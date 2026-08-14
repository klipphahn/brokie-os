"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { CommunityDiscordInputSchema } from "@/lib/community-discord";

const INFO_SECTIONS = [
  ["roadmap", "Roadmap"],
  ["events", "Events"],
  ["giveaway", "Giveaway"],
  ["truck", "Truck"],
  ["gear", "Gear"]
];

function emptyForm() {
  return {
    live: { verified: false, isLive: false, title: null, url: null },
    info: Object.fromEntries(
      INFO_SECTIONS.map(([key]) => [key, { text: null, url: null }])
    ),
    announcement: { enabled: false, text: null, url: null }
  };
}
function formFromFeed(feed) {
  return {
    live: {
      verified: Boolean(feed?.live?.verified),
      isLive: Boolean(feed?.live?.isLive),
      title: feed?.live?.title || "",
      url: feed?.live?.url || ""
    },
    info: Object.fromEntries(
      INFO_SECTIONS.map(([key]) => [
        key,
        {
          text: feed?.info?.[key]?.text || "",
          url: feed?.info?.[key]?.url || ""
        }
      ])
    ),
    announcement: {
      enabled: Boolean(feed?.announcement?.enabled),
      text: feed?.announcement?.text || "",
      url: feed?.announcement?.url || ""
    }
  };
}

