import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { candidateSlots } from "@/lib/booking/config";
import { hostRecord, reservation, sql } from "@/lib/booking/db";
import { assertOrigin, ipHash } from "@/lib/booking/security";
import { checkout, ready, reconcile } from "@/lib/booking/payments";
const schema = z.object({ host: z.enum(["suleiman","saif"]), duration: z.union([z.literal(30),z.literal(60)]), start: z.iso.datetime(), name: z.string().trim().min(2).max(100), email: z.email().max(254).transform(s=>s.toLowerCase()), topic: z.string().trim().min(2).max(100), notes: z.string().trim().max(1500), timeZone: z.string().max(80), locale: z.enum(["en","ar"]), agreed: z.literal(true), website: z.string().max(0) });
export async function POST(request: Request) {
  try { assertOrigin(request); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 403 }); }
  if (!ready()) return NextResponse.json({ error: "Online booking is being set up. Please try again shortly." }, { status: 503 });
  if (Number(request.headers.get("content-length")) > 12000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const parsed = schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error: "Check your name, email and selected time." }, { status: 400 });
  const data = parsed.data;
  try { new Intl.DateTimeFormat("en", { timeZone: data.timeZone }).format(); } catch { return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 }); }
  try {
    const host = await hostRecord(data.host);
    if (!host.enabled) return NextResponse.json({ error: "Bookings are currently paused." }, { status: 409 });
    await reconcile(data.host);
    if (!candidateSlots(host.settings, data.duration).includes(new Date(data.start).toISOString())) return NextResponse.json({ error: "That time is no longer available. Please choose another." }, { status: 409 });
    const id = randomUUID();
    await sql()`SELECT personal_booking.reserve_slot(${id}::uuid,${data.host},${data.start}::timestamptz,${data.duration},${data.name},${data.email},${data.topic},${data.notes},${data.timeZone},${data.locale},${ipHash(request)})`;
    const row = await reservation(id);
    if (!row) throw new Error("Reservation failed");
    const url = await checkout(row);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("BOOKING_RATE_LIMIT")) return NextResponse.json({ error: "Too many booking attempts. Please wait before trying again." }, { status: 429 });
    if (message.includes("BOOKING_SLOT_TAKEN")) return NextResponse.json({ error: "Someone just selected that time. Please choose another." }, { status: 409 });
    console.error("Booking checkout failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "We couldn't open checkout. No payment was taken. Please contact your host before retrying." }, { status: 503 });
  }
}
