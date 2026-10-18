import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NativeBooking } from "@/components/native-booking";
export function generateStaticParams() { return [{locale:"en"},{locale:"ar"}]; }
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata> {
  const {locale}=await params;
  return { metadataBase:new URL("https://links.saifjamal.tech"), title:locale==="ar"?"احجز استشارة مع سيف جمال":"Book a consultation with Saif Jamal", description:locale==="ar"?"استشارة فردية في الذكاء الاصطناعي وتطوير المواقع ومشروعك. 30 دقيقة مقابل 100 دولار أو 60 دقيقة مقابل 200 دولار. اختر موعدًا وأكمل الدفع لتأكيده.":"1:1 help with AI, web development and your project. 30 minutes $100 USD or 60 minutes $200 USD. Choose a time and pay to confirm.", alternates:{canonical:`https://links.saifjamal.tech/book/${locale}`,languages:{en:"https://links.saifjamal.tech/book/en",ar:"https://links.saifjamal.tech/book/ar"}},openGraph:{title:"Book a call with Saif Jamal",url:`https://links.saifjamal.tech/book/${locale}`,images:["https://links.saifjamal.tech/assets/saif-gym-photo.webp"]},twitter:{card:"summary",images:["https://links.saifjamal.tech/assets/saif-gym-photo.webp"]} };
}
export default async function Page({params}:{params:Promise<{locale:string}>}) {const {locale}=await params;if(locale!=="en"&&locale!=="ar")notFound();return <NativeBooking host="saif" locale={locale}/>;}
