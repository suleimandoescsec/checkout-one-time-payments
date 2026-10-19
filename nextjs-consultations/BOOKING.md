# Personal booking deployment

Implementation source: `src/lib/booking`, `src/app/api/booking`, native booking components.
MIT payment base: https://github.com/suleimandoescsec/checkout-one-time-payments/tree/main/nextjs-consultations.

## Public pages

- Suleiman: `/book/en`, `/book/ar`.
- Saif: `https://links.saifjamal.tech/book/en` and `/book/ar`, proxied to this app's host-specific route.
- Dashboard: `/book/admin`. Separate access keys open separate host records.
- Payment return: `/book/confirmed`, private signed link, noindex and no-referrer.

## Configuration

Required: `BOOKING_DATABASE_URL`, `BOOKING_SIGNING_SECRET`, `BOOKING_ADMIN_KEY`,
`SAIF_BOOKING_ADMIN_KEY`, `BOOKING_STRIPE_KEY`, `BOOKING_STRIPE_WEBHOOK_SECRET`,
`BOOKING_RESEND_KEY`, `BOOKING_SITE_URL`.

The booking schema is separate from Support Circle's tables. Slots are reserved under
a database host-row lock, so 30/60-minute purchases cannot overlap. Stripe must report
an expired checkout before its held slot is released. A paid slot stays reserved even
if the confirmation email temporarily fails. Use a Stripe restricted key for the server.

User requested every day from 5 AM until 2 AM next day, Asia/Dubai. The default is
24 hours' notice, zero buffer, a 30-day window. Visitors see their own time zone.
Both hosts start paused until credentials are configured. Change hours in the dashboard.

## Add the Stripe key locally

In the existing InstantReply Stripe account, open API keys in live mode and create a
restricted key for personal bookings. Allow Checkout Sessions read/write,
Prices read, and current Account read. Keep other permissions disabled. The app
reuses the four prices created by the Stripe plugin; it does not create products
or prices at checkout. Merchant, active one-time USD amount and host/duration
metadata are validated before a slot is held.
Append `BOOKING_STRIPE_KEY=...` to the ignored `.env.local` file in this checkout.
The key is server-only; never use a `NEXT_PUBLIC_` prefix or commit it.
The private publishing helper reads it through stdin and saves it to Vercel Production
as a sensitive environment variable. Redeploy, verify the expected merchant and enable
the host's availability before accepting bookings.

Webhook destination: `https://suleimanalnsour.me/api/booking/webhook`.
Events: checkout.session.completed, checkout.session.async_payment_succeeded,
checkout.session.async_payment_failed, checkout.session.expired.

## Current limits

External calendar busy-time syncing is not configured. Block outside commitments manually.
Hosts email the meeting link before the call. Guests reply to confirmations for changes
or cancellations; hosts handle refunds in Stripe. No recurring scheduler purchase is used.
# Stripe plugin payment links, 18 October 2026

The Stripe plugin created four live one-time prices and four payment links for
Suleiman and Saif: USD 100 / 30 minutes and USD 200 / 60 minutes. Their twelve
public ID/URL references are stored in Vercel Production and the ignored local
`.env.booking-links.local`. These references are not reusable API credentials.

The links are staged inactive until the booking flow is connected. Their return
behavior uses Stripe's hosted confirmation rather than a nonexistent site URL.
They do not activate the existing native scheduler. On 19 October 2026 the owner
confirmed the required order: select an available time, pay, then receive booking
confirmation. Keep that order. The scheduler uses a reservation-specific Checkout
Session with the same 35-minute expiry as its hold. The existing scheduler still
requires its restricted server credential and host activation. Never treat a
browser return or a public Checkout Session ID as proof of payment.

