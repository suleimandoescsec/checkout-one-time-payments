import type { Metadata } from "next";
import { BookingAdmin } from "@/components/booking-admin";
export const metadata:Metadata={title:"Booking dashboard",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <BookingAdmin/>;}
