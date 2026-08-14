import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  fetchBrokieAi,
  normalizeBrokieAiQueueRequest,
  readBrokieAiResponse
} from "@/lib/brokie-ai";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    await requireAdminApiUser(request);
    const task = normalizeBrokieAiQueueRequest(await request.json());
    const response = await fetchBrokieAi("/api/ai/queue", {
      method: "POST",
      body: JSON.stringify(task)
    });
    return NextResponse.json({ ok: true, ...(await readBrokieAiResponse(response)) });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const validation = /Task|adapter|allowlisted/.test(error.message);
    console.error("Brokie AI queue request failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: validation ? 400 : 503 });
  }
}
