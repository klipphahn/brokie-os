import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  fetchBrokieAi,
  normalizeSystemOverview,
  readBrokieAiResponse
} from "@/lib/brokie-ai";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const response = await fetchBrokieAi("/api/ai/system");
    const payload = await readBrokieAiResponse(response);
    return NextResponse.json({ ok: true, ...normalizeSystemOverview(payload) });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("System overview request failed:", error.message);
    return NextResponse.json(
      { ok: false, error: "Whole-system monitoring is currently unavailable." },
      { status: 503 }
    );
  }
}
