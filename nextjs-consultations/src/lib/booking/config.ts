export type HostId = "suleiman" | "saif";
export type BookingSettings = {
  timeZone: string;
  days: number[];
  startHour: number;
  endHour: number;
  noticeHours: number;
  bufferMinutes: number;
  horizonDays: number;
};

export const bookingHosts = {
  suleiman: { name: "Suleiman Alnsour", firstName: "Suleiman", email: "suleiman@instantreply.co", back: "/links/en", adminKeyEnv: "BOOKING_ADMIN_KEY", topics: ["Building with AI", "Business", "Marketing"] },
  saif: { name: "Saif Jamal", firstName: "Saif", email: "saiffarroukh@gmail.com", back: "https://links.saifjamal.tech/", adminKeyEnv: "SAIF_BOOKING_ADMIN_KEY", topics: ["Building with AI", "Web development", "Your project"] },
} as const;

// Hosts review and enable their own hours in the private dashboard before sales open.
export const defaultSettings: BookingSettings = { timeZone: "Asia/Dubai", days: [0, 1, 2, 3, 4, 5, 6], startHour: 5, endHour: 26, noticeHours: 24, bufferMinutes: 0, horizonDays: 30 };
export const bookingOrigin = process.env.BOOKING_SITE_URL || "https://suleimanalnsour.me";
export function publicBookingOrigin(host: HostId) { return host === "saif" ? "https://links.saifjamal.tech" : bookingOrigin; }
export function publicBookingPath(host: HostId, locale = "en") { return host === "saif" ? `/book/${locale}` : bookingPath(host, locale); }
export function isHost(value: unknown): value is HostId { return value === "suleiman" || value === "saif"; }
export function priceFor(duration: 30 | 60) { return duration === 30 ? 10000 : 20000; }
export function bookingPath(host: HostId, locale = "en") { return host === "suleiman" ? `/book/${locale}` : `/book/saif/${locale}`; }

const formatters = new Map<string, Intl.DateTimeFormat>();
export function localParts(date: Date, timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) { formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }); formatters.set(timeZone, formatter); }
  const parts = formatter.formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === key)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
}

export function candidateSlots(settings: BookingSettings, duration: 30 | 60, now = new Date()) {
  const slots: string[] = [];
  const earliest = now.getTime() + settings.noticeHours * 3600000;
  const latest = now.getTime() + settings.horizonDays * 86400000;
  // Iterate UTC instants, then evaluate host-local hours. DST gaps/overlaps stay correct.
  for (let stamp = Math.ceil(earliest / 1800000) * 1800000; stamp <= latest; stamp += 1800000) {
    const start = new Date(stamp);
    const p = localParts(start, settings.timeZone);
    const inside = (instant: number) => {
      const point = localParts(new Date(instant), settings.timeZone);
      const overnight = settings.endHour > 24 && point.hour < settings.endHour - 24;
      const minute = point.hour * 60 + point.minute + (overnight ? 1440 : 0);
      const weekday = overnight ? (point.weekday + 6) % 7 : point.weekday;
      return settings.days.includes(weekday) && minute >= settings.startHour * 60 && minute < settings.endHour * 60;
    };
    if (p.minute % 30 === 0 && Array.from({ length: duration / 15 }, (_, i) => stamp + i * 900000).every(inside)) slots.push(start.toISOString());
  }
  return slots;
}
