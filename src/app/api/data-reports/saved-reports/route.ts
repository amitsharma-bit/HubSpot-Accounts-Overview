import { NextRequest, NextResponse } from "next/server";
import { listSavedReports, saveSavedReport, duplicateSavedReport, renameSavedReport, deleteSavedReport } from "@/lib/dataReports/savedReports";

export async function GET() {
  const reports = await listSavedReports();
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "duplicate") {
    const report = await duplicateSavedReport(body.id, body.newName);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json(report);
  }
  if (body.action === "rename") {
    const report = await renameSavedReport(body.id, body.newName);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json(report);
  }
  const report = await saveSavedReport(body);
  return NextResponse.json(report);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deleteSavedReport(id);
  return NextResponse.json({ ok: true });
}
