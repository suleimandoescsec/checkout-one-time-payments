"use client";
import { useEffect, useState } from "react";
import { Check, Clock3 } from "lucide-react";
type Status = {status:string;host:string;contact:string;startsAt:string;duration:number;amount:number;timeZone:string;locale:"en"|"ar"};
export function BookingConfirmation() {
  const [data,setData]=useState<Status|null>(null),[error,setError]=useState(""),[query,setQuery]=useState("");
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const search=new URLSearchParams({id:params.get("id")||"",token:params.get("token")||""}).toString();
    let stopped=false,timer:ReturnType<typeof setTimeout>;
    async function poll() {
      try {const response=await fetch(`/api/booking/status?${search}`,{cache:"no-store"});if(!response.ok)throw new Error("We couldn't find this booking. Please contact your host.");const value=await response.json();if(stopped)return;setData(value);setQuery(search);if(["holding","processing"].includes(value.status))timer=setTimeout(poll,3500);}
      catch(e){if(!stopped)setError(e instanceof Error?e.message:"Please try again.");}
    }
    poll();return ()=>{stopped=true;clearTimeout(timer);};
  },[]);
  const arabic=data?.locale==="ar", confirmed=data?.status==="confirmed", pending=!data||["holding","processing"].includes(data.status);
  return <main className="bio-page" lang={arabic?"ar":"en"} dir={arabic?"rtl":"ltr"}><div className="bio-shell bio-book-shell booking-confirmation">
    <span className="booking-confirm-mark">{confirmed?<Check/>:<Clock3/>}</span>
    <header className="bio-book-heading"><p className="bio-eyebrow">{data?.host||"1:1 consultation"}</p><h1>{error?"Let's check that link.":confirmed?(arabic?"تم تأكيد موعدك.":"You're booked."):pending?(arabic?"جارٍ تأكيد الدفع…":"Confirming your payment…"):(arabic?"نحتاج لترتيب موعدك.":"Let's arrange your time.")}</h1><p>{error|| (confirmed?(arabic?"أرسلنا تفاصيل جلستك إلى بريدك الإلكتروني. يمكنك الرد علينا مباشرة.":"Your session details are on their way to your inbox. You can reply to us directly."):pending?(arabic?"يمكن أن يستغرق تأكيد الدفع لحظات. سيصلك بريد عند التأكيد.":"Payment confirmation can take a moment. We'll email you once it's confirmed. If your payment method takes longer, you can close this page."):(arabic?"تواصل مع صاحب الجلسة لتنسيق موعدك أو مناقشة استرداد المبلغ.":"Please contact your host to arrange your session or discuss a refund."))}</p></header>
    {confirmed&&data&&<><div className="booking-summary"><Clock3/><div><strong>{new Intl.DateTimeFormat(arabic?"ar":"en",{dateStyle:"full",timeStyle:"short",timeZone:data.timeZone}).format(new Date(data.startsAt))}</strong><span>{data.timeZone} · {data.duration} {arabic?"دقيقة":"minutes"} · ${data.amount/100} USD</span></div></div><a className="bio-book-action" href={`/api/booking/status?${query}&calendar=1`}>{arabic?"أضف إلى تقويمك":"Add to your calendar"}<Check/></a><p className="bio-book-note">{arabic?"سيُرسل لك صاحب الجلسة رابط الاجتماع قبل الموعد.":"Your host will email your meeting link before the call."}</p></>}
    {data&&<p className="booking-contact"><a href={`mailto:${data.contact}`}>{data.contact}</a></p>}
  </div></main>;
}
