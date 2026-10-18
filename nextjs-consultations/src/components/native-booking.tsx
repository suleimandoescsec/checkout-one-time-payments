"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Globe2, LockKeyhole } from "lucide-react";
import { bookingHosts, type HostId } from "@/lib/booking/config";

const copy = {
  en: { back:"Back to links", title:"A little time. A clear next step.", intro:"Bring your idea, your app, or the thing you're stuck on. We'll work through it together.", session:"Choose your session", topic:"What would you like help with?", min:"minutes", focused:"One question. A practical plan.", deep:"Time to build and work together.", next:"Choose a time", times:"Find a time that works.", local:"Times are shown in your time zone.", date:"Choose a day", time:"Choose a time", zone:"Your time zone", details:"A few details, then you're in.", name:"Your name", email:"Email address", notes:"What would you like us to work on?", optional:"Optional. A little context helps us get straight to it.", summary:"Your session", pay:"Continue to payment", paying:"Opening secure checkout…", payment:"Secure payment with Stripe. Your booking is confirmed after payment.", terms:"I understand this is a paid consultation. To change or cancel, I'll reply to my confirmation email.", noTimes:"Online booking is being set up.", noTimesText:"Please email your host for now. Times will appear here as soon as booking opens.", empty:"No available times in this month. Try the next month.", retry:"Try again", error:"We couldn't load available times. Please try again.", change:"Change", continue:"Continue", steps:["Session","Time","Details"] },
  ar: { back:"العودة إلى الروابط", title:"وقت بسيط. وخطوة أوضح.", intro:"أحضر فكرتك أو تطبيقك أو المشكلة التي تواجهك، ونعمل عليها معًا.", session:"اختر مدة الجلسة", topic:"بماذا تريد المساعدة؟", min:"دقيقة", focused:"سؤال محدد وخطة عملية.", deep:"وقت أطول للبناء والعمل معًا.", next:"اختر موعدًا", times:"اختر الوقت المناسب لك.", local:"تُعرض المواعيد حسب منطقتك الزمنية.", date:"اختر اليوم", time:"اختر الوقت", zone:"منطقتك الزمنية", details:"بيانات بسيطة، ثم نؤكد موعدك.", name:"اسمك", email:"بريدك الإلكتروني", notes:"ما الذي تريد العمل عليه معنا؟", optional:"اختياري. قليل من التفاصيل يساعدنا على البدء مباشرة.", summary:"جلستك", pay:"المتابعة إلى الدفع", paying:"جارٍ فتح صفحة الدفع الآمنة…", payment:"دفع آمن عبر Stripe. يتأكد الحجز بعد إتمام الدفع.", terms:"أفهم أن هذه استشارة مدفوعة. لتغيير الموعد أو إلغائه، سأرد على رسالة تأكيد الحجز.", noTimes:"نعمل على تجهيز الحجز الإلكتروني.", noTimesText:"يمكنك مراسلة صاحب الجلسة بالبريد حاليًا. ستظهر المواعيد هنا بمجرد تفعيل الحجز.", empty:"لا توجد مواعيد متاحة هذا الشهر. جرّب الشهر التالي.", retry:"حاول مجددًا", error:"تعذّر تحميل المواعيد. يرجى المحاولة مجددًا.", change:"تعديل", continue:"متابعة", steps:["الجلسة","الموعد","البيانات"] },
} as const;

