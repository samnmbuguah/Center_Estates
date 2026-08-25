import { useEffect, useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";

import { fetchSmtp, saveSmtp, testSmtp, type SmtpSettings } from "../api";
import { ErrorBanner } from "../components";

const EMPTY: SmtpSettings = {
  host: "", port: 587, username: "", from_email: "", use_tls: true, enabled: false, has_password: false,
};

interface WhatsAppSettings {
  account_sid: string; from_number: string; enabled: boolean; has_auth_token: boolean;
}

export function Settings() {
  const [cfg, setCfg] = useState<SmtpSettings>(EMPTY);
  const [password, setPassword] = useState("");
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // WhatsApp state
  const [wa, setWa] = useState<WhatsAppSettings>({ account_sid: "", from_number: "", enabled: false, has_auth_token: false });
  const [waToken, setWaToken] = useState("");
  const [waTestTo, setWaTestTo] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waTesting, setWaTesting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSmtp().then(c => { setCfg(c); setTestTo(c.from_email); }),
      fetch("/settings/whatsapp").then(r => r.json()).then(setWa).catch(() => {}),
    ]).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof SmtpSettings>(k: K, v: SmtpSettings[K]) => setCfg((c) => ({ ...c, [k]: v }));

  async function save() {
    setError(null); setNotice(null);
    try {
      const body: any = { ...cfg };
      if (password) body.password = password;
      const updated = await saveSmtp(body);
      setCfg(updated);
      setPassword("");
      setNotice("SMTP settings saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendTest() {
    setError(null); setNotice(null);
    try {
      const r = await testSmtp(testTo);
      setNotice(`Test email sent to ${r.to}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveWa() {
    setError(null); setNotice(null); setWaSaving(true);
    try {
      const body: any = { ...wa };
      if (waToken) body.auth_token = waToken;
      const res = await fetch("/settings/whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setWa(await res.json());
      setWaToken("");
      setNotice("WhatsApp settings saved.");
    } catch (e) { setError((e as Error).message); }
    finally { setWaSaving(false); }
  }

  async function testWa() {
    setError(null); setNotice(null); setWaTesting(true);
    try {
      const res = await fetch("/settings/whatsapp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: waTestTo }) });
      if (!res.ok) throw new Error((await res.json()).error || "Test failed");
      setNotice("WhatsApp test message sent.");
    } catch (e) { setError((e as Error).message); }
    finally { setWaTesting(false); }
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin · Notifications</div>
        <h2>Email (SMTP) settings</h2>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Connect your cPanel mailbox so the system can send email notifications
        (e.g. urgent issues) alongside mobile push.
      </p>

      <ErrorBanner message={error} />
      {notice && (
        <div className="card" style={{ borderColor: "var(--success)" }}>
          <span style={{ color: "var(--success)" }}>{notice}</span>
        </div>
      )}

      {loading ? <p className="muted">Loading...</p> : (<>
      <div className="card" style={{ maxWidth: 560 }}>
        <label className="row" style={{ gap: 8, marginBottom: 14 }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ width: 16, height: 16 }} />
          <span>Enable email notifications</span>
        </label>

        <div className="field">
          <label>SMTP host</label>
          <input value={cfg.host} placeholder="mail.yourdomain.com" onChange={(e) => set("host", e.target.value)} />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Port</label>
            <input type="number" value={cfg.port} onChange={(e) => set("port", Number(e.target.value))} />
          </div>
          <label className="row" style={{ gap: 8, alignSelf: "flex-end", marginBottom: 12 }}>
            <input type="checkbox" checked={cfg.use_tls} onChange={(e) => set("use_tls", e.target.checked)} style={{ width: 16, height: 16 }} />
            <span>Use TLS</span>
          </label>
        </div>
        <div className="field">
          <label>Username</label>
          <input value={cfg.username} placeholder="noreply@yourdomain.com" autoComplete="off" onChange={(e) => set("username", e.target.value)} />
        </div>
        <div className="field">
          <label>Password {cfg.has_password && <span className="muted">(set — leave blank to keep)</span>}</label>
          <input type="password" value={password} placeholder={cfg.has_password ? "••••••••" : ""} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>From address</label>
          <input value={cfg.from_email} placeholder="noreply@yourdomain.com" onChange={(e) => set("from_email", e.target.value)} />
        </div>
        <button className="btn" onClick={save}><Mail size={16} /> Save settings</button>
      </div>

      <h3>Send a test email</h3>
      <div className="card row" style={{ maxWidth: 560 }}>
        <input style={{ flex: 1 }} value={testTo} placeholder="you@example.com" onChange={(e) => setTestTo(e.target.value)} />
        <button className="btn ghost" onClick={sendTest} disabled={!testTo}><Send size={16} /> Send test</button>
      </div>
      </>)}

      {/* WhatsApp */}
      <hr style={{ margin: "32px 0", border: "none", borderTop: "1px solid var(--border)" }} />
      <h2><MessageSquare size={20} style={{ marginRight: 8 }} /> WhatsApp Notifications</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Configure Twilio WhatsApp API to send notifications via WhatsApp.
      </p>

      <div className="card" style={{ maxWidth: 560 }}>
        <label className="row" style={{ gap: 8, marginBottom: 14 }}>
          <input type="checkbox" checked={wa.enabled} onChange={(e) => setWa({ ...wa, enabled: e.target.checked })} style={{ width: 16, height: 16 }} />
          <span>Enable WhatsApp notifications</span>
        </label>
        <div className="field">
          <label>Account SID</label>
          <input value={wa.account_sid} placeholder="ACxxxxxxxxxxxx" onChange={(e) => setWa({ ...wa, account_sid: e.target.value })} />
        </div>
        <div className="field">
          <label>Auth Token {wa.has_auth_token && <span className="muted">(set — leave blank to keep)</span>}</label>
          <input type="password" autoComplete="new-password" value={waToken} placeholder={wa.has_auth_token ? "••••••••" : ""} onChange={(e) => setWaToken(e.target.value)} />
        </div>
        <div className="field">
          <label>From (WhatsApp number)</label>
          <input value={wa.from_number} placeholder="+14155238886" onChange={(e) => setWa({ ...wa, from_number: e.target.value })} />
        </div>
        <button className="btn" onClick={saveWa} disabled={waSaving}><MessageSquare size={16} /> Save WhatsApp settings</button>
      </div>

      <h3>Send a test message</h3>
      <div className="card row" style={{ maxWidth: 560 }}>
        <input style={{ flex: 1 }} value={waTestTo} placeholder="+254712345678" onChange={(e) => setWaTestTo(e.target.value)} />
        <button className="btn ghost" onClick={testWa} disabled={waTesting || !waTestTo}><Send size={16} /> Send test</button>
      </div>
    </div>
  );
}
