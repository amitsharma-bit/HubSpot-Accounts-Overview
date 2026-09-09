import { NextRequest, NextResponse } from "next/server";
import { searchCompaniesCanonical } from "@/lib/assignment/assignmentSearch";
import type { FilterGroup } from "@/lib/assignment/types";

export const maxDuration = 290;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dealershipClass = sp.get("dealershipClass");
  if (dealershipClass !== "Franchise" && dealershipClass !== "Independent") {
    return NextResponse.json(
      { type: "MALFORMED_RECORD", message: "dealershipClass must be 'Franchise' (Single Franchise) or 'Independent' (Independent Rooftop).", retryable: false },
      { status: 400 }
    );
  }

  const filtersRaw = sp.get("filters");
  let filters: FilterGroup | null = null;
  if (filtersRaw) {
    try {
      filters = JSON.parse(filtersRaw);
    } catch {
      return NextResponse.json({ type: "MALFORMED_RECORD", message: "filters query param is not valid JSON.", retryable: false }, { status: 400 });
    }
  }

  try {
    const result = await searchCompaniesCanonical({
      dealershipClass,
      filters,
      search: sp.get("q") ?? "",
      sortField: (sp.get("sortField") as never) || null,
      sortDir: sp.get("sortDir") === "desc" ? "desc" : "asc",
      page: Number(sp.get("page") ?? 1) || 1,
      pageSize: Math.min(Number(sp.get("pageSize") ?? 25) || 25, 100),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("companies search failed:", err);
    return NextResponse.json({ type: "HUBSPOT_API_ERROR", message: "Failed to search companies.", retryable: true }, { status: 502 });
  }
}
