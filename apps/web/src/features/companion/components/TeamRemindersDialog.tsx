"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { Field, Modal } from "@/components/module-ui";

type Reminder = {
  id: string;
  title: string;
  message: string;
  category: "announcement" | "campaign" | "reminder";
  icon: string;
  action_label: string;
  action_href: string;
  delivery: "popup" | "overview" | "both";
  starts_at: string;
  ends_at: string | null;
  priority: number;
  is_active: boolean;
};

type Draft = Omit<Reminder, "id">;
const toInputDateTime = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
const emptyDraft = (): Draft => ({
  title: "", message: "", category: "reminder", icon: "📣", action_label: "View details", action_href: "/companion",
  delivery: "both", starts_at: toInputDateTime(new Date().toISOString()), ends_at: "", priority: 50, is_active: true,
});

export function TeamRemindersDialog({ open, onClose, organizationId }: { open: boolean; onClose: () => void; organizationId: string | null | undefined }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/companion/announcements/", {}, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Could not load team reminders."));
      const data = await response.json();
      setItems(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load team reminders."); }
    finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { if (open) void load(); }, [open, load]);
  const edit = (item: Reminder) => {
    setEditing(item.id);
    setDraft({ ...item, starts_at: toInputDateTime(item.starts_at), ends_at: toInputDateTime(item.ends_at) });
    setError("");
  };
  const reset = () => { setEditing(null); setDraft(emptyDraft()); setError(""); };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!organizationId) return;
    if (!draft.title.trim() || !draft.message.trim() || !draft.starts_at) { setError("Give the reminder a title, message, and start date."); return; }
    setSaving(true); setError("");
    try {
      const body = {
        ...draft,
        title: draft.title.trim(), message: draft.message.trim(), icon: draft.icon.trim() || "📣",
        starts_at: new Date(draft.starts_at).toISOString(),
        ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      };
      const response = await apiFetch(`/companion/announcements/${editing ? `${editing}/` : ""}`, {
        method: editing ? "PATCH" : "POST", body: JSON.stringify(body),
      }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Could not save the reminder."));
      reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the reminder."); }
    finally { setSaving(false); }
  };
  const toggle = async (item: Reminder) => {
    if (!organizationId) return;
    try {
      const response = await apiFetch(`/companion/announcements/${item.id}/`, { method: "PATCH", body: JSON.stringify({ is_active: !item.is_active }) }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Could not update the reminder."));
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update the reminder."); }
  };
  const activeCount = useMemo(() => items.filter((item) => item.is_active).length, [items]);
  if (!open) return null;

  return <Modal wide title="📣 Team reminders & campaigns" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Close</button><button className="btn primary" disabled={saving} onClick={() => void submit()}>{saving ? "Saving…" : editing ? "Save changes" : "Create reminder"}</button></>}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, .85fr)", gap: 22 }}>
      <section>
        <p className="muted" style={{ marginTop: 0 }}>Create a calm, time-bound message for all staff. It can appear at sign-in, on Companion home, or both; pause it at any time.</p>
        {error && <div role="alert" style={{ padding: 12, color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 45%, transparent)", borderRadius: 8, marginBottom: 14 }}>{error}</div>}
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Title" required><input value={draft.title} maxLength={180} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Wellness Week starts Monday" /></Field>
          <Field label="Message icon"><input value={draft.icon} maxLength={16} onChange={(e) => set("icon", e.target.value)} placeholder="📣" aria-label="Message icon" /></Field>
        </div>
        <Field label="Message" required><textarea value={draft.message} maxLength={1000} rows={5} onChange={(e) => set("message", e.target.value)} placeholder="A concise, encouraging reminder for your staff…" /></Field>
        <div className="grid-3" style={{ gap: 12 }}>
          <Field label="Type"><select value={draft.category} onChange={(e) => set("category", e.target.value as Draft["category"])}><option value="reminder">Gentle reminder</option><option value="campaign">Campaign</option><option value="announcement">Announcement</option></select></Field>
          <Field label="Where to show"><select value={draft.delivery} onChange={(e) => set("delivery", e.target.value as Draft["delivery"])}><option value="both">Sign-in and Companion home</option><option value="popup">Sign-in popup only</option><option value="overview">Companion home only</option></select></Field>
          <Field label="Priority"><input type="number" min="1" max="999" value={draft.priority} onChange={(e) => set("priority", Number(e.target.value) || 50)} /></Field>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Starts"><input type="datetime-local" value={draft.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
          <Field label="Ends (optional)"><input type="datetime-local" value={draft.ends_at || ""} onChange={(e) => set("ends_at", e.target.value)} /></Field>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Button label"><input value={draft.action_label} maxLength={80} onChange={(e) => set("action_label", e.target.value)} placeholder="View details" /></Field>
          <Field label="Button link"><input value={draft.action_href} maxLength={500} onChange={(e) => set("action_href", e.target.value)} placeholder="/companion?tab=dialogue" /></Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginTop: 4 }}><input type="checkbox" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Make this reminder active after saving</label>
      </section>
      <aside style={{ borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>Published reminders</strong><span className="status-pill success">{activeCount} active</span></div>
        <button className="btn ghost sm" style={{ margin: "10px 0" }} onClick={reset}>+ New reminder</button>
        {loading ? <p className="muted">Loading…</p> : items.length === 0 ? <p className="muted">No organisation-wide reminders yet.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{items.map((item) => <article key={item.id} className="card" style={{ padding: 12 }}>
          <strong>{item.icon} {item.title}</strong><p className="muted" style={{ margin: "5px 0", fontSize: 12, lineHeight: 1.45 }}>{item.message}</p>
          <div className="muted" style={{ fontSize: 11 }}>{item.delivery.replace("both", "popup + home")} · {item.ends_at ? `until ${new Date(item.ends_at).toLocaleDateString()}` : "no end date"}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}><button className="btn ghost sm" onClick={() => edit(item)}>Edit</button><button className="btn ghost sm" onClick={() => void toggle(item)}>{item.is_active ? "Pause" : "Activate"}</button></div>
        </article>)}</div>}
      </aside>
    </div>
  </Modal>;
}
