import { NextRequest, NextResponse } from "next/server";
import { AssignmentPreviewService } from "@/lib/assignment/assignmentPreview";
import { recordSimulatedAssignment } from "@/lib/assignment/assignmentHistory";
import type { AssignmentSelection, AssignmentTarget } from "@/lib/assignment/types";

export const maxDuration = 290;

// SAFETY: this route only ever calls AssignmentPreviewService (read-only —
// see its own doc comment) and, if `record: true`, appends a SIMULATED entry
// to the history log. It never calls a HubSpot write/mutation endpoint.
export async function POST(req: NextRequest) {
  let body: { selection: AssignmentSelection; target: AssignmentTarget | null; record?: boolean; performedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ type: "MALFORMED_RECORD", message: "Request body is not valid JSON.", retryable: false }, { status: 400 });
  }

  if (!body.selection || (body.selection.selectedGroupIds.length === 0 && body.selection.selectedCompanyIds.length === 0)) {
    return NextResponse.json({ type: "MALFORMED_RECORD", message: "Select at least one group or company before previewing.", retryable: false }, { status: 400 });
  }

  try {
    const preview = await AssignmentPreviewService.preview(body.selection, body.target ?? null);
    if (body.record) {
      await recordSimulatedAssignment(preview, body.selection, body.performedBy ?? "unknown");
    }
    return NextResponse.json(preview);
  } catch (err) {
    console.error("assignment preview failed:", err);
    return NextResponse.json({ type: "HUBSPOT_API_ERROR", message: "Failed to compute assignment preview.", retryable: true }, { status: 502 });
  }
}
