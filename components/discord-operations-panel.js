"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock3, LoaderCircle, RefreshCw, ShieldCheck, TicketCheck, Trophy, Users } from "lucide-react";
import { formatOperationsDuration } from "@/lib/discord-operations";

export default function DiscordOperationsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/community/discord/operations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || "Could not load Discord operations.");
      setData(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const guild = data?.guilds?.[0] || null;
  const summary = guild?.summary;
  const cards = summary ? [
    [Users, "Members", guild.memberCount],
    [ShieldCheck, "Moderation cases", summary.mod.total],
    [AlertTriangle, "Open appeals", summary.mod.openAppeals],
    [TicketCheck, "Open tickets", summary.tickets.open],
    [Clock3, "Awaiting response", summary.tickets.awaitingResponse],
    [Trophy, "Nominations", summary.nominations]
  ] : [];

  return (
    <section className="panel discordOpsPanel" id="discord-operations">
      <div className="panelHead">
        <div>
          <span className="eyebrow">COMMUNITY OPERATIONS</span>
          <h2>Discord command center</h2>
          <p className="communityStatus">
            {guild ? `${guild.guildName} • Updated ${guild.updatedAt ? new Date(guild.updatedAt).toLocaleString() : "recently"}` : "Waiting for the first protected bot snapshot"}
          </p>
        </div>
        <button className="secondary" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      {error && <div className="managerNotice error">{error}</div>}
      {loading ? (
        <div className="managerEmpty"><LoaderCircle className="spin" /><span>Loading Discord operations…</span></div>
      ) : guild ? (
        <>
          <div className="discordOpsGrid">
            {cards.map(([Icon, label, value]) => (
              <article key={label}><Icon size={18} /><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></article>
            ))}
          </div>
          <div className="discordOpsDetails">
            <article><span>Average first response</span><strong>{formatOperationsDuration(summary.tickets.averageFirstResponseMs)}</strong></article>
            <article><span>Closed tickets</span><strong>{summary.tickets.closed.toLocaleString()}</strong></article>
            <article><span>Top commands</span><strong>{summary.topCommands.join(" • ") || "No usage recorded yet"}</strong></article>
          </div>
        </>
      ) : (
        <div className="managerEmpty"><span>The bot is ready to sync once its protected Supabase secret is installed on Proxmox.</span></div>
      )}
    </section>
  );
}
