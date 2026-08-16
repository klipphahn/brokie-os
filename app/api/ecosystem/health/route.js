import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  BROKIE_OS_ORIGIN,
  collectEcosystemHealth
} from "@/lib/ecosystem-health";

export const runtime = "nodejs";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const report = await collectEcosystemHealth({
      origin: BROKIE_OS_ORIGIN
    });
    return NextResponse.json(report, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 503;
    const message =
      error instanceof AdminApiAuthError
        ? error.message
        : "Ecosystem health is unavailable.";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: PRIVATE_HEADERS }
    );
  }
}
