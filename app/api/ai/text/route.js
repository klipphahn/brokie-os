import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiUser, AdminApiAuthError } from "@/lib/admin-api-auth";
import { generateText } from "@/lib/ai-provider";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  system: z.string().max(12000).optional(),
  prompt: z.string().min(1).max(24000),
  schema: z.record(z.any()).optional(),
  schemaName: z.string().regex(/^[A-Za-z0-9_-]+$/).max(64).optional()
});

export async function POST(request) {
  try {
    await requireAdminApiUser(request);
    const body = RequestSchema.parse(await request.json());
    const messages = [];
    if (body.system) messages.push({ role: "system", content: body.system });
    messages.push({ role: "user", content: body.prompt });

    const result = await generateText({
      messages,
      schema: body.schema,
      schemaName: body.schemaName
    });

    return NextResponse.json(
      {
        ok: true,
        provider: result.provider,
        model: result.model,
        fallbackUsed: result.fallbackUsed,
        text: result.text
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status =
      error instanceof AdminApiAuthError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 503;

    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; ")
        : error.message || "AI text request failed.";

    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
