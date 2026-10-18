import { NextResponse } from "next/server";
import { candidateSlots, defaultSettings, isHost } from "@/lib/booking/config";
import { hostRecord, occupied } from "@/lib/booking/db";
import { ready, reconcile } from "@/lib/booking/payments";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const host = params.get("host");
  const duration = Number(params.get("duration"));
  if (!isHost(host) || (duration !== 30 && duration !== 60)) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  if (process.env.NODE_ENV === "development" && process.env.BOOKING_PREVIEW === "1") return NextResponse.json({ slots: candidateSlots(defaultSettings,duration),paused:false,preview:true });
  if (!ready()) return NextResponse.json({ slots: [], paused: true }, { headers: { "Cache-Control": "no-store" } });
  try {
    const row = await hostRecord(host);
    if (!row.enabled) return NextResponse.json({ slots: [], paused: true });
    await reconcile(host);
    const busy = await occupied(host);
    const slots = candidateSlots(row.settings, duration).filter(value => {
      const start = new Date(value).getTime();
      const end = start + (duration + row.settings.bufferMinutes) * 60000;
      return !busy.some(b => b.start < end && b.end > start);
    });
    return NextResponse.json({ slots, paused: false }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "We couldn't load times. Please try again." }, { status: 503 }); }
}
