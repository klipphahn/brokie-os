import { NextResponse } from "next/server";
import { diagnosePrintful } from "@/lib/printful-bridge";

async function test() {
  try {
    const diagnostics = await diagnosePrintful();

    return NextResponse.json({
      ok: true,
      message: "Printful is connected.",
      diagnostics
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        details: error?.payload || null
      },
      { status: error?.status || 400 }
    );
  }
}

export async function GET() {
  return test();
}

export async function POST() {
  return test();
}
