import { Satellite } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { createSatelliteDataset, deleteSatelliteDataset, fetchSatelliteDatasets } from "../api";
import { useAuth } from "../auth";
import { EmptyState } from "../components/EmptyState";
import { ConfirmModal, ErrorBanner } from "../components";

export function SatelliteDatasets() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ sat_type: "optical", capture_date: "", resolution_cm: "", cloud_cover_pct: "", external_url: "", source_provider: "", notes: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const load = () => fetchSatelliteDatasets(id).then(setDatasets).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const submit = () => {
    setError(null);
    const payload: Record<string, any> = {};
    if (form.sat_type) payload.sat_type = form.sat_type;
    if (form.capture_date) payload.capture_date = form.capture_date;
    if (form.resolution_cm) payload.resolution_cm = Number(form.resolution_cm);
    if (form.cloud_cover_pct) payload.cloud_cover_pct = Number(form.cloud_cover_pct);
    if (form.external_url) payload.external_url = form.external_url;
    if (form.source_provider) payload.source_provider = form.source_provider;
    if (form.notes) payload.notes = form.notes;
    createSatelliteDataset(id, payload).then(() => {
      setForm({ sat_type: "optical", capture_date: "", resolution_cm: "", cloud_cover_pct: "", external_url: "", source_provider: "", notes: "" });
      load();
    }).catch(e => setError(e.message));
  };

  const handleDelete = (dsId: number) => {
    setError(null);
    deleteSatelliteDataset(id, dsId).then(load).catch(e => setError(e.message));
  };

  return (
    <div>
      <h2>Satellite Datasets</h2>
      <ErrorBanner message={error} />

      <div className="table-wrap">
        <div className="card">
          <table>
            <thead><tr>
              <th>Type</th><th>Capture Date</th><th>Resolution (cm)</th><th>Cloud Cover</th><th>Provider</th><th>Source</th><th></th>
            </tr></thead>
            <tbody>
              {datasets.map(d => (
                <tr key={d.id}>
                  <td>{d.sat_type || "—"}</td>
                  <td>{d.capture_date || "—"}</td>
                  <td className="mono">{d.resolution_cm != null ? `${d.resolution_cm} cm` : "—"}</td>
                  <td>{d.cloud_cover_pct != null ? `${d.cloud_cover_pct}%` : "—"}</td>
                  <td>{d.source_provider || "—"}</td>
                  <td>{d.external_url ? <a href={d.external_url} target="_blank" rel="noreferrer">Link</a> : "—"}</td>
                  <td>
                    {can("drone.view") && (
                      <button className="btn ghost sm" onClick={() => setDeleteTarget({ id: d.id, label: `${d.sat_type || "dataset"} #${d.id}` })}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datasets.length === 0 && <EmptyState icon={<Satellite size={40} />} title="No satellite datasets" description="Record satellite imagery or remote sensing data for this project." />}
        </div>
      </div>

      <div className="card">
        <h3>Record Satellite Dataset</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <select value={form.sat_type} onChange={e => setForm({ ...form, sat_type: e.target.value })}>
            <option value="optical">Optical</option>
            <option value="radar">Radar (SAR)</option>
            <option value="multispectral">Multispectral</option>
            <option value="thermal">Thermal</option>
            <option value="lidar">LiDAR</option>
            <option value="other">Other</option>
          </select>
          <input type="date" value={form.capture_date} onChange={e => setForm({ ...form, capture_date: e.target.value })} placeholder="Capture date" />
          <input type="number" value={form.resolution_cm} onChange={e => setForm({ ...form, resolution_cm: e.target.value })} placeholder="Resolution (cm)" style={{ width: 140 }} />
          <input type="number" min="0" max="100" value={form.cloud_cover_pct} onChange={e => setForm({ ...form, cloud_cover_pct: e.target.value })} placeholder="Cloud cover %" style={{ width: 120 }} />
          <input value={form.external_url} onChange={e => setForm({ ...form, external_url: e.target.value })} placeholder="External URL" style={{ flex: 1, minWidth: 200 }} />
          <input value={form.source_provider} onChange={e => setForm({ ...form, source_provider: e.target.value })} placeholder="Source / Provider" style={{ flex: 1, minWidth: 160 }} />
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" style={{ flex: 1, minWidth: 160 }} />
          <button className="btn" onClick={submit}>Record</button>
        </div>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete dataset"
        message={deleteTarget ? `Delete "${deleteTarget.label}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
