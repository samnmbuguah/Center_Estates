"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export type SavedViewFilters = { status: string; search: string };
type SavedView = { name: string; filters: SavedViewFilters };

export function SavedViews({
  scope,
  current,
  onApply,
}: {
  scope: string;
  current: SavedViewFilters;
  onApply: (filters: SavedViewFilters) => void;
}) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const storageKey = `ce_saved_views:${organizationId ?? "anon"}:${scope}`;
  const [views, setViews] = useState<SavedView[]>([]);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setViews(raw ? (JSON.parse(raw) as SavedView[]) : []);
    } catch {
      setViews([]);
    }
  }, [storageKey]);

  useEffect(() => { load(); }, [load]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const save = () => {
    const name = window.prompt("Name this view (e.g. Reserved deals):");
    if (!name) return;
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    const next = [...views.filter((v) => v.name !== trimmed), { name: trimmed, filters: current }];
    persist(next);
  };

  const remove = (name: string) => persist(views.filter((v) => v.name !== name));

  const isActive = (v: SavedView) => v.filters.status === current.status && v.filters.search === current.search;

  return (
    <div className="row" style={{ gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {views.map((v) => (
        <span
          key={v.name}
          className={`btn sm ${isActive(v) ? "primary" : "ghost"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 8px" }}
        >
          <Bookmark size={12} onClick={() => onApply(v.filters)} style={{ cursor: "pointer" }} />
          <span onClick={() => onApply(v.filters)} style={{ cursor: "pointer" }}>{v.name}</span>
          <X size={11} onClick={() => remove(v.name)} style={{ cursor: "pointer", opacity: 0.7 }} aria-label={`Remove view ${v.name}`} />
        </span>
      ))}
      <button type="button" className="btn ghost sm" onClick={save} title="Save current filters as a view" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        <BookmarkPlus size={12} /> Save view
      </button>
    </div>
  );
}
