import { NextRequest, NextResponse } from "next/server";
import { getCountryOptions, getStateOptions } from "@/lib/filterOptions";
import { DEFAULT_COUNTRY } from "@/lib/filters";

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? DEFAULT_COUNTRY;
  const [countries, states] = await Promise.all([getCountryOptions(), getStateOptions(country)]);
  return NextResponse.json({ countries, states, dealershipClasses: ["Independent", "Franchise", "Group"] });
}
