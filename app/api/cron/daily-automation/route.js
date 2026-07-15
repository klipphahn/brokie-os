import { NextResponse } from "next/server";
import { runAutomationCycle } from "@/lib/automation";

function isAuthorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const payload = await runAutomationCycle({ full: false });

    return NextResponse.json({
      ok: true,
      source: "cron",
      ...payload
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Daily automation failed."
      },
      { status: 400 }
    );
  }
}
