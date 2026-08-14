"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, LoaderCircle, RefreshCw, Send, Trash2, X } from "lucide-react";

const modes = [
  ["assistant", "Ask Brokie"],
  ["content-metadata", "Content metadata"],
  ["log-summary", "Log summary"],
  ["job-routing", "Task routing"]
];

function formatResult(payload) {
  const result = payload.result || {};

  if (payload.adapter === "assistant") {
    return {
      text: result.answer || "The local model returned no answer.",
      steps: result.suggested_next_steps || []
    };
  }

  if (payload.adapter === "content-metadata") {
    return {
      text: [
        result.title && `TITLE: ${result.title}`,
        result.description && `DESCRIPTION: ${result.description}`,
        result.short_caption && `CAPTION: ${result.short_caption}`,
        Array.isArray(result.keywords) &&
          result.keywords.length &&
          `KEYWORDS: ${result.keywords.join(", ")}`
      ]
        .filter(Boolean)
        .join("\n\n"),
      steps: result.safety_notes || []
    };
  }

  if (payload.adapter === "log-summary") {
    return {
      text: result.summary || JSON.stringify(result, null, 2),
      steps: [
        ...(result.probable_causes || []).map((item) => `Cause: ${item}`),
        ...(result.recommended_actions || []).map(
          (item) => `Action: ${item}`
        )
      ]
    };
  }

  return {
    text: [
      `Category: ${result.category || "unknown"}`,
      `Node: ${result.suggested_node || "human-review"}`,
      `Priority: ${result.priority || "normal"}`,
      result.rationale || ""
    ]
      .filter(Boolean)
      .join("\n"),
    steps: result.steps || []
  };
}

export default function LocalAiConsole() {
  const [status, setStatus] = useState("checking");
  const [mode, setMode] = useState("assistant");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [proposalLoading, setProposalLoading] = useState(true);
  const [deciding, setDeciding] = useState("");

  const loadProposals = useCallback(async () => {
    setProposalLoading(true);
    try {
      const response = await fetch("/api/local-ai/proposals", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Proposal refresh failed.");
      setProposals((payload.jobs || []).filter((job) => job.state === "Proposed"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProposalLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/local-ai/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => active && setStatus(payload.ok ? "online" : "offline"))
      .catch(() => active && setStatus("offline"));
    const proposalRefresh = window.setTimeout(loadProposals, 0);

    return () => {
      active = false;
      window.clearTimeout(proposalRefresh);
    };
  }, [loadProposals]);

  const modeLabel =
    modes.find(([value]) => value === mode)?.[1] || "Ask Brokie";

  async function submit(event) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || loading) return;

    const conversation = messages.slice(-6).map(({ role, text }) => ({
      role,
      text
    }));
    setMessages((current) => [
      ...current,
      { role: "user", text: nextPrompt, meta: modeLabel }
    ]);
    setPrompt("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/local-ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prompt: nextPrompt, conversation })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Local AI request failed.");
      }

      const formatted = formatResult(payload);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: formatted.text,
          steps: formatted.steps,
          meta: `${payload.model || "local model"} · ${payload.target || "local-ai"} · ${payload.elapsedSeconds || "?"}s`
        }
      ]);
      setStatus("online");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("offline");
    } finally {
      setLoading(false);
    }
  }

  async function queueTask() {
    const text = prompt.trim();
    if (!text || queueing) return;
    setQueueing(true);
    setError("");
    try {
      const response = await fetch("/api/local-ai/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          adapter: "auto",
          repository: "brokie-os",
          testProfile: "node-test"
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Task queue failed.");
      setMessages((current) => [...current, {
        role: "assistant",
        text: "Task accepted by the local-first automation queue. If it proposes a code change, it will appear below for approval before execution.",
        meta: `queued · ${payload.requestId}`
      }]);
      setPrompt("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setQueueing(false);
    }
  }

  async function decide(job, action) {
    const verb = action === "approve" ? "approve and release" : "reject";
    if (!window.confirm(`${verb} proposal ${job.id}?`)) return;
    setDeciding(job.id);
    setError("");
    try {
      const response = await fetch(`/api/local-ai/proposals/${encodeURIComponent(job.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Decision failed.");
      setProposals((current) => current.filter((item) => item.id !== job.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeciding("");
    }
  }

  return (
    <section className="panel localAiPanel" id="local-ai">
      <div className="panelHead">
        <div>
          <span className="eyebrow">PRIVATE LOCAL INFERENCE</span>
          <h2>Brokie AI</h2>
        </div>
        <span className={`localAiStatus ${status}`}>
          {status === "checking" ? "CHECKING" : status.toUpperCase()}
        </span>
      </div>

      <div className="localAiLayout">
        <div className="localAiMessages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="localAiEmpty">
              <Bot size={36} />
              <strong>Local AI is connected server-to-server.</strong>
              <span>No console key is exposed to this browser.</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <article className={`localAiMessage ${message.role}`} key={index}>
                <small>{message.meta}</small>
                <p>{message.text}</p>
                {message.steps?.length > 0 && (
                  <ul>
                    {message.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))
          )}
          {loading && (
            <div className="localAiThinking">
              <LoaderCircle className="spin" size={18} /> Local AI is working…
            </div>
          )}
        </div>

        <form className="localAiComposer" onSubmit={submit}>
          <label>
            Work mode
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              {modes.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={8000}
              placeholder="Ask about Brokie operations, content, automation, or routing…"
            />
          </label>
          {error && <p className="localAiError">{error}</p>}
          <div className="localAiActions">
            <button type="button" onClick={() => setMessages([])} disabled={!messages.length}>
              <Trash2 size={16} /> Clear
            </button>
            <button type="submit" className="primary" disabled={loading || !prompt.trim()}>
              <Send size={16} /> Send to local AI
            </button>
          </div>
          <button type="button" className="localAiQueueButton" onClick={queueTask} disabled={queueing || !prompt.trim()}>
            {queueing ? <LoaderCircle className="spin" size={16} /> : <Bot size={16} />}
            Queue approved task
          </button>
          <small className="localAiSafety">Queues analysis and proposals only. Code changes still require approval below; deploys and destructive work remain blocked.</small>
        </form>
      </div>

      <div className="localAiProposalHead">
        <div>
          <span className="eyebrow">HUMAN APPROVAL GATE</span>
          <h3>Code proposals</h3>
        </div>
        <button type="button" onClick={loadProposals} disabled={proposalLoading}>
          <RefreshCw className={proposalLoading ? "spin" : ""} size={15} /> Refresh
        </button>
      </div>
      <div className="localAiProposals" aria-live="polite">
        {!proposalLoading && proposals.length === 0 ? (
          <p>No code proposals are waiting for approval.</p>
        ) : proposals.map((job) => (
          <article key={job.id}>
            <div>
              <small>{job.repository || "repository"} · {job.testProfile || "tests required"}</small>
              <strong>{job.task}</strong>
              <span>{job.id}</span>
            </div>
            <div className="localAiProposalActions">
              <button type="button" onClick={() => decide(job, "reject")} disabled={deciding === job.id}>
                <X size={15} /> Reject
              </button>
              <button type="button" className="primary" onClick={() => decide(job, "approve")} disabled={deciding === job.id}>
                <Check size={15} /> Approve
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