const dayFormatters=new Map<string,Intl.DateTimeFormat>();
function dayKey(iso: string, timeZone: string) {
  let formatter=dayFormatters.get(timeZone);
  if(!formatter){formatter=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"});dayFormatters.set(timeZone,formatter);}
  const p = formatter.formatToParts(new Date(iso));
  return ["year","month","day"].map(k=>p.find(x=>x.type===k)!.value).join("-");
}

export function NativeBooking({ locale, host="suleiman" }: { locale:"en"|"ar"; host?:HostId }) {
  const t=copy[locale], owner=bookingHosts[host];
  const [step,setStep]=useState(0), [duration,setDuration]=useState<30|60>(30), [topic,setTopic]=useState(0);
  const [timeZone,setTimeZone]=useState("Asia/Dubai"), [zones,setZones]=useState<string[]>([]);
  const [slots,setSlots]=useState<string[]>([]), [loading,setLoading]=useState(false), [paused,setPaused]=useState(false), [error,setError]=useState("");
  const [day,setDay]=useState(""), [month,setMonth]=useState(""), [start,setStart]=useState("");
  const [sending,setSending]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{ Promise.resolve().then(()=>{
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setZones(typeof Intl.supportedValuesOf==="function"?Intl.supportedValuesOf("timeZone"):["UTC","Asia/Dubai","Europe/London","America/New_York"]);
  }); },[]);
  useEffect(()=>{
    if (step!==1) return;
    const controller=new AbortController();
    Promise.resolve().then(()=>{setLoading(true);setError("");});
    fetch(`/api/booking/availability?host=${host}&duration=${duration}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);return data;})
      .then(data=>{setSlots(data.slots);setPaused(data.paused);})
      .catch(e=>{if(e.name!=="AbortError")setError(t.error);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[step,host,duration,reload,t.error]);
  const days=useMemo(()=>[...new Set(slots.map(s=>dayKey(s,timeZone)))],[slots,timeZone]);
  const currentDay=days.includes(day)?day:days[0] || "";
  const currentMonth=month || currentDay.slice(0,7);
  const times=slots.filter(s=>dayKey(s,timeZone)===currentDay);
  const monthDate=new Date(`${currentMonth || "2030-01"}-01T12:00:00Z`);
  const monthDays=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,0)).getUTCDate();
  const localeCode=locale==="ar"?"ar-AE":"en";
  const timeLabel=(iso:string)=>new Intl.DateTimeFormat(localeCode,{timeZone,hour:"numeric",minute:"2-digit"}).format(new Date(iso));
  const dayLabel=(iso:string)=>new Intl.DateTimeFormat(localeCode,{timeZone,weekday:"short",month:"short",day:"numeric"}).format(new Date(iso));
  const topics=locale==="ar"?(host==="suleiman"?["البناء بالذكاء الاصطناعي","الأعمال","التسويق"]:["البناء بالذكاء الاصطناعي","تطوير المواقع","مشروعك"]):owner.topics;
  function shiftMonth(delta:number) { const date=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+delta,1));const value=date.toISOString().slice(0,7);setMonth(value);setDay(days.find(d=>d.startsWith(value))||"");setStart(""); }
  async function pay(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(sending)return;
    setSending(true);setError("");
    const data=new FormData(event.currentTarget);
    try {
      const response=await fetch("/api/booking/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({host,duration,start,topic:topics[topic],name:data.get("name"),email:data.get("email"),notes:data.get("notes"),website:data.get("website"),timeZone,locale,agreed:data.get("agreed")==="on"})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      const url=new URL(result.url);
      if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")throw new Error("Checkout is unavailable. Please contact your host.");
      window.location.assign(url.toString());
    } catch(e) {setError(e instanceof Error?e.message:"Please try again.");setSending(false);}
  }
  return <main lang={locale} dir={locale==="ar"?"rtl":"ltr"} className="bio-page booking-page">
    <div className="bio-shell bio-book-shell">
      <a href={host==="saif"?owner.back:`/links/${locale}`} className="bio-back"><ArrowLeft aria-hidden="true"/>{t.back}</a>
      <div className="booking-progress" aria-label={locale==="ar"?"خطوات الحجز":"Booking progress"}>{t.steps.map((label,i)=><span key={label} aria-current={i===step?"step":undefined} data-complete={i<step}><i>{i<step?<Check/>:i+1}</i>{label}</span>)}</div>
      <header className="bio-book-heading"><p className="bio-eyebrow">1:1 · {owner.name}</p><h1>{step===0?t.title:step===1?t.times:t.details}</h1><p>{step===0?t.intro:step===1?t.local:t.payment}</p></header>
      {step===0?<>
        <div className="bio-field-label">{t.session}</div>
        <div className="bio-sessions">{([30,60] as const).map(minutes=><button key={minutes} type="button" className="bio-session" aria-pressed={duration===minutes} onClick={()=>{setDuration(minutes);setStart("");setDay("");setMonth("");}}><span className="bio-session-check">{duration===minutes&&<Check/>}</span><span className="bio-session-copy"><span className="bio-session-time">{minutes} {t.min}</span><span className="bio-session-detail">{minutes===30?t.focused:t.deep}</span></span><span className="bio-price">${minutes===30?100:200}<small>USD</small></span></button>)}</div>
        <div className="bio-field-label" id="booking-topic">{t.topic}</div><div className="bio-topics" role="group" aria-labelledby="booking-topic">{topics.map((label,i)=><button key={label} type="button" className="bio-topic" aria-pressed={i===topic} onClick={()=>setTopic(i)}>{label}</button>)}</div>
        <button className="bio-book-action" onClick={()=>setStep(1)}>{t.next}<ArrowRight/></button><p className="bio-book-note">{t.payment}</p>
      </>:<button className="bio-change-session" onClick={()=>{setStep(step-1);setError("");}}><ArrowLeft/>{t.steps[step-1]}</button>}
      {step===1&&<>
        <label className="booking-zone"><Globe2 aria-hidden="true"/><span className="sr-only">{t.zone}</span><select value={timeZone} onChange={e=>{setTimeZone(e.target.value);setDay("");setMonth("");setStart("");}}>{[...new Set([timeZone,...zones])].map(zone=><option key={zone} value={zone}>{zone.replaceAll("_"," ")}</option>)}</select></label>
        {loading?<div className="booking-loading" role="status"><span/>{locale==="ar"?"جارٍ تحميل المواعيد…":"Finding available times…"}</div>:paused?<div className="booking-empty"><h2>{t.noTimes}</h2><p>{t.noTimesText}</p><a href={`mailto:${owner.email}`}>{owner.email}</a></div>:!error&&currentMonth&&<>
          <section className="booking-calendar" aria-label={t.date}><div className="booking-month"><h2>{new Intl.DateTimeFormat(localeCode,{month:"long",year:"numeric",timeZone:"UTC"}).format(monthDate)}</h2><div><button aria-label={locale==="ar"?"الشهر السابق":"Previous month"} onClick={()=>shiftMonth(-1)} disabled={currentMonth<=days[0]?.slice(0,7)}><ChevronLeft/></button><button aria-label={locale==="ar"?"الشهر التالي":"Next month"} onClick={()=>shiftMonth(1)} disabled={currentMonth>=days[days.length-1]?.slice(0,7)}><ChevronRight/></button></div></div>
            <div className="booking-day-grid">{Array.from({length:7},(_,i)=><span className="booking-weekday" key={`w${i}`}>{new Intl.DateTimeFormat(localeCode,{weekday:"narrow",timeZone:"UTC"}).format(new Date(Date.UTC(2026,9,18+i)))}</span>)}{Array.from({length:monthDate.getUTCDay()},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:monthDays},(_,i)=>{const date=`${currentMonth}-${String(i+1).padStart(2,"0")}`;return <button type="button" key={date} disabled={!days.includes(date)} aria-pressed={date===currentDay} aria-label={new Intl.DateTimeFormat(localeCode,{dateStyle:"full",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`))} onClick={()=>{setDay(date);setStart("");}}>{i+1}</button>;})}</div>
          </section>
          {days.some(d=>d.startsWith(currentMonth))?<section className="booking-times" aria-label={t.time}><h2>{dayLabel(times[0])}</h2><div>{times.map(iso=><button key={iso} type="button" aria-pressed={start===iso} onClick={()=>setStart(iso)}>{timeLabel(iso)}{start===iso&&<Check/>}</button>)}</div></section>:<p className="bio-book-note">{t.empty}</p>}
          <button className="bio-book-action" disabled={!start} onClick={()=>{setStep(2);setError("");}}>{t.continue}<ArrowRight/></button>
        </>}
        {error&&<div className="booking-error" role="alert">{error}<button onClick={()=>setReload(reload+1)}>{t.retry}</button></div>}
      </>}
      {step===2&&<form onSubmit={pay} className="booking-details">
        <div className="booking-summary"><Clock3/><div><strong>{dayLabel(start)} · {timeLabel(start)}</strong><span>{duration} {t.min} · ${duration===30?100:200} USD · {timeZone.replaceAll("_"," ")}</span></div><button type="button" onClick={()=>setStep(1)}>{t.change}</button></div>
        <label>{t.name}<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label><label>{t.email}<input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254}/></label>
        <label>{t.notes}<textarea name="notes" rows={3} maxLength={1500}/><small>{t.optional}</small></label>
        <div className="booking-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
        <label className="booking-agree"><input type="checkbox" name="agreed" required/><span>{t.terms}</span></label>
        {error&&<div className="booking-error" role="alert">{error}</div>}
        <button className="bio-book-action" type="submit" disabled={sending}>{sending?t.paying:t.pay}<LockKeyhole/></button><p className="bio-book-note">{t.payment}</p>
      </form>}
      <p className="booking-contact">{locale==="ar"?"لديك سؤال؟":"Have a question?"} <a href={`mailto:${owner.email}`}>{owner.email}</a></p>
    </div>
  </main>;
}
