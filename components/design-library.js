"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Heart,
  History,
  LayoutGrid,
  List,
  LoaderCircle,
  PackageOpen,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const emptyFilters = {
  status: "",
  productType: "",
  audience: "",
  style: "",
  theme: ""
};

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD"
    }
  );
}

function performanceLabel(metrics) {
  const orders = Number(metrics?.orders || 0);
  const clicks = Number(metrics?.clicks || 0);

  if (!orders && !clicks) return "Awaiting data";
  if (orders >= 10) return "Winner";
  if (orders >= 3) return "Promising";
  if (clicks >= 20) return "Getting attention";
  return "Testing";
}

export default function DesignLibrary() {
  const [items, setItems] = useState([]);
  const [facets, setFacets] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [archived, setArchived] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (query.trim()) params.set("q", query.trim());
      if (favorites) params.set("favorite", "true");
      if (archived) params.set("archived", "true");

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(
        `/api/designs?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Unable to load designs."
        );
      }

      setItems(data.designs || []);
      setFacets(data.facets || {});

      if (
        selectedId &&
        !data.designs.some(
          (item) => item.id === selectedId
        )
      ) {
        setSelectedId(null);
        setEdit(null);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [query, favorites, archived, filters]);

  async function repairLegacyDesigns() {
    setWorking("repair_legacy_batch");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repair_legacy_batch" })
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Legacy designs could not be repaired.");
      }

      setMessage(
        data.failures?.length
          ? `${data.message} ${data.failures.length} need manual review.`
          : data.message
      );
      await load();
    } catch (repairError) {
      setError(repairError.message);
    } finally {
      setWorking("");
    }
  }

  const selected = useMemo(
    () =>
      items.find((item) => item.id === selectedId) ||
      null,
    [items, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setEdit(null);
      return;
    }

    setEdit({
      name: selected.name || "",
      prompt: selected.prompt || "",
      theme:
        selected.theme ||
        selected.resolved_dna?.theme ||
        "",
      audience:
        selected.target_audience ||
        selected.resolved_dna?.audience ||
        "",
      style:
        selected.visual_style ||
        selected.resolved_dna?.style ||
        "",
      placement:
        selected.placement ||
        selected.resolved_dna?.placement ||
        "",
      colors: (
        selected.color_palette?.length
          ? selected.color_palette
          : selected.resolved_dna?.colors || []
      ).join(", "),
      changeNote: ""
    });
  }, [selectedId, selected?.updated_at]);

  function patchFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function apiAction(payload) {
    setWorking(
      `${payload.action || "patch"}:${payload.id}`
    );
    setMessage("");
    setError("");

    try {
      const method = payload.action ? "POST" : "PATCH";
      const response = await fetch("/api/designs", {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Design action failed."
        );
      }

      setMessage(data.message || "Design updated.");
      await load();
      return data;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    } finally {
      setWorking("");
    }
  }

  async function toggleFavorite(item) {
    await apiAction({
      id: item.id,
      favorite: !item.favorite
    });
  }

  async function saveDetails() {
    if (!selected || !edit) return;

    await apiAction({
      id: selected.id,
      name: edit.name,
      prompt: edit.prompt,
      theme: edit.theme,
      target_audience: edit.audience,
      visual_style: edit.style,
      placement: edit.placement,
      color_palette: edit.colors
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      design_dna: {
        ...(selected.design_dna || {}),
        theme: edit.theme,
        audience: edit.audience,
        style: edit.style,
        placement: edit.placement,
        colors: edit.colors
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      }
    });
  }

  async function saveVersion() {
    if (!selected || !edit) return;

    await apiAction({
      action: "new_version",
      id: selected.id,
      name: edit.name,
      prompt: edit.prompt,
      artworkUrl: selected.front_artwork_url,
      thumbnailUrl: selected.thumbnail_url,
      designDna: {
        ...(selected.design_dna || {}),
        theme: edit.theme,
        audience: edit.audience,
        style: edit.style,
        placement: edit.placement,
        colors: edit.colors
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      },
      changeNote:
        edit.changeNote ||
        `Saved from Design Library 3.0`
    });
  }

  async function remove(item) {
    if (
      !confirm(
        `Permanently delete "${item.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setWorking(`delete:${item.id}`);
    setError("");

    try {
      const response = await fetch(
        `/api/designs?id=${encodeURIComponent(
          item.id
        )}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Delete failed."
        );
      }

      setSelectedId(null);
      setMessage("Design permanently deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setWorking("");
    }
  }

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    Number(favorites) +
    Number(archived);

  return (
    <section
      className="panel designVault"
      id="designs"
    >
      <div className="panelHead">
        <div>
          <span className="eyebrow">
            DESIGN LIBRARY 3.0
          </span>
          <h2>Your brand&apos;s creative vault</h2>
        </div>

        <div className="libraryHeadActions">
          <button
            className="secondary"
            onClick={repairLegacyDesigns}
            disabled={loading || Boolean(working)}
          >
            {working === "repair_legacy_batch" ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Repair legacy designs
          </button>

          <button
            className="secondary"
            onClick={() => setShowFilters((value) => !value)}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <b className="filterCount">
                {activeFilterCount}
              </b>
            )}
          </button>

          <button
            className="secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="vaultToolbar">
        <div className="vaultSearch">
          <Search size={17} />
          <input
            placeholder="Search names, prompts, themes, colors, audiences, styles, and tags…"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          className={
            favorites
              ? "secondary activeFilter"
              : "secondary"
          }
          onClick={() =>
            setFavorites((value) => !value)
          }
        >
          <Heart
            size={16}
            fill={favorites ? "currentColor" : "none"}
          />
          Favorites
        </button>

        <button
          className={
            archived
              ? "secondary activeFilter"
              : "secondary"
          }
          onClick={() =>
            setArchived((value) => !value)
          }
        >
          <Archive size={16} />
          Archive
        </button>

        <div className="viewSwitcher">
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="vaultFilters">
          {[
            ["status", "Status", facets.statuses],
            [
              "productType",
              "Product type",
              facets.productTypes
            ],
            [
              "audience",
              "Audience",
              facets.audiences
            ],
            ["style", "Visual style", facets.styles],
            ["theme", "Theme", facets.themes]
          ].map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select
                value={filters[key]}
                onChange={(event) =>
                  patchFilter(key, event.target.value)
                }
              >
                <option value="">All</option>
                {(options || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <button
            className="textButton"
            onClick={() => {
              setFilters(emptyFilters);
              setFavorites(false);
              setArchived(false);
            }}
          >
            <SlidersHorizontal size={15} />
            Clear filters
          </button>
        </div>
      )}

      {message && (
        <div className="managerNotice success">
          {message}
        </div>
      )}

      {error && (
        <div className="managerNotice error">
          {error}
        </div>
      )}

      <div className="vaultSummary">
        <span>
          <strong>{items.length}</strong> designs shown
        </span>
        <span>
          <strong>
            {
              items.filter(
                (item) =>
                  item.product?.online_store_published
              ).length
            }
          </strong>{" "}
          live
        </span>
        <span>
          <strong>
            {
              items.filter((item) => item.favorite)
                .length
            }
          </strong>{" "}
          favorites
        </span>
        <span>
          <strong>
            {items.reduce(
              (sum, item) =>
                sum +
                Number(item.metrics?.orders || 0),
              0
            )}
          </strong>{" "}
          recorded orders
        </span>
      </div>

      {loading ? (
        <div className="managerEmpty">
          <LoaderCircle className="spin" />
          <span>Loading the creative vault…</span>
        </div>
      ) : items.length ? (
        <div
          className={
            view === "grid"
              ? "vaultGrid"
              : "vaultList"
          }
        >
          {items.map((item) => {
            const dna = item.resolved_dna || {};
            const live =
              Boolean(
                item.product?.online_store_published
              );

            return (
              <article
                className={`vaultCard ${
                  selectedId === item.id
                    ? "selectedVaultCard"
                    : ""
                }`}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="vaultArtwork">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                    />
                  ) : (
                    <PackageOpen size={30} />
                  )}

                  <button
                    className={`favoriteButton ${
                      item.favorite ? "favorited" : ""
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(item);
                    }}
                    aria-label="Favorite design"
                  >
                    <Heart
                      size={17}
                      fill={
                        item.favorite
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>

                  <span
                    className={`vaultStatus ${
                      live ? "live" : item.status
                    }`}
                  >
                    {live ? "LIVE" : item.status}
                  </span>
                </div>

                <div className="vaultCardBody">
                  <div className="vaultCardTopline">
                    <span>
                      {dna.productType ||
                        item.product_type ||
                        "Artwork"}
                    </span>
                    <span>
                      v{item.current_version || 1}
                    </span>
                  </div>

                  <h3>{item.name}</h3>

                  <p className="vaultHeadline">
                    {dna.headline ||
                      item.prompt ||
                      "Built with The Brokie Brand DNA."}
                  </p>

                  <div className="dnaTags">
                    {[dna.theme, dna.audience, dna.style]
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                  </div>

                  <div className="paletteDots">
                    {(dna.colors || [])
                      .slice(0, 6)
                      .map((color) => (
                        <i
                          key={color}
                          style={{
                            background: color
                          }}
                          title={color}
                        />
                      ))}
                  </div>

                  <div className="vaultPerformance">
                    <div>
                      <strong>
                        {performanceLabel(item.metrics)}
                      </strong>
                      <span>performance</span>
                    </div>
                    <div>
                      <strong>
                        {item.metrics?.orders || 0}
                      </strong>
                      <span>orders</span>
                    </div>
                    <div>
                      <strong>
                        {money(item.metrics?.revenue)}
                      </strong>
                      <span>revenue</span>
                    </div>
                  </div>

                  <div className="vaultCardActions">
                    {item.front_artwork_url && (
                      <a
                        href={item.front_artwork_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <ExternalLink size={14} />
                        Artwork
                      </a>
                    )}

                    {item.product?.shopify_admin_url && (
                      <a
                        href={
                          item.product.shopify_admin_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        Shopify
                        <ExternalLink size={13} />
                      </a>
                    )}

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        apiAction({
                          action: "duplicate",
                          id: item.id
                        });
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="managerEmpty">
          <Search />
          <span>
            No matching designs. Adjust filters or
            generate something in Foundry.
          </span>
        </div>
      )}

      {selected && edit && (
        <div
          className="designDrawerBackdrop"
          onClick={() => setSelectedId(null)}
        >
          <aside
            className="designDrawer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="drawerHeader">
              <div>
                <span className="eyebrow">
                  DESIGN DNA
                </span>
                <h2>{selected.name}</h2>
              </div>

              <button
                className="drawerClose"
                onClick={() => setSelectedId(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="drawerHero">
              <img
                src={
                  selected.thumbnail_url ||
                  selected.front_artwork_url ||
                  ""
                }
                alt={selected.name}
              />
            </div>

            <div className="drawerStatusRow">
              <span className="statusPill">
                {selected.status}
              </span>
              <span>
                Version {selected.current_version || 1}
              </span>
              <span>
                {selected.product
                  ?.online_store_published
                  ? "Live in Shopify"
                  : "Not live"}
              </span>
            </div>

            <div className="drawerMetrics">
              {[
                ["Views", selected.metrics?.views],
                ["Clicks", selected.metrics?.clicks],
                ["Orders", selected.metrics?.orders],
                [
                  "Revenue",
                  money(selected.metrics?.revenue)
                ]
              ].map(([label, value]) => (
                <article key={label}>
                  <strong>{value || 0}</strong>
                  <span>{label}</span>
                </article>
              ))}
            </div>

            <div className="drawerFields">
              <label>
                Design name
                <input
                  value={edit.name}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Theme
                <input
                  value={edit.theme}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      theme: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Audience
                <input
                  value={edit.audience}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      audience: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Visual style
                <input
                  value={edit.style}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      style: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Placement
                <input
                  value={edit.placement}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      placement: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Colors
                <input
                  value={edit.colors}
                  placeholder="#FF4F00, #FFC107, #FFFFFF"
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      colors: event.target.value
                    }))
                  }
                />
              </label>

              <label className="drawerWide">
                Original prompt
                <textarea
                  value={edit.prompt}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      prompt: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <div className="drawerActions">
              <button
                onClick={saveDetails}
                disabled={!!working}
              >
                <Save size={16} />
                Save Design DNA
              </button>

              <button
                className="secondary"
                onClick={() =>
                  apiAction({
                    action: "duplicate",
                    id: selected.id
                  })
                }
                disabled={!!working}
              >
                <Copy size={16} />
                Duplicate
              </button>

              <a
                href="#publisher"
                onClick={() => setSelectedId(null)}
              >
                <Sparkles size={15} />
                Open Publisher
              </a>
            </div>

            <div className="versionPanel">
              <div className="versionPanelHead">
                <div>
                  <History size={17} />
                  <strong>Version history</strong>
                </div>
                <span>
                  {selected.versions?.length || 0} saved
                </span>
              </div>

              <label>
                Version note
                <input
                  value={edit.changeNote}
                  placeholder="What changed in this version?"
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      changeNote: event.target.value
                    }))
                  }
                />
              </label>

              <button
                className="secondary saveVersionButton"
                onClick={saveVersion}
                disabled={!!working}
              >
                <History size={15} />
                Save current state as new version
              </button>

              <div className="versionTimeline">
                {(selected.versions || []).map(
                  (version) => (
                    <article key={version.id}>
                      <div>
                        <strong>
                          v{version.version_number}
                        </strong>
                        <span>
                          {new Date(
                            version.created_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <p>
                        {version.change_note ||
                          "Saved design version"}
                      </p>
                    </article>
                  )
                )}
              </div>
            </div>

            <div className="dangerActions">
              {selected.archived_at ? (
                <button
                  className="secondary"
                  onClick={() =>
                    apiAction({
                      action: "restore",
                      id: selected.id
                    })
                  }
                >
                  <ArchiveRestore size={15} />
                  Restore design
                </button>
              ) : (
                <button
                  className="secondary"
                  onClick={() =>
                    apiAction({
                      action: "archive",
                      id: selected.id
                    })
                  }
                >
                  <Archive size={15} />
                  Archive design
                </button>
              )}

              <button
                className="deleteDesignButton"
                onClick={() => remove(selected)}
              >
                <Trash2 size={15} />
                Permanently delete
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
