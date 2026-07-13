import { NextResponse } from "next/server";
import {
  extractCatalogResult,
  findCatalogProduct,
  getCatalogProduct,
  listCatalogProducts,
  normalizedSize
} from "@/lib/printful";

function sortSizes(values) {
  const order = [
    "xs",
    "s",
    "m",
    "l",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl"
  ];

  return [...values].sort(
    (left, right) =>
      order.indexOf(normalizedSize(left)) -
      order.indexOf(normalizedSize(right))
  );
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const blankName =
      url.searchParams.get("blankName") ||
      process.env.PRINTFUL_DEFAULT_BLANK ||
      "Comfort Colors 1717";

    const products = await listCatalogProducts();
    const match = findCatalogProduct(products, blankName);

    if (!match?.id) {
      throw new Error(
        `Printful catalog product "${blankName}" was not found.`
      );
    }

    const payload = await getCatalogProduct(match.id);
    const { product, variants } = extractCatalogResult(payload);
    const available = variants.filter(
      (variant) =>
        variant?.in_stock !== false &&
        variant?.availability_status !== "discontinued"
    );

    const colors = new Map();

    for (const variant of available) {
      const color = String(variant?.color || "").trim();
      const size = String(variant?.size || "").trim();
      if (!color || !size) continue;

      if (!colors.has(color)) {
        colors.set(color, {
          name: color,
          hex:
            variant?.color_code ||
            variant?.color_code2 ||
            null,
          sizes: new Set()
        });
      }

      colors.get(color).sizes.add(size);
    }

    const options = [...colors.values()]
      .map((color) => ({
        name: color.name,
        hex: color.hex,
        sizes: sortSizes(color.sizes)
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name)
      );

    return NextResponse.json({
      ok: true,
      blank: {
        id: Number(product?.id || match.id),
        name:
          product?.title ||
          product?.name ||
          match?.title ||
          match?.name ||
          blankName
      },
      colors: options,
      sizes: sortSizes(
        new Set(options.flatMap((color) => color.sizes))
      )
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      },
      { status: error?.status || 400 }
    );
  }
}
