"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  Layers,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  PhoneCall,
  PlusCircle,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import Unit3DViewer from "@/components/sales-unit3d/Unit3DViewer";

type Row = Record<string, any>;
type JourneyStage = {
  step: number;
  name: string;
  channel: string;
  detail: string;
};

type Portal = {
  buyer: Row;
  currentSale: Row | null;
  sales: Row[];
  installments: Row[];
  payments: Row[];
  documents: Row[];
  siteVisits: Row[];
  availableUnits: Row[];
  journey?: {
    stage: number;
    label: string;
    maxStages: number;
    stages: JourneyStage[];
  };
  agent?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null;
  kpis: {
    totalSales: number;
    outstanding: number;
    verifiedPayments: number;
    scheduledVisits?: number;
  };
};

type Tab =
  | "overview"
  | "viewings"
  | "agreement"
  | "installments"
  | "payments"
  | "documents"
  | "support"
  | "showcase";

const labels: Record<Tab, string> = {
  overview: "Overview",
  viewings: "Site Visits",
  agreement: "My Property",
  installments: "Installments",
  payments: "Payments",
  documents: "Contracts & Docs",
  support: "After-Sales & Care",
  showcase: "Available Units",
};

const tabIcons: Record<Tab, React.ReactNode> = {
  overview: <Gauge size={17} />,
  viewings: <Compass size={17} />,
  agreement: <Home size={17} />,
  installments: <CalendarDays size={17} />,
  payments: <CreditCard size={17} />,
  documents: <FileText size={17} />,
  support: <LifeBuoy size={17} />,
  showcase: <Building2 size={17} />,
};

const cash = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const friendlyDate = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

function BuyerPortalContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const queryBuyer = searchParams.get("buyer") || "";
  const organizationId = session?.activeOrganizationId ?? null;

  const [data, setData] = useState<Portal | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [record, setRecord] = useState({
    sale: "",
    installment: "",
    amount: "",
    method: "paybill",
    external_reference: "",
  });

  const [viewingOpen, setViewingOpen] = useState(false);
  const [viewingBusy, setViewingBusy] = useState(false);
  const [viewingError, setViewingError] = useState("");
  const [viewingForm, setViewingForm] = useState({
    project: "",
    visited_at: "",
    unit_type: "2 Bedroom",
    notes: "",
  });

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState("");
  const [supportError, setSupportError] = useState("");
  const [supportForm, setSupportForm] = useState({
    category: "Maintenance & Repairs",
    subject: "",
    details: "",
  });

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const endpoint = queryBuyer
        ? `/sales/buyer-portal/?buyer=${encodeURIComponent(queryBuyer)}`
        : "/sales/buyer-portal/";
      const res = await apiFetch(endpoint, {}, organizationId);
      if (!res.ok) {
        setError(
          res.status === 403
            ? "This account is not linked to an active client profile. Please reach out to your sales agent for access."
            : await apiErrorMessage(
                res,
                "Your client portal account could not be loaded."
              )
        );
        setLoading(false);
        return;
      }
      const json = (await res.json()) as Portal;
      setData(json);
      if (json.currentSale) {
        setRecord((r) => ({
          ...r,
          sale: String(json.currentSale!.id ?? ""),
          installment: String(json.installments?.[0]?.id ?? ""),
        }));
      }
      if (json.availableUnits?.length && !viewingForm.project) {
        const firstProj = json.availableUnits[0].project;
        if (firstProj?.id) {
          setViewingForm((vf) => ({ ...vf, project: String(firstProj.id) }));
        }
      }
    } catch {
      setError("Unable to connect to the client portal. Please check your network and retry.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, queryBuyer]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function submitPayment() {
    if (!record.amount || !record.external_reference.trim()) {
      setRecordError("Please provide both an amount and the payment reference code.");
      return;
    }
    setRecordBusy(true);
    setRecordError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/sales/buyer-portal/payments/record/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify({
            sale: record.sale,
            installment: record.installment || null,
            amount: record.amount,
            method: record.method,
            external_reference: record.external_reference.trim(),
          }),
        },
        organizationId
      );
      if (!res.ok) {
        setRecordError(
          await apiErrorMessage(res, "The payment reference could not be verified.")
        );
        return;
      }
      setRecordOpen(false);
      setRecord({ ...record, amount: "", external_reference: "" });
      await load();
      setTab("payments");
    } catch {
      setRecordError("Payment submission failed. Check your network connection.");
    } finally {
      setRecordBusy(false);
    }
  }

  async function submitViewingRequest() {
    if (!viewingForm.project) {
      setViewingError("Please choose a development/project.");
      return;
    }
    setViewingBusy(true);
    setViewingError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/sales/buyer-portal/viewings/request/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify(viewingForm),
        },
        organizationId
      );
      if (!res.ok) {
        setViewingError(
          await apiErrorMessage(res, "Could not submit viewing request.")
        );
        return;
      }
      setViewingOpen(false);
      setViewingForm({
        project: "",
        visited_at: "",
        unit_type: "2 Bedroom",
        notes: "",
      });
      await load();
      setTab("viewings");
    } catch {
      setViewingError("Request could not be sent. Please retry.");
    } finally {
      setViewingBusy(false);
    }
  }

  async function submitSupportRequest() {
    if (!supportForm.subject.trim()) {
      setSupportError("Please enter a subject.");
      return;
    }
    setSupportBusy(true);
    setSupportError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/sales/buyer-portal/support/request/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify(supportForm),
        },
        organizationId
      );
      if (!res.ok) {
        setSupportError(
          await apiErrorMessage(res, "Could not submit after-sales request.")
        );
        return;
      }
      setSupportSuccess(
        "Your request has been logged! Our property management team will get back to you shortly."
      );
      setSupportForm({
        category: "Maintenance & Repairs",
        subject: "",
        details: "",
      });
      setTimeout(() => {
        setSupportOpen(false);
        setSupportSuccess("");
      }, 2000);
      await load();
    } catch {
      setSupportError("Submission failed. Please retry.");
    } finally {
      setSupportBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wrap" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <CircularProgress size={38} sx={{ color: "var(--color-brand-blue, #1d4ed8)" }} />
          <p style={{ marginTop: 16, fontWeight: 700, color: "var(--text-secondary)" }}>
            Synchronizing client portal from ERP system…
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-wrap" style={{ maxWidth: 640, margin: "60px auto", padding: 24 }}>
        <Alert severity="warning" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const buyer = data.buyer ?? {};
  const sale = data.currentSale;
  const agent = data.agent;
  const journey = data.journey;

  const currentStageNum = journey?.stage ?? 4;
  const progressPercent = Math.round((currentStageNum / 7) * 100);

  const whatsappLink = agent?.phone
    ? `https://wa.me/${agent.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hello ${agent.name}, I am reaching out from Center Estates client portal regarding my account ${buyer.reference || ""}.`
      )}`
    : "";

  return (
    <div className="page-wrap tenant-portal-page" style={{ paddingBottom: 60 }}>
      {/* Staff Preview Support Banner */}
      {queryBuyer && (
        <div
          style={{
            background: "linear-gradient(90deg, #1e293b, #0f172a)",
            color: "#f8fafc",
            padding: "10px 20px",
            borderRadius: 12,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔍</span>
            <span>
              <strong>Staff Support Mode:</strong> Previewing portal as client{" "}
              <strong>{String(buyer.full_name)}</strong> ({String(buyer.reference)})
            </span>
          </div>
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => (window.location.href = "/sales")}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            ← Return to ERP Sales
          </Button>
        </div>
      )}

      {/* Top Integrated Ecosystem Header */}
      <header
        style={{
          background: "linear-gradient(135deg, #091a3c 0%, #102a5c 50%, #1e3a8a 100%)",
          color: "#ffffff",
          borderRadius: 20,
          padding: "28px 32px",
          marginBottom: 24,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 20,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(8px)",
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#93c5fd",
                }}
              >
                Center Estates · Integrated Digital Ecosystem
              </span>
              <span
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 12,
                }}
              >
                ● Connected to ERP
              </span>
            </div>
            <h1
              style={{
                margin: "4px 0 8px",
                fontSize: "clamp(24px, 3.5vw, 32px)",
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              Welcome back, {String(buyer.full_name || "Client").split(" ")[0]}
            </h1>
            <p
              style={{
                margin: 0,
                color: "#cbd5e1",
                fontSize: 14,
                maxWidth: 620,
                lineHeight: 1.5,
              }}
            >
              Track your property journey in real time—from initial discovery and site viewings
              to milestone payments, legal contracts, and lifetime after-sales care.
            </p>
          </div>

          {/* Dedicated Relationship Manager Card */}
          {agent && (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 16,
                padding: "16px 20px",
                minWidth: 280,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    fontSize: 18,
                    color: "#fff",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93c5fd", fontWeight: 700 }}>
                    Dedicated Property Specialist
                  </div>
                  <strong style={{ fontSize: 16, color: "#fff" }}>{agent.name}</strong>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {whatsappLink && (
                  <Button
                    size="small"
                    variant="contained"
                    sx={{
                      bgcolor: "#25D366",
                      "&:hover": { bgcolor: "#1ebd58" },
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 12,
                      flex: 1,
                    }}
                    startIcon={<MessageCircle size={15} />}
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </Button>
                )}
                {agent.phone && (
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{
                      color: "#fff",
                      borderColor: "rgba(255,255,255,0.4)",
                      "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
                      textTransform: "none",
                      fontSize: 12,
                      minWidth: 40,
                    }}
                    href={`tel:${agent.phone}`}
                    title="Call Specialist"
                  >
                    <Phone size={15} />
                  </Button>
                )}
                {agent.email && (
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{
                      color: "#fff",
                      borderColor: "rgba(255,255,255,0.4)",
                      "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
                      textTransform: "none",
                      fontSize: 12,
                      minWidth: 40,
                    }}
                    href={`mailto:${agent.email}`}
                    title="Email Specialist"
                  >
                    <Mail size={15} />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 7-Stage Customer Journey Stepper (Direct from Architecture Diagram) */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#fbbf24" />
              <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f8fafc" }}>
                Connected Customer Journey
              </strong>
            </div>
            <div style={{ fontSize: 13, color: "#93c5fd" }}>
              Current Milestone:{" "}
              <strong style={{ color: "#fff" }}>
                Step {currentStageNum} of 7: {journey?.label ?? "Active Stage"}
              </strong>{" "}
              ({progressPercent}%)
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 8,
              position: "relative",
            }}
          >
            {(journey?.stages ?? []).map((st) => {
              const isPast = st.step < currentStageNum;
              const isCurrent = st.step === currentStageNum;
              return (
                <div
                  key={st.step}
                  style={{
                    background: isCurrent
                      ? "rgba(59, 130, 246, 0.35)"
                      : isPast
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(255, 255, 255, 0.06)",
                    border: isCurrent
                      ? "1.5px solid #60a5fa"
                      : isPast
                      ? "1px solid rgba(52, 211, 153, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: isCurrent ? "#93c5fd" : isPast ? "#6ee7b7" : "#94a3b8",
                        textTransform: "uppercase",
                      }}
                    >
                      Step 0{st.step}
                    </span>
                    {isPast ? (
                      <CheckCircle2 size={13} color="#34d399" />
                    ) : isCurrent ? (
                      <Clock size={13} color="#60a5fa" />
                    ) : null}
                  </div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 800,
                      color: isCurrent ? "#ffffff" : isPast ? "#f1f5f9" : "#94a3b8",
                    }}
                  >
                    {st.name}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: isCurrent ? "#bfdbfe" : isPast ? "#a7f3d0" : "#64748b",
                      marginTop: 2,
                    }}
                  >
                    {st.channel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="tenant-portal-layout">
        {/* Navigation Sidebar */}
        <aside className="tenant-portal-sidebar">
          <div className="tenant-sidebar-profile">
            <div className="tenant-sidebar-profile-top">
              <div className="tenant-avatar-circle">
                {String(buyer.full_name || "CE").slice(0, 2).toUpperCase()}
              </div>
              <div className="tenant-sidebar-user-meta">
                <strong className="tenant-sidebar-name">{String(buyer.full_name || "Client")}</strong>
                <span className="tenant-sidebar-code">Ref: {String(buyer.reference || "BUY-0000")}</span>
              </div>
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={String(buyer.status || "Lead").toUpperCase()}
                color={buyer.status === "completed" ? "success" : "primary"}
                sx={{ fontWeight: 800, fontSize: 10, height: 20 }}
              />
              <Chip
                size="small"
                label={sale ? `Unit ${sale.unit_code}` : "Prospective Buyer"}
                variant="outlined"
                sx={{ fontSize: 10, height: 20 }}
              />
            </div>
          </div>

          <nav className="tenant-sidebar-nav">
            {(Object.keys(labels) as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`tenant-sidebar-nav-item ${tab === item ? "active" : ""}`}
                onClick={() => setTab(item)}
              >
                <span className="tenant-nav-icon">{tabIcons[item]}</span>
                <span className="tenant-nav-label">{labels[item]}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Fast Action Box */}
          <div
            style={{
              background: "var(--color-surface-alt, #f8fafc)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: 14,
              padding: 14,
              marginTop: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <LifeBuoy size={16} color="#2563eb" />
              <strong style={{ fontSize: 12 }}>Need Assistance?</strong>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              Book an accompanied site visit or submit an after-sales service inquiry directly to the ERP team.
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              <Button
                size="small"
                variant="contained"
                onClick={() => setViewingOpen(true)}
                sx={{ textTransform: "none", fontSize: 11, fontWeight: 700 }}
                startIcon={<Compass size={14} />}
              >
                Request Site Visit
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSupportOpen(true)}
                sx={{ textTransform: "none", fontSize: 11 }}
                startIcon={<Wrench size={14} />}
              >
                Report After-Sales Issue
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="tenant-portal-main">
          {tab === "overview" && (
            <OverviewTab
              data={data}
              setTab={setTab}
              onOpenPayment={() => setRecordOpen(true)}
              onOpenViewing={() => setViewingOpen(true)}
              onOpenSupport={() => setSupportOpen(true)}
            />
          )}

          {tab === "viewings" && (
            <ViewingsTab
              data={data}
              onOpenViewing={() => setViewingOpen(true)}
            />
          )}

          {tab === "agreement" && (
            <AgreementTab sale={sale} data={data} onOpenPayment={() => setRecordOpen(true)} />
          )}

          {tab === "installments" && (
            <InstallmentsTab data={data} onOpenPayment={() => setRecordOpen(true)} />
          )}

          {tab === "payments" && (
            <PaymentsTab data={data} onOpenPayment={() => setRecordOpen(true)} />
          )}

          {tab === "documents" && <DocumentsTab data={data} />}

          {tab === "support" && (
            <SupportTab
              data={data}
              onOpenSupport={() => setSupportOpen(true)}
              agent={agent}
            />
          )}

          {tab === "showcase" && (
            <ShowcaseTab
              data={data}
              onOpenViewing={(projId) => {
                setViewingForm((vf) => ({ ...vf, project: projId }));
                setViewingOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* 1. Modal: Record Payment Reference */}
      <RecordPaymentModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        busy={recordBusy}
        error={recordError}
        record={record}
        setRecord={setRecord}
        onSubmit={() => void submitPayment()}
        installments={data.installments}
        buyer={buyer}
      />

      {/* 2. Modal: Request Site Visit */}
      <RequestViewingModal
        open={viewingOpen}
        onClose={() => setViewingOpen(false)}
        busy={viewingBusy}
        error={viewingError}
        form={viewingForm}
        setForm={setViewingForm}
        onSubmit={() => void submitViewingRequest()}
        availableUnits={data.availableUnits}
      />

      {/* 3. Modal: After-Sales Service & Maintenance */}
      <RequestSupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        busy={supportBusy}
        success={supportSuccess}
        error={supportError}
        form={supportForm}
        setForm={setSupportForm}
        onSubmit={() => void submitSupportRequest()}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-views & Components
// --------------------------------------------------------------------------

function OverviewTab({
  data,
  setTab,
  onOpenPayment,
  onOpenViewing,
  onOpenSupport,
}: {
  data: Portal;
  setTab: (t: Tab) => void;
  onOpenPayment: () => void;
  onOpenViewing: () => void;
  onOpenSupport: () => void;
}) {
  const k = data.kpis ?? { totalSales: 0, outstanding: 0, verifiedPayments: 0 };
  const sale = data.currentSale;
  const buyer = data.buyer;

  return (
    <>
      {/* Financial KPI Cards */}
      <section className="kpi-grid" style={{ marginBottom: 20 }}>
        <div
          className="tenant-kpi-card"
          onClick={() => setTab("agreement")}
          style={{ cursor: "pointer" }}
        >
          <span className="tenant-kpi-label">Active Purchases</span>
          <strong className="tenant-kpi-value">{Number(k.totalSales)}</strong>
          <span className="tenant-kpi-note">{sale ? `Unit ${sale.unit_code}` : "In Pipeline"}</span>
        </div>
        <div
          className="tenant-kpi-card"
          onClick={() => setTab("payments")}
          style={{ cursor: "pointer" }}
        >
          <span className="tenant-kpi-label">Verified Paid</span>
          <strong className="tenant-kpi-value" style={{ color: "var(--color-success, #059669)" }}>
            {cash.format(Number(k.verifiedPayments))}
          </strong>
          <span className="tenant-kpi-note">Allocated & confirmed</span>
        </div>
        <div
          className="tenant-kpi-card"
          onClick={() => setTab("installments")}
          style={{ cursor: "pointer" }}
        >
          <span className="tenant-kpi-label">Outstanding Balance</span>
          <strong
            className="tenant-kpi-value"
            style={{ color: Number(k.outstanding) > 0 ? "var(--color-brand-blue, #1d4ed8)" : "var(--color-success)" }}
          >
            {cash.format(Number(k.outstanding))}
          </strong>
          <span className="tenant-kpi-note">Remaining milestone total</span>
        </div>
        <div
          className="tenant-kpi-card"
          onClick={() => setTab("viewings")}
          style={{ cursor: "pointer" }}
        >
          <span className="tenant-kpi-label">Scheduled Viewings</span>
          <strong className="tenant-kpi-value">{data.siteVisits?.length ?? 0}</strong>
          <span className="tenant-kpi-note">Accompanied visits</span>
        </div>
      </section>

      {/* Active Purchase Spotlight / Unit Card */}
      {sale ? (
        <section
          className="data-panel"
          style={{
            marginBottom: 20,
            background: "linear-gradient(to right bottom, #ffffff, #f8fafc)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "var(--color-brand-blue, #1d4ed8)",
                  letterSpacing: "0.06em",
                }}
              >
                Reserved Development Spotlight
              </span>
              <h2 style={{ margin: "4px 0 6px", fontSize: 22, fontWeight: 900 }}>
                {String(sale.project_name)} · Unit {String(sale.unit_code)}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                <span>Type: <strong>{String(sale.unit_type || "Apartment")}</strong></span>
                <span>•</span>
                <span>Floor: <strong>{String(sale.unit_floor || "G")}</strong></span>
                <span>•</span>
                <span>Ref: <strong className="mono">{String(sale.reference)}</strong></span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CreditCard size={16} />}
                onClick={onOpenPayment}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Make Payment
              </Button>
              <Button
                variant="outlined"
                startIcon={<Eye size={16} />}
                onClick={() => setTab("agreement")}
                sx={{ textTransform: "none" }}
              >
                View 3D Model
              </Button>
            </div>
          </div>

          {/* Construction Progress Bar (Synchronized with ERP) */}
          <div
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: 12,
              padding: "14px 18px",
              marginTop: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>Construction & Site Progress</span>
              <span style={{ fontWeight: 800, color: "var(--color-brand-blue)" }}>
                {sale.construction_progress || "75"}% Completed
              </span>
            </div>
            <div style={{ width: "100%", height: 10, background: "#e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Number(sale.construction_progress || 75)}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #3b82f6, #10b981)",
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="data-panel" style={{ marginBottom: 20, padding: 24, textAlign: "center" }}>
          <Compass size={36} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px" }}>Explore Off-Plan Developments</h3>
          <p style={{ margin: "0 auto 16px", color: "var(--text-secondary)", maxWidth: 520, fontSize: 13 }}>
            You do not have an active purchase agreement yet. Browse available units, schedule an accompanied site
            visit, or contact your specialist to reserve an off-plan property.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Button variant="contained" onClick={() => setTab("showcase")}>
              Browse Available Developments
            </Button>
            <Button variant="outlined" onClick={onOpenViewing}>
              Schedule a Site Visit
            </Button>
          </div>
        </section>
      )}

      {/* Quick Actions Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div
          onClick={onOpenViewing}
          style={{
            background: "var(--surface-raised, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 14,
            padding: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "all 0.2s",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#dbeafe", color: "#1d4ed8", display: "grid", placeItems: "center" }}>
            <Compass size={22} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 14 }}>Schedule a Site Visit</strong>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Pick date & preferred project</span>
          </div>
        </div>

        <div
          onClick={onOpenPayment}
          style={{
            background: "var(--surface-raised, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 14,
            padding: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "all 0.2s",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#dcfce7", color: "#15803d", display: "grid", placeItems: "center" }}>
            <CreditCard size={22} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 14 }}>Make a Payment</strong>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>M-Pesa Paybill & Bank details</span>
          </div>
        </div>

        <div
          onClick={() => setTab("documents")}
          style={{
            background: "var(--surface-raised, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 14,
            padding: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "all 0.2s",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fef3c7", color: "#b45309", display: "grid", placeItems: "center" }}>
            <FileText size={22} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 14 }}>Contracts & Receipts</strong>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Download signed documents</span>
          </div>
        </div>

        <div
          onClick={onOpenSupport}
          style={{
            background: "var(--surface-raised, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 14,
            padding: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "all 0.2s",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#ede9fe", color: "#6d28d9", display: "grid", placeItems: "center" }}>
            <LifeBuoy size={22} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 14 }}>After-Sales Care</strong>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Maintenance & handover support</span>
          </div>
        </div>
      </section>
    </>
  );
}

function ViewingsTab({
  data,
  onOpenViewing,
}: {
  data: Portal;
  onOpenViewing: () => void;
}) {
  const visits = data.siteVisits ?? [];

  return (
    <div className="data-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px" }}>Site Visits & Property Viewings</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            Step 5 in your journey: Accompanied architectural site inspections and progress reviews.
          </p>
        </div>
        <Button
          variant="contained"
          startIcon={<PlusCircle size={16} />}
          onClick={onOpenViewing}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Book New Site Visit
        </Button>
      </div>

      {visits.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <Compass size={40} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
          <h4 style={{ margin: "0 0 4px" }}>No viewings scheduled yet</h4>
          <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: 13 }}>
            Request an accompanied site visit to inspect our projects, view mock-up apartments, and meet the site engineers.
          </p>
          <Button variant="outlined" onClick={onOpenViewing}>
            Book a Visit
          </Button>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Project</th>
                <th>Preferred Unit</th>
                <th>Date & Time</th>
                <th>Assigned Agent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const isPast = new Date(v.visited_at).getTime() < Date.now();
                return (
                  <tr key={String(v.id)}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                      {String(v.reference)}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 700 }}>
                      {String(v.project_name || "Development")}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {String(v.interested_unit_type || "Standard Unit")}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {friendlyDate(v.visited_at)}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {String(v.agent_name || "Center Estates Specialist")}
                    </td>
                    <td>
                      <Chip
                        size="small"
                        label={isPast ? "Completed" : "Scheduled"}
                        color={isPast ? "default" : "success"}
                        sx={{ fontWeight: 700, fontSize: 10 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgreementTab({
  sale,
  data,
  onOpenPayment,
}: {
  sale: Row | null;
  data: Portal;
  onOpenPayment: () => void;
}) {
  if (!sale) {
    return (
      <div className="data-panel" style={{ padding: 40, textAlign: "center" }}>
        <h3>No Sale Agreement Active</h3>
        <p style={{ color: "var(--text-secondary)" }}>
          Contact your sales representative to reserve an available unit and generate your purchase contract.
        </p>
      </div>
    );
  }

  const renders =
    (sale.renders as unknown as {
      id: string;
      render_kind: string;
      title: string;
      caption: string;
      render_url: string;
      is_primary: boolean;
    }[]) ?? [];

  return (
    <div className="data-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: "0 0 4px" }}>Purchase Contract — {String(sale.reference)}</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            Sectional Title & Unit Sale Agreement
          </p>
        </div>
        <Button variant="contained" color="primary" onClick={onOpenPayment} startIcon={<CreditCard size={15} />}>
          Record Payment
        </Button>
      </div>

      {/* 3D WebGL Viewer */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 13, textTransform: "uppercase", color: "var(--text-secondary)" }}>
            Interactive 3D Architectural Viewer
          </strong>
          <span style={{ fontSize: 12, color: "var(--color-brand-blue)" }}>
            Drag to rotate • Scroll to zoom
          </span>
        </div>
        <Unit3DViewer
          renders={renders}
          unitCode={String(sale.unit_code ?? "Unit")}
          unitType={String(sale.unit_type ?? "Apartment")}
          area={Number(sale.unit_area ?? 0)}
          floor={String(sale.unit_floor ?? "")}
          height={380}
        />
      </div>

      {/* Specs Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          background: "var(--color-surface-alt, #f8fafc)",
          padding: 20,
          borderRadius: 14,
        }}
      >
        <div>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>Development</span>
          <strong style={{ display: "block", fontSize: 15 }}>{String(sale.project_name)}</strong>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>Unit Number</span>
          <strong style={{ display: "block", fontSize: 15 }}>{String(sale.unit_code)}</strong>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>Agreed Price</span>
          <strong style={{ display: "block", fontSize: 15, color: "var(--color-brand-blue)" }}>
            {cash.format(Number(sale.agreed_price))}
          </strong>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>Deposit Paid</span>
          <strong style={{ display: "block", fontSize: 15, color: "var(--color-success)" }}>
            {cash.format(Number(sale.paid_amount || 0))}
          </strong>
        </div>
      </div>
    </div>
  );
}

function InstallmentsTab({
  data,
  onOpenPayment,
}: {
  data: Portal;
  onOpenPayment: () => void;
}) {
  const installments = data.installments ?? [];

  return (
    <div className="data-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: "0 0 4px" }}>Milestone Installment Schedule</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            Progress payments linked to architectural milestone sign-offs.
          </p>
        </div>
        <Button variant="contained" onClick={onOpenPayment} startIcon={<CreditCard size={15} />}>
          Make Payment
        </Button>
      </div>

      {installments.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 24 }}>
          No installment milestones configured for this contract.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Milestone Description</th>
                <th>Due Date</th>
                <th>Milestone Amount</th>
                <th>Paid Amount</th>
                <th>Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((r) => {
                const rem = Number(r.amount) - Number(r.paid_amount);
                return (
                  <tr key={String(r.id)}>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{String(r.sequence)}</td>
                    <td style={{ fontSize: 13, fontWeight: 700 }}>{String(r.description)}</td>
                    <td style={{ fontSize: 12 }}>{friendlyDate(r.due_on)}</td>
                    <td className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                      {cash.format(Number(r.amount))}
                    </td>
                    <td className="mono" style={{ fontSize: 13, color: "var(--color-success)" }}>
                      {cash.format(Number(r.paid_amount))}
                    </td>
                    <td className="mono" style={{ fontSize: 13, color: rem > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                      {cash.format(rem)}
                    </td>
                    <td>
                      <Chip
                        size="small"
                        label={String(r.status || "upcoming").toUpperCase()}
                        color={
                          r.status === "paid"
                            ? "success"
                            : r.status === "overdue"
                            ? "error"
                            : "default"
                        }
                        sx={{ fontWeight: 800, fontSize: 10 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentsTab({
  data,
  onOpenPayment,
}: {
  data: Portal;
  onOpenPayment: () => void;
}) {
  const payments = data.payments ?? [];
  const buyer = data.buyer ?? {};

  return (
    <>
      {/* Express Payment Information Card */}
      <section
        className="data-panel"
        style={{
          background: "linear-gradient(135deg, #091a3c, #1e3a8a)",
          color: "#ffffff",
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#93c5fd" }}>
              Express Payment Options
            </span>
            <h3 style={{ margin: "4px 0 10px", color: "#fff" }}>Direct Payment Channels</h3>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, maxWidth: 520 }}>
              Use your unique account reference when paying via M-Pesa or RTGS/Bank Transfer.
              Payments reflect instantly upon accounting verification.
            </p>
          </div>
          <Button
            variant="contained"
            sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, fontWeight: 700, textTransform: "none" }}
            onClick={onOpenPayment}
            startIcon={<PlusCircle size={16} />}
          >
            Submit Payment Reference
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          {/* M-Pesa Paybill */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <strong style={{ color: "#86efac", display: "block", marginBottom: 6, fontSize: 13 }}>
              📱 M-PESA PAYBILL
            </strong>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div>Business No: <strong style={{ color: "#fff" }}>247247</strong></div>
              <div>Account No: <strong style={{ color: "#fff" }}>{buyer.reference || "BUY-0001"}</strong></div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>
                Takes: Instant • No transaction fee for reservations
              </div>
            </div>
          </div>

          {/* Bank Transfer */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <strong style={{ color: "#93c5fd", display: "block", marginBottom: 6, fontSize: 13 }}>
              🏦 BANK TRANSFER (RTGS / EFT)
            </strong>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div>Bank: <strong style={{ color: "#fff" }}>NCBA Bank Kenya</strong></div>
              <div>Account Name: <strong style={{ color: "#fff" }}>Center Estates Ltd</strong></div>
              <div>Account No: <strong style={{ color: "#fff" }}>100-245-8971</strong></div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment History Table */}
      <section className="data-panel">
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Payment History & Verification</h3>
        {payments.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 24 }}>
            No payments have been recorded yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Payment Ref</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>External Ref</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={String(p.id)}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                      {String(p.reference)}
                    </td>
                    <td style={{ fontSize: 12 }}>{friendlyDate(p.paid_on)}</td>
                    <td className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                      {cash.format(Number(p.amount))}
                    </td>
                    <td style={{ fontSize: 12, textTransform: "capitalize" }}>
                      {String(p.method)}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {String(p.external_reference)}
                    </td>
                    <td>
                      <Chip
                        size="small"
                        label={String(p.status).toUpperCase()}
                        color={p.status === "verified" ? "success" : "default"}
                        sx={{ fontWeight: 800, fontSize: 10 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function DocumentsTab({ data }: { data: Portal }) {
  const docs = data.documents ?? [];

  return (
    <div className="data-panel">
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Contracts & Legal Vault</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
        Download verified Sale Agreements, Architectural Floor Plans, Sectional Title Deeds, and Official Receipts.
      </p>

      {docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <FileText size={36} color="#94a3b8" style={{ margin: "0 auto 10px" }} />
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            No legal documents have been uploaded to your vault yet.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Document Title</th>
                <th>Document Type</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={String(d.id)}>
                  <td style={{ fontSize: 13, fontWeight: 700 }}>{String(d.title)}</td>
                  <td style={{ fontSize: 12, textTransform: "capitalize" }}>
                    {String(d.document_type || "General")}
                  </td>
                  <td>
                    <Chip
                      size="small"
                      label={d.is_final ? "Official / Signed" : "Draft"}
                      color={d.is_final ? "success" : "default"}
                      sx={{ fontSize: 10 }}
                    />
                  </td>
                  <td>
                    {d.file_url ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download size={14} />}
                        href={String(d.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ textTransform: "none", fontSize: 11 }}
                      >
                        Download
                      </Button>
                    ) : (
                      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SupportTab({
  data,
  onOpenSupport,
  agent,
}: {
  data: Portal;
  onOpenSupport: () => void;
  agent?: { name: string; phone: string; email: string } | null;
}) {
  return (
    <div className="data-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: "0 0 4px" }}>Step 7: After-Sales Service & Lifetime Care</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            Continuous property management, maintenance requests, warranty resolution, and service charge management.
          </p>
        </div>
        <Button
          variant="contained"
          onClick={onOpenSupport}
          startIcon={<Wrench size={16} />}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Report Maintenance Issue
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "var(--color-surface-alt, #f8fafc)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <ShieldCheck size={20} color="#10b981" />
            <strong style={{ fontSize: 14 }}>Builder Defect Warranty</strong>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            All finishes, MEP installations, and structural fittings are covered under our comprehensive 12-month
            developer warranty period post-handover.
          </p>
        </div>

        <div
          style={{
            background: "var(--color-surface-alt, #f8fafc)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <ReceiptText size={20} color="#3b82f6" />
            <strong style={{ fontSize: 14 }}>Service Charge Administration</strong>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Common area lighting, 24/7 security, backup generators, and borehole water filtration are maintained
            through centralized estate service charges.
          </p>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-color, #e2e8f0)",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h4 style={{ margin: "0 0 12px" }}>Direct Care Contacts</h4>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>Property Management Desk:</span>{" "}
            <strong>+254 711 000 111</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>Emergency Maintenance:</span>{" "}
            <strong>+254 722 999 888</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>Support Email:</span>{" "}
            <strong>care@centerestates.com</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseTab({
  data,
  onOpenViewing,
}: {
  data: Portal;
  onOpenViewing: (projId: string) => void;
}) {
  const units = data.availableUnits ?? [];

  return (
    <div className="data-panel">
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Featured Developments & Units</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 18 }}>
        Explore pre-launch developments and available sectional units directly from the developer.
      </p>

      {units.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", padding: 24, textAlign: "center" }}>
          No additional available listings at this time.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {units.map((u) => (
            <div
              key={String(u.id)}
              style={{
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: 14,
                padding: 16,
                background: "var(--surface-raised, #ffffff)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-brand-blue)", textTransform: "uppercase" }}>
                  {String(u.project_name || "Project")}
                </span>
                <h4 style={{ margin: "4px 0 6px", fontSize: 16 }}>
                  Unit {String(u.unit_code)} · {String(u.unit_type || "Apartment")}
                </h4>
                <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-success)", marginBottom: 8 }}>
                  {cash.format(Number(u.list_price))}
                </div>
              </div>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onOpenViewing(String(u.project?.id || ""))}
                sx={{ textTransform: "none", fontWeight: 700, marginTop: 12 }}
              >
                Inquire & Book Visit
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Modals
// --------------------------------------------------------------------------

function RecordPaymentModal({
  open,
  onClose,
  busy,
  error,
  record,
  setRecord,
  onSubmit,
  installments,
  buyer,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string;
  record: any;
  setRecord: (r: any) => void;
  onSubmit: () => void;
  installments: Row[];
  buyer: Row;
}) {
  return (
    <Dialog open={open} onClose={!busy ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Submit Payment Reference</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info" sx={{ fontSize: 12 }}>
            Pay via M-Pesa Paybill <strong>247247</strong> (Account:{" "}
            <strong>{buyer.reference || "BUY-0001"}</strong>) or Bank Transfer, then enter your confirmation code below.
          </Alert>
          <TextField
            select
            label="Target Installment"
            size="small"
            value={record.installment}
            onChange={(e) => setRecord({ ...record, installment: e.target.value })}
            fullWidth
          >
            {installments.map((r) => (
              <MenuItem key={String(r.id)} value={String(r.id)}>
                {String(r.description)} — {cash.format(Number(r.amount))}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Amount Paid (KES)"
            type="number"
            size="small"
            value={record.amount}
            onChange={(e) => setRecord({ ...record, amount: e.target.value })}
            fullWidth
          />
          <TextField
            select
            label="Payment Method"
            size="small"
            value={record.method}
            onChange={(e) => setRecord({ ...record, method: e.target.value })}
            fullWidth
          >
            <MenuItem value="paybill">M-Pesa Paybill</MenuItem>
            <MenuItem value="bank">Bank Transfer (RTGS / EFT)</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
            <MenuItem value="online">Online Card Payment</MenuItem>
          </TextField>
          <TextField
            label="M-Pesa Code / Bank Reference"
            size="small"
            value={record.external_reference}
            onChange={(e) => setRecord({ ...record, external_reference: e.target.value })}
            fullWidth
            placeholder="e.g. QK876XYZ90 or NCBA-00123"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={busy}>
          {busy ? "Submitting…" : "Confirm Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RequestViewingModal({
  open,
  onClose,
  busy,
  error,
  form,
  setForm,
  onSubmit,
  availableUnits,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string;
  form: any;
  setForm: (f: any) => void;
  onSubmit: () => void;
  availableUnits: Row[];
}) {
  return (
    <Dialog open={open} onClose={!busy ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Schedule a Site Visit (Viewing)</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Our architectural specialist will accompany you on an on-site inspection of the development.
          </p>
          <TextField
            select
            label="Select Development"
            size="small"
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
            fullWidth
          >
            {availableUnits.map((u) => (
              <MenuItem key={String(u.project?.id || u.id)} value={String(u.project?.id || u.id)}>
                {String(u.project?.name || u.project_name || "Development")}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Preferred Date & Time"
            type="datetime-local"
            size="small"
            value={form.visited_at}
            onChange={(e) => setForm({ ...form, visited_at: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            select
            label="Unit Type of Interest"
            size="small"
            value={form.unit_type}
            onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
            fullWidth
          >
            <MenuItem value="Studio">Studio Apartment</MenuItem>
            <MenuItem value="1 Bedroom">1 Bedroom</MenuItem>
            <MenuItem value="2 Bedroom">2 Bedroom</MenuItem>
            <MenuItem value="3 Bedroom">3 Bedroom & DSQ</MenuItem>
            <MenuItem value="Penthouse">Penthouse</MenuItem>
            <MenuItem value="Commercial">Commercial / Retail</MenuItem>
          </TextField>
          <TextField
            label="Special Requests / Notes"
            size="small"
            multiline
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth
            placeholder="e.g. Please provide transport from Westlands, or I want to inspect high floor units."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={busy}>
          {busy ? "Scheduling…" : "Confirm Booking"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RequestSupportModal({
  open,
  onClose,
  busy,
  success,
  error,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  success: string;
  error: string;
  form: any;
  setForm: (f: any) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onClose={!busy ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Submit After-Sales Request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField
            select
            label="Category"
            size="small"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            fullWidth
          >
            <MenuItem value="Maintenance & Repairs">Maintenance & Repairs</MenuItem>
            <MenuItem value="Builder Warranty Snagging">Builder Warranty Snagging</MenuItem>
            <MenuItem value="Service Charge Inquiry">Service Charge Inquiry</MenuItem>
            <MenuItem value="Utility & Meter Setup">Utility & Meter Setup</MenuItem>
            <MenuItem value="Keys & Handover">Keys & Handover</MenuItem>
          </TextField>
          <TextField
            label="Subject"
            size="small"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            fullWidth
            placeholder="e.g. Water heater inspection or Sectional title deed query"
          />
          <TextField
            label="Details"
            size="small"
            multiline
            rows={4}
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })}
            fullWidth
            placeholder="Describe the issue or query in detail so our site team can assist you."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" onClick={onSubmit} disabled={busy}>
          {busy ? "Submitting…" : "Send Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BuyerPortalPage() {
  return (
    <Suspense fallback={<div className="page-wrap" style={{ padding: 40, textAlign: "center" }}>Loading portal…</div>}>
      <BuyerPortalContent />
    </Suspense>
  );
}