"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  FileCheck2,
  HardHat,
  Home,
  Image as ImageIcon,
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
  X,
} from "lucide-react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { formatKES, formatUSD, type PublicListing } from "./StorefrontHome";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);

  const imagesCount = listing?.images?.length ?? 0;

  const goToPrevImage = useCallback(() => {
    if (imagesCount <= 1) return;
    setActiveImage((prev) => (prev - 1 + imagesCount) % imagesCount);
  }, [imagesCount]);

  const goToNextImage = useCallback(() => {
    if (imagesCount <= 1) return;
    setActiveImage((prev) => (prev + 1) % imagesCount);
  }, [imagesCount]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!thumbnailRailRef.current) return;
    const activeEl = thumbnailRailRef.current.children[activeImage] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeImage]);

  // Keyboard navigation for gallery & lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "ArrowLeft") {
        goToPrevImage();
      } else if (e.key === "ArrowRight") {
        goToNextImage();
      } else if (e.key === "Escape" && lightboxOpen) {
        setLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevImage, goToNextImage, lightboxOpen]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [lightboxOpen]);

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
    <MarketingLayout isSales={true}>
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
                  background: "var(--bg, #f8fafc)",
                  border: "1px solid var(--border)",
                  aspectRatio: "16/10",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 30px -10px rgba(15, 23, 42, 0.08)",
                  cursor: listing.images && listing.images.length > 0 ? "zoom-in" : "default",
                  userSelect: "none",
                }}
                onClick={() => {
                  if (listing.images && listing.images.length > 0) {
                    setLightboxOpen(true);
                  }
                }}
              >
                {listing.images && listing.images[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={listing.images[activeImage].url}
                    src={listing.images[activeImage].url}
                    alt={listing.images[activeImage].title || listing.unit.code}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "opacity 0.25s ease",
                    }}
                  />
                ) : (
                  <Building2 size={72} color="#94a3b8" />
                )}

                {/* Floating Previous & Next Chevrons */}
                {listing.images && listing.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo (Left Arrow)"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevImage();
                      }}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.92)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 255, 255, 0.8)",
                        color: "var(--ink, #0f172a)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.16)",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        zIndex: 4,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-50%) scale(1.08)";
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.color = "var(--brand, #b91c1c)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.92)";
                        e.currentTarget.style.color = "var(--ink, #0f172a)";
                      }}
                    >
                      <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>

                    <button
                      type="button"
                      aria-label="Next photo (Right Arrow)"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextImage();
                      }}
                      style={{
                        position: "absolute",
                        right: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.92)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 255, 255, 0.8)",
                        color: "var(--ink, #0f172a)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.16)",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        zIndex: 4,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-50%) scale(1.08)";
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.color = "var(--brand, #b91c1c)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.92)";
                        e.currentTarget.style.color = "var(--ink, #0f172a)";
                      }}
                    >
                      <ChevronRight size={22} strokeWidth={2.5} />
                    </button>
                  </>
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
                      background: "rgba(15, 23, 42, 0.82)",
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
                      background: "rgba(22, 101, 52, 0.88)",
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

                {/* Bottom Overlay: Caption + Photo Counter + Fullscreen Button */}
                {listing.images && listing.images.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 14,
                      left: 14,
                      right: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      pointerEvents: "none",
                      zIndex: 3,
                    }}
                  >
                    {/* Left: Image Room Caption */}
                    <div style={{ pointerEvents: "auto" }}>
                      {listing.images[activeImage]?.title ? (
                        <div
                          style={{
                            background: "rgba(15, 23, 42, 0.8)",
                            backdropFilter: "blur(8px)",
                            color: "#ffffff",
                            fontSize: 12.5,
                            fontWeight: 600,
                            padding: "6px 14px",
                            borderRadius: 20,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          }}
                        >
                          {listing.images[activeImage].title}
                        </div>
                      ) : null}
                    </div>

                    {/* Right: Counter Badge & Fullscreen Button */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" }}>
                      <div
                        style={{
                          background: "rgba(15, 23, 42, 0.8)",
                          backdropFilter: "blur(8px)",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 12px",
                          borderRadius: 20,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}
                      >
                        <ImageIcon size={13} />
                        {activeImage + 1} / {listing.images.length}
                      </div>

                      <button
                        type="button"
                        aria-label="View Fullscreen Gallery"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxOpen(true);
                        }}
                        style={{
                          background: "rgba(15, 23, 42, 0.8)",
                          backdropFilter: "blur(8px)",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 12px",
                          borderRadius: 20,
                          border: "none",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          transition: "background 0.2s, transform 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--brand, #b91c1c)";
                          e.currentTarget.style.transform = "scale(1.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(15, 23, 42, 0.8)";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        <Maximize2 size={13} />
                        Fullscreen
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Thumbnail Selector */}
              {listing.images && listing.images.length > 1 && (
                <div style={{ marginTop: 14 }}>
                  <div
                    ref={thumbnailRailRef}
                    style={{
                      display: "flex",
                      gap: 10,
                      overflowX: "auto",
                      padding: "4px 2px 8px",
                      scrollBehavior: "smooth",
                      scrollbarWidth: "thin",
                    }}
                  >
                    {listing.images.map((image, index) => {
                      const isActive = index === activeImage;
                      return (
                        <button
                          key={`${image.url}-${index}`}
                          type="button"
                          onClick={() => setActiveImage(index)}
                          style={{
                            border: isActive
                              ? "2.5px solid var(--brand, #b91c1c)"
                              : "1.5px solid var(--border)",
                            borderRadius: 12,
                            padding: 0,
                            overflow: "hidden",
                            width: 96,
                            height: 64,
                            cursor: "pointer",
                            background: "var(--surface)",
                            flexShrink: 0,
                            position: "relative",
                            transform: isActive ? "scale(1.04)" : "scale(1)",
                            opacity: isActive ? 1 : 0.78,
                            boxShadow: isActive
                              ? "0 4px 12px rgba(185, 28, 28, 0.25)"
                              : "none",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.opacity = "1";
                              e.currentTarget.style.borderColor = "var(--ink2, #64748b)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.opacity = "0.78";
                              e.currentTarget.style.borderColor = "var(--border)";
                            }
                          }}
                          aria-label={`View photo ${index + 1}${image.title ? `: ${image.title}` : ""}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          {isActive && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: "var(--brand, #b91c1c)",
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Title & Core Location Header */}
              <div style={{ marginTop: 28 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
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
                      {Number(listing.price) > 0 && (
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink3, #64748b)" }}>
                          (~{formatUSD(listing.price)})
                        </span>
                      )}
                    </div>
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
                  padding: "26px 28px",
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Subtle top accent bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: "linear-gradient(90deg, var(--brand, #b91c1c) 0%, #16a34a 100%)",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: "rgba(185, 28, 28, 0.08)",
                        color: "var(--brand, #b91c1c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          margin: 0,
                          color: "var(--ink, #0f172a)",
                          letterSpacing: "-0.2px",
                        }}
                      >
                        Center Estates Verified Purchase Guarantee
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink3, #64748b)" }}>
                        Institutional-grade legal due diligence & buyer escrow safety included with every unit
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 20,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#15803d",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.2px",
                    }}
                  >
                    <CheckCircle2 size={14} /> 100% TITLE VETTED
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 14,
                    marginTop: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--surface, #ffffff)",
                      border: "1px solid #edf2f7",
                      display: "flex",
                      gap: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#ecfdf5",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--ink, #0f172a)", display: "block", marginBottom: 2 }}>
                        Sectional Title Verification
                      </strong>
                      <span style={{ color: "var(--ink2, #475569)" }}>
                        Survey and land registry due diligence completed prior to listing.
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--surface, #ffffff)",
                      border: "1px solid #edf2f7",
                      display: "flex",
                      gap: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#ecfdf5",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--ink, #0f172a)", display: "block", marginBottom: 2 }}>
                        Escrow Protection
                      </strong>
                      <span style={{ color: "var(--ink2, #475569)" }}>
                        Stage-gated construction milestone releases verified by licensed quantity surveyors.
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--surface, #ffffff)",
                      border: "1px solid #edf2f7",
                      display: "flex",
                      gap: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#ecfdf5",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--ink, #0f172a)", display: "block", marginBottom: 2 }}>
                        Turnkey Handover
                      </strong>
                      <span style={{ color: "var(--ink2, #475569)" }}>
                        Snagging inspection, utility meter onboardings, and title deed registration support included.
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--surface, #ffffff)",
                      border: "1px solid #edf2f7",
                      display: "flex",
                      gap: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#ecfdf5",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--ink, #0f172a)", display: "block", marginBottom: 2 }}>
                        Direct Developer Pricing
                      </strong>
                      <span style={{ color: "var(--ink2, #475569)" }}>
                        No agent markups or broker commissions charged to buyers.
                      </span>
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
      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && listing?.images && listing.images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Listing photo lightbox"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(10, 15, 29, 0.96)",
            backdropFilter: "blur(14px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px 24px",
          }}
          onClick={() => setLightboxOpen(false)}
        >
          {/* Lightbox Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: 1200,
              margin: "0 auto",
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 16 }}>
                {listing.unit.code} — {listing.project.name}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>
                {listing.images[activeImage]?.title || "Gallery View"}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ImageIcon size={14} />
                {activeImage + 1} / {listing.images.length}
              </div>

              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--brand, #b91c1c)";
                  e.currentTarget.style.transform = "scale(1.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                aria-label="Close fullscreen view (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image & Arrows */}
          <div
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: 1200,
              width: "100%",
              margin: "12px auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Arrow */}
            {listing.images.length > 1 && (
              <button
                type="button"
                aria-label="Previous photo (Left Arrow)"
                onClick={goToPrevImage}
                style={{
                  position: "absolute",
                  left: 12,
                  zIndex: 20,
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--brand, #b91c1c)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={listing.images[activeImage]?.url}
              src={listing.images[activeImage]?.url}
              alt={listing.images[activeImage]?.title || listing.unit.code}
              style={{
                maxHeight: "74vh",
                maxWidth: "88vw",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8)",
              }}
            />

            {/* Next Arrow */}
            {listing.images.length > 1 && (
              <button
                type="button"
                aria-label="Next photo (Right Arrow)"
                onClick={goToNextImage}
                style={{
                  position: "absolute",
                  right: 12,
                  zIndex: 20,
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--brand, #b91c1c)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <ChevronRight size={28} />
              </button>
            )}
          </div>

          {/* Lightbox Bottom Thumbnails */}
          {listing.images.length > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 10,
                overflowX: "auto",
                padding: "8px 0 4px",
                maxWidth: 1200,
                width: "100%",
                margin: "0 auto",
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {listing.images.map((image, idx) => {
                const isActive = idx === activeImage;
                return (
                  <button
                    key={`lb-${image.url}-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    style={{
                      border: isActive
                        ? "2px solid var(--brand, #ef4444)"
                        : "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: 8,
                      padding: 0,
                      overflow: "hidden",
                      width: 68,
                      height: 48,
                      cursor: "pointer",
                      background: "transparent",
                      flexShrink: 0,
                      opacity: isActive ? 1 : 0.5,
                      transform: isActive ? "scale(1.08)" : "scale(1)",
                      transition: "all 0.2s ease",
                    }}
                    aria-label={`Jump to photo ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>
    </MarketingLayout>
  );
}
