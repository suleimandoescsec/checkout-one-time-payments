import type { Metadata } from "next";
import { BookingConfirmation } from "@/components/booking-confirmation";
export const metadata:Metadata={title:"Your consultation",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <BookingConfirmation/>;}
