import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText, Folder, Upload, Search, Download, Eye, Trash2, Plus, X,
} from "lucide-react";

import {
  addDocument,
  deleteDocument,
  fetchProjectDocuments,
  uploadFile,
  type ProjectDocument,
} from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { KpiCard } from "../components/KpiCard";
import { PageEmpty, PageError, PageLoading, StatusPill, TableEmpty } from "../components/PageState";

const DOC_TYPES = [
  { value: "drawing", label: "Drawing" },
  { value: "contract", label: "Contract" },
  { value: "permit", label: "Permit" },
  { value: "report", label: "Report" },
  { value: "boq", label: "BoQ" },
  { value: "other", label: "Other" },
] as const;

const DISCIPLINES = [
  { value: "", label: "— None —" },
  { value: "architectural", label: "Architectural" },
  { value: "structural", label: "Structural" },
  { value: "mep", label: "MEP" },
  { value: "civil", label: "Civil" },
  { value: "qs", label: "Quantity Surveying" },
] as const;

function docLabel(docType: string): string {
  return DOC_TYPES.find((t) => t.value === docType)?.label
    ?? docType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function disciplineLabel(d: string): string {
  if (!d) return "—";
  return DISCIPLINES.find((x) => x.value === d)?.label
    ?? d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function openUrl(url: string | null | undefined) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ProjectDocuments() {
  const { activeProjectId, activeProject, loading: wsLoading } = useWorkspace();
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    doc_type: "drawing",
    remote_url: "",
    discipline: "",
    revision_number: "",
  });
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!activeProjectId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectDocuments(activeProjectId);
      setDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message || "Failed to load documents");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const folders = useMemo(() => {
    const byType = new Map<string, number>();
    const byDiscipline = new Map<string, number>();
    for (const d of docs) {
      const t = d.doc_type || "other";
      byType.set(t, (byType.get(t) || 0) + 1);
      if (d.discipline) {
        byDiscipline.set(d.discipline, (byDiscipline.get(d.discipline) || 0) + 1);
      }
    }
    const typeFolders = Array.from(byType.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, count]) => ({
        id: `type:${id}`,
        label: docLabel(id),
        count,
        kind: "type" as const,
      }));
    const disciplineFolders = Array.from(byDiscipline.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, count]) => ({
        id: `discipline:${id}`,
        label: disciplineLabel(id),
        count,
        kind: "discipline" as const,
      }));
    return {
      all: docs.length,
      typeFolders,
      disciplineFolders,
    };
  }, [docs]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (selectedFolder.startsWith("type:")) {
        const t = selectedFolder.slice(5);
        if ((d.doc_type || "other") !== t) return false;
      } else if (selectedFolder.startsWith("discipline:")) {
        const disc = selectedFolder.slice(11);
        if ((d.discipline || "") !== disc) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          d.title,
          d.doc_type,
          d.discipline,
          d.revision_number,
          String(d.id),
          d.remote_url,
          d.latest_url,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, selectedFolder, search]);

  const typeCount = (t: string) => docs.filter((d) => (d.doc_type || "other") === t).length;
  const withUrl = docs.filter((d) => d.latest_url || d.remote_url).length;

  const handleCreate = async () => {
    if (!activeProjectId) return;
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let remoteUrl = form.remote_url.trim();
      if (uploadFileObj) {
        setUploading(true);
        remoteUrl = await uploadFile(uploadFileObj);
        setUploading(false);
      }
      if (!remoteUrl) {
        setError("Upload a file or provide a remote URL");
        setSaving(false);
        return;
      }
      await addDocument(activeProjectId, {
        title: form.title.trim(),
        doc_type: form.doc_type,
        remote_url: remoteUrl,
        discipline: form.discipline || undefined,
        revision_number: form.revision_number || undefined,
        format: uploadFileObj?.name.split(".").pop() || "",
      });
      setForm({ title: "", doc_type: "drawing", remote_url: "", discipline: "", revision_number: "" });
      setUploadFileObj(null);
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message || "Failed to add document");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (!activeProjectId) return;
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    setError(null);
    try {
      await deleteDocument(activeProjectId, doc.id);
      await load();
    } catch (e) {
      setError((e as Error).message || "Failed to delete document");
    }
  };

  if (wsLoading) return <div style={{ padding: 20 }}><PageLoading /></div>;

  if (!activeProjectId) {
    return (
      <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto" }}>
        <PageEmpty
          title="No project selected"
          description="Select a project in the workspace switcher to manage its documents."
          icon={<FileText size={40} />}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
            Document Management & Archiving
          </h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {activeProject?.name || "Project"} — controlled documents from the API
          </div>
        </div>
        <button
          className="btn btn-primary"
          style={{ background: "#d92d2d", borderColor: "#d92d2d" }}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? <X size={15} style={{ marginRight: 4 }} /> : <Upload size={15} style={{ marginRight: 4 }} />}
          {showForm ? "Cancel" : "Add Document"}
        </button>
      </div>

      {error && <PageError message={error} onRetry={load} />}

      {showForm && (
        <div className="card" style={{ padding: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>New document</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div className="field">
              <label style={{ fontSize: 12 }}>Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Document title"
              />
            </div>
            <div className="field">
              <label style={{ fontSize: 12 }}>Type</label>
              <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label style={{ fontSize: 12 }}>Discipline</label>
              <select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
                {DISCIPLINES.map((d) => (
                  <option key={d.value || "none"} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label style={{ fontSize: 12 }}>Revision</label>
              <input
                value={form.revision_number}
                onChange={(e) => setForm({ ...form, revision_number: e.target.value })}
                placeholder="e.g. A, 01"
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12 }}>Upload file (preferred)</label>
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setUploadFileObj(f);
                  if (f && !form.title) setForm((prev) => ({ ...prev, title: f.name.replace(/\.[^.]+$/, "") }));
                }}
              />
              {uploadFileObj && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  Selected: {uploadFileObj.name} ({Math.round(uploadFileObj.size / 1024)} KB)
                </div>
              )}
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12 }}>Or remote URL</label>
              <input
                value={form.remote_url}
                onChange={(e) => setForm({ ...form, remote_url: e.target.value })}
                placeholder="https://… or /media/… (optional if uploading)"
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn"
              onClick={handleCreate}
              disabled={saving || uploading || !form.title || (!form.remote_url && !uploadFileObj)}
            >
              <Plus size={14} style={{ marginRight: 6 }} />
              {uploading ? "Uploading…" : saving ? "Saving…" : "Create document"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <PageLoading />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <KpiCard label="Total Documents" value={docs.length} color="var(--text)" icon={<FileText size={18} />} />
            <KpiCard label="Drawings" value={typeCount("drawing")} color="#00a3ff" icon={<Folder size={18} />} />
            <KpiCard label="Contracts" value={typeCount("contract")} color="#10b981" icon={<FileText size={18} />} />
            <KpiCard label="With URL" value={withUrl} color="#f59e0b" sub={`${docs.length - withUrl} without link`} />
          </div>

          {docs.length === 0 ? (
            <PageEmpty
              title="No documents yet"
              description="Add a document with a title and remote URL to build the project register."
              action={{ label: "Add Document", onClick: () => setShowForm(true) }}
              icon={<Folder size={40} />}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
              <div className="card" style={{ padding: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>
                  DOCUMENT FOLDERS
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <FolderBtn
                    active={selectedFolder === "all"}
                    label="All Documents"
                    count={folders.all}
                    onClick={() => setSelectedFolder("all")}
                  />
                  {folders.typeFolders.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--muted)", margin: "10px 0 4px", fontWeight: 700 }}>BY TYPE</div>
                  )}
                  {folders.typeFolders.map((fld) => (
                    <FolderBtn
                      key={fld.id}
                      active={selectedFolder === fld.id}
                      label={fld.label}
                      count={fld.count}
                      onClick={() => setSelectedFolder(fld.id)}
                    />
                  ))}
                  {folders.disciplineFolders.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--muted)", margin: "10px 0 4px", fontWeight: 700 }}>BY DISCIPLINE</div>
                  )}
                  {folders.disciplineFolders.map((fld) => (
                    <FolderBtn
                      key={fld.id}
                      active={selectedFolder === fld.id}
                      label={fld.label}
                      count={fld.count}
                      onClick={() => setSelectedFolder(fld.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>DOCUMENT REGISTER</h3>
                  <div style={{ position: "relative", width: 260 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                    <input
                      placeholder="Search title, type, revision…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        width: "100%", paddingLeft: 32, paddingRight: 10, height: 34, borderRadius: 6,
                        background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12,
                      }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                        <th style={{ padding: 8 }}>ID</th>
                        <th style={{ padding: 8 }}>Title</th>
                        <th style={{ padding: 8 }}>Type</th>
                        <th style={{ padding: 8 }}>Discipline</th>
                        <th style={{ padding: 8 }}>Version</th>
                        <th style={{ padding: 8 }}>Revision</th>
                        <th style={{ padding: 8, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((doc) => {
                        const url = doc.latest_url || doc.remote_url;
                        return (
                          <tr key={doc.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: 8, fontWeight: 700, color: "var(--text)", fontFamily: "IBM Plex Mono, monospace" }}>
                              {doc.id}
                            </td>
                            <td style={{ padding: 8, fontWeight: 600, color: url ? "#00a3ff" : "var(--text)" }}>
                              {url ? (
                                <a href={url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{doc.title}</a>
                              ) : (
                                doc.title
                              )}
                            </td>
                            <td style={{ padding: 8 }}>
                              <StatusPill label={docLabel(doc.doc_type || "other")} tone="info" />
                            </td>
                            <td style={{ padding: 8, color: "var(--muted)" }}>{disciplineLabel(doc.discipline || "")}</td>
                            <td style={{ padding: 8, fontFamily: "IBM Plex Mono, monospace" }}>
                              v{doc.current_version ?? 0}
                            </td>
                            <td style={{ padding: 8, color: "var(--muted)" }}>{doc.revision_number || "—"}</td>
                            <td style={{ padding: 8, textAlign: "right" }}>
                              <button
                                className="btn sm ghost"
                                style={{ color: "#00a3ff", marginRight: 4 }}
                                disabled={!url}
                                title={url ? "Open" : "No URL"}
                                onClick={() => openUrl(url)}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                className="btn sm ghost"
                                style={{ color: "var(--text)", marginRight: 4 }}
                                disabled={!url}
                                title={url ? "Open link" : "No URL"}
                                onClick={() => openUrl(url)}
                              >
                                <Download size={14} />
                              </button>
                              <button
                                className="btn sm ghost"
                                style={{ color: "#ef4444" }}
                                title="Delete"
                                onClick={() => handleDelete(doc)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableEmpty colSpan={7} label="No documents match this filter." />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FolderBtn({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 6,
        border: "none",
        background: active ? "rgba(0,163,255,0.15)" : "transparent",
        color: active ? "#00a3ff" : "var(--text)",
        fontWeight: active ? 700 : 400,
        fontSize: 12,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Folder size={16} style={{ color: active ? "#00a3ff" : "var(--muted)" }} />
        <span>{label}</span>
      </div>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{count}</span>
    </button>
  );
}
