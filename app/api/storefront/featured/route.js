import { NextResponse } from "next/server";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  "X-Content-Type-Options": "nosniff"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}

export async function GET() {
  try {
    const supabase = tryCreateSupabaseAdminClient();
    const { storefront, products, brain, launch, activity } = await loadStorefrontFeed(supabase);

    return NextResponse.json(
      { ok: true, schemaVersion: "1.1", storefront, products, brain, launch, activity },
      { headers: PUBLIC_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Storefront feed is temporarily unavailable." },
      { status: 503, headers: PUBLIC_HEADERS }
    );
  }
}
