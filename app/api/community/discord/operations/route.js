import { NextResponse } from "next/server";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import { safeDiscordOperationsRow } from "@/lib/discord-operations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("discord_operations_state")
      .select("guild_id,guild_name,member_count,state,updated_at")
      .order("updated_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    const guilds = (Array.isArray(data) ? data : []).map(safeDiscordOperationsRow).filter(Boolean);
    return NextResponse.json({ ok: true, sourceAvailable: guilds.length > 0, guilds }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 503;
    const message = error instanceof AdminApiAuthError ? error.message : "Discord operations data is unavailable.";
    return NextResponse.json({ ok: false, error: message }, { status, headers: PRIVATE_HEADERS });
  }
}
