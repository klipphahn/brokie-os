import { z } from "zod";

const CountSchema = z.number().int().nonnegative().catch(0);
const NullableDurationSchema = z.number().int().nonnegative().nullable().catch(null);

const SummarySchema = z.object({
  mod: z.object({ total: CountSchema, openAppeals: CountSchema }).catch({ total: 0, openAppeals: 0 }),
  tickets: z.object({
    total: CountSchema,
    open: CountSchema,
    closed: CountSchema,
    awaitingResponse: CountSchema,
    averageFirstResponseMs: NullableDurationSchema
  }).catch({ total: 0, open: 0, closed: 0, awaitingResponse: 0, averageFirstResponseMs: null }),
  topCommands: z.array(z.string().max(100)).max(5).catch([]),
  nominations: CountSchema
}).catch({
  mod: { total: 0, openAppeals: 0 },
  tickets: { total: 0, open: 0, closed: 0, awaitingResponse: 0, averageFirstResponseMs: null },
  topCommands: [],
  nominations: 0
});

export function safeDiscordOperationsRow(row) {
  if (!row || typeof row !== "object") return null;
  const guildId = String(row.guild_id || "").slice(0, 32);
  if (!/^\d{16,24}$/.test(guildId)) return null;
  const updatedAt = Number.isFinite(Date.parse(row.updated_at)) ? new Date(row.updated_at).toISOString() : null;
  const capturedAt = Number.isFinite(Date.parse(row.state?.captured_at)) ? new Date(row.state.captured_at).toISOString() : updatedAt;
  return {
    guildId,
    guildName: String(row.guild_name || "Discord server").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100),
    memberCount: Math.max(0, Number.isSafeInteger(row.member_count) ? row.member_count : 0),
    capturedAt,
    updatedAt,
    summary: SummarySchema.parse(row.state?.summary)
  };
}

export function formatOperationsDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return "Not available";
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
