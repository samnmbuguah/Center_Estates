import { Save, Webhook } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { fetchModuleConfig, updateModuleConfig } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

export function ProjectSettings() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [inflationThreshold, setInflationThreshold] = useState(40);
  const [contingencyAllowance, setContingencyAllowance] = useState(0);
  const [retentionPercent, setRetentionPercent] = useState(5);
  const [advanceRecoveryRate, setAdvanceRecoveryRate] = useState(10);
  const [webhookUrls, setWebhookUrls] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [costCfg, ptCfg, scCfg] = await Promise.all([
        fetchModuleConfig(id, "cost"),
        fetchModuleConfig(id, "progress_tracking"),
        fetchModuleConfig(id, "smart_contract").catch(() => ({ settings: {} })),
      ]);
      const cs = costCfg.settings ?? {};
      const ps = ptCfg.settings ?? {};
      const sc = scCfg.settings ?? {};
      if (cs.contingency_allowance != null) setContingencyAllowance(Number(cs.contingency_allowance));
      if (cs.retention_percent != null) setRetentionPercent(Number(cs.retention_percent));
      if (cs.advance_recovery_rate != null) setAdvanceRecoveryRate(Number(cs.advance_recovery_rate));
      if (ps.inflation_threshold != null) setInflationThreshold(Number(ps.inflation_threshold));
      const wh = (sc as Record<string, unknown>).webhook_urls;
      if (wh) setWebhookUrls(Array.isArray(wh) ? (wh as string[]).join("\n") : String(wh));
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveCost() {
    setError(null); setNotice(null);
    try {
      await updateModuleConfig(id, "cost", {
        contingency_allowance: contingencyAllowance,
        retention_percent: retentionPercent,
        advance_recovery_rate: advanceRecoveryRate,
      });
      setNotice("Cost module settings saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveProgress() {
    setError(null); setNotice(null);
    try {
      await updateModuleConfig(id, "progress_tracking", {
        inflation_threshold: inflationThreshold,
      });
      setNotice("Progress tracking settings saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveWebhooks() {
    setError(null); setNotice(null);
    try {
      const urls = webhookUrls.split("\n").map(s => s.trim()).filter(Boolean);
      await updateModuleConfig(id, "smart_contract", { webhook_urls: urls });
      setNotice("Smart contract webhook URLs saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Project Settings</h2>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Configure project-level tolerance thresholds and default values.
      </p>

      <ErrorBanner message={error} />
      {notice && (
        <div className="card" style={{ borderColor: "var(--success)" }}>
          <span style={{ color: "var(--success)" }}>{notice}</span>
        </div>
      )}

      {loading ? <p className="muted">Loading…</p> : (
        <>
          <div className="card" style={{ maxWidth: 560 }}>
            <h3>Progress Tracking</h3>
            <div className="field">
              <label>Progress inflation threshold (%)</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                How much a single progress jump can exceed before being flagged as inflation.
              </p>
              <input
                type="number" min={0} max={100}
                value={inflationThreshold}
                onChange={e => setInflationThreshold(Number(e.target.value))}
              />
            </div>
            {can("projects.edit") && (
              <button className="btn" onClick={saveProgress}><Save size={16} /> Save</button>
            )}
          </div>

          <div className="card" style={{ maxWidth: 560 }}>
            <h3>Cost Module</h3>
            <div className="field">
              <label>Contingency allowance (%)</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Percentage of budget reserved for contingencies.
              </p>
              <input
                type="number" min={0} max={100}
                value={contingencyAllowance}
                onChange={e => setContingencyAllowance(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Retention percentage (%)</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Percentage retained from each certificate until final completion.
              </p>
              <input
                type="number" min={0} max={100}
                value={retentionPercent}
                onChange={e => setRetentionPercent(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Advance recovery rate (%)</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Percentage of each certificate applied to recover advance payments.
              </p>
              <input
                type="number" min={0} max={100}
                value={advanceRecoveryRate}
                onChange={e => setAdvanceRecoveryRate(Number(e.target.value))}
              />
            </div>
            {can("projects.edit") && (
              <button className="btn" onClick={saveCost}><Save size={16} /> Save</button>
            )}
          </div>

          <div className="card" style={{ maxWidth: 560 }}>
            <h3><Webhook size={18} style={{ marginRight: 6, verticalAlign: "middle" }} /> Smart Contract Webhooks</h3>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Webhook URLs that will receive notifications when on-chain verification events occur.
              Enter one URL per line.
            </p>
            <div className="field">
              <label>Webhook URLs</label>
              <textarea
                rows={4} value={webhookUrls}
                onChange={e => setWebhookUrls(e.target.value)}
                placeholder="https://api.example.com/webhook&#10;https://chain.example.com/hook"
                style={{ width: "100%", resize: "vertical", fontFamily: "monospace" }}
              />
            </div>
            {can("projects.edit") && (
              <button className="btn" onClick={saveWebhooks}><Save size={16} /> Save</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
