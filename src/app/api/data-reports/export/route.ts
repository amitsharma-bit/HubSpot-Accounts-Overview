import { NextRequest, NextResponse } from "next/server";
import { exportReportRows } from "@/lib/dataReports/companyService";
import { csvHeaderLine, csvRowLine } from "@/lib/dataReports/csv";
import { recordExport } from "@/lib/dataReports/savedReports";
import type { ReportDefinition } from "@/lib/dataReports/types";

// A fully unfiltered export over this portal's whole Companies universe
// (~165k records at last count) can exceed even this ceiling — HubSpot's
// rate limit plus Vercel's hard maxDuration cap mean there's no way around
// that for a truly unbounded export. Streaming at least means the download
// starts immediately and partial progress isn't lost to a single timeout at
// the very end; recommending at least one owner/filter in the UI is the
// practical mitigation, not a hard block (Phase 12 doesn't ask for one).
export const maxDuration = 290;

export async function POST(req: NextRequest) {
  let body: { definition: ReportDefinition; reportName?: string; exportedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body is not valid JSON." }, { status: 400 });
  }
  const def = body.definition;
  if (!def || def.columns.length === 0) {
    return NextResponse.json({ error: "Select at least one column for the report." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let rowCount = 0;
  let headerWritten = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const page of exportReportRows(def)) {
          if (!headerWritten) {
            controller.enqueue(encoder.encode(csvHeaderLine(def.columns) + "\r\n"));
            headerWritten = true;
          }
          rowCount += page.length;
          if (page.length > 0) {
            const csvChunk = page.map((row) => csvRowLine(def.columns, row)).join("\r\n");
            controller.enqueue(encoder.encode(csvChunk + "\r\n"));
          }
        }
        if (!headerWritten) {
          controller.enqueue(encoder.encode(csvHeaderLine(def.columns) + "\r\n")); // header-only CSV for zero matching records
        }
        await recordExport({
          reportName: body.reportName ?? "Untitled Report",
          recordCount: rowCount,
          columnCount: def.columns.length,
          exportedBy: body.exportedBy ?? "unknown",
        }).catch((err) => console.error("recordExport failed (non-fatal):", err));
        controller.close();
      } catch (err) {
        console.error("data-reports export failed:", err);
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${(body.reportName ?? "company-report").replace(/[^a-z0-9-_ ]/gi, "_")}.csv"`,
    },
  });
}
