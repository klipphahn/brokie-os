import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  BROKIE_OS_ORIGIN,
  collectEcosystemHealth
} from "@/lib/ecosystem-health";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

async function readDiscordBotHeartbeat() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("discord_operations_state")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { configured: true, updatedAt: data?.updated_at || null };
  } catch {
    return { configured: true, error: true, updatedAt: null };
  }
}

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const discordBotHeartbeat = await readDiscordBotHeartbeat();
    const report = await collectEcosystemHealth({
      origin: BROKIE_OS_ORIGIN,
      discordBotHeartbeat
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
