import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.PRINTFUL_TOKEN;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!token) {
    return NextResponse.json({ error: "PRINTFUL_TOKEN is missing." }, { status: 400 });
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (storeId) headers["X-PF-Store-Id"] = storeId;

  const response = await fetch("https://api.printful.com/stores", { headers, cache: "no-store" });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
