"use client";

import { useMemo, useState } from "react";
import { Badge, EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import {
  ArticleCategory,
  MarketingAssetKind,
  ProjectMarketingProfile,
  Row,
  SalesCmsSummary,
  SalesContentArticle,
  SalesMarketingAsset,
  Tone,
} from "../../types/sales.types";
import { fmtDate } from "../../utils/sales.utils";
import { DataTable, FilterChips, TableChrome } from "../SalesUiComponents";

const CATEGORY_META: Record<ArticleCategory, { label: string; icon: string; tone: Tone }> = {
  buyer_guide: { label: "Buyer Guide", icon: "📘", tone: "blue" },
  neighborhood_guide: { label: "Neighborhood Guide", icon: "📍", tone: "green" },
  investment_analysis: { label: "ROI Analysis", icon: "📈", tone: "purple" },
  project_update: { label: "Project Update", icon: "🏗️", tone: "cyan" },
  promotion: { label: "Launch Promo", icon: "🏷️", tone: "yellow" },
  faq: { label: "Sales & Legal FAQ", icon: "⚖️", tone: "gray" },
};

const ASSET_KIND_META: Record<MarketingAssetKind, { label: string; icon: string; tone: Tone }> = {
  brochure: { label: "Brochure (PDF)", icon: "📕", tone: "red" },
  pricelist: { label: "Payment Plan / Price List", icon: "💵", tone: "green" },
  floorplan: { label: "Floor Plan", icon: "📐", tone: "blue" },
  masterplan: { label: "Master Site Plan", icon: "🗺️", tone: "purple" },
  video_tour: { label: "Video Walkthrough", icon: "🎬", tone: "yellow" },
  virtual_tour: { label: "3D / Matterport Tour", icon: "👓", tone: "cyan" },
  image_still: { label: "Hero Render", icon: "🖼️", tone: "blue" },
  legal_pack: { label: "Offer & Legal Pack", icon: "📜", tone: "gray" },
};

export function CMSView({
  articles,
  assets,
  profiles,
  summary,
  projects,
  loading,
  search,
  setSearch,
  status,
  setStatus,
  selectedCategory,
  setSelectedCategory,
  selectedAssetKind,
  setSelectedAssetKind,
  onPublishArticle,
  onUnpublishArticle,
  onSaveArticle,
  onDeleteArticle,
  onSaveAsset,
  onDeleteAsset,
  onRecordAssetDownload,
  onSaveProjectProfile,
  onSeedDefaults,
}: {
  articles: SalesContentArticle[];
  assets: SalesMarketingAsset[];
  profiles: ProjectMarketingProfile[];
  summary: SalesCmsSummary | null;
  projects: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedAssetKind: string;
  setSelectedAssetKind: (v: string) => void;
  onPublishArticle: (id: string) => Promise<any>;
  onUnpublishArticle: (id: string) => Promise<any>;
  onSaveArticle: (payload: Partial<SalesContentArticle>, id?: string) => Promise<any>;
  onDeleteArticle: (id: string) => Promise<boolean>;
  onSaveAsset: (payload: FormData | Record<string, unknown>, id?: string) => Promise<any>;
  onDeleteAsset: (id: string) => Promise<boolean>;
  onRecordAssetDownload: (id: string) => Promise<void>;
  onSaveProjectProfile: (payload: Partial<ProjectMarketingProfile>, id?: string) => Promise<any>;
  onSeedDefaults: () => Promise<void>;
}) {
  const [activeSection, setActiveSection] = useState<"articles" | "assets" | "profiles">("articles");
  const [editingArticle, setEditingArticle] = useState<Partial<SalesContentArticle> | null>(null);
  const [previewArticle, setPreviewArticle] = useState<SalesContentArticle | null>(null);
  const [editingAsset, setEditingAsset] = useState<Partial<SalesMarketingAsset> | null>(null);
  const [editingProfile, setEditingProfile] = useState<Partial<ProjectMarketingProfile> | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Copy share link helper
  function handleCopyShare(text: string, label: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  }

  // Filtered lists
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (status && a.status !== status) return false;
      if (selectedCategory && selectedCategory !== "all" && a.category !== selectedCategory) return false;
      return true;
    });
  }, [articles, status, selectedCategory]);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (selectedAssetKind && selectedAssetKind !== "all" && a.asset_kind !== selectedAssetKind) return false;
      return true;
    });
  }, [assets, selectedAssetKind]);

  const totalViews = summary?.total_views ?? articles.reduce((acc, a) => acc + (a.views_count || 0), 0);
  const publishedCount = summary?.published_articles ?? articles.filter((a) => a.status === "published").length;
  const totalAssetsCount = summary?.total_assets ?? assets.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24 }}>🎨</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
              Native Sales Content Management System (CMS)
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                fontWeight: 600,
              }}
            >
              Zero-Sync Conflict &bull; Multi-Tenant Isolated
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.75)", margin: 0, lineHeight: 1.5 }}>
            Empower your sales and marketing team to publish homebuyer guides, market analyses, digital brochures, 
            and 3D walkthroughs directly inside Center Estates without maintaining external CMS servers.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn primary sm"
            onClick={onSeedDefaults}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            <span>🚀</span>
            <span>{articles.length === 0 ? "Seed Real Estate Guides & Media" : "Re-sync Default Content"}</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip cols={5}>
        <KpiCard
          icon="📰"
          iconBg="var(--color-indigo-bg)"
          iconColor="var(--color-indigo)"
          label="Total Content"
          value={number.format(articles.length)}
          sub="Guides & Articles"
          onClick={() => { setActiveSection("articles"); setStatus(""); }}
        />
        <KpiCard
          icon="✅"
          iconBg="var(--color-green-bg)"
          iconColor="var(--color-success)"
          label="Published"
          value={number.format(publishedCount)}
          sub="Publicly Visible"
          onClick={() => { setActiveSection("articles"); setStatus("published"); }}
        />
        <KpiCard
          icon="📝"
          iconBg="var(--color-amber-bg)"
          iconColor="var(--color-amber-strong)"
          label="Drafts"
          value={number.format(articles.length - publishedCount)}
          sub="Under Editing"
          onClick={() => { setActiveSection("articles"); setStatus("draft"); }}
        />
        <KpiCard
          icon="📁"
          iconBg="var(--color-sky-bg)"
          iconColor="var(--color-cyan)"
          label="Sales Collateral"
          value={number.format(totalAssetsCount)}
          sub="PDFs, Plans & 3D Tours"
          onClick={() => setActiveSection("assets")}
        />
        <KpiCard
          icon="👁️"
          iconBg="var(--color-violet-bg)"
          iconColor="var(--color-violet)"
          label="Content Views"
          value={number.format(totalViews)}
          sub="Buyer Engagement"
        />
      </KpiStrip>

      {/* Section Switcher Tabs */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: 8 }}>
        <button
          className={`btn sm ${activeSection === "articles" ? "primary" : "secondary"}`}
          onClick={() => setActiveSection("articles")}
          style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 20 }}
        >
          <span>📰</span>
          <span>Buyer Guides &amp; Articles ({articles.length})</span>
        </button>
        <button
          className={`btn sm ${activeSection === "assets" ? "primary" : "secondary"}`}
          onClick={() => setActiveSection("assets")}
          style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 20 }}
        >
          <span>📁</span>
          <span>Marketing Collateral &amp; Media ({assets.length})</span>
        </button>
        <button
          className={`btn sm ${activeSection === "profiles" ? "primary" : "secondary"}`}
          onClick={() => setActiveSection("profiles")}
          style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 20 }}
        >
          <span>🏢</span>
          <span>Project Marketing Profiles ({projects.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: BUYER GUIDES & ARTICLES                        */}
      {/* ========================================================= */}
      {activeSection === "articles" && (
        <Panel
          title="Sales Articles & Buyer Education Library"
          badge={filteredArticles.length}
        >
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search article headline, summary, tags..."
            chips={
              <FilterChips
                options={[
                  { value: "buyer_guide", label: "Buyer Guide" },
                  { value: "neighborhood_guide", label: "Neighborhood" },
                  { value: "investment_analysis", label: "ROI Analysis" },
                  { value: "project_update", label: "Project Update" },
                  { value: "faq", label: "Legal FAQ" },
                ]}
                value={selectedCategory as any}
                onChange={(v) => setSelectedCategory(v || "all")}
              />
            }
            actions={
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn primary sm"
                  onClick={() => setEditingArticle({
                    title: "",
                    category: "buyer_guide",
                    summary: "",
                    body: "## Introduction\n\nWrite your content here...",
                    status: "draft",
                    is_featured: false,
                    read_time_minutes: 3,
                    tags: [],
                  })}
                >
                  + New Article
                </button>
              </div>
            }
          >
            {filteredArticles.length === 0 ? (
              <EmptyState
                icon="📰"
                title="No articles found"
                description="Create your first real estate article or click 'Seed Real Estate Guides' to populate default guides."
                action={
                  <button className="btn primary sm" onClick={onSeedDefaults}>
                    🚀 Seed Real Estate Guides
                  </button>
                }
              />
            ) : (
              <DataTable headers={["Article Headline", "Category", "Project", "Status", "Read Time", "Views", "Actions"]}>
                {filteredArticles.map((a) => {
                  const cat = CATEGORY_META[a.category] || { label: a.category, icon: "📄", tone: "gray" };
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {a.cover_image_url ? (
                            <img
                              src={a.cover_image_url}
                              alt=""
                              style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 6,
                                background: "var(--color-surface-alt)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 20,
                              }}
                            >
                              {cat.icon}
                            </div>
                          )}
                          <div>
                            <strong style={{ fontSize: 13, cursor: "pointer" }} onClick={() => setPreviewArticle(a)}>
                              {a.title}
                            </strong>
                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                              by {a.author_name || "Sales Team"} &bull; slug: <span className="mono">/{a.slug}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={cat.tone}>
                          {cat.icon} {cat.label}
                        </Badge>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {a.project_name ? <span>{a.project_name}</span> : <span style={{ color: "var(--color-muted)" }}>General</span>}
                      </td>
                      <td>
                        <StatusPill
                          value={a.status === "published" ? "Published" : "Draft"}
                          tone={a.status === "published" ? "green" : "yellow"}
                        />
                      </td>
                      <td style={{ fontSize: 12 }}>{a.read_time_minutes} min</td>
                      <td className="mono" style={{ fontSize: 12 }}>{number.format(a.views_count)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            className="btn ghost sm"
                            onClick={() => setPreviewArticle(a)}
                            title="Preview Article"
                          >
                            👁️
                          </button>
                          <button
                            className="btn ghost sm"
                            onClick={() => setEditingArticle(a)}
                            title="Edit Article"
                          >
                            ✏️
                          </button>
                          {a.status === "published" ? (
                            <button
                              className="btn secondary sm"
                              onClick={() => onUnpublishArticle(a.id)}
                              title="Unpublish"
                              style={{ fontSize: 11 }}
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              className="btn success sm"
                              onClick={() => onPublishArticle(a.id)}
                              title="Publish Live"
                              style={{ fontSize: 11 }}
                            >
                              Publish
                            </button>
                          )}
                          <button
                            className="btn ghost sm"
                            onClick={async () => {
                              if (confirm(`Delete article "${a.title}"?`)) {
                                await onDeleteArticle(a.id);
                              }
                            }}
                            title="Delete"
                            style={{ color: "var(--color-danger)" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </TableChrome>
        </Panel>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: MARKETING COLLATERAL & MEDIA ASSET LIBRARY      */}
      {/* ========================================================= */}
      {activeSection === "assets" && (
        <Panel
          title="Sales Collateral & Digital Assets"
          badge={filteredAssets.length}
        >
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search brochures, floor plans, video links..."
            chips={
              <FilterChips
                options={[
                  { value: "brochure", label: "Brochures" },
                  { value: "pricelist", label: "Price Lists" },
                  { value: "floorplan", label: "Floor Plans" },
                  { value: "masterplan", label: "Master Plans" },
                  { value: "video_tour", label: "Video Tours" },
                  { value: "virtual_tour", label: "3D Virtual Tours" },
                ]}
                value={selectedAssetKind as any}
                onChange={(v) => setSelectedAssetKind(v || "all")}
              />
            }
            actions={
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn primary sm"
                  onClick={() => setEditingAsset({
                    title: "",
                    asset_kind: "brochure",
                    external_url: "",
                    description: "",
                    is_public: true,
                  })}
                >
                  + Add Collateral
                </button>
              </div>
            }
          >
            {filteredAssets.length === 0 ? (
              <EmptyState
                icon="📁"
                title="No collateral found"
                description="Upload project brochures, pricing schedules, or floor plans to empower sales reps with instant shareable links."
                action={
                  <button className="btn primary sm" onClick={onSeedDefaults}>
                    🚀 Seed Sample Collateral
                  </button>
                }
              />
            ) : (
              <DataTable headers={["Collateral Name", "Type", "Project", "Direct Share Link", "Size / Downloads", "Actions"]}>
                {filteredAssets.map((asset) => {
                  const meta = ASSET_KIND_META[asset.asset_kind] || { label: asset.asset_kind, icon: "📄", tone: "gray" };
                  const shareTarget = asset.share_url || asset.file_url || asset.external_url || "";
                  const isCopied = copiedLink === asset.id;
                  return (
                    <tr key={asset.id}>
                      <td>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 22 }}>{meta.icon}</span>
                          <div>
                            <strong style={{ fontSize: 13 }}>{asset.title}</strong>
                            {asset.description && (
                              <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2, maxWidth: 300 }}>
                                {asset.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {asset.project_name ? <span>{asset.project_name}</span> : <span style={{ color: "var(--color-muted)" }}>All Projects</span>}
                      </td>
                      <td>
                        {shareTarget ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                              className={`btn sm ${isCopied ? "success" : "secondary"}`}
                              onClick={() => handleCopyShare(shareTarget, asset.id)}
                              style={{ fontSize: 11, padding: "3px 8px" }}
                            >
                              {isCopied ? "✅ Copied!" : "📋 Copy Link"}
                            </button>
                            <a
                              href={shareTarget}
                              target="_blank"
                              rel="noreferrer"
                              className="btn ghost sm"
                              onClick={() => onRecordAssetDownload(asset.id)}
                              style={{ fontSize: 11 }}
                            >
                              🔗 Open
                            </a>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Pending upload</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 11 }}>
                          {asset.file_size ? `${(asset.file_size / (1024 * 1024)).toFixed(1)} MB` : "Link"}
                          <div style={{ color: "var(--color-muted)" }}>{asset.downloads_count} downloads</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            className="btn ghost sm"
                            onClick={() => setEditingAsset(asset)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn ghost sm"
                            onClick={async () => {
                              if (confirm(`Delete collateral "${asset.title}"?`)) {
                                await onDeleteAsset(asset.id);
                              }
                            }}
                            title="Delete"
                            style={{ color: "var(--color-danger)" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </TableChrome>
        </Panel>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: PROJECT MARKETING PROFILES                      */}
      {/* ========================================================= */}
      {activeSection === "profiles" && (
        <Panel
          title="Project Marketing Profiles & Landing Page Config"
          badge={projects.length}
        >
          {projects.length === 0 ? (
            <EmptyState
              icon="🏢"
              title="No sales projects registered"
              description="Register projects in Projects & Units to configure marketing elevator pitches and amenities."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, padding: 18 }}>
              {projects.map((proj) => {
                const profile = profiles.find((p) => String(p.project) === String(proj.id));
                return (
                  <div
                    key={String(proj.id)}
                    style={{
                      background: "var(--color-surface-alt)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ fontSize: 15 }}>{String(proj.name ?? "Project")}</strong>
                        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                          Code: {String(proj.code ?? "—")}
                        </div>
                      </div>
                      <button
                        className="btn secondary sm"
                        onClick={() => setEditingProfile(profile || {
                          project: String(proj.id),
                          headline: "",
                          marketing_pitch: "",
                          amenities: ["Borehole", "Backup Generator", "High-Speed Lifts", "24/7 CCTV Security"],
                          virtual_tour_url: "",
                          video_tour_url: "",
                          is_featured: false,
                        })}
                      >
                        ✏️ {profile ? "Edit Marketing Profile" : "Configure Profile"}
                      </button>
                    </div>

                    {profile?.headline ? (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-info)",
                          fontStyle: "italic",
                          borderLeft: "3px solid var(--color-info)",
                          paddingLeft: 8,
                        }}
                      >
                        &ldquo;{profile.headline}&rdquo;
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--color-muted)", fontStyle: "italic" }}>
                        No marketing headline configured yet.
                      </div>
                    )}

                    {profile?.marketing_pitch && (
                      <p style={{ fontSize: 12, color: "var(--color-text)", margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {profile.marketing_pitch}
                      </p>
                    )}

                    {profile?.amenities && profile.amenities.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {profile.amenities.map((am) => (
                          <span
                            key={am}
                            style={{
                              fontSize: 11,
                              background: "var(--color-surface)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 4,
                              padding: "2px 8px",
                            }}
                          >
                            ✨ {am}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8, borderTop: "1px dashed var(--color-border)", fontSize: 11 }}>
                      {profile?.virtual_tour_url ? (
                        <a href={profile.virtual_tour_url} target="_blank" rel="noreferrer" style={{ color: "var(--color-info)" }}>
                          👓 3D Tour
                        </a>
                      ) : (
                        <span style={{ color: "var(--color-muted)" }}>No 3D tour</span>
                      )}
                      <span>&bull;</span>
                      {profile?.video_tour_url ? (
                        <a href={profile.video_tour_url} target="_blank" rel="noreferrer" style={{ color: "var(--color-info)" }}>
                          🎬 Video Walkthrough
                        </a>
                      ) : (
                        <span style={{ color: "var(--color-muted)" }}>No video tour</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ARTICLE EDITOR MODAL                             */}
      {/* ========================================================= */}
      {editingArticle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editingArticle.id ? "✏️ Edit Marketing Article" : "✨ Create New Sales Article"}
              </h3>
              <button
                className="btn secondary sm"
                onClick={() => setEditingArticle(null)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  ARTICLE HEADLINE / TITLE *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%", fontSize: 14 }}
                  value={editingArticle.title || ""}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  placeholder="e.g. Navigating Off-Plan Escrow Payments in Nairobi"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    CATEGORY
                  </label>
                  <select
                    className="input"
                    style={{ width: "100%" }}
                    value={editingArticle.category || "buyer_guide"}
                    onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value as ArticleCategory })}
                  >
                    <option value="buyer_guide">📘 Homebuyer &amp; Investor Guide</option>
                    <option value="neighborhood_guide">📍 Neighborhood &amp; Area Guide</option>
                    <option value="investment_analysis">📈 ROI &amp; Market Analysis</option>
                    <option value="project_update">🏗️ Project Update &amp; Progress</option>
                    <option value="promotion">🏷️ Special Offer / Launch Promo</option>
                    <option value="faq">⚖️ Sales &amp; Legal FAQ</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    ASSOCIATED PROJECT (OPTIONAL)
                  </label>
                  <select
                    className="input"
                    style={{ width: "100%" }}
                    value={editingArticle.project || ""}
                    onChange={(e) => setEditingArticle({ ...editingArticle, project: e.target.value || null })}
                  >
                    <option value="">General (All Projects)</option>
                    {projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  COVER IMAGE URL
                </label>
                <input
                  type="url"
                  className="input"
                  style={{ width: "100%", fontSize: 12 }}
                  value={editingArticle.cover_image_url || ""}
                  onChange={(e) => setEditingArticle({ ...editingArticle, cover_image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  SUMMARY / EXCERPT (SEO Meta Description &amp; Card Teaser)
                </label>
                <textarea
                  rows={2}
                  className="input"
                  style={{ width: "100%", fontSize: 12 }}
                  value={editingArticle.summary || ""}
                  onChange={(e) => setEditingArticle({ ...editingArticle, summary: e.target.value })}
                  placeholder="A concise summary displayed on social shares and card listings..."
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  ARTICLE BODY (Markdown &amp; Headings)
                </label>
                <textarea
                  rows={10}
                  className="input"
                  style={{ width: "100%", fontSize: 12, fontFamily: "monospace", lineHeight: 1.5 }}
                  value={editingArticle.body || ""}
                  onChange={(e) => setEditingArticle({ ...editingArticle, body: e.target.value })}
                  placeholder="## Heading\n\nWrite your rich formatted article..."
                />
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editingArticle.status === "published"}
                    onChange={(e) => setEditingArticle({
                      ...editingArticle,
                      status: e.target.checked ? "published" : "draft",
                    })}
                  />
                  <span>Publish immediately</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!editingArticle.is_featured}
                    onChange={(e) => setEditingArticle({
                      ...editingArticle,
                      is_featured: e.target.checked,
                    })}
                  />
                  <span>Pin as featured</span>
                </label>
              </div>
            </div>

            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "var(--color-surface-alt)",
              }}
            >
              <button className="btn secondary sm" onClick={() => setEditingArticle(null)}>
                Cancel
              </button>
              <button
                className="btn primary sm"
                onClick={async () => {
                  if (!editingArticle.title?.trim()) {
                    alert("Headline is required.");
                    return;
                  }
                  await onSaveArticle(editingArticle, editingArticle.id);
                  setEditingArticle(null);
                }}
              >
                💾 Save Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ARTICLE PREVIEW MODAL                            */}
      {/* ========================================================= */}
      {previewArticle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Badge tone="blue">{CATEGORY_META[previewArticle.category]?.label || "Article"}</Badge>
                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                  {previewArticle.read_time_minutes} min read &bull; {fmtDate(previewArticle.published_at || previewArticle.created_at)}
                </span>
              </div>
              <button
                className="btn secondary sm"
                onClick={() => setPreviewArticle(null)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "24px 28px", overflowY: "auto" }}>
              {previewArticle.cover_image_url && (
                <img
                  src={previewArticle.cover_image_url}
                  alt=""
                  style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 18 }}
                />
              )}
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px 0" }}>
                {previewArticle.title}
              </h1>
              {previewArticle.summary && (
                <p style={{ fontSize: 14, color: "var(--color-muted)", fontStyle: "italic", marginBottom: 18, lineHeight: 1.5 }}>
                  {previewArticle.summary}
                </p>
              )}
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--color-text)",
                  whiteSpace: "pre-wrap",
                  borderTop: "1px solid var(--color-border)",
                  paddingTop: 16,
                }}
              >
                {previewArticle.body}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: COLLATERAL ASSET MODAL                           */}
      {/* ========================================================= */}
      {editingAsset && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              width: "100%",
              maxWidth: 580,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editingAsset.id ? "✏️ Edit Marketing Collateral" : "📁 Add Sales Collateral"}
              </h3>
              <button
                className="btn secondary sm"
                onClick={() => setEditingAsset(null)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  COLLATERAL TITLE *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%", fontSize: 13 }}
                  value={editingAsset.title || ""}
                  onChange={(e) => setEditingAsset({ ...editingAsset, title: e.target.value })}
                  placeholder="e.g. Master Development Brochure & Finishes (PDF)"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    COLLATERAL TYPE
                  </label>
                  <select
                    className="input"
                    style={{ width: "100%" }}
                    value={editingAsset.asset_kind || "brochure"}
                    onChange={(e) => setEditingAsset({ ...editingAsset, asset_kind: e.target.value as MarketingAssetKind })}
                  >
                    <option value="brochure">📕 Brochure (PDF)</option>
                    <option value="pricelist">💵 Price List / Payment Plan</option>
                    <option value="floorplan">📐 Architectural Floor Plan</option>
                    <option value="masterplan">🗺️ Master Site Plan</option>
                    <option value="video_tour">🎬 Video Walkthrough</option>
                    <option value="virtual_tour">👓 3D / Matterport Tour</option>
                    <option value="image_still">🖼️ High-Res Hero Render</option>
                    <option value="legal_pack">📜 Offer &amp; Legal Pack</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    PROJECT
                  </label>
                  <select
                    className="input"
                    style={{ width: "100%" }}
                    value={editingAsset.project || ""}
                    onChange={(e) => setEditingAsset({ ...editingAsset, project: e.target.value || null })}
                  >
                    <option value="">All Projects</option>
                    {projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  EXTERNAL URL / CLOUD LINK (Matterport, YouTube, Google Drive, CDN)
                </label>
                <input
                  type="url"
                  className="input"
                  style={{ width: "100%", fontSize: 13 }}
                  value={editingAsset.external_url || ""}
                  onChange={(e) => setEditingAsset({ ...editingAsset, external_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  DESCRIPTION
                </label>
                <textarea
                  rows={2}
                  className="input"
                  style={{ width: "100%", fontSize: 12 }}
                  value={editingAsset.description || ""}
                  onChange={(e) => setEditingAsset({ ...editingAsset, description: e.target.value })}
                  placeholder="Summary of what this document covers..."
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editingAsset.is_public !== false}
                  onChange={(e) => setEditingAsset({ ...editingAsset, is_public: e.target.checked })}
                />
                <span>Publicly shareable via direct link</span>
              </label>
            </div>

            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "var(--color-surface-alt)",
              }}
            >
              <button className="btn secondary sm" onClick={() => setEditingAsset(null)}>
                Cancel
              </button>
              <button
                className="btn primary sm"
                onClick={async () => {
                  if (!editingAsset.title?.trim()) {
                    alert("Title is required.");
                    return;
                  }
                  await onSaveAsset(editingAsset, editingAsset.id);
                  setEditingAsset(null);
                }}
              >
                💾 Save Collateral
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: PROJECT MARKETING PROFILE MODAL                  */}
      {/* ========================================================= */}
      {editingProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                🏢 Configure Project Marketing Profile
              </h3>
              <button
                className="btn secondary sm"
                onClick={() => setEditingProfile(null)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  MARKETING HEADLINE / TAGLINE
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%", fontSize: 13 }}
                  value={editingProfile.headline || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, headline: e.target.value })}
                  placeholder="e.g. Luxury Living Redefined in Kilimani"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  SALES ELEVATOR PITCH &amp; NARRATIVE
                </label>
                <textarea
                  rows={4}
                  className="input"
                  style={{ width: "100%", fontSize: 12 }}
                  value={editingProfile.marketing_pitch || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, marketing_pitch: e.target.value })}
                  placeholder="Comprehensive description of the architectural design, finishes, and lifestyle..."
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  AMENITIES &amp; KEY FEATURES (Comma-separated)
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%", fontSize: 13 }}
                  value={(editingProfile.amenities || []).join(", ")}
                  onChange={(e) => setEditingProfile({
                    ...editingProfile,
                    amenities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                  placeholder="Infinity Pool, Heated Gym, Borehole, Backup Generator, 24/7 CCTV"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    3D / VIRTUAL TOUR EMBED LINK
                  </label>
                  <input
                    type="url"
                    className="input"
                    style={{ width: "100%", fontSize: 12 }}
                    value={editingProfile.virtual_tour_url || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, virtual_tour_url: e.target.value })}
                    placeholder="https://my.matterport.com/..."
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    VIDEO WALKTHROUGH LINK (YouTube / Vimeo)
                  </label>
                  <input
                    type="url"
                    className="input"
                    style={{ width: "100%", fontSize: 12 }}
                    value={editingProfile.video_tour_url || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, video_tour_url: e.target.value })}
                    placeholder="https://youtube.com/..."
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "var(--color-surface-alt)",
              }}
            >
              <button className="btn secondary sm" onClick={() => setEditingProfile(null)}>
                Cancel
              </button>
              <button
                className="btn primary sm"
                onClick={async () => {
                  await onSaveProjectProfile(editingProfile, editingProfile.id);
                  setEditingProfile(null);
                }}
              >
                💾 Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
