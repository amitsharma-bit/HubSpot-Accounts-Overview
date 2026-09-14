import { NextRequest, NextResponse } from "next/server";
import { searchReportPreview } from "@/lib/dataReports/companyService";
import type { ReportDefinition } from "@/lib/dataReports/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { definition: ReportDefinition; page?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body is not valid JSON." }, { status: 400 });
  }
  if (!body.definition || body.definition.columns.length === 0) {
    return NextResponse.json({ error: "Select at least one column for the report." }, { status: 400 });
  }
  try {
    const result = await searchReportPreview(body.definition, body.page ?? 1);
    return NextResponse.json(result);
  } catch (err) {
    console.error("data-reports search failed:", err);
    return NextResponse.json({ error: "Unable to load HubSpot data. Please try again." }, { status: 502 });
  }
}
