"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Factory,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  audiences,
  moods,
  palettes,
  placements,
  productTypes,
  visualStyles
} from "@/lib/foundry-options";

const initialForm = {
  name: "Still Building Collection",
  theme: "Union electricians",
  audience: "Union electricians",
  productType: "Heavyweight Tee",
  style: "Premium graffiti",
  mood: "Relentless",
  placement: "Small left chest + large back",
  palette: "brokie-core",
  count: 5,
  autoPublish: false,
  basePrompt:
    "Create a cohesive collection for union electricians who take pride in discipline, overtime, skill, loyalty, and building a better life."
};

function statusIcon(status) {
  if (status === "completed") return <CheckCircle2 size={15} />;
  if (status === "failed") return <XCircle size={15} />;
  if (status === "generating") {
    return <LoaderCircle size={15} className="spin" />;
  }
  return <CircleDashed size={15} />;
}

export default function DesignFactory() {
  const [form, setForm] = useState(initialForm);
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const stopRef = useRef(false);

  const palette = useMemo(
    () =>
      palettes.find((item) => item.id === form.palette) ||
      palettes[0],
    [form.palette]
  );

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadRuns() {
    const response = await fetch("/api/design-factory", {
      cache: "no-store"
    });
    const data = await response.json();
    if (response.ok && data.ok) setRuns(data.runs || []);
  }

  async function loadRun(runId = run?.id) {
    if (!runId) return null;

    const response = await fetch(
      `/api/design-factory?runId=${encodeURIComponent(runId)}`,
      { cache: "no-store" }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Factory run could not be loaded.");
    }

    setRun(data.run);
    return data.run;
  }

  useEffect(() => {
    loadRuns();
  }, []);

  async function createRun() {
    setCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/design-factory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_run",
          ...form,
          colors: palette.colors
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Factory run could not be created.");
      }

      setRun(data.run);
      setMessage(data.message);
      await loadRuns();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setCreating(false);
    }
  }

  async function control(action) {
    if (!run?.id) return;

    setError("");

    try {
      const response = await fetch("/api/design-factory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          runId: run.id
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Factory action failed.");
      }

      setRun(data.run);
      await loadRuns();
    } catch (controlError) {
      setError(controlError.message);
    }
  }

  async function report(action, payload) {
    const response = await fetch("/api/design-factory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        runId: run.id,
        ...payload
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Factory status update failed.");
    }

    setRun(data.run);
    return data.run;
  }

  async function processFactory() {
    if (!run?.id || processing) return;

    stopRef.current = false;
    setProcessing(true);
    setError("");
    setMessage("");

    try {
      let currentRun = await loadRun(run.id);

      while (
        !stopRef.current &&
        !["completed", "cancelled", "paused"].includes(
          currentRun.status
        )
      ) {
        const claimResponse = await fetch("/api/design-factory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "claim_next",
            runId: currentRun.id
          })
        });

        const claim = await claimResponse.json();

        if (!claimResponse.ok || !claim.ok) {
          throw new Error(claim.error || "Could not claim next job.");
        }

        if (!claim.job) {
          currentRun = claim.run;
          setRun(currentRun);
          break;
        }

        setRun((value) => ({
          ...value,
          status: "running",
          jobs: value.jobs.map((job) =>
            job.id === claim.job.id ? claim.job : job
          )
        }));

        try {
          const generateResponse = await fetch("/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: claim.job.prompt,
              productType: currentRun.product_type,
              audience: currentRun.audience,
              style: currentRun.visual_style,
              mood: currentRun.mood,
              placement: currentRun.placement,
              palette: currentRun.palette,
              colors: currentRun.colors,
              variations: 1
            })
          });

          const generated = await generateResponse.json();

          if (!generateResponse.ok || !generated.ok) {
            throw new Error(
              generated.error || "Artwork generation failed."
            );
          }

          const result = generated.results?.[0];

          currentRun = await report("complete_job", {
            jobId: claim.job.id,
            designId: result?.image?.designId || null,
            collectionId: currentRun.collection_id,
            conceptName: result?.concept?.concept_name || null,
            artworkUrl:
              result?.mockups?.back?.publicUrl ||
              result?.image?.publicUrl ||
              null
          });

          window.dispatchEvent(
            new Event("brokie-design-created")
          );
        } catch (jobError) {
          currentRun = await report("fail_job", {
            jobId: claim.job.id,
            error: jobError.message
          });
        }
      }

      if (currentRun.status === "completed") {
        setMessage(
          `${currentRun.completed_count} designs completed and saved to Design Library.`
        );
      } else if (currentRun.status === "needs_attention") {
        setMessage(
          "Factory run finished with failures. Review and retry failed jobs."
        );
      }

      await loadRuns();
    } catch (processError) {
      setError(processError.message);
    } finally {
      setProcessing(false);
    }
  }

  function stopProcessing() {
    stopRef.current = true;
  }

  const completed =
    run?.jobs?.filter((job) => job.status === "completed").length ||
    run?.completed_count ||
    0;

  const failed =
    run?.jobs?.filter((job) => job.status === "failed").length ||
    run?.failed_count ||
    0;

  const progress = run?.requested_count
    ? Math.round(
        ((completed + failed) / run.requested_count) * 100
      )
    : 0;

  return (
    <section className="panel designFactory" id="factory">
      <div className="panelHead">
        <div>
          <span className="eyebrow">DESIGN FACTORY V2.2</span>
          <h2>Build an entire collection</h2>
        </div>
        <Factory className="orangeIcon" />
      </div>

      <div className="factoryLayout">
        <div className="factoryControls">
          <div className="factoryControlGrid">
            <label>
              Collection name
              <input
                value={form.name}
                onChange={(event) =>
                  update("name", event.target.value)
                }
              />
            </label>

            <label>
              Theme
              <input
                value={form.theme}
                onChange={(event) =>
                  update("theme", event.target.value)
                }
              />
            </label>

            <label>
              Product
              <select
                value={form.productType}
                onChange={(event) =>
                  update("productType", event.target.value)
                }
              >
                {productTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Audience
              <select
                value={form.audience}
                onChange={(event) =>
                  update("audience", event.target.value)
                }
              >
                {audiences.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Style
              <select
                value={form.style}
                onChange={(event) =>
                  update("style", event.target.value)
                }
              >
                {visualStyles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Mood
              <select
                value={form.mood}
                onChange={(event) =>
                  update("mood", event.target.value)
                }
              >
                {moods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Placement
              <select
                value={form.placement}
                onChange={(event) =>
                  update("placement", event.target.value)
                }
              >
                {placements.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Designs
              <select
                value={form.count}
                onChange={(event) =>
                  update("count", Number(event.target.value))
                }
              >
                <option value={5}>5 — test collection</option>
                <option value={10}>10 — focused drop</option>
                <option value={15}>15 — full collection</option>
                <option value={25}>25 — factory run</option>
              </select>
            </label>
          </div>

          <label>
            Collection brief
            <textarea
              value={form.basePrompt}
              onChange={(event) =>
                update("basePrompt", event.target.value)
              }
            />
          </label>

          <div className="factoryPalette">
            <span>COLOR SYSTEM</span>
            <div>
              {palettes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    form.palette === item.id
                      ? "activePalette"
                      : ""
                  }
                  onClick={() => update("palette", item.id)}
                >
                  <span className="miniSwatches">
                    {item.colors.map((color) => (
                      <i
                        key={color}
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="factoryEstimate">
            <AlertTriangle size={17} />
            <span>
              This run will make approximately{" "}
              <strong>{form.count * 2} image requests</strong> and{" "}
              <strong>{form.count} concept requests</strong>. It
              generates coordinated front and back artwork plus two
              shirt mockups for each design. It works one design at a
              time so you can pause it.
            </span>
          </div>

          <button
            className="forgeButton"
            onClick={createRun}
            disabled={
              creating ||
              form.basePrompt.trim().length < 10
            }
          >
            {creating ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}
            {creating
              ? "Building queue…"
              : `Queue ${form.count}-design collection`}
          </button>
        </div>

        <div className="factoryRunPanel">
          {!run ? (
            <div className="factoryEmpty">
              <Factory size={34} />
              <h3>No active factory run</h3>
              <p>
                Configure a collection and create the queue. The
                factory will save every finished design directly
                into Design Library.
              </p>

              {runs.length > 0 && (
                <div className="recentFactoryRuns">
                  <span>RECENT RUNS</span>
                  {runs.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadRun(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <small>
                        {item.completed_count}/{item.requested_count} ·{" "}
                        {item.status}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="factoryRunHead">
                <div>
                  <span className="eyebrow">ACTIVE RUN</span>
                  <h3>{run.name}</h3>
                  <p>
                    {run.requested_count} designs · {run.audience} ·{" "}
                    {run.product_type}
                  </p>
                </div>
                <span className={`factoryRunStatus ${run.status}`}>
                  {run.status}
                </span>
              </div>

              <div className="factoryProgress">
                <div>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p>
                  <strong>{completed}</strong> completed ·{" "}
                  <strong>{failed}</strong> failed ·{" "}
                  <strong>{run.requested_count - completed - failed}</strong>{" "}
                  remaining
                </p>
              </div>

              <div className="factoryActions">
                {!processing ? (
                  <button
                    onClick={processFactory}
                    disabled={[
                      "completed",
                      "cancelled",
                      "paused"
                    ].includes(run.status)}
                  >
                    <Play size={16} />
                    Start / Continue
                  </button>
                ) : (
                  <button
                    className="secondary"
                    onClick={stopProcessing}
                  >
                    <Square size={15} />
                    Stop after current design
                  </button>
                )}

                {run.status === "running" && (
                  <button
                    className="secondary"
                    onClick={() => {
                      stopProcessing();
                      control("pause");
                    }}
                  >
                    <Pause size={16} />
                    Pause
                  </button>
                )}

                {run.status === "paused" && (
                  <button
                    className="secondary"
                    onClick={() => control("resume")}
                  >
                    <Play size={16} />
                    Resume
                  </button>
                )}

                {failed > 0 && (
                  <button
                    className="secondary"
                    onClick={() => control("retry_failed")}
                  >
                    <RotateCcw size={16} />
                    Retry failed
                  </button>
                )}

                <button
                  className="secondary"
                  onClick={() => loadRun(run.id)}
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>

                {!["completed", "cancelled"].includes(run.status) && (
                  <button
                    className="factoryCancel"
                    onClick={() => control("cancel")}
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                )}
              </div>

              <div className="factoryJobs">
                {run.jobs?.map((job) => (
                  <article
                    key={job.id}
                    className={`factoryJob ${job.status}`}
                  >
                    <div className="factoryJobNumber">
                      {String(job.sequence_number).padStart(2, "0")}
                    </div>

                    <div className="factoryJobBody">
                      <strong>
                        {job.concept_name || job.creative_angle}
                      </strong>
                      <span>{job.status}</span>
                      {job.error_message && (
                        <small>{job.error_message}</small>
                      )}
                    </div>

                    <div className="factoryJobResult">
                      {job.artwork_url ? (
                        <img src={job.artwork_url} alt="" />
                      ) : (
                        statusIcon(job.status)
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {run.status === "completed" && (
                <div className="factoryComplete">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Collection complete</strong>
                    <span>
                      All designs are saved in Design Library and
                      linked to {run.collections?.name || run.name}.
                    </span>
                  </div>
                  <a href="#designs">Open Design Library</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {message && (
        <div className="managerNotice success">{message}</div>
      )}

      {error && (
        <div className="managerNotice error">{error}</div>
      )}
    </section>
  );
}
