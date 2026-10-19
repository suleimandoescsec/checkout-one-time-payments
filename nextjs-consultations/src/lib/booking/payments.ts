import "server-only";
import Stripe from "stripe";
import { bookingHosts, priceFor, publicBookingOrigin, publicBookingPath, type HostId } from "./config";
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
  const pricesReady=(["suleiman","saif"] as const).every(host=>([30,60] as const).every(duration=>/^price_[a-zA-Z0-9]+$/.test(configuredPriceId(host,duration))));
  return !!(key && validMode && pricesReady && process.env.BOOKING_STRIPE_ACCOUNT_ID && process.env.BOOKING_STRIPE_WEBHOOK_SECRET && process.env.BOOKING_RESEND_KEY && process.env.BOOKING_DATABASE_URL && process.env.BOOKING_SIGNING_SECRET);
}

function configuredPriceId(host: HostId, duration: 30 | 60) {
  return process.env[`BOOKING_STRIPE_${host.toUpperCase()}_${duration}_PRICE_ID`] || "";
}

let verifiedUntil=0;
export async function assertMerchant() {
  if(Date.now()<verifiedUntil)return;
  const account=await stripeClient().accounts.retrieveCurrent();
  if(account.id!==process.env.BOOKING_STRIPE_ACCOUNT_ID || !account.charges_enabled)throw new Error("The booking Stripe account is not ready");
  verifiedUntil=Date.now()+300000;
}

const verifiedPrices=new Map<string,number>();
export async function assertCheckoutConfiguration(host: HostId, duration: 30 | 60) {
  const id=configuredPriceId(host,duration);
  if(!/^price_[a-zA-Z0-9]+$/.test(id))throw new Error("Booking price is not configured");
  const cacheKey=`${host}:${duration}:${id}`;
  await Promise.all([assertMerchant(),(async()=>{
    if(Date.now()<(verifiedPrices.get(cacheKey)||0))return;
    const price=await stripeClient().prices.retrieve(id);
    if(!price.active || price.type!=="one_time" || price.currency!=="usd" || price.unit_amount!==priceFor(duration) || price.metadata.host!==host || price.metadata.duration!==String(duration) || (process.env.NODE_ENV==="production"&&!price.livemode))throw new Error("Booking price does not match the session");
    verifiedPrices.set(cacheKey,Date.now()+300000);
  })()]);
  return id;
}

// Adapted from stripe-samples/checkout-one-time-payments (MIT); see THIRD_PARTY_NOTICES.md.
export async function checkout(row: Reservation) {
  const price=await assertCheckoutConfiguration(row.host_id,row.duration);
  const token = bookingToken(row.id);
  const when=new Intl.DateTimeFormat(row.locale,{timeZone:row.time_zone,dateStyle:"full",timeStyle:"short"}).format(new Date(row.starts_at));
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: row.email,
    client_reference_id: row.id,
    integration_identifier: "personal-booking-qwertyui",
    line_items: [{ quantity: 1, price }],
    metadata: { integration: "personal_booking_v1", reservation_id: row.id, host: row.host_id },
    payment_intent_data: { metadata: { integration: "personal_booking_v1", reservation_id: row.id, host: row.host_id } },
    expires_at: Math.floor(new Date(row.expires_at).getTime() / 1000),
    success_url: `${publicBookingOrigin(row.host_id)}/book/confirmed?id=${row.id}&token=${token}`,
    cancel_url: `${publicBookingOrigin(row.host_id)}${publicBookingPath(row.host_id, row.locale)}?cancelled=1`,
    custom_text: { submit: { message: row.locale==="ar" ? `جلسة مع ${bookingHosts[row.host_id].name}: ${when} (${row.time_zone}). يتم تأكيد الموعد بعد نجاح الدفع. للتغيير أو الإلغاء، رد على رسالة التأكيد.` : `Call with ${bookingHosts[row.host_id].name}: ${when} (${row.time_zone}). Your time is confirmed after successful payment. For changes or cancellation, reply to your confirmation email.` } },
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
