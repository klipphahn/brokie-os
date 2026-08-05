import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminApiAuthError, requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  announcementNeedsNewId,
  buildCommunityDiscordFeed,
  CommunityDiscordInputSchema,
  COMMUNITY_SINGLETON,
  communityInputToRow,
  safeCommunityDiscordFeed
} from "@/lib/community-discord";
import {
  createSupabaseAdminClient,
  tryCreateSupabaseAdminClient
} from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff"
};

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

async function readCommunityRow(supabase) {
  const { data, error } = await supabase
    .from("discord_community_feed")
    .select("*")
    .eq("singleton", COMMUNITY_SINGLETON)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
function validationMessage(error) {
  if (!(error instanceof z.ZodError)) return null;
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    .join("; ");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}

export async function GET() {
  try {
    const supabase = tryCreateSupabaseAdminClient();
    const [row, storefront] = await Promise.all([
      readCommunityRow(supabase),
      loadStorefrontFeed(supabase)
    ]);
    const products = Array.isArray(storefront?.products) ? storefront.products : [];

    return NextResponse.json(
      buildCommunityDiscordFeed({
        row,
        products,
        storefrontAvailable: products.length > 0
      }),
      { headers: PUBLIC_HEADERS }
    );
  } catch {
    return NextResponse.json(safeCommunityDiscordFeed(), {
      status: 200,
      headers: PUBLIC_HEADERS
    });
  }
}

export async function POST(request) {
  try {
    await requireAdminApiUser(request);
    const input = CommunityDiscordInputSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const currentRow = await readCommunityRow(supabase);
    const announcementId = announcementNeedsNewId(input, currentRow)
      ? randomUUID()
      : null;
    const nextRow = communityInputToRow(input, {
      currentRow,
      announcementId
    });
    const { data, error } = await supabase
      .from("discord_community_feed")
      .upsert(nextRow, { onConflict: "singleton" })
      .select("*")
      .single();
    if (error || !data) throw error || new Error("Community feed save failed.");

    const storefront = await loadStorefrontFeed(supabase);
    const products = Array.isArray(storefront?.products) ? storefront.products : [];
    return NextResponse.json(
      buildCommunityDiscordFeed({
        row: data,
        products,
        storefrontAvailable: products.length > 0
      }),
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    const validationError = validationMessage(error);
    const status =
      error instanceof AdminApiAuthError
        ? error.status
        : validationError || error instanceof SyntaxError
          ? 400
          : 503;
    const message =
      error instanceof AdminApiAuthError
        ? error.message
        : validationError ||
          (error instanceof SyntaxError
            ? "Request body must be valid JSON."
            : "Community feed could not be saved.");
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: PRIVATE_HEADERS }
    );
  }
}

