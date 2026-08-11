import { NextResponse } from "next/server";
import { requireAdminApiUser, AdminApiAuthError } from "@/lib/admin-api-auth";
import { getAiProviderStatus } from "@/lib/ai-provider";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const status = await getAiProviderStatus();
    return NextResponse.json({ ok: true, ...status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 503;
    return NextResponse.json(
      { ok: false, error: error.message || "AI provider status unavailable." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
