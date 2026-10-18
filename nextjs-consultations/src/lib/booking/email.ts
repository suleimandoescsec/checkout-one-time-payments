import "server-only";
import { bookingHosts, bookingOrigin, publicBookingOrigin } from "./config";
import { sql, type Reservation } from "./db";
import { bookingToken } from "./security";

function escape(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
function icsText(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function stamp(value: string) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }

export function calendarFile(row: Reservation) {
  const host = bookingHosts[row.host_id];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//InstantReply//Personal Consultations//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:${row.id}@suleimanalnsour.me`, `DTSTAMP:${stamp(row.created_at)}`, `DTSTART:${stamp(row.starts_at)}`, `DTEND:${stamp(row.ends_at)}`, `SUMMARY:${icsText(`Consultation with ${host.name}`)}`, `DESCRIPTION:${icsText(`${row.topic}\n${row.notes}\nYour host will email the meeting link. Questions or changes: ${host.email}`)}`, `ORGANIZER;CN=${host.name}:mailto:${host.email}`, "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR"];
  return lines.map(line=>{
    const folded:string[]=[];let current="";
    for(const character of line){if(Buffer.byteLength(current+character,"utf8")>74){folded.push(current);current=" ";}current+=character;}
    folded.push(current);return folded.join("\r\n");
  }).join("\r\n") + "\r\n";
}

async function send(to: string, subject: string, html: string, key: string, row: Reservation, attachment = false, replyTo?: string) {
  const host = bookingHosts[row.host_id];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.BOOKING_RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from: `${host.name} <team@suleimanalnsour.me>`, reply_to: replyTo || host.email, to: [to], subject, html, ...(attachment ? { attachments: [{ filename: "consultation.ics", content: Buffer.from(calendarFile(row)).toString("base64") }] } : {}) }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Confirmation email delivery failed (${response.status})`);
}

export async function sendConfirmation(row: Reservation) {
  if (row.notified_at) return;
  if (!process.env.BOOKING_RESEND_KEY) throw new Error("Booking email is not configured");
  const host = bookingHosts[row.host_id];
  const when = new Intl.DateTimeFormat("en", { timeZone: row.time_zone, dateStyle: "full", timeStyle: "short" }).format(new Date(row.starts_at));
  const statusUrl = `${publicBookingOrigin(row.host_id)}/book/confirmed?id=${row.id}&token=${bookingToken(row.id)}`;
  const conflict = row.status === "payment_conflict";
  const shell = (body: string) => `<div style="font-family:Arial,sans-serif;max-width:540px;margin:32px auto;color:#171819;line-height:1.65"><p style="font-size:12px;color:#666">${escape(host.name)} · 1:1</p>${body}<p>Talk soon,<br>${escape(host.firstName)}</p><hr style="border:0;border-top:1px solid #ddd"><p style="font-size:12px;color:#666">You can reply directly to this email.</p></div>`;
  const detail = `<p><strong>${escape(when)} (${escape(row.time_zone)})</strong><br>${row.duration} minutes · $${row.amount / 100} USD<br>${escape(row.topic)}</p>`;
  await send(row.email, conflict ? "Payment received. We need to arrange your time." : `You're booked with ${host.firstName}`, shell(`<h1 style="font-size:28px">Hi ${escape(row.name)},</h1>${conflict ? `<p>Your payment came through, but this time is no longer available. I'm sorry about that. I'll contact you to arrange another time or a refund. Your call isn't confirmed yet.</p>` : `<p>Thanks for booking some time with me. Your payment is received and your call is confirmed.</p>${detail}<p>I'll email your meeting link before we meet. Bring your questions and anything you'd like us to look at together.</p><p><a href="${statusUrl}">View your booking and add it to your calendar</a></p>`}`), `booking-${row.id}-${conflict ? "conflict" : "confirmed"}-guest`, row, !conflict);
  await send(host.email, conflict ? `Action needed: booking payment conflict` : `New paid consultation: ${row.name}`, shell(`<p>${escape(row.name)} (${escape(row.email)}) paid $${row.amount / 100} USD.</p>${detail}<p>${escape(row.notes)}</p>${conflict ? "<p>This time conflicts with another booking. Contact the guest and arrange a new time or refund through Stripe.</p>" : "<p>Send the guest your meeting link before the call. Reply to this email to contact them directly.</p>"}<p><a href="${bookingOrigin}/book/admin">Open the booking dashboard</a></p>`), `booking-${row.id}-${conflict ? "conflict" : "confirmed"}-host`, row, !conflict, row.email);
  await sql()`UPDATE personal_booking.reservations SET notified_at=now() WHERE id=${row.id}::uuid`;
}
