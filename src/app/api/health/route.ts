import { NextResponse } from "next/server";
import { rotaryYearFor } from "@/lib/utils/rotary-year";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    application: "Rotaract Club Operations Platform",
    club: "Rotaract San Pedro East",
    district: "3820",
    timezone: "Asia/Manila",
    rotaryYear: rotaryYearFor(),
    timestamp: new Date().toISOString(),
  });
}
