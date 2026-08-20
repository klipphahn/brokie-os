import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  fetchBrokieAiAdmin,
  normalizeProposalDecision,
  readBrokieAiResponse
} from "@/lib/brokie-ai";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    await requireAdminApiUser(request);
    const { jobId } = await params;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(jobId || "")) {
      return NextResponse.json({ ok: false, error: "Invalid proposal id." }, { status: 400 });
    }
    const decision = normalizeProposalDecision(await request.json());
    const response = await fetchBrokieAiAdmin(`/api/ai/proposals/${encodeURIComponent(jobId)}/decision`, {
      method: "POST",
      body: JSON.stringify(decision)
    });
    return NextResponse.json({ ok: true, ...(await readBrokieAiResponse(response)) });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const validation = /Decision/.test(error.message);
    console.error("Brokie AI proposal decision failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: validation ? 400 : 503 });
  }
}
