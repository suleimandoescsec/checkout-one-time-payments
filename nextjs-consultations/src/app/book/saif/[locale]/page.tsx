import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NativeBooking } from "@/components/native-booking";
import { saifId } from "@/lib/site-schema";
export function generateStaticParams() { return [{locale:"en"},{locale:"ar"}]; }
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata> {
  const {locale}=await params;
  const title=locale==="ar"?"احجز استشارة مع سيف جمال":"Book a consultation with Saif Jamal";
  const description=locale==="ar"?"استشارة فردية في الذكاء الاصطناعي وتطوير المواقع ومشروعك. 30 دقيقة مقابل 100 دولار أو 60 دقيقة مقابل 200 دولار. اختر موعدًا وأكمل الدفع لتأكيده.":"1:1 help with AI, web development and your project. 30 minutes $100 USD or 60 minutes $200 USD. Choose a time and pay to confirm.";
  const url=`https://links.saifjamal.tech/book/${locale}`;
  const image="https://links.saifjamal.tech/assets/saif-gym-photo.webp";
  return { metadataBase:new URL("https://links.saifjamal.tech"), title, description, alternates:{canonical:url,languages:{en:"https://links.saifjamal.tech/book/en",ar:"https://links.saifjamal.tech/book/ar","x-default":"https://links.saifjamal.tech/book/en"}},openGraph:{type:"website",title,description,url,locale:locale==="ar"?"ar_AE":"en_US",siteName:"Saif Jamal",images:[{url:image,alt:"Saif Jamal"}]},twitter:{card:"summary",title,description,images:[image]} };
}
export default async function Page({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;if(locale!=="en"&&locale!=="ar")notFound();
  const url=`https://links.saifjamal.tech/book/${locale}`;
  const service={"@context":"https://schema.org","@type":"Service","@id":`${url}#service`,name:locale==="ar"?"استشارة فردية مع سيف جمال":"1:1 consultation with Saif Jamal",provider:{"@id":saifId},serviceType:locale==="ar"?"استشارة في الذكاء الاصطناعي وتطوير المواقع":"AI, web development and project consultation",url,availableChannel:{"@type":"ServiceChannel",serviceUrl:url,availableLanguage:["en","ar"]},offers:[{"@type":"Offer",name:locale==="ar"?"استشارة لمدة 30 دقيقة":"30-minute consultation",url,price:"100",priceCurrency:"USD"},{"@type":"Offer",name:locale==="ar"?"استشارة لمدة 60 دقيقة":"60-minute consultation",url,price:"200",priceCurrency:"USD"}]};
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:locale==="ar"?"الرئيسية":"Home",item:"https://saifjamal.tech/"},{"@type":"ListItem",position:2,name:locale==="ar"?"حجز استشارة":"Book a consultation",item:url}]};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(service)}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumb)}}/><NativeBooking host="saif" locale={locale}/></>;
}
