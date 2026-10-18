import { NextResponse } from "next/server";
import { processSession, stripeClient } from "@/lib/booking/payments";
import type Stripe from "stripe";
export async function POST(request: Request) {
  const secret = process.env.BOOKING_STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new NextResponse("Webhook unavailable", { status: 400 });
  let event: Stripe.Event;
  try { event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return new NextResponse("Invalid signature", { status: 400 }); }
  if (process.env.NODE_ENV === "production" && !event.livemode) return new NextResponse("Live events required", { status: 400 });
  if (!["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired"].includes(event.type)) return NextResponse.json({ received: true });
  try { await processSession(event.data.object as Stripe.Checkout.Session, event.type); return NextResponse.json({ received: true }); }
  catch (error) { console.error("Booking webhook failed", error instanceof Error ? error.name : "Unknown error"); return new NextResponse("Please retry", { status: 500 }); }
}
