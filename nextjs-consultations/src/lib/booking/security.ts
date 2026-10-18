import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { bookingHosts, isHost, type HostId } from "./config";

function secret() { const value = process.env.BOOKING_SIGNING_SECRET; if (!value) throw new Error("Booking signing key is not configured"); return value; }
export function bookingToken(id: string) { return createHmac("sha256", secret()).update(`reservation:${id}`).digest("hex"); }
export function safeEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export function validBookingToken(id: string, token: string) { return safeEqual(bookingToken(id), token); }
export function adminSession(host: HostId, expires: number) {
  const body = `${host}:${expires}`;
  return `${body}:${createHmac("sha256", secret()).update(`admin:${body}`).digest("hex")}`;
}
export function authenticatedHost(cookie?: string): HostId | null {
  if (!cookie) return null;
  const [host, stamp] = cookie.split(":");
  const expires = Number(stamp);
  if (!isHost(host) || !Number.isFinite(expires) || expires < Date.now()) return null;
  return safeEqual(adminSession(host, expires), cookie) ? host : null;
}
export function validAdminKey(host: HostId, key: string) {
  const expected = process.env[bookingHosts[host].adminKeyEnv];
  return !!expected && key.length >= 20 && safeEqual(expected, key);
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const current = new URL(request.url).origin;
  const allowed = [current, process.env.BOOKING_SITE_URL || "https://suleimanalnsour.me", "https://links.saifjamal.tech"];
  if (!origin || !allowed.includes(origin)) throw new Error("Invalid request origin");
}

export function ipHash(request: Request) {
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0] || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  return createHmac("sha256", secret()).update(ip.trim()).digest("hex");
}
