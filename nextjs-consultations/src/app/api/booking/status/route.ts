import { NextResponse } from "next/server";
import { bookingHosts } from "@/lib/booking/config";
import { reservation } from "@/lib/booking/db";
import { validBookingToken } from "@/lib/booking/security";
import { calendarFile } from "@/lib/booking/email";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  if (!/^[a-f0-9-]{36}$/.test(id) || !validBookingToken(id, params.get("token") || "")) return new NextResponse("Not found", { status: 404 });
  const row = await reservation(id);
  if (!row) return new NextResponse("Not found", { status: 404 });
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (params.get("calendar") === "1" && row.status === "confirmed") return new NextResponse(calendarFile(row), { headers: { ...headers, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="consultation.ics"' } });
  return NextResponse.json({ status: row.status, host: bookingHosts[row.host_id].name, contact: bookingHosts[row.host_id].email, startsAt: row.starts_at, duration: row.duration, amount: row.amount, timeZone: row.time_zone, locale: row.locale }, { headers });
}
