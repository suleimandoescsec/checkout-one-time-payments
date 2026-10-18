import "server-only";
import Stripe from "stripe";
import { bookingHosts, publicBookingOrigin, publicBookingPath } from "./config";
import { sql, reservation, type Reservation } from "./db";
import { bookingToken } from "./security";
import { sendConfirmation } from "./email";

export function stripeClient() {
  const key = process.env.BOOKING_STRIPE_KEY;
  if (!key) throw new Error("Booking payments are not configured");
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia", maxNetworkRetries: 2, appInfo: { name: "Personal Consultations", version: "1.0.0", url: "https://github.com/suleimandoescsec/checkout-one-time-payments" } });
}
export function ready() {
  const key=process.env.BOOKING_STRIPE_KEY || "";
  const validMode=process.env.NODE_ENV !== "production" || /^(sk|rk)_live_/.test(key);
  return !!(key && validMode && process.env.BOOKING_STRIPE_ACCOUNT_ID && process.env.BOOKING_STRIPE_WEBHOOK_SECRET && process.env.BOOKING_RESEND_KEY && process.env.BOOKING_DATABASE_URL && process.env.BOOKING_SIGNING_SECRET);
}

let verifiedUntil=0;
export async function assertMerchant() {
  if(Date.now()<verifiedUntil)return;
  const account=await stripeClient().accounts.retrieveCurrent();
  if(account.id!==process.env.BOOKING_STRIPE_ACCOUNT_ID || !account.charges_enabled)throw new Error("The booking Stripe account is not ready");
  verifiedUntil=Date.now()+300000;
}

// Adapted from stripe-samples/checkout-one-time-payments (MIT); see THIRD_PARTY_NOTICES.md.
export async function checkout(row: Reservation) {
  await assertMerchant();
  const token = bookingToken(row.id);
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: row.email,
    client_reference_id: row.id,
    integration_identifier: "personal-booking-qwertyui",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: row.amount, product_data: { name: `${row.duration}-minute consultation with ${bookingHosts[row.host_id].name}`, description: `${new Date(row.starts_at).toISOString()} · ${row.topic}` } } }],
    metadata: { integration: "personal_booking_v1", reservation_id: row.id, host: row.host_id },
    payment_intent_data: { metadata: { integration: "personal_booking_v1", reservation_id: row.id, host: row.host_id } },
    expires_at: Math.floor(new Date(row.expires_at).getTime() / 1000),
    success_url: `${publicBookingOrigin(row.host_id)}/book/confirmed?id=${row.id}&token=${token}`,
    cancel_url: `${publicBookingOrigin(row.host_id)}${publicBookingPath(row.host_id, row.locale)}?cancelled=1`,
    custom_text: { submit: { message: "Your time is confirmed after successful payment. To change or cancel, reply to your confirmation email." } },
  }, { idempotencyKey: `booking-checkout-${row.id}` });
  await sql()`UPDATE personal_booking.reservations SET stripe_session_id=${session.id} WHERE id=${row.id}::uuid AND (stripe_session_id IS NULL OR stripe_session_id=${session.id})`;
  if (!session.url) throw new Error("Checkout is unavailable");
  return session.url;
}

export async function processSession(session: Stripe.Checkout.Session, kind: string) {
  if (session.metadata?.integration !== "personal_booking_v1") return;
  const id = session.metadata.reservation_id;
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Missing reservation reference");
  const row = await reservation(id);
  if (!row || session.client_reference_id !== id || (row.stripe_session_id && row.stripe_session_id !== session.id) || session.metadata.host !== row.host_id || session.currency !== "usd" || session.amount_total !== row.amount) throw new Error("Payment does not match reservation");
  const db = sql();
  if (session.payment_status === "paid") {
    // The database function locks the host and refuses conflicting late payments.
    await db`SELECT personal_booking.confirm_reservation(${id}::uuid, ${session.id})`;
    const confirmed = await reservation(id);
    if (confirmed && (confirmed.status === "confirmed" || confirmed.status === "payment_conflict")) await sendConfirmation(confirmed);
  } else if (kind === "checkout.session.async_payment_failed" || session.status === "expired") {
    await db`UPDATE personal_booking.reservations SET status='expired', stripe_session_id=${session.id} WHERE id=${id}::uuid AND status IN ('holding','processing') AND paid_at IS NULL`;
  } else if (session.status === "complete") {
    await db`UPDATE personal_booking.reservations SET status='processing', stripe_session_id=${session.id} WHERE id=${id}::uuid AND status='holding'`;
  }
}

export async function reconcile(host: string) {
  const rows = await sql()`SELECT * FROM personal_booking.reservations WHERE host_id=${host} AND status IN ('holding','processing') AND expires_at < now() ORDER BY created_at LIMIT 8`;
  for (const row of rows) {
    let sessionId = row.stripe_session_id as string | null;
    if (!sessionId) {
      // Recover a response lost between Stripe creation and our database write.
      // Retrying identical parameters with the same idempotency key returns the original session.
      try { await checkout(row as Reservation); sessionId = (await reservation(row.id))?.stripe_session_id || null; }
      catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.param === "expires_at") {
          await sql()`UPDATE personal_booking.reservations SET status='expired' WHERE id=${row.id}::uuid AND stripe_session_id IS NULL AND status='holding' AND paid_at IS NULL`;
          continue;
        }
        throw error;
      }
    }
    if (!sessionId) continue;
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    // Never release inventory using only a local timer; Stripe must confirm expiration.
    await processSession(session, "reconcile");
  }
  const unsent = await sql()`SELECT * FROM personal_booking.reservations WHERE host_id=${host} AND status IN ('confirmed','payment_conflict') AND notified_at IS NULL ORDER BY created_at LIMIT 3`;
  for (const row of unsent) await sendConfirmation(row as Reservation);
}
