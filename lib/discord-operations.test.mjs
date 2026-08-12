import assert from "node:assert/strict";
import test from "node:test";
import { formatOperationsDuration, safeDiscordOperationsRow } from "./discord-operations.js";

test("discord operations row exposes bounded aggregates only", () => {
  const value = safeDiscordOperationsRow({
    guild_id: "1517741718126989342",
    guild_name: "Brokie\u0000 Server",
    member_count: 12,
    updated_at: "2026-08-12T00:00:00Z",
    state: {
      captured_at: "2026-08-12T00:00:00Z",
      moderation_cases: [{ reason: "private" }],
      summary: {
        mod: { total: 2, openAppeals: 1 },
        tickets: { total: 4, open: 1, closed: 3, awaitingResponse: 1, averageFirstResponseMs: 3_600_000 },
        topCommands: ["/help (4)"], nominations: 2
      }
    }
  });
  assert.equal(value.guildName, "Brokie Server");
  assert.equal(value.summary.mod.total, 2);
  assert.equal(value.moderation_cases, undefined);
  assert.equal(formatOperationsDuration(value.summary.tickets.averageFirstResponseMs), "1h");
});

test("discord operations rejects invalid guild identifiers", () => {
  assert.equal(safeDiscordOperationsRow({ guild_id: "bad" }), null);
});
