import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bookingHosts, isHost } from "@/lib/booking/config";
import { hostRecord, sql } from "@/lib/booking/db";
import { adminSession, assertOrigin, authenticatedHost, ipHash, validAdminKey } from "@/lib/booking/security";
import { assertCheckoutConfiguration, ready, reconcile } from "@/lib/booking/payments";
const cookieName = "personal_booking_admin";
const settingsSchema = z.object({ timeZone: z.string().min(1).max(80), days: z.array(z.number().int().min(0).max(6)).min(1).max(7), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(47), noticeHours: z.number().int().min(1).max(168), bufferMinutes: z.number().int().min(0).max(120), horizonDays: z.number().int().min(7).max(60) }).refine(s => s.endHour > s.startHour && s.endHour - s.startHour <= 24);
async function hostSession() { return authenticatedHost((await cookies()).get(cookieName)?.value); }
export async function GET() {
  const host = await hostSession();
  if (!host) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  let paymentsReady=ready();
  let paymentError="";
  if (paymentsReady) {
    try { await Promise.all([assertCheckoutConfiguration(host,30),assertCheckoutConfiguration(host,60)]); await reconcile(host); }
    catch { paymentsReady=false; paymentError="Couldn't verify payment setup. Check the live Stripe key, Checkout Sessions read/write, Prices read, Account read, configured price IDs and email configuration."; }
  }
  const db = sql();
  const [record, bookings, blocks] = await Promise.all([hostRecord(host), db`SELECT id,name,email,topic,notes,starts_at,ends_at,status,amount,paid_at,stripe_session_id,created_at FROM personal_booking.reservations WHERE host_id=${host} ORDER BY starts_at DESC LIMIT 200`, db`SELECT id,starts_at,ends_at FROM personal_booking.blocks WHERE host_id=${host} AND ends_at>now() ORDER BY starts_at`]);
  return NextResponse.json({ host, name: bookingHosts[host].name, enabled: record.enabled, settings: record.settings, bookings, blocks, ready: paymentsReady, paymentError }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  try { assertOrigin(request); } catch { return new NextResponse("Invalid origin", { status: 403 }); }
  const data = await request.json().catch(()=>null);
  if (!data || typeof data.action !== "string") return new NextResponse("Invalid request", { status: 400 });
  if (data.action === "login") {
    if (!isHost(data.host) || typeof data.key !== "string" || data.key.length > 200) return new NextResponse("Invalid login", { status: 400 });
    const key = `login:${ipHash(request)}:${Math.floor(Date.now()/900000)}`;
    const hits = await sql()`INSERT INTO personal_booking.rate_limits(key,hits,expires_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET hits=personal_booking.rate_limits.hits+1 RETURNING hits`;
    if (hits[0].hits > 8) return NextResponse.json({ error: "Too many attempts. Try in 15 minutes." }, { status: 429 });
    if (!validAdminKey(data.host, data.key)) return NextResponse.json({ error: "Incorrect access key" }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, adminSession(data.host,Date.now()+12*3600000), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 12*3600 });
    return response;
  }
  const host = await hostSession();
  if (!host) return new NextResponse("Sign in first", { status: 401 });
  if (data.action === "logout") { const response=NextResponse.json({ ok:true }); response.cookies.delete(cookieName); return response; }
  if (data.action === "settings") {
    const parsed = settingsSchema.safeParse(data.settings);
    if (!parsed.success || typeof data.enabled !== "boolean") return NextResponse.json({ error: "Check your hours and settings" }, { status: 400 });
    try { new Intl.DateTimeFormat("en", { timeZone: parsed.data.timeZone }).format(); } catch { return new NextResponse("Invalid time zone", { status: 400 }); }
    if (data.enabled && !ready()) return NextResponse.json({ error: "Add the Stripe key, webhook secret and email key before enabling payments." }, { status: 409 });
    if (data.enabled) { try { await Promise.all([assertCheckoutConfiguration(host,30),assertCheckoutConfiguration(host,60)]); } catch { return NextResponse.json({ error: "Check the live Stripe key and both consultation prices. The key needs Checkout Sessions read/write, Prices read and Account read." }, { status: 409 }); } }
    await sql()`UPDATE personal_booking.hosts SET enabled=${data.enabled},settings=${JSON.stringify(parsed.data)}::jsonb,updated_at=now() WHERE id=${host}`;
  } else if (data.action === "block") {
    const parsed = z.object({ start:z.iso.datetime(),end:z.iso.datetime() }).safeParse(data);
    if (!parsed.success || parsed.data.end <= parsed.data.start) return new NextResponse("Invalid dates", { status: 400 });
    try { await sql()`SELECT personal_booking.add_block(${randomUUID()}::uuid,${host},${parsed.data.start}::timestamptz,${parsed.data.end}::timestamptz)`; }
    catch { return NextResponse.json({ error: "This overlaps an existing reservation. Contact the guest first." }, { status: 409 }); }
  } else if (data.action === "unblock") {
    if (!z.uuid().safeParse(data.id).success) return new NextResponse("Invalid block", { status:400 });
    await sql()`DELETE FROM personal_booking.blocks WHERE id=${data.id}::uuid AND host_id=${host}`;
  } else return new NextResponse("Unknown action", { status: 400 });
  return NextResponse.json({ ok:true });
}
