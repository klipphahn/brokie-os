import { NextResponse } from "next/server";
import { findOnlineStorePublication } from "@/lib/shopify-publications";

export async function GET() {
  try {
    const publication = await findOnlineStorePublication();
    return NextResponse.json({
      ok: true,
      publication,
      message: `${publication.title} publication is available.`
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        requiredScopes: ["read_publications", "write_publications"]
      },
      { status: 400 }
    );
  }
}
