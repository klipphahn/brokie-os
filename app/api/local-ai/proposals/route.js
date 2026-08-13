import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import { fetchBrokieAi, readBrokieAiResponse } from "@/lib/brokie-ai";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const response = await fetchBrokieAi("/api/ai/proposals");
    return NextResponse.json({ ok: true, ...(await readBrokieAiResponse(response)) });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("Brokie AI proposals request failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
}
