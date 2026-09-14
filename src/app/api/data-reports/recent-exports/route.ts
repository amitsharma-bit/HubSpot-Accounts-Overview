import { NextResponse } from "next/server";
import { listRecentExports } from "@/lib/dataReports/savedReports";

export async function GET() {
  const exports = await listRecentExports();
  return NextResponse.json({ exports });
}
