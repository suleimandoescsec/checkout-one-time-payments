# Self-hosted consultations

An added Next.js scheduling example based on Stripe's MIT one-time Checkout sample.
No Calendly or scheduler subscription. Hosting/database/email quotas and Stripe
processing fees still apply.

## Included

- Separate English and Arabic screens, local time-zone detection and manual override.
- 30-minute/$100 and 60-minute/$200 sessions; server-enforced amounts.
- Shared availability per host, overlapping reservation protection, and temporary holds.
- Hosted Stripe Checkout; signed webhooks confirm paid bookings.
- Delayed payment, failure and expiration handling; idempotent Checkout requests.
- Replyable Resend confirmations to guest and host, with calendar attachments.
- Private, host-scoped dashboard for hours, date blocks and reservations.
- Honeypot, booking attempt limits, login rate limits, signed booking links and HTTP-only admin cookies.

## Run

1. Use Node 22 or later. Run `npm install` in this directory.
2. Copy `.env.example` to `.env.local`. Set a PostgreSQL/Neon connection string,
   a Stripe restricted server key, a Resend sending key and random private signing/admin keys.
3. Customize the hosts, contact details, prices, public domains and hours in
   `src/lib/booking/config.ts`. Update the SQL price constraints together with prices.
4. Apply `scripts/booking-schema.sql` to the database. It creates an isolated
   `personal_booking` schema; it does not modify other application tables.
5. Register `/api/booking/webhook` with Stripe for `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   and `checkout.session.expired`. Save the signing secret in the environment.
6. Configure a verified email sender. This deployment uses `team@suleimanalnsour.me`;
   change the sender in `src/lib/booking/email.ts` for your own domain.
7. Run `npm run dev`, then sign in at `/book/admin` and review the hours. Bookings
   remain paused until the host enables them and required credentials exist.
8. Deploy with the same environment variables. Use a separate Stripe sandbox for
   payment development, then configure the intended live account before accepting payments.

The return page only reads reservation status. It never treats a URL redirect as proof
of payment. Confirmation is driven by signed Stripe events (or authenticated Stripe
session reconciliation). Holds are not released solely because a local timer expired.

## Operational limits

- External calendar busy-time sync is not configured. Hosts must block commitments
  made elsewhere in the dashboard. This system prevents overlapping bookings made here.
- Hosts send their meeting/video link before the call. No video platform is provisioned.
- Cancellation/rescheduling/refund requests are handled by replying to the host.
  Refunds are managed through Stripe; there is no automatic refund or self-service reschedule UI.
- A late payment for a conflicting/past slot is flagged for the host, not confirmed.
- Email retries use Resend idempotency keys. Stripe retries failed webhooks, and later
  availability/dashboard requests retry unsent confirmations.
- No background reminder service or free-tier capacity guarantee is included.

See `THIRD_PARTY_NOTICES.md` and the repository MIT license for attribution.
