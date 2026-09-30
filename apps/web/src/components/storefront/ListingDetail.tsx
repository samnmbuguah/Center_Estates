"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { formatKES, type PublicListing } from "./StorefrontHome";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="muted">{label}</span>
      <strong style={{ textAlign: "right" }}>{value}</strong>
    </div>
  );
}

export function ListingDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    fetch(`/api/v1/sales/public/listings/${id}/`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json();
      })
      .then((data: PublicListing) => setListing(data))
      .catch(() => setMissing(true));
  }, [id]);

  async function submitEnquiry(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError("Please share your name and a phone number or email.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/v1/sales/public/enquiries/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), message: message.trim(), listing: id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const first = Object.values((payload as { errors?: Record<string, string> }).errors ?? {})[0];
        throw new Error(typeof first === "string" ? first : "Your enquiry could not be sent. Please try again.");
      }
      setReference(String((payload as { reference?: string }).reference ?? ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your enquiry could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" }}>
        <Link href="/" style={{ fontSize: 14 }}>← All listings</Link>
        {!listing && !missing && <p className="muted" style={{ marginTop: 24 }}>Loading…</p>}
        {missing && <p className="muted" style={{ marginTop: 24 }}>This listing is no longer available. <Link href="/">Browse others →</Link></p>}
        {listing && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)", gap: 28, marginTop: 20 }}>
            <div>
              <div style={{ borderRadius: 14, overflow: "hidden", background: "var(--color-sky-bg, #e0f2fe)", aspectRatio: "16/10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {listing.images[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.images[activeImage].url} alt={listing.unit.code} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 64 }}>🏢</span>
                )}
              </div>
              {listing.images.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {listing.images.map((image, index) => (
                    <button
                      key={`${image.url}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      style={{ border: index === activeImage ? "2px solid var(--primary)" : "1px solid var(--border)", borderRadius: 8, padding: 0, overflow: "hidden", width: 84, height: 56, cursor: "pointer", background: "var(--surface)" }}
                      aria-label={`View image ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>{formatKES(listing.price)}</h1>
                {listing.is_featured && (
                  <span style={{ background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 20 }}>★ Featured</span>
                )}
              </div>
              <p className="muted" style={{ margin: "4px 0 0" }}>{listing.unit.type || "Unit"} {listing.unit.code} · {listing.project.name}{listing.project.location ? ` · ${listing.project.location}` : ""}</p>
              {listing.project.description && <p style={{ marginTop: 14, lineHeight: 1.6 }}>{listing.project.description}</p>}
              <div style={{ marginTop: 8 }}>
                <DetailRow label="Unit" value={listing.unit.code} />
                <DetailRow label="Type" value={listing.unit.type || "—"} />
                <DetailRow
                  label="Bedrooms"
                  value={listing.unit.bedrooms === null || listing.unit.bedrooms === undefined ? "—" : listing.unit.bedrooms === 0 ? "Studio" : String(listing.unit.bedrooms)}
                />
                <DetailRow label="Floor" value={listing.unit.floor || "—"} />
                <DetailRow label="Area" value={listing.unit.area ? `${listing.unit.area} sqft` : "—"} />
                <DetailRow label="Minimum deposit" value={`${listing.minimum_deposit_percent}%`} />
                <DetailRow label="Construction progress" value={`${listing.construction_progress}%`} />
              </div>
            </div>
            <aside style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 20, background: "var(--surface)", alignSelf: "start" }}>
              {reference ? (
                <div>
                  <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 0 }}>Enquiry received ✓</h2>
                  <p className="muted" style={{ fontSize: 14 }}>Reference <strong>{reference}</strong>. Our sales team will contact you shortly.</p>
                </div>
              ) : (
                <form onSubmit={submitEnquiry}>
                  <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 0 }}>Enquire about this unit</h2>
                  {error && <p style={{ color: "var(--color-danger, #b91c1c)", fontSize: 13 }}>{error}</p>}
                  <label style={{ display: "block", fontSize: 13, marginBottom: 10 }}>Full name*<br />
                    <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                  </label>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 10 }}>Phone<br />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254…" style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                  </label>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 10 }}>Email<br />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                  </label>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 14 }}>Message<br />
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Viewing request, payment plan question…" style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                  </label>
                  <button type="submit" className="btn primary" disabled={sending} style={{ width: "100%", justifyContent: "center" }}>
                    {sending ? "Sending…" : "Send enquiry"}
                  </button>
                </form>
              )}
            </aside>
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
