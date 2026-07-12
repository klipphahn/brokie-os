import { NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify";

export async function POST() {
  try {
    const data = await shopifyGraphQL(`
      query {
        shop {
          name
          myshopifyDomain
          email
          plan { displayName }
        }
        productsCount(limit: null) { count }
      }
    `);

    return NextResponse.json({
      ok: true,
      message: `Shopify connected to ${data.shop.name}.`,
      shop: data.shop,
      productCount: data.productsCount.count
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}
