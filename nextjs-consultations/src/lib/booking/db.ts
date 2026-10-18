import "server-only";
import { neon } from "@neondatabase/serverless";
import type { BookingSettings, HostId } from "./config";

export function sql() {
  const url = process.env.BOOKING_DATABASE_URL;
  if (!url) throw new Error("Booking database is not configured");
  return neon(url);
}

export type Reservation = {
  id: string; host_id: HostId; starts_at: string; ends_at: string; busy_until: string;
  duration: 30 | 60; amount: number; name: string; email: string; topic: string; notes: string;
  time_zone: string; locale: "en" | "ar"; status: string; stripe_session_id: string | null;
  expires_at: string; paid_at: string | null; created_at: string; notified_at: string | null;
};

export async function hostRecord(host: HostId) {
  const rows = await sql()`SELECT id, enabled, settings FROM personal_booking.hosts WHERE id=${host}`;
  if (!rows.length) throw new Error("Host is not configured");
  return rows[0] as { id: HostId; enabled: boolean; settings: BookingSettings };
}

export async function reservation(id: string) {
  const rows = await sql()`SELECT * FROM personal_booking.reservations WHERE id=${id}::uuid`;
  return (rows[0] || null) as Reservation | null;
}

export async function occupied(host: HostId) {
  const db = sql();
  const [bookings, blocks] = await Promise.all([
    db`SELECT starts_at, busy_until AS ends_at FROM personal_booking.reservations WHERE host_id=${host} AND status IN ('holding','processing','confirmed') AND busy_until > now()`,
    db`SELECT starts_at, ends_at FROM personal_booking.blocks WHERE host_id=${host} AND ends_at > now()`,
  ]);
  return [...bookings, ...blocks].map(r => ({ start: new Date(r.starts_at).getTime(), end: new Date(r.ends_at).getTime() }));
}
