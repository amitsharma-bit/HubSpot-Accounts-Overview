import { NextRequest, NextResponse } from "next/server";
import { searchGroupsCanonical } from "@/lib/assignment/assignmentSearch";
import type { FilterGroup } from "@/lib/assignment/types";

export const maxDuration = 290;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
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
    const result = await searchGroupsCanonical({
      filters,
      search: sp.get("q") ?? "",
      requireUsQualified: sp.get("usOnly") !== "false", // default true — matches Phase 7's default rule
      sortField: (sp.get("sortField") as never) || null,
      sortDir: sp.get("sortDir") === "desc" ? "desc" : "asc",
      page: Number(sp.get("page") ?? 1) || 1,
      pageSize: Math.min(Number(sp.get("pageSize") ?? 25) || 25, 100),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("groups search failed:", err);
    return NextResponse.json({ type: "HUBSPOT_API_ERROR", message: "Failed to search Dealership Groups.", retryable: true }, { status: 502 });
  }
}
