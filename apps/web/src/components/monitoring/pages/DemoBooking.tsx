import { CalendarCheck, Clock, Monitor, Shield, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Link } from "@/components/monitoring/react-router-shim";

const BENEFITS = [
  { icon: Monitor, title: "Live Product Tour", desc: "See the platform in action with a guided walkthrough of all modules." },
  { icon: Users, title: "Tailored to Your Needs", desc: "We focus on the modules and workflows relevant to your projects." },
  { icon: Shield, title: "No Commitment", desc: "Free, no-obligation demo. Ask questions, get answers, decide later." },
  { icon: Clock, title: "30 Minutes", desc: "Designed to be concise and respect your schedule." },
];

export function DemoBooking() {
  const { session } = useAuth();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "" });

  // Redirect logged-out users to sign-up page
  useEffect(() => {
    if (!session) {
      router.replace("/sign-up");
    }
  }, [session, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div className="stat-icon" style={{ margin: "0 auto 16px", width: 56, height: 56, fontSize: 28 }}>
            <CalendarCheck size={28} />
          </div>
          <h2 style={{ fontSize: 28, marginBottom: 12 }}>Demo Request Received</h2>
          <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
            Thanks, {form.name || "there"}! Our team will contact you at <strong>{form.email}</strong> within 24 hours to schedule your personalized walkthrough.
          </p>
          <Link to="/" className="btn">Back to Home</Link>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "60px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            <CalendarCheck size={14} /> Book a demo
          </div>
          <h1 style={{ fontSize: 40, margin: "0 0 12px" }}>See MonitorERP in Action</h1>
          <p style={{ color: "var(--muted)", fontSize: 16, maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
            Schedule a 30-minute walkthrough with our team. We'll show you how MonitorERP fits your construction projects.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>Why book a demo?</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {BENEFITS.map(b => (
                <div key={b.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div className="stat-icon" style={{ flexShrink: 0, width: 40, height: 40 }}>
                    <b.icon size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 15 }}>{b.title}</strong>
                    <p style={{ fontSize: 14, color: "var(--muted)", margin: "2px 0 0", lineHeight: 1.5 }}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>Request a Demo</h3>
            <div className="field">
              <label htmlFor="name">Full Name *</label>
              <input id="name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="email">Work Email *</label>
              <input id="email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="company">Company *</label>
              <input id="company" required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input id="phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="message">What would you like to see?</label>
              <textarea id="message" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={!form.name || !form.email || !form.company}>
              Request Demo
            </button>
            <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 12, textAlign: "center" }}>
              No credit card required. Your data is handled per our privacy policy.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
