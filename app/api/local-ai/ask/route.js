import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  fetchBrokieAi,
  normalizeBrokieAiRequest,
  readBrokieAiResponse
} from "@/lib/brokie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    await requireAdminApiUser(request);
    const task = normalizeBrokieAiRequest(await request.json());
    const response = await fetchBrokieAi("/api/ai/ask", {
      method: "POST",
      body: JSON.stringify(task)
    });
    const payload = await readBrokieAiResponse(response);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    const isValidationError = /mode|Prompt/.test(error.message);
    console.error("Brokie AI request failed:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: isValidationError ? 400 : 503 }
    );
  }
}
