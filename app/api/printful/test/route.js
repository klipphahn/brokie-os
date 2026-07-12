import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.PRINTFUL_TOKEN;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!token) {
    return NextResponse.json(
      { error: "PRINTFUL_TOKEN is missing from the deployment environment." },
      { status: 400 }
    );
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (storeId) headers["X-PF-Store-Id"] = storeId;

  const response = await fetch("https://api.printful.com/stores", {
    headers,
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.message || "Printful rejected the credentials.", details: data },
      { status: response.status }
    );
  }

  return NextResponse.json({
    message: `Printful connected. ${Array.isArray(data.result) ? data.result.length : 1} store record(s) available.`,
    stores: data.result
  });
}
