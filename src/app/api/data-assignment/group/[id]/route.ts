import { NextResponse } from "next/server";
import { getGroupDetailWithCompanies } from "@/lib/assignment/groupService";

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const detail = await getGroupDetailWithCompanies(id);
    if (!detail) return NextResponse.json({ error: "Dealership Group not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    console.error("group detail failed:", err);
    return NextResponse.json({ type: "HUBSPOT_API_ERROR", message: "Failed to load group detail.", retryable: true }, { status: 502 });
  }
}
