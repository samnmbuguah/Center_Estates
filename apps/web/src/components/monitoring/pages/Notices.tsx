import { useEffect, useState } from "react";

import { Trash2 } from "lucide-react";

import { del, fetchNotices, postNotice } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";

export function Notices() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<any | null>(null);

  const load = () => {
    setLoading(true);
    fetchNotices().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!form.title || !form.body) return;
    setError(null);
    try {
      await postNotice(form);
      setForm({ title: "", body: "" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Notice Board</h2>
      <ErrorBanner message={error} />
      {can("communication.post") && (
        <div className="card">
          <div className="field">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <textarea placeholder="Message" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <button className="btn" onClick={add}>Post notice</button>
        </div>
      )}
      {loading ? <p className="muted">Loading...</p> : (
        rows.length === 0 ? <p className="muted">No notices yet.</p> : rows.map((n) => (
        <div className="card" key={n.id}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <strong>{n.title}</strong>
            {can("communication.post") && (
              <button className="btn ghost sm" title="Delete" onClick={() => setConfirmDeleteTarget(n)}><Trash2 size={14} /></button>
            )}
          </div>
          <p>{n.body}</p>
          <div className="muted">by {n.posted_by}</div>
        </div>
        ))
      )}

      <ConfirmModal
        open={!!confirmDeleteTarget}
        title="Delete notice"
        message="Delete this notice?"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!confirmDeleteTarget) return;
          setError(null);
          try { await del(`/notices/${confirmDeleteTarget.id}`); load(); } catch (e) { setError((e as Error).message); }
          setConfirmDeleteTarget(null);
        }}
        onCancel={() => setConfirmDeleteTarget(null)}
      />
    </div>
  );
}
