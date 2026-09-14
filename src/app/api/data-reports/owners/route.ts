import { NextResponse } from "next/server";
import { listReportOwners } from "@/lib/dataReports/companyService";

export async function GET() {
  try {
    const owners = await listReportOwners();
    return NextResponse.json({ owners });
  } catch (err) {
    console.error("data-reports owners failed:", err);
    return NextResponse.json({ error: "Unable to load HubSpot owners." }, { status: 502 });
  }
}
