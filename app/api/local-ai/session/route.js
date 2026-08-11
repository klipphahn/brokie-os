import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import { fetchBrokieAi, readBrokieAiResponse } from "@/lib/brokie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const response = await fetchBrokieAi("/api/ai/session");
    await readBrokieAiResponse(response);
    return NextResponse.json({ ok: true, online: true });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("Brokie AI session check failed:", error.message);
    return NextResponse.json(
      { ok: false, online: false, error: error.message },
      { status: 503 }
    );
  }
}
