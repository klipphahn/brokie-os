import { NextResponse } from "next/server";

export async function POST() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || "2026-07";

  if (!domain || !token) {
    return NextResponse.json(
      { error: "Shopify domain or Admin API token is missing." },
      { status: 400 }
    );
  }

  const response = await fetch(
    `https://${domain}/admin/api/${version}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token
      },
      body: JSON.stringify({
        query: "query ShopIdentity { shop { name myshopifyDomain } }"
      }),
      cache: "no-store"
    }
  );

  const data = await response.json();
  if (!response.ok || data.errors) {
    return NextResponse.json(
      { error: "Shopify connection failed.", details: data },
      { status: response.status || 400 }
    );
  }

  return NextResponse.json({
    message: `Shopify connected to ${data.data.shop.name}.`,
    shop: data.data.shop
  });
}
