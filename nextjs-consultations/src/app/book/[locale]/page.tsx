import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NativeBooking } from "@/components/native-booking";
import { suleimanId } from "@/lib/site-schema";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "ar" ? "استشارة مع سليمان النسور | الذكاء الاصطناعي والأعمال" : "Book a Call with Suleiman Alnsour | AI, Business & Marketing";
  const description = locale === "ar" ? "جلسة فردية لبناء تطبيق بالذكاء الاصطناعي أو تطوير مشروعك أو تسويقك. 30 دقيقة مقابل 100 دولار أو 60 دقيقة مقابل 200 دولار أمريكي. اختر موعدك وأكمل الدفع لتأكيد الحجز." : "1:1 help with building apps using AI, business and marketing. 30 minutes for $100 or 60 minutes for $200 USD. Choose a time in your time zone and pay to confirm.";
  return {
    title, description,
    alternates: { canonical: `/book/${locale}`, languages: { en: "/book/en", ar: "/book/ar", "x-default": "/book/en" } },
    openGraph: { title, description, url: `/book/${locale}`, locale: locale === "ar" ? "ar_AE" : "en_US", images: ["/suleiman-alnsour.png"] },
    twitter: { card: "summary", title, description, images: ["/suleiman-alnsour.png"] },
  };
}

export default async function BookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ar") notFound();
  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `https://suleimanalnsour.me/book/${locale}#service`,
    name: locale === "ar" ? "استشارة فردية مع سليمان النسور" : "1:1 consultation with Suleiman Alnsour",
    provider: { "@id": suleimanId },
    serviceType: "AI, business and marketing consultation",
    url: `https://suleimanalnsour.me/book/${locale}`,
    offers: [
      { "@type": "Offer", name: "30-minute consultation", price: "100", priceCurrency: "USD" },
      { "@type": "Offer", name: "60-minute consultation", price: "200", priceCurrency: "USD" },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(service) }} />
    <NativeBooking locale={locale} />
  </>;
}
