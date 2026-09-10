"use client";

import { useMemo, useState } from "react";
import { EmptyState, Panel, LoadingState } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtDateTime, fmtMoney } from "../../utils/sales.utils";
import { DataTable } from "../SalesUiComponents";
import type { ReportPreview } from "../../hooks/useSalesLogic";

const catalogIcons: Record<string, string> = {
  "🏠": "🏠",
  "📋": "📋",
  "💳": "💳",
  "🗓️": "🗓️",
  "🧾": "🧾",
  "👥": "👥",
  "📍": "📍",
  "🧑‍💼": "🧑‍💼",
  "📈": "📈",
};

export function ReportsView({
  rows,
  recentExports,
  reportPreview,
  reportLoading,
  reportKey,
  loadReportPreview,
  downloadReport,
}: {
  rows: Row[];
  recentExports: Row[];
  reportPreview: ReportPreview | null;
  reportLoading: boolean;
  reportKey: string;
  loadReportPreview: (key: string, start?: string, end?: string) => Promise<void>;
  downloadReport: (key: string, name: string, format: "csv" | "xlsx", start?: string, end?: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const catalogue = (rows as { key?: string; name?: string; category?: string; description?: string; icon?: string }[]);
  const categories = useMemo(() => {
    const map = new Map<string, typeof catalogue>();
    for (const r of catalogue) {
      const cat = r.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return map;
  }, [catalogue]);

  const active = catalogue.find((r) => r.key === selected);
  const preview = selected ? reportPreview : null;
  const isMoney = (col: string) => /amount|price|value|balance|fee|paid|gate|cost|total|income/i.test(col) && !col.includes("%");

  function openReport(key: string, name: string) {
    setSelected(key);
    void loadReportPreview(key, start, end);
  }

  const renderPreviewRows = preview?.rows ?? [];
  const previewColumns = preview?.columns ?? [];

  return (
    <>
      <Panel title="Sales Report Catalogue" action={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Report start date" style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>to</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Report end date" style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }} />
        </div>
      }>
        {catalogue.length === 0 ? (
          <EmptyState icon="📊" title="No report catalogue" description="The analytics service will provide report definitions here." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[...categories.entries()].map(([category, reports]) => (
              <div key={category}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>{category}</div>
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                  {reports.map((r) => {
                    const key = String(r.key ?? "");
                    const name = String(r.name ?? "Report");
                    const icon = catalogIcons[String(r.icon ?? "")] ?? "📄";
                    const isActive = selected === key;
                    return (
                      <article
                        key={key}
                        className="data-panel"
                        onClick={() => openReport(key, name)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openReport(key, name); }}
                        style={{ padding: 18, cursor: "pointer", border: isActive ? "2px solid var(--color-orange)" : "1px solid var(--border)" }}
                      >
                        <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 10 }}>
                          <span className="fc-asset-icon" style={{ background: "var(--color-orange-bg)", color: "var(--color-orange)" }}>{icon}</span>
                          <strong style={{ fontSize: 13 }}>{name}</strong>
                        </div>
                        <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 14px", minHeight: 36 }}>{r.description ?? "Exports the current sales dataset."}</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn primary sm" style={{ flex: 1, justifyContent: "center" }} onClick={(e) => { e.stopPropagation(); void downloadReport(key, name, "xlsx", start, end); }}>Excel</button>
                          <button className="btn secondary sm" style={{ flex: 1, justifyContent: "center" }} onClick={(e) => { e.stopPropagation(); void downloadReport(key, name, "csv", start, end); }}>CSV</button>
                        </div>
                        <button className="btn ghost sm" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={(e) => { e.stopPropagation(); openReport(key, name); }}>
                          {isActive ? "Previewing…" : "Preview"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {reportLoading && <LoadingState rows={4} />}

      {preview && !reportLoading && (
        <Panel
          title={String(active?.name ?? "Report Preview")}
          badge={preview.count ?? 0}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary sm" onClick={() => void downloadReport(selected, String(active?.name ?? ""), "xlsx", start, end)}>↓ Excel</button>
              <button className="btn secondary sm" onClick={() => void downloadReport(selected, String(active?.name ?? ""), "csv", start, end)}>↓ CSV</button>
            </div>
          }
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: 12, color: "var(--text-secondary)" }}>
            <span>Period: <strong>{preview.period?.start ? new Date(preview.period.start).toLocaleDateString() : "—"} → {preview.period?.end ? new Date(preview.period.end).toLocaleDateString() : "—"}</strong></span>
            <span>Rows: <strong>{preview.count}</strong></span>
            <span>Generated by: <strong>{String(preview.meta?.generated_by ?? "—")}</strong> · {fmtDateTime(preview.meta?.generated_at)}</span>
          </div>
          {previewColumns.length === 0 || renderPreviewRows.length === 0 ? (
            <EmptyState icon="📭" title="No rows in period" description="No records match the selected date range. Widen the range or add data first." />
          ) : (
            <DataTable headers={previewColumns}>
              {renderPreviewRows.map((row: Row, i: number) => (
                <tr key={i}>
                  {previewColumns.map((col: string) => {
                    const v = row[col];
                    return (
                      <td key={col} style={{ fontSize: 12 }}>
                        {isMoney(col) && v !== "" && v != null ? (
                          <span className="mono">{fmtMoney(v)}</span>
                        ) : /^\d{4}-\d{2}-\d{2}/.test(String(v)) && !/^[\d.]+$/.test(String(v)) ? (
                          new Date(String(v)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        ) : (
                          String(v ?? "—")
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}

      <Panel title="Recent Exports" badge={recentExports.length}>
        {recentExports.length === 0 ? (
          <EmptyState icon="🕘" title="No exports yet" description="Reports you download from the catalogue will be tracked here." />
        ) : (
          <DataTable headers={["Report", "File", "Exported At"]}>
            {recentExports.map((e, i) => (
              <tr key={`${String(e.key)}-${i}`}>
                <td><strong style={{ fontSize: 12 }}>{String(e.name ?? "—")}</strong></td>
                <td className="mono" style={{ fontSize: 12 }}>sales-{String(e.key)}.{String(e.format ?? "csv")}</td>
                <td style={{ fontSize: 12 }}>{fmtDateTime(e.exportedAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
