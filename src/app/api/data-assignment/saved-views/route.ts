import { NextRequest, NextResponse } from "next/server";
import { listSavedViews, saveSavedView, deleteSavedView, FILTER_PRESETS } from "@/lib/assignment/savedViews";

export async function GET() {
  const views = await listSavedViews();
  return NextResponse.json({ views, presets: FILTER_PRESETS });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const view = await saveSavedView(body);
  return NextResponse.json(view);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deleteSavedView(id);
  return NextResponse.json({ ok: true });
}
