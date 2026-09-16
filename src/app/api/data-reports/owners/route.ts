import { NextRequest, NextResponse } from "next/server";
import { listReportOwners } from "@/lib/dataReports/companyService";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") === "all" ? "all" : "dashboard";
  try {
    const owners = await listReportOwners(scope);
    return NextResponse.json({ owners });
  } catch (err) {
    console.error("data-reports owners failed:", err);
    return NextResponse.json({ error: "Unable to load HubSpot owners." }, { status: 502 });
  }
}
