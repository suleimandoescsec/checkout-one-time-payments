"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Globe2, LockKeyhole, Video } from "lucide-react";
import { bookingHosts, type HostId } from "@/lib/booking/config";

const copy = {
  en: {
    back: "All links", portfolio: "My portfolio", language: "العربية", consultation: "A 1:1 consultation",
    title: "Let’s work on it.", intro: "Bring your idea or the thing you’re stuck on. We’ll work out your next step together.",
    session: "Choose your session", topic: "What’s on your mind?", min: "min", focused: "One problem. A practical plan.", deep: "Work on your project together.",
    next: "Find a time", times: "Choose a time", local: "Your time zone is detected automatically. You can change it below.", date: "Choose a day", time: "Available times", zone: "Your time zone",
    details: "Your details", name: "Your name", email: "Email address", notes: "Anything you’d like me to know?", optional: "Optional. A link or a few sentences is plenty.",
    summary: "Your session", pay: "Continue to payment", paying: "Opening checkout…", payment: "Secure checkout with Stripe. Confirmed after payment.",
    terms: "I understand this is a paid consultation. I can reply to my confirmation email to request a change or cancellation.",
    noTimes: "Booking opens soon.", noTimesText: "You can email me in the meantime and we’ll find a time together.", empty: "No times available in this month. Try the next one.",
    fullyBooked: "No times available right now.", fullyBookedText: "Please email me and we’ll work out a time.", retry: "Try again", error: "We couldn’t load the times. Please try again.",
    checkoutError: "We couldn’t open checkout. No payment was taken. Please try again or email me.", conflict: "That time has just become unavailable. Please choose another.",
    change: "Change", continue: "Continue", online: "Online video call", support: "Have a question?", how: "How booking works", steps: ["Session", "Time", "Details"],
    howText: "Choose a session and a time, then pay to confirm. You’ll receive a confirmation email and calendar invite. I’ll send the meeting link before our call. For changes or cancellations, reply to the confirmation email.",
  },
  ar: {
    back: "كل الروابط", portfolio: "أعمالي", language: "English", consultation: "استشارة فردية",
    title: "نحلّها معًا.", intro: "فكرة، مشروع، أو مشكلة توقفت عندها. نناقشها معًا ونحدد خطوتك التالية.",
    session: "اختر مدة الجلسة", topic: "بماذا تفكّر؟", min: "دقيقة", focused: "مشكلة محددة وخطة عملية.", deep: "وقت أوسع للمراجعة أو البناء والعمل معًا.",
    next: "اختر موعدًا", times: "اختر موعدك", local: "نعرض المواعيد حسب منطقتك الزمنية تلقائيًا. يمكنك تغييرها أدناه.", date: "اختر اليوم", time: "المواعيد المتاحة", zone: "منطقتك الزمنية",
    details: "بياناتك", name: "اسمك", email: "بريدك الإلكتروني", notes: "هل هناك شيء تودّ إخباري به؟", optional: "اختياري. رابط أو بضعة أسطر تكفي.",
    summary: "جلستك", pay: "المتابعة إلى الدفع", paying: "جارٍ فتح صفحة الدفع…", payment: "دفع آمن عبر Stripe. يتأكد الحجز بعد الدفع.",
    terms: "أفهم أن هذه استشارة مدفوعة. يمكنني الرد على رسالة التأكيد لطلب تغيير الموعد أو إلغائه.",
    noTimes: "الحجز متاح قريبًا.", noTimesText: "يمكنك مراسلتي الآن ونتفق على موعد مناسب.", empty: "لا توجد مواعيد هذا الشهر. جرّب الشهر التالي.",
    fullyBooked: "لا توجد مواعيد متاحة حاليًا.", fullyBookedText: "راسلني بالبريد لنتفق على وقت مناسب.", retry: "حاول مجددًا", error: "تعذّر تحميل المواعيد. يرجى المحاولة مجددًا.",
    checkoutError: "تعذّر فتح صفحة الدفع. لم يُخصم أي مبلغ. حاول مجددًا أو راسلني بالبريد.", conflict: "هذا الموعد لم يعد متاحًا. اختر موعدًا آخر.",
    change: "تعديل", continue: "متابعة", online: "مكالمة فيديو فردية", support: "لديك سؤال؟", how: "كيف يتم الحجز؟", steps: ["الجلسة", "الموعد", "البيانات"],
    howText: "اختر مدة الجلسة وموعدها، ثم أكمل الدفع لتأكيد الحجز. تصلك رسالة تأكيد ودعوة تقويم، وأرسل لك رابط المكالمة قبل الجلسة. لتغيير الموعد أو إلغائه، ردّ على رسالة التأكيد.",
  },
} as const;

