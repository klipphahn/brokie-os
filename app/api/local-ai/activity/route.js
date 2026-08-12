import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  fetchBrokieAi,
  normalizeAutomationActivity,
  readBrokieAiResponse
} from "@/lib/brokie-ai";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const response = await fetchBrokieAi("/api/ai/activity");
    const payload = await readBrokieAiResponse(response);
    return NextResponse.json({ ok: true, ...normalizeAutomationActivity(payload) });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("Automation activity request failed:", error.message);
    return NextResponse.json(
      { ok: false, error: "Automation activity is currently unavailable." },
      { status: 503 }
    );
  }
}
