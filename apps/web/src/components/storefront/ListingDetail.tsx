"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  FileCheck2,
  HardHat,
  Home,
  Key,
  Layers,
  MapPin,
  Maximize2,
  MessageCircle,
  PhoneCall,
  Share2,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { formatKES, type PublicListing } from "./StorefrontHome";

const WHATSAPP_SALES_PHONE = "254712345678";

function SpecCard({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "var(--brand-light, #fce8e8)",
          color: "var(--brand, #b91c1c)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink3, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: 2 }}>
          {value}
        </div>
        {subvalue && (
          <div style={{ fontSize: 12, color: "var(--ink3, #64748b)", marginTop: 1 }}>
            {subvalue}
          </div>
        )}
      </div>
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
  const [viewingDate, setViewingDate] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/sales/public/listings/${id}/`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json();
      })
      .then((data: PublicListing) => setListing(data))
      .catch(() => setMissing(true));
  }, [id]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  async function submitEnquiry(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError("Please provide your name and either a phone number or email.");
      return;
    }
    setSending(true);
    try {
      const fullMessage = viewingDate
        ? `${message.trim()} [Requested Site Viewing: ${viewingDate}]`
        : message.trim();

      const response = await fetch("/api/v1/sales/public/enquiries/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          message: fullMessage,
          listing: id,
        }),
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

  // Pre-calculated milestone payment figures based on unit price
  const priceNum = listing ? Number(listing.price) || 0 : 0;
  const depositPercent = listing ? Number(listing.minimum_deposit_percent) || 20 : 20;
  const depositAmount = (priceNum * depositPercent) / 100;
  const handoverPercent = 10;
  const handoverAmount = (priceNum * handoverPercent) / 100;
  const milestonePercent = Math.max(0, 100 - depositPercent - handoverPercent);
  const milestoneAmount = (priceNum * milestonePercent) / 100;

  // Pre-filled WhatsApp message
  const whatsappUrl = listing
    ? `https://wa.me/${WHATSAPP_SALES_PHONE}?text=${encodeURIComponent(
        `Hi Center Estates! I am interested in ${listing.unit.type || "Unit"} ${listing.unit.code} at ${listing.project.name} (${formatKES(listing.price)}). Is this unit available for viewing?`
      )}`
    : `https://wa.me/${WHATSAPP_SALES_PHONE}`;

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* Breadcrumb Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            fontSize: 13,
            color: "var(--ink3, #64748b)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              Home
            </Link>
            <ChevronRight size={14} />
            <Link href="/properties" style={{ color: "inherit", textDecoration: "none" }}>
              Properties
            </Link>
            {listing && (
              <>
                <ChevronRight size={14} />
                <Link
                  href={listing.project.id ? `/properties?project=${listing.project.id}` : `/properties?search=${encodeURIComponent(listing.project.name)}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {listing.project.name}
                </Link>
                <ChevronRight size={14} />
                <span style={{ color: "var(--ink, #0f172a)", fontWeight: 600 }}>
                  Unit {listing.unit.code}
                </span>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleShare}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink2, #334155)",
                cursor: "pointer",
              }}
            >
              <Share2 size={14} />
              {copiedLink ? "Link Copied!" : "Share Unit"}
            </button>
            <Link
              href="/properties"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink2, #334155)",
                textDecoration: "none",
              }}
            >
              <ArrowLeft size={14} /> All Listings
            </Link>
          </div>
        </div>

        {/* Loading / Missing States */}
        {!listing && !missing && (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "3px solid var(--border)",
                borderTopColor: "var(--brand, #b91c1c)",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p className="muted" style={{ marginTop: 16, fontSize: 15 }}>
              Loading unit details…
            </p>
          </div>
        )}

        {missing && (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
              Listing Unavailable
            </h2>
            <p className="muted" style={{ maxWidth: 480, margin: "0 auto 20px" }}>
              This specific unit has either been reserved or removed from active public inventory.
            </p>
            <Link
              href="/properties"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 10,
                background: "var(--brand, #b91c1c)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Browse Active Properties →
            </Link>
          </div>
        )}

        {/* Main Content */}
        {listing && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.8fr) minmax(320px, 1.1fr)",
              gap: 36,
              alignItems: "start",
            }}
          >
            {/* Left Column: Media & Specs */}
            <div>
              {/* Main Photo Gallery */}
              <div
                style={{
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  aspectRatio: "16/10",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-md, 0 4px 14px rgba(0,0,0,0.08))",
                }}
              >
                {listing.images && listing.images[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.images[activeImage].url}
                    alt={listing.unit.code}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.4s ease",
                    }}
                  />
                ) : (
                  <Building2 size={72} color="#94a3b8" />
                )}

                {/* Status Badges Overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    zIndex: 2,
                  }}
                >
                  <span
                    style={{
                      background: "rgba(15, 23, 42, 0.8)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "5px 12px",
                      borderRadius: 20,
                    }}
                  >
                    {listing.status === "available" ? "For Sale" : listing.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                  {listing.is_featured && (
                    <span
                      style={{
                        background: "var(--brand, #b91c1c)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "5px 12px",
                        borderRadius: 20,
                        boxShadow: "0 2px 8px rgba(185, 28, 28, 0.4)",
                      }}
                    >
                      ★ Featured
                    </span>
                  )}
                  <span
                    style={{
                      background: "rgba(22, 101, 52, 0.85)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "5px 12px",
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <ShieldCheck size={14} /> Verified Title Deed
                  </span>
                </div>

                {/* Image counter indicator */}
                {listing.images && listing.images.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 16,
                      right: 16,
                      background: "rgba(15, 23, 42, 0.75)",
                      backdropFilter: "blur(6px)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 14,
                    }}
                  >
                    Photo {activeImage + 1} of {listing.images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail Selector */}
              {listing.images && listing.images.length > 1 && (
                <div style={{ display: "flex", gap: 10, marginTop: 14, overflowX: "auto", paddingBottom: 6 }}>
                  {listing.images.map((image, index) => (
                    <button
                      key={`${image.url}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      style={{
                        border: index === activeImage ? "2.5px solid var(--brand, #b91c1c)" : "1.5px solid var(--border)",
                        borderRadius: 10,
                        padding: 0,
                        overflow: "hidden",
                        width: 90,
                        height: 60,
                        cursor: "pointer",
                        background: "var(--surface)",
                        flexShrink: 0,
                        transform: index === activeImage ? "scale(1.02)" : "scale(1)",
                        transition: "all 0.15s ease",
                      }}
                      aria-label={`View photo ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Title & Core Location Header */}
              <div style={{ marginTop: 28 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h1
                      style={{
                        fontSize: 34,
                        fontWeight: 900,
                        color: "var(--ink, #0f172a)",
                        margin: 0,
                        letterSpacing: "-0.5px",
                      }}
                    >
                      {formatKES(listing.price)}
                    </h1>
                    <div style={{ fontSize: 13, color: "var(--ink3, #64748b)", marginTop: 2 }}>
                      Direct Developer Pricing · Zero Intermediary Markup
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink, #0f172a)" }}>
                      {listing.unit.type || "Unit"} {listing.unit.code}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink3, #64748b)" }}>
                      {listing.project.name}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 12,
                    fontSize: 14,
                    color: "var(--ink2, #334155)",
                  }}
                >
                  <MapPin size={16} color="var(--brand, #b91c1c)" />
                  <span>
                    {listing.project.location ? `${listing.project.location}, Kenya` : "Nairobi, Kenya"}
                  </span>
                </div>
              </div>

              {/* Architectural Specs Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                  marginTop: 24,
                }}
              >
                <SpecCard
                  icon={<Home size={20} />}
                  label="Configuration"
                  value={
                    listing.unit.bedrooms === null || listing.unit.bedrooms === undefined
                      ? listing.unit.type || "Unit"
                      : listing.unit.bedrooms === 0
                      ? "Studio Apartment"
                      : `${listing.unit.bedrooms} Bedroom${listing.unit.bedrooms > 1 ? "s" : ""}`
                  }
                  subvalue={listing.unit.type || "Residential"}
                />

                <SpecCard
                  icon={<Square size={20} />}
                  label="Internal Area"
                  value={listing.unit.area ? `${listing.unit.area} sqft` : "Spacious Layout"}
                  subvalue={listing.unit.area ? `~${Math.round(Number(listing.unit.area) * 0.0929)} m²` : undefined}
                />

                <SpecCard
                  icon={<Layers size={20} />}
                  label="Floor Level"
                  value={listing.unit.floor ? `Level ${listing.unit.floor}` : "Elevated Floor"}
                  subvalue="Panoramic Views"
                />

                <SpecCard
                  icon={<Key size={20} />}
                  label="Commitment Deposit"
                  value={`${listing.minimum_deposit_percent}%`}
                  subvalue={priceNum > 0 ? formatKES(depositAmount) : undefined}
                />

                <SpecCard
                  icon={<HardHat size={20} />}
                  label="Construction Stage"
                  value={`${Math.round(Number(listing.construction_progress || 0))}% Complete`}
                  subvalue={Number(listing.construction_progress) >= 95 ? "Ready for Occupation" : "Active Construction"}
                />

                <SpecCard
                  icon={<FileCheck2 size={20} />}
                  label="Sectional Title"
                  value="Individually Titled"
                  subvalue="Survey Verified"
                />
              </div>

              {/* Milestone Payment Plan Visualizer */}
              <div
                style={{
                  marginTop: 32,
                  padding: 24,
                  borderRadius: 18,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "var(--brand-light, #fce8e8)",
                      color: "var(--brand, #b91c1c)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Coins size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                      Structured Milestone Payment Schedule
                    </h3>
                    <div style={{ fontSize: 13, color: "var(--ink3, #64748b)" }}>
                      Transparent direct-to-escrow developer payment terms
                    </div>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div
                  style={{
                    height: 10,
                    borderRadius: 6,
                    background: "var(--border)",
                    overflow: "hidden",
                    display: "flex",
                    margin: "18px 0 14px",
                  }}
                >
                  <div style={{ width: `${depositPercent}%`, background: "var(--brand, #b91c1c)" }} title="Deposit" />
                  <div style={{ width: `${milestonePercent}%`, background: "#3b82f6" }} title="Milestones" />
                  <div style={{ width: `${handoverPercent}%`, background: "#10b981" }} title="Handover" />
                </div>

                {/* Milestone columns */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div style={{ borderLeft: "3px solid var(--brand, #b91c1c)", paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand, #b91c1c)" }}>
                      1. Deposit ({depositPercent}%)
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: 2 }}>
                      {priceNum > 0 ? formatKES(depositAmount) : `${depositPercent}%`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink3, #64748b)", marginTop: 2 }}>
                      Upon signing sale agreement
                    </div>
                  </div>

                  <div style={{ borderLeft: "3px solid #3b82f6", paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6" }}>
                      2. Milestones ({milestonePercent}%)
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: 2 }}>
                      {priceNum > 0 ? formatKES(milestoneAmount) : `${milestonePercent}%`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink3, #64748b)", marginTop: 2 }}>
                      Spread across construction phases
                    </div>
                  </div>

                  <div style={{ borderLeft: "3px solid #10b981", paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>
                      3. Handover ({handoverPercent}%)
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: 2 }}>
                      {priceNum > 0 ? formatKES(handoverAmount) : `${handoverPercent}%`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink3, #64748b)", marginTop: 2 }}>
                      Upon key handover & title deed
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Description */}
              {listing.project.description && (
                <div
                  style={{
                    marginTop: 32,
                    padding: 24,
                    borderRadius: 18,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>
                    About {listing.project.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: "var(--ink2, #334155)",
                      margin: 0,
                    }}
                  >
                    {listing.project.description}
                  </p>
                </div>
              )}

              {/* The Center Estates Due Diligence Standard */}
              <div
                style={{
                  marginTop: 32,
                  padding: 24,
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                  color: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <ShieldCheck size={24} color="#ef4444" />
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                    Center Estates Verified Purchase Guarantee
                  </h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
                      <strong>Sectional Title Verification:</strong> Survey and land registry due diligence completed prior to listing.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
                      <strong>Escrow Protection:</strong> Stage-gated construction milestone releases verified by licensed quantity surveyors.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
                      <strong>Turnkey Handover:</strong> Snagging inspection, utility meter onboardings, and title deed registration support included.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
                      <strong>Direct Developer Pricing:</strong> No agent markups or broker commissions charged to buyers.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Action & Enquiry Desk */}
            <aside
              style={{
                position: "sticky",
                top: 90,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* WhatsApp Quick Action Card */}
              <div
                style={{
                  background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
                  borderRadius: 18,
                  padding: 22,
                  color: "#fff",
                  boxShadow: "0 8px 24px rgba(6, 78, 59, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#25D366",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MessageCircle size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Direct Sales Desk</div>
                    <div style={{ fontSize: 12, color: "#a7f3d0" }}>Instant response via WhatsApp</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#d1fae5", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Chat directly with the project investment advisor for floor plans, brochure PDFs, and private site visits.
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: 10,
                    background: "#25D366",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(37, 211, 102, 0.4)",
                    transition: "transform 0.15s ease",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                  onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <MessageCircle size={18} /> Chat About Unit {listing.unit.code}
                </a>
              </div>

              {/* Formal Enquiry / Viewing Booking Form */}
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  padding: 24,
                  background: "var(--surface)",
                  boxShadow: "var(--shadow-md, 0 4px 16px rgba(0,0,0,0.06))",
                }}
              >
                {reference ? (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "#dcfce7",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                      }}
                    >
                      <CheckCircle2 size={32} />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>
                      Enquiry Registered
                    </h2>
                    <p className="muted" style={{ fontSize: 14, margin: "0 0 16px" }}>
                      Thank you! Your reference number is:
                    </p>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "8px 18px",
                        borderRadius: 8,
                        background: "var(--bg, #f1f5f9)",
                        fontWeight: 800,
                        fontSize: 16,
                        letterSpacing: "0.5px",
                        marginBottom: 16,
                      }}
                    >
                      {reference}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--ink2, #334155)", lineHeight: 1.6 }}>
                      A dedicated investment manager will contact you with full documentation and coordinate your site visit.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submitEnquiry}>
                    <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 4px" }}>
                      Schedule a Site Viewing
                    </h2>
                    <p className="muted" style={{ fontSize: 13, margin: "0 0 18px" }}>
                      Direct developer consultation with no obligations
                    </p>

                    {error && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#b91c1c",
                          fontSize: 13,
                          marginBottom: 16,
                        }}
                      >
                        {error}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #0f172a)" }}>
                        Full Name *
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          placeholder="e.g. Jane Muthoni"
                          style={{
                            width: "100%",
                            marginTop: 5,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            fontSize: 14,
                            outline: "none",
                          }}
                        />
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #0f172a)" }}>
                          Phone Number
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+254 7…"
                            style={{
                              width: "100%",
                              marginTop: 5,
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              fontSize: 14,
                              outline: "none",
                            }}
                          />
                        </label>

                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #0f172a)" }}>
                          Email Address
                          <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            placeholder="jane@example.com"
                            style={{
                              width: "100%",
                              marginTop: 5,
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              fontSize: 14,
                              outline: "none",
                            }}
                          />
                        </label>
                      </div>

                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #0f172a)" }}>
                        Preferred Viewing Date
                        <input
                          type="date"
                          value={viewingDate}
                          onChange={(e) => setViewingDate(e.target.value)}
                          style={{
                            width: "100%",
                            marginTop: 5,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            fontSize: 14,
                            outline: "none",
                          }}
                        />
                      </label>

                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #0f172a)" }}>
                        Questions or Remarks
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={3}
                          placeholder="I am interested in seeing the payment plan options and visiting the show house…"
                          style={{
                            width: "100%",
                            marginTop: 5,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            fontSize: 14,
                            outline: "none",
                            resize: "vertical",
                          }}
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={sending}
                        style={{
                          width: "100%",
                          padding: "13px 20px",
                          borderRadius: 10,
                          background: "var(--brand, #b91c1c)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 15,
                          border: "none",
                          cursor: sending ? "not-allowed" : "pointer",
                          opacity: sending ? 0.7 : 1,
                          marginTop: 6,
                          boxShadow: "0 2px 8px rgba(185, 28, 28, 0.3)",
                        }}
                      >
                        {sending ? "Submitting Enquiry…" : "Request Site Visit & Info Pack"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