const arabicTopics = {
  suleiman: ["لم أحدد بعد", "الذكاء الاصطناعي والأتمتة", "المواقع والمتاجر الإلكترونية", "الظهور في البحث وأجوبة الذكاء الاصطناعي", "العملاء والمحتوى والتسويق"],
  saif: ["البناء بالذكاء الاصطناعي", "تطوير المواقع", "مشروعك"],
};

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
function dayKey(iso: string, timeZone: string) {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(iso));
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}

export function NativeBooking({ locale, host = "suleiman" }: { locale: "en" | "ar"; host?: HostId }) {
  const t = copy[locale], owner = bookingHosts[host], rtl = locale === "ar";
  const [step, setStep] = useState(0), [duration, setDuration] = useState<30 | 60>(30), [topic, setTopic] = useState(0);
  const [timeZone, setTimeZone] = useState("Asia/Dubai"), [zones, setZones] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]), [loading, setLoading] = useState(false), [paused, setPaused] = useState(false), [error, setError] = useState("");
  const [day, setDay] = useState(""), [month, setMonth] = useState(""), [start, setStart] = useState("");
  const [sending, setSending] = useState(false), [reload, setReload] = useState(0);
  const [guest, setGuest] = useState({ name: "", email: "", notes: "", agreed: false });
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  const localeCode = rtl ? "ar-AE" : "en";
  const topics = rtl ? arabicTopics[host] : owner.topics;
  const ownerName = rtl ? (host === "suleiman" ? "سليمان النسور" : "سيف جمال") : owner.name;
  const back = host === "saif" ? owner.back : `/links/${locale}`;
  const portfolio = host === "saif" ? "https://saifjamal.tech/" : "/";
  const photo = host === "saif" ? "https://links.saifjamal.tech/assets/saif-gym-photo.webp" : "/suleiman-alnsour.png";

  useEffect(() => {
    Promise.resolve().then(() => {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setZones(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC", "Asia/Dubai", "Europe/London", "America/New_York"]);
    });
  }, []);
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    panelHeading.current?.focus({ preventScroll: false });
  }, [step]);
  useEffect(() => {
    if (step !== 1) return;
    const controller = new AbortController();
    Promise.resolve().then(() => { setLoading(true); setError(""); });
    fetch(`/api/booking/availability?host=${host}&duration=${duration}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { setSlots(data.slots); setPaused(data.paused); if (!data.slots.includes(start)) setStart(""); })
      .catch(e => { if (e.name !== "AbortError") setError(t.error); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // Selecting a time must not trigger a new availability request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, host, duration, reload, t.error]);

  const days = useMemo(() => [...new Set(slots.map(slot => dayKey(slot, timeZone)))], [slots, timeZone]);
  const currentDay = days.includes(day) ? day : days[0] || "";
  const currentMonth = month || currentDay.slice(0, 7);
  const times = useMemo(() => slots.filter(slot => dayKey(slot, timeZone) === currentDay), [slots, timeZone, currentDay]);
  const monthDate = new Date(`${currentMonth || "2030-01"}-01T12:00:00Z`);
  const monthDays = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(localeCode, { timeZone, hour: "numeric", minute: "2-digit" }), [localeCode, timeZone]);
  const offsetFormatter = useMemo(() => new Intl.DateTimeFormat(localeCode, { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }), [localeCode, timeZone]);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(localeCode, { timeZone, weekday: "short", month: "short", day: "numeric" }), [localeCode, timeZone]);
  const timeLabel = (iso: string) => timeFormatter.format(new Date(iso));
  const dayLabel = (iso: string) => dayFormatter.format(new Date(iso));
  const duplicateLabels = new Set(times.map(timeLabel).filter((label, index, all) => all.indexOf(label) !== index));

  function goTo(next: number) { setStep(next); setError(""); }
  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + delta, 1));
    const value = date.toISOString().slice(0, 7);
    setMonth(value); setDay(days.find(date => date.startsWith(value)) || ""); setStart("");
  }
  async function pay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (sending) return;
    setSending(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/booking/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, duration, start, topic: topics[topic], name: guest.name, email: guest.email, notes: guest.notes, website: data.get("website"), timeZone, locale, agreed: guest.agreed }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setStart(""); setStep(1); setReload(value => value + 1); throw new Error(t.conflict); }
        throw new Error(rtl ? t.checkoutError : result.error || t.checkoutError);
      }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error(t.checkoutError);
      window.location.assign(url.toString());
    } catch (e) { setError(e instanceof Error ? e.message : t.checkoutError); setSending(false); }
  }

  return <main lang={locale} dir={rtl ? "rtl" : "ltr"} data-step={step} className="bio-page booking-page">
    <div className="booking-shell">
      <nav className="booking-nav" aria-label={rtl ? "روابط الصفحة" : "Page navigation"}>
        <a href={back} className="bio-back"><ArrowLeft aria-hidden="true" />{t.back}</a>
        <a href={`/book/${rtl ? "en" : "ar"}`} hrefLang={rtl ? "en" : "ar"} lang={rtl ? "en" : "ar"} className="booking-language">{t.language}</a>
      </nav>
      <div className="booking-layout">
        <header className="booking-intro">
          <a className="booking-host" href={portfolio}>
            <Image src={photo} alt="" width={48} height={48} unoptimized={host === "saif"} />
            <span><strong>{ownerName}</strong><span>{t.consultation}</span></span>
          </a>
          <h1>{t.title}</h1><p className="booking-intro-text">{t.intro}</p>
          <p className="booking-format"><Video aria-hidden="true" />{t.online}</p>
          {step > 0 && <div className="booking-aside-summary"><span>{t.summary}</span><strong>{duration} {t.min}<span dir="ltr">${duration === 30 ? 100 : 200} USD</span></strong>{start && <p>{dayLabel(start)} · {timeLabel(start)}</p>}</div>}
        </header>
        <section className="booking-panel" aria-labelledby="booking-step-title">
          <ol className="booking-progress" aria-label={rtl ? "خطوات الحجز" : "Booking progress"}>{t.steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step}><span aria-hidden="true">{index < step ? <Check /> : index + 1}</span>{label}</li>)}</ol>
          <div key={step} className="booking-step">
            <div className="booking-step-header"><h2 id="booking-step-title" ref={panelHeading} tabIndex={-1}>{step === 0 ? t.session : step === 1 ? t.times : t.details}</h2>{step > 0 && <button type="button" className="booking-previous" onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />{t.change}</button>}</div>
            {step === 0 && <>
              <div className="bio-sessions" role="group" aria-label={t.session}>{([30, 60] as const).map(minutes => <button key={minutes} type="button" className="bio-session" aria-pressed={duration === minutes} onClick={() => { setDuration(minutes); setStart(""); setDay(""); setMonth(""); }}>
                <span className="bio-session-copy"><span className="bio-session-time">{minutes} {t.min}</span><span className="bio-session-detail">{minutes === 30 ? t.focused : t.deep}</span></span>
                <span className="bio-price" dir="ltr">${minutes === 30 ? 100 : 200}<small>USD</small></span><span className="bio-session-check" aria-hidden="true">{duration === minutes && <Check />}</span>
              </button>)}</div>
              <label className="booking-topic-label" htmlFor="booking-topic">{t.topic}</label><div className="booking-select"><select id="booking-topic" value={topic} onChange={event => setTopic(Number(event.target.value))}>{topics.map((label, index) => <option key={label} value={index}>{label}</option>)}</select><ChevronDown aria-hidden="true" /></div>
              <button type="button" className="bio-book-action" onClick={() => { setLoading(true); goTo(1); }}>{t.next}<ArrowRight aria-hidden="true" /></button>
              <p className="bio-book-note"><LockKeyhole aria-hidden="true" />{t.payment}</p>
            </>}
            {step === 1 && <>
              <p className="booking-step-hint">{t.local}</p>
              <label className="booking-zone"><Globe2 aria-hidden="true" /><span className="sr-only">{t.zone}</span><select value={timeZone} onChange={event => { setTimeZone(event.target.value); setDay(""); setMonth(""); setStart(""); }}>{[...new Set([timeZone, ...zones])].map(zone => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select></label>
              {loading ? <div className="booking-loading" role="status"><span />{rtl ? "جارٍ تحميل المواعيد…" : "Finding available times…"}</div> : paused ? <div className="booking-empty"><h3>{t.noTimes}</h3><p>{t.noTimesText}</p><a href={`mailto:${owner.email}`}>{owner.email}</a></div> : !error && !days.length ? <div className="booking-empty"><h3>{t.fullyBooked}</h3><p>{t.fullyBookedText}</p><a href={`mailto:${owner.email}`}>{owner.email}</a></div> : !error && currentMonth && <>
                <div className="booking-calendar-layout">
                  <section className="booking-calendar" aria-label={t.date}>
                    <div className="booking-month"><h3>{new Intl.DateTimeFormat(localeCode, { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate)}</h3><div><button type="button" aria-label={rtl ? "الشهر السابق" : "Previous month"} onClick={() => shiftMonth(-1)} disabled={currentMonth <= days[0]?.slice(0, 7)}><ChevronLeft /></button><button type="button" aria-label={rtl ? "الشهر التالي" : "Next month"} onClick={() => shiftMonth(1)} disabled={currentMonth >= days[days.length - 1]?.slice(0, 7)}><ChevronRight /></button></div></div>
                    <div className="booking-day-grid">{Array.from({ length: 7 }, (_, index) => <span className="booking-weekday" key={`w${index}`}>{new Intl.DateTimeFormat(localeCode, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 18 + index)))}</span>)}{Array.from({ length: monthDate.getUTCDay() }, (_, index) => <span key={`blank${index}`} />)}{Array.from({ length: monthDays }, (_, index) => {
                      const date = `${currentMonth}-${String(index + 1).padStart(2, "0")}`;
                      return <button type="button" key={date} disabled={!days.includes(date)} aria-pressed={date === currentDay} aria-label={new Intl.DateTimeFormat(localeCode, { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))} onClick={() => { setDay(date); setStart(""); }}>{new Intl.NumberFormat(localeCode).format(index + 1)}</button>;
                    })}</div>
                  </section>
                  {days.some(date => date.startsWith(currentMonth)) ? <section className="booking-times" aria-label={t.time}><h3>{times[0] ? dayLabel(times[0]) : t.time}</h3><div>{times.map(iso => <button key={iso} type="button" aria-pressed={start === iso} onClick={() => setStart(iso)}>{duplicateLabels.has(timeLabel(iso)) ? offsetFormatter.format(new Date(iso)) : timeLabel(iso)}{start === iso && <Check aria-hidden="true" />}</button>)}</div></section> : <p className="bio-book-note">{t.empty}</p>}
                </div>
                <button type="button" className="bio-book-action" disabled={!start} onClick={() => goTo(2)}>{t.continue}<ArrowRight aria-hidden="true" /></button>
              </>}
              {error && <div className="booking-error" role="alert">{error}<button type="button" onClick={() => setReload(value => value + 1)}>{t.retry}</button></div>}
            </>}
            {step === 2 && <form onSubmit={pay} className="booking-details">
              <div className="booking-summary"><div><strong>{dayLabel(start)} · {timeLabel(start)}</strong><span>{duration} {t.min} · <bdi>${duration === 30 ? 100 : 200} USD</bdi> · {timeZone.replaceAll("_", " ")}</span></div><button type="button" onClick={() => goTo(1)}>{t.change}</button></div>
              <div className="booking-person-fields"><label>{t.name}<input name="name" autoComplete="name" required minLength={2} maxLength={100} value={guest.name} onChange={event => setGuest({ ...guest, name: event.target.value })} /></label><label>{t.email}<input name="email" type="email" dir="ltr" autoComplete="email" inputMode="email" required maxLength={254} value={guest.email} onChange={event => setGuest({ ...guest, email: event.target.value })} /></label></div>
              <label>{t.notes}<textarea name="notes" rows={3} maxLength={1500} value={guest.notes} onChange={event => setGuest({ ...guest, notes: event.target.value })} /><small>{t.optional}</small></label>
              <div className="booking-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <label className="booking-agree"><input type="checkbox" name="agreed" required checked={guest.agreed} onChange={event => setGuest({ ...guest, agreed: event.target.checked })} /><span>{t.terms}</span></label>
              {error && <div className="booking-error" role="alert">{error}</div>}
              <button className="bio-book-action" type="submit" disabled={sending}>{sending ? t.paying : t.pay}<LockKeyhole aria-hidden="true" /></button><p className="bio-book-note">{t.payment}</p>
            </form>}
          </div>
        </section>
      </div>
      <footer className="booking-footer"><a href={portfolio}>{t.portfolio}<ArrowRight aria-hidden="true" /></a><span>{t.support} <a href={`mailto:${owner.email}`}>{owner.email}</a></span><details className="booking-help"><summary>{t.how}<ChevronDown aria-hidden="true" /></summary><p>{t.howText}</p></details></footer>
    </div>
  </main>;
}