function readJsonMap(label, text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label} must be a JSON object of label-to-URL pairs.`);
  }
  return value;
}

function validationText(result) {
  return result.error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    .join("; ");
}

export default function CommunityDiscordPanel() {
  const [form, setForm] = useState(emptyForm);
  const [linksText, setLinksText] = useState("{}");
  const [socialsText, setSocialsText] = useState("{}");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceAvailable, setSourceAvailable] = useState(false);
  const [notice, setNotice] = useState(null);
  const [jsonErrors, setJsonErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/community/discord", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "Could not load the Discord community feed.");
      }
      setForm(formFromFeed(data));
      setLinksText(JSON.stringify(data.links?.items || {}, null, 2));
      setSocialsText(JSON.stringify(data.socials?.items || {}, null, 2));
      setSourceAvailable(Boolean(data.sourceAvailable));
      setJsonErrors({});
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateLive(field, value) {
    setForm((current) => ({
      ...current,
      live: {
        ...current.live,
        [field]: value,
        ...(field === "verified" && !value ? { isLive: false } : {})
      }
    }));
  }

  function updateInfo(key, field, value) {
    setForm((current) => ({
      ...current,
      info: {
        ...current.info,
        [key]: { ...current.info[key], [field]: value }
      }
    }));
  }

  function updateAnnouncement(field, value) {
    setForm((current) => ({
      ...current,
      announcement: { ...current.announcement, [field]: value }
    }));
  }

  function validateJsonField(name, label, value, setter) {
    setter(value);
    try {
      const map = readJsonMap(label, value);
      const candidate = CommunityDiscordInputSchema.safeParse({
        ...form,
        links: name === "links" ? map : readJsonMap("Official links", linksText),
        socials: name === "socials" ? map : readJsonMap("Social links", socialsText)
      });
      const fieldIssues = candidate.success
        ? []
        : candidate.error.issues.filter((issue) => issue.path[0] === name);
      setJsonErrors((current) => ({
        ...current,
        [name]: fieldIssues.map((issue) => issue.message).join("; ")
      }));
    } catch (error) {
      setJsonErrors((current) => ({ ...current, [name]: error.message }));
    }
  }

  async function save() {
    setNotice(null);
    let payload;
    try {
      payload = {
        ...form,
        links: readJsonMap("Official links", linksText),
        socials: readJsonMap("Social links", socialsText)
      };
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    const validated = CommunityDiscordInputSchema.safeParse(payload);
    if (!validated.success) {
      setNotice({ type: "error", text: validationText(validated) });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/community/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data)
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "Could not save the Discord community feed.");
      }
      setForm(formFromFeed(data));
      setLinksText(JSON.stringify(data.links?.items || {}, null, 2));
      setSocialsText(JSON.stringify(data.socials?.items || {}, null, 2));
      setSourceAvailable(Boolean(data.sourceAvailable));
      setJsonErrors({});
      setNotice({ type: "success", text: "Discord community feed saved." });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel communityPanel" id="community-discord">
      <div className="panelHead">
        <div>
          <span className="eyebrow">COMMUNITY FEED</span>
          <h2>Discord community</h2>
          <p className="communityStatus">
            {sourceAvailable ? "Published source available" : "Safe fallback active"}
          </p>
        </div>
        <button className="secondary" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      {notice && (
        <div className={`managerNotice ${notice.type}`}>
          {notice.type === "success" && <Check size={16} />} {notice.text}
        </div>
      )}

      {loading ? (
        <div className="managerEmpty">
          <LoaderCircle className="spin" />
          <span>Loading community feed…</span>
        </div>
      ) : (
        <div className="communityEditor">
          <fieldset>
            <legend>Verified live status</legend>
            <div className="communityChecks">
              <label>
                <input
                  type="checkbox"
                  checked={form.live.verified}
                  onChange={(event) => updateLive("verified", event.target.checked)}
                />
                Verified
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.live.isLive}
                  disabled={!form.live.verified}
                  onChange={(event) => updateLive("isLive", event.target.checked)}
                />
                Live now
              </label>
            </div>
            <label>
              <span>Live title</span>
              <input
                value={form.live.title || ""}
                maxLength={256}
                onChange={(event) => updateLive("title", event.target.value)}
              />
            </label>
            <label>
              <span>Live URL</span>
              <input
                type="url"
                value={form.live.url || ""}
                onChange={(event) => updateLive("url", event.target.value)}
              />
            </label>
          </fieldset>

          <div className="communityInfoGrid">
            {INFO_SECTIONS.map(([key, label]) => (
              <fieldset key={key}>
                <legend>{label}</legend>
                <label>
                  <span>Text</span>
                  <textarea
                    value={form.info[key].text || ""}
                    maxLength={3500}
                    onChange={(event) => updateInfo(key, "text", event.target.value)}
                  />
                </label>
                <label>
                  <span>Public URL</span>
                  <input
                    type="url"
                    value={form.info[key].url || ""}
                    onChange={(event) => updateInfo(key, "url", event.target.value)}
                  />
                </label>
              </fieldset>
            ))}
          </div>

          <div className="communityJsonGrid">
            <label>
              <span>Official links JSON</span>
              <textarea
                value={linksText}
                spellCheck={false}
                onChange={(event) =>
                  validateJsonField("links", "Official links", event.target.value, setLinksText)
                }
              />
              {jsonErrors.links && <small className="fieldError">{jsonErrors.links}</small>}
            </label>
            <label>
              <span>Social links JSON</span>
              <textarea
                value={socialsText}
                spellCheck={false}
                onChange={(event) =>
                  validateJsonField("socials", "Social links", event.target.value, setSocialsText)
                }
              />
              {jsonErrors.socials && <small className="fieldError">{jsonErrors.socials}</small>}
            </label>
          </div>

          <fieldset>
            <legend>Announcement</legend>
            <div className="communityChecks">
              <label>
                <input
                  type="checkbox"
                  checked={form.announcement.enabled}
                  onChange={(event) => updateAnnouncement("enabled", event.target.checked)}
                />
                Enabled
              </label>
              <small>The server owns and rotates the announcement ID.</small>
            </div>
            <label>
              <span>Announcement text</span>
              <textarea
                value={form.announcement.text || ""}
                maxLength={2000}
                onChange={(event) => updateAnnouncement("text", event.target.value)}
              />
            </label>
            <label>
              <span>Announcement URL</span>
              <input
                type="url"
                value={form.announcement.url || ""}
                onChange={(event) => updateAnnouncement("url", event.target.value)}
              />
            </label>
          </fieldset>

          <div className="communityActions">
            <button type="button" onClick={save} disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
              Save community feed
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

