import { Link } from "@/components/monitoring/react-router-shim";

export function About() {
  return (
    <div>
      <section style={{
        padding: "60px 24px 48px", textAlign: "center",
        background: "var(--glow), var(--bg)",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: 40, marginBottom: 16 }}>About MonitorERP</h1>
          <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7 }}>
            We build construction management software that gives project teams a single source of truth — from the site supervisor capturing daily progress on their phone to the CEO reviewing portfolio dashboards in the boardroom.
          </p>
        </div>
      </section>

      <section style={{ padding: "40px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 26, marginBottom: 12 }}>Our Mission</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.7, fontSize: 15 }}>
              To eliminate the gap between what happens on site and what management sees in reports. We believe every construction project deserves real-time visibility, tamper-proof evidence, and financial control — without complexity.
            </p>
          </div>
          <div style={{ padding: 32, background: "var(--surface-2)", borderRadius: 16, border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 8px", textTransform: "none", letterSpacing: 0, fontSize: 16 }}>Built for the field</h3>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: 14 }}>
              Our platform was designed from the ground up with input from project managers, quantity surveyors, and site supervisors. Every feature solves a real problem encountered in daily construction operations.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: "60px 24px", background: "var(--surface)", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, marginBottom: 32 }}>Why Construction Teams Choose Us</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, textAlign: "left" }}>
            {[
              { title: "Tamper-Proof Evidence", desc: "Every photo, log, and milestone is geofenced and audit-sealed. What gets submitted cannot be altered." },
              { title: "Offline-First Design", desc: "Site teams work without internet. Data syncs automatically when they reconnect." },
              { title: "Real-Time Visibility", desc: "Management sees progress, costs, and issues as they happen — not weeks later." },
              { title: "Modular by Nature", desc: "Start with what you need. Add modules as your projects grow in complexity." },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: 22 }}>
                <h3 style={{ margin: "0 0 8px", textTransform: "none", letterSpacing: 0, fontSize: 16 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "60px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, marginBottom: 12 }}>Want to learn more?</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>Get in touch with our team.</p>
        <Link to="/contact" className="btn">Contact Us</Link>
      </section>
    </div>
  );
}
