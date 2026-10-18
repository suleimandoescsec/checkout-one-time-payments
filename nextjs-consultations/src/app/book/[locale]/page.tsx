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
    metadataBase: new URL("https://suleimanalnsour.me"),
    title, description,
    alternates: { canonical: `/book/${locale}`, languages: { en: "/book/en", ar: "/book/ar", "x-default": "/book/en" } },
    openGraph: { type: "website", title, description, url: `/book/${locale}`, locale: locale === "ar" ? "ar_AE" : "en_US", siteName: "Suleiman Alnsour", images: [{ url: "/suleiman-alnsour.png", alt: "Suleiman Alnsour" }] },
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
    availableChannel: { "@type": "ServiceChannel", serviceUrl: `https://suleimanalnsour.me/book/${locale}`, availableLanguage: ["en", "ar"] },
    offers: [
      { "@type": "Offer", name: locale === "ar" ? "استشارة لمدة 30 دقيقة" : "30-minute consultation", url: `https://suleimanalnsour.me/book/${locale}`, price: "100", priceCurrency: "USD" },
      { "@type": "Offer", name: locale === "ar" ? "استشارة لمدة 60 دقيقة" : "60-minute consultation", url: `https://suleimanalnsour.me/book/${locale}`, price: "200", priceCurrency: "USD" },
    ],
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: locale === "ar" ? "الرئيسية" : "Home", item: "https://suleimanalnsour.me/" },
      { "@type": "ListItem", position: 2, name: locale === "ar" ? "حجز استشارة" : "Book a consultation", item: `https://suleimanalnsour.me/book/${locale}` },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(service) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    <NativeBooking locale={locale} />
  </>;
}
