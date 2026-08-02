import { useState } from "react";
import { Link } from "@/components/monitoring/react-router-shim";

export function Contact() {
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In a real implementation, POST to a backend endpoint
    setSent(true);
  }

  return (
    <div>
      <section style={{
        padding: "60px 24px 40px", textAlign: "center",
        background: "var(--glow), var(--bg)",
      }}>
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>Contact Us</h1>
        <p style={{ color: "var(--muted)", fontSize: 17 }}>Have questions? We'd love to hear from you.</p>
      </section>

      <section style={{ padding: "20px 24px 60px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div>
            <h3 style={{ margin: "0 0 16px", textTransform: "none", letterSpacing: 0, fontSize: 18 }}>Get in Touch</h3>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Email</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>hello@monitorerp.com</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Phone</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>+254 700 000 000</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Location</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>Nairobi, Kenya</p>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Sales</p>
              <Link to="/sign-up" className="btn sm">Start Free Trial</Link>
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 16px", textTransform: "none", letterSpacing: 0, fontSize: 18 }}>Send a Message</h3>
            {sent ? (
              <div style={{ padding: 20, background: "var(--surface-2)", borderRadius: 12, textAlign: "center" }}>
                <p style={{ color: "var(--green)", fontWeight: 600 }}>Thank you! We'll get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Name</label>
                  <input placeholder="Your name" required />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" placeholder="you@example.com" required />
                </div>
                <div className="field">
                  <label>Message</label>
                  <textarea rows={4} placeholder="How can we help?" required />
                </div>
                <button className="btn" type="submit">Send Message</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
