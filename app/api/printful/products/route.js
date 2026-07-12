import { NextResponse } from "next/server";
import { z } from "zod";

const productSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  variantIds: z.array(z.number().int().positive()).min(1),
  frontUrl: z.string().url(),
  backUrl: z.union([z.string().url(), z.literal("")]).optional()
});

const requestSchema = z.object({
  dryRun: z.boolean(),
  products: z.array(productSchema).min(1).max(10)
});

function createPayload(product) {
  return {
    sync_product: { name: product.title },
    sync_variants: product.variantIds.map((variantId, index) => ({
      variant_id: variantId,
      retail_price: product.price,
      sku: `BROKIE-${product.id.toUpperCase()}-${index + 1}`,
      files: [
        { type: "front", url: product.frontUrl },
        ...(product.backUrl ? [{ type: "back", url: product.backUrl }] : [])
      ]
    }))
  };
}

export async function POST(request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Each selected product needs at least one variant ID and a public front artwork URL.",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const prepared = parsed.data.products.map((product) => ({
    id: product.id,
    title: product.title,
    payload: createPayload(product)
  }));

  if (parsed.data.dryRun) {
    return NextResponse.json({
      ok: true,
      mode: "dry-run",
      message: `${prepared.length} payload(s) validated. Nothing was sent to Printful.`,
      products: prepared
    });
  }

  const token = process.env.PRINTFUL_TOKEN;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!token) {
    return NextResponse.json(
      { ok: false, message: "PRINTFUL_TOKEN is missing.", products: prepared },
      { status: 400 }
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (storeId) headers["X-PF-Store-Id"] = storeId;

  const results = [];
  for (const item of prepared) {
    try {
      const response = await fetch("https://api.printful.com/store/products", {
        method: "POST",
        headers,
        body: JSON.stringify(item.payload),
        cache: "no-store"
      });
      const data = await response.json();
      results.push({
        id: item.id,
        title: item.title,
        ok: response.ok,
        status: response.status,
        data
      });
    } catch (error) {
      results.push({
        id: item.id,
        title: item.title,
        ok: false,
        status: 0,
        data: { error: error.message }
      });
    }
  }

  const successful = results.filter((result) => result.ok).length;
  return NextResponse.json(
    {
      ok: successful === results.length,
      mode: "live",
      message: `${successful}/${results.length} products created successfully.`,
      results
    },
    { status: successful ? 200 : 400 }
  );
}
