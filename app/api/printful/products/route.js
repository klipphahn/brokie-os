import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "The legacy Printful product-creation route has been retired. Shopify-connected products must be imported and configured through /api/printful/bridge using the Ecommerce Platform Sync API.",
      replacement: "/api/printful/bridge"
    },
    { status: 410 }
  );
}
