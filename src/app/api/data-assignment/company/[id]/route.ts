import { NextResponse } from "next/server";
import { getCompaniesByIds } from "@/lib/assignment/companyService";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [company] = await getCompaniesByIds([id]);
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    return NextResponse.json(company);
  } catch (err) {
    console.error("company detail (data-assignment) failed:", err);
    return NextResponse.json({ type: "HUBSPOT_API_ERROR", message: "Failed to load company detail.", retryable: true }, { status: 502 });
  }
}
