import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    const supabase = createSupabaseAdminClient();
    const { storefront, products } = await loadStorefrontFeed(supabase);

    return NextResponse.json(
      { ok: true, schemaVersion: "1.0", storefront, products },
      { headers: PUBLIC_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Storefront feed is temporarily unavailable." },
      { status: 503, headers: PUBLIC_HEADERS }
    );
  }
}
