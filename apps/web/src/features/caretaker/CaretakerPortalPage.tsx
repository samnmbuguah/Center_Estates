"use client";

import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Building2,
  CheckCircle2,
  CheckSquare,
  Download,
  Droplets,
  FileCheck2,
  Gauge,
  HardHat,
  Menu,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";

type Row = Record<string, any>;

type Tab =
  | "overview"
  | "meters"
  | "job-cards"
  | "appraisals"
  | "handovers"
  | "incidents"
  | "tasks"
  | "walkthrough"
  | "directory";

const tabLabels: Record<Tab, string> = {
  overview: "Command Center",
  meters: "Meter Readings",
  "job-cards": "Job Cards & Sign-off",
  appraisals: "Vendor Appraisals",
  handovers: "Tenant Handovers",
  incidents: "Incident & Hazard Log",
  tasks: "Work Orders & Tasks",
  walkthrough: "Daily Walk-Through",
  directory: "Emergency & Trades",
};

const tabIcons: Record<Tab, React.ReactNode> = {
  overview: <Gauge size={18} />,
  meters: <Droplets size={18} />,
  "job-cards": <HardHat size={18} />,
  appraisals: <FileCheck2 size={18} />,
  handovers: <UserCheck size={18} />,
  incidents: <ShieldAlert size={18} />,
  tasks: <Wrench size={18} />,
  walkthrough: <CheckSquare size={18} />,
  directory: <PhoneCall size={18} />,
};

interface DailyCheckItem {
  id: string;
  category: string;
  title: string;
  description: string;
  completed: boolean;
  time?: string;
  notes?: string;
}

const DEFAULT_MORNING_ROUND: DailyCheckItem[] = [
  {
    id: "rnd-1",
    category: "Access & Security",
    title: "Main Gate & Guard Post Handover",
    description: "Inspect barrier motor, security logbook entries, and guard attendance.",
    completed: true,
    time: "07:15 AM",
  },
  {
    id: "rnd-2",
    category: "Cleanliness",
    title: "Ground Lobby & Main Entrance",
    description: "Verify floor polishing, glass doors cleaned, and waste bins emptied.",
    completed: true,
    time: "07:45 AM",
  },
  {
    id: "rnd-3",
    category: "Utilities & Pumps",
    title: "Water Pump Room & Borehole Levels",
    description: "Check pressure gauges (3.5 - 4.2 Bar), underground reservoir capacity, and booster pumps.",
    completed: false,
  },
  {
    id: "rnd-4",
    category: "Vertical Transport",
    title: "Elevator / Lift Operations",
    description: "Test cabin lights, emergency intercom, floor leveling, and certificate validity display.",
    completed: false,
  },
  {
    id: "rnd-5",
    category: "Power & Backup",
    title: "Backup Generator Fuel & Battery Test",
    description: "Inspect diesel fuel sight gauge (>75%), starting battery voltage (12.4V+), and auto-start mode.",
    completed: false,
  },
  {
    id: "rnd-6",
    category: "Waste Management",
    title: "Refuse Chute & Bin Compound",
    description: "Check bulk waste bins, recycling sorting, and sanitize perimeter drainage.",
    completed: false,
  },
  {
    id: "rnd-7",
    category: "Fire & Life Safety",
    title: "Emergency Exits & Fire Extinguishers",
    description: "Ensure stairwells are clear of obstructions and extinguisher pressure needles are in the green zone.",
    completed: false,
  },
];

const EMERGENCY_DIRECTORY = [
  {
    trade: "Emergency Plumber & Borehole",
    contact: "Nairobi Aqueduct Services (David)",
    phone: "+254 722 341 890",
    role: "Burst pipes, pump failures, sewer blockages",
    badge: "24/7 Priority",
  },
  {
    trade: "Emergency Electrician & Generator",
    contact: "PowerGrid FM Team (Samuel)",
    phone: "+254 733 912 405",
    role: "Transformer trip, phase imbalance, ATS failure",
    badge: "24/7 Priority",
  },
  {
    trade: "Elevator / Lift Breakdown",
    contact: "Schindler / Kone 24h Dispatch",
    phone: "+254 20 289 0000",
    role: "Passenger entrapment, safety gear trigger",
    badge: "Immediate",
  },
  {
    trade: "Security & Guarding Command",
    contact: "Shield Security Operations Desk",
    phone: "+254 711 004 000",
    role: "Perimeter breach, trespass, CCTV monitoring",
    badge: "Rapid Response",
  },
  {
    trade: "Fire & Emergency Rescue",
    contact: "County Fire Department",
    phone: "999 / 112 / +254 20 222 2181",
    role: "Fire breakout, smoke emergency, gas leak",
    badge: "Emergency",
  },
  {
    trade: "Property & Facility Manager",
    contact: "Legend Estates Management Office",
    phone: "+254 709 888 100",
    role: "Escalations, approvals, police incident reports",
    badge: "Management",
  },
];

export function CaretakerPortalPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const { activeProperty, properties, selectProperty } = usePropertyContext();

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "overview";
    const requested = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    return requested && Object.prototype.hasOwnProperty.call(tabLabels, requested) ? requested : "overview";
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Data states
  const [meters, setMeters] = useState<Row[]>([]);
  const [jobCards, setJobCards] = useState<Row[]>([]);
  const [appraisals, setAppraisals] = useState<Row[]>([]);
  const [handovers, setHandovers] = useState<Row[]>([]);
  const [incidents, setIncidents] = useState<Row[]>([]);
  const [workOrders, setWorkOrders] = useState<Row[]>([]);
  const [dailyChecklist, setDailyChecklist] = useState<DailyCheckItem[]>(DEFAULT_MORNING_ROUND);

  // Search and filters
  const [meterSearch, setMeterSearch] = useState("");
  const [jobCardFilter, setJobCardFilter] = useState<"all" | "pending_caretaker">("pending_caretaker");
  const [appraisalFilter, setAppraisalFilter] = useState<"all" | "pending_caretaker">("pending_caretaker");
  const [handoverFilter, setHandoverFilter] = useState<"all" | "pending_caretaker">("pending_caretaker");

  // Dialog states
  const [activeModal, setActiveModal] = useState<"job-card" | "appraisal" | "handover" | "incident" | "meter-reading" | null>(null);
  const [selectedItem, setSelectedItem] = useState<Row | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Form states
  const [signatoryName, setSignatoryName] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [appraisalScores, setAppraisalScores] = useState({ quality: 5, timeliness: 5, responsiveness: 5 });
  const [newIncident, setNewIncident] = useState({
    title: "",
    category: "plumbing",
    location: "",
    severity: "medium",
    immediate_action: "",
    description: "",
  });
  const [singleMeterReading, setSingleMeterReading] = useState({
    meterId: "",
    currentValue: "",
    notes: "",
  });

  const userName = session?.user?.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session?.user?.username ?? "Caretaker";

  const userInitials = (session?.user?.firstName ? session.user.firstName[0] : "C") +
    (session?.user?.lastName ? session.user.lastName[0] : "T");

  const selectTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState({}, "", url);
    }
  }, []);

  // Fetch live operational data across ERP endpoints
  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");

    try {
      const propParam = activeProperty?.id ? `?property=${encodeURIComponent(activeProperty.id)}` : "";

      const [metersRes, jobCardsRes, appraisalsRes, handoversRes, incidentsRes, workOrdersRes] = await Promise.all([
        apiFetch(`/facility/meters/${propParam}`, {}, organizationId),
        apiFetch(`/facility/job-cards/${propParam}`, {}, organizationId),
        apiFetch(`/facility/contract-invoice-appraisals/`, {}, organizationId),
        apiFetch(`/property/handovers/${propParam}`, {}, organizationId),
        apiFetch(`/facility/incidents/${propParam}`, {}, organizationId),
        apiFetch(`/facility/work-orders/${propParam}`, {}, organizationId),
      ]);

      if (metersRes.ok) {
        const d = await metersRes.json();
        setMeters(Array.isArray(d) ? d : d?.results || []);
      }
      if (jobCardsRes.ok) {
        const d = await jobCardsRes.json();
        setJobCards(Array.isArray(d) ? d : d?.results || []);
      }
      if (appraisalsRes.ok) {
        const d = await appraisalsRes.json();
        setAppraisals(Array.isArray(d) ? d : d?.results || []);
      }
      if (handoversRes.ok) {
        const d = await handoversRes.json();
        setHandovers(Array.isArray(d) ? d : d?.results || []);
      }
      if (incidentsRes.ok) {
        const d = await incidentsRes.json();
        setIncidents(Array.isArray(d) ? d : d?.results || []);
      }
      if (workOrdersRes.ok) {
        const d = await workOrdersRes.json();
        setWorkOrders(Array.isArray(d) ? d : d?.results || []);
      }
    } catch (err: any) {
      console.error("Caretaker portal load error:", err);
      setError("Failed to load some caretaker operational records. You can retry anytime.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId, activeProperty?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived KPI Counts
  const pendingJobCardsCount = useMemo(
    () => jobCards.filter((c) => c.status === "contractor_signed").length,
    [jobCards]
  );

  const pendingAppraisalsCount = useMemo(
    () => appraisals.filter((a) => a.status === "pending_caretaker").length,
    [appraisals]
  );

  const pendingHandoversCount = useMemo(
    () => handovers.filter((h) => ["draft", "in_progress"].includes(String(h.status)) && !h.caretaker_name).length,
    [handovers]
  );

  const activeIncidentsCount = useMemo(
    () => incidents.filter((i) => !["resolved", "closed"].includes(String(i.status))).length,
    [incidents]
  );

  const openWorkOrdersCount = useMemo(
    () => workOrders.filter((w) => !["completed", "cancelled"].includes(String(w.status))).length,
    [workOrders]
  );

  const checklistCompletedCount = useMemo(
    () => dailyChecklist.filter((c) => c.completed).length,
    [dailyChecklist]
  );

  // PDF Document Downloader
  async function downloadDoc(path: string, fileName: string) {
    setError("");
    try {
      const response = await apiFetch(path, {}, organizationId);
      if (!response.ok) {
        setError(await apiErrorMessage(response, "Document download failed. Please retry."));
        return;
      }
      const bytes = await response.arrayBuffer();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Failed to download document. Please check connection.");
    }
  }

  // 1. Sign Job Card
  async function handleSignJobCard() {
    if (!selectedItem) return;
    const name = signatoryName.trim() || userName;
    setActionBusy(true);
    setError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/facility/job-cards/${selectedItem.id}/caretaker-sign/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({ signatory: name, notes: actionNotes }),
        },
        organizationId
      );
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Could not sign job card."));
        return;
      }
      setSuccessMsg(`Job Card ${selectedItem.number} signed successfully. Awaiting manager verification.`);
      setActiveModal(null);
      setSelectedItem(null);
      await loadData();
    } catch {
      setError("Failed to sign job card. Please retry.");
    } finally {
      setActionBusy(false);
    }
  }

  // 2. Sign Vendor Performance Appraisal
  async function handleSignAppraisal() {
    if (!selectedItem) return;
    setActionBusy(true);
    setError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/facility/contract-invoice-appraisals/${selectedItem.id}/caretaker-sign/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            quality_score: appraisalScores.quality,
            timeliness_score: appraisalScores.timeliness,
            responsiveness_score: appraisalScores.responsiveness,
            notes: actionNotes,
          }),
        },
        organizationId
      );
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Could not submit appraisal sign-off."));
        return;
      }
      setSuccessMsg(`Vendor appraisal for ${selectedItem.supplier_name || "contractor"} submitted.`);
      setActiveModal(null);
      setSelectedItem(null);
      await loadData();
    } catch {
      setError("Failed to sign appraisal. Please retry.");
    } finally {
      setActionBusy(false);
    }
  }

  // 3. Sign Tenant Move-in/Move-out Handover
  async function handleSignHandover() {
    if (!selectedItem) return;
    const name = signatoryName.trim() || userName;
    setActionBusy(true);
    setError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/property/handovers/${selectedItem.id}/sign-caretaker/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({ caretaker_name: name }),
        },
        organizationId
      );
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Could not sign handover."));
        return;
      }
      setSuccessMsg(`Unit handover for ${selectedItem.unit_code || "unit"} signed as Caretaker.`);
      setActiveModal(null);
      setSelectedItem(null);
      await loadData();
    } catch {
      setError("Failed to sign handover.");
    } finally {
      setActionBusy(false);
    }
  }

  // 4. Log New Incident
  async function handleCreateIncident(e: FormEvent) {
    e.preventDefault();
    if (!newIncident.title.trim()) return;
    setActionBusy(true);
    setError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/facility/incidents/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            title: newIncident.title.trim(),
            category: newIncident.category,
            location: newIncident.location.trim() || activeProperty?.name || "Main Building",
            severity: newIncident.severity,
            immediate_action: newIncident.immediate_action.trim(),
            description: newIncident.description.trim(),
            property: activeProperty?.id,
          }),
        },
        organizationId
      );
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Could not log incident."));
        return;
      }
      setSuccessMsg("Incident logged and reported to property management.");
      setActiveModal(null);
      setNewIncident({
        title: "",
        category: "plumbing",
        location: "",
        severity: "medium",
        immediate_action: "",
        description: "",
      });
      selectTab("incidents");
      await loadData();
    } catch {
      setError("Failed to log incident.");
    } finally {
      setActionBusy(false);
    }
  }

  // 5. Submit Single Meter Reading
  async function handleSubmitMeterReading(e: FormEvent) {
    e.preventDefault();
    if (!singleMeterReading.meterId || !singleMeterReading.currentValue) return;
    setActionBusy(true);
    setError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/facility/readings/bulk/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            readings: [
              {
                meter_id: singleMeterReading.meterId,
                value: parseFloat(singleMeterReading.currentValue),
                notes: singleMeterReading.notes || "Recorded via Caretaker Walk-Through Hub",
              },
            ],
          }),
        },
        organizationId
      );
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Could not record reading."));
        return;
      }
      setSuccessMsg("Meter reading recorded successfully.");
      setActiveModal(null);
      setSingleMeterReading({ meterId: "", currentValue: "", notes: "" });
      await loadData();
    } catch {
      setError("Failed to submit meter reading.");
    } finally {
      setActionBusy(false);
    }
  }

  // Daily Walk-Through Checkbox toggle
  function toggleDailyItem(id: string) {
    setDailyChecklist((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const nextCompleted = !it.completed;
          return {
            ...it,
            completed: nextCompleted,
            time: nextCompleted ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
          };
        }
        return it;
      })
    );
  }

  return (
    <div className="page-wrap property-app tenant-portal-page caretaker-portal-page">
      {/* Mobile Top Header */}
      <div className="tenant-mobile-header">
        <div className="tenant-mobile-brand">
          <span className="tenant-portal-badge" style={{ background: "#ccfbf1", color: "#0f766e" }}>
            Field Operations
          </span>
          <span className="tenant-mobile-unit">{activeProperty?.name || "All Properties"}</span>
        </div>
        <button
          type="button"
          className="tenant-mobile-menu-btn"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open portal navigation menu"
        >
          <Menu size={16} />
          <span>Menu</span>
        </button>
      </div>

      <div className="tenant-portal-layout">
        {/* Left Navigation Rail */}
        <aside className={`tenant-portal-sidebar ${mobileDrawerOpen ? "open" : ""}`}>
          <div className="tenant-sidebar-close-row">
            <span className="tenant-portal-badge" style={{ background: "#ccfbf1", color: "#0f766e" }}>
              Caretaker Hub
            </span>
            <button
              type="button"
              className="tenant-sidebar-close-btn"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          {/* Identity & Scope Selector */}
          <div className="tenant-sidebar-profile" style={{ background: "linear-gradient(135deg, rgba(15,118,110,0.08), rgba(13,148,136,0.02))", border: "1px solid #ccfbf1" }}>
            <div className="tenant-sidebar-profile-top">
              <div
                className="tenant-avatar-circle"
                style={{ background: "linear-gradient(135deg, #0f766e, #0d9488)", color: "#ffffff", fontWeight: 800 }}
              >
                {userInitials}
              </div>
              <div className="tenant-sidebar-user-meta">
                <strong className="tenant-sidebar-name">{userName}</strong>
                <span className="tenant-sidebar-code" style={{ color: "#0f766e", fontWeight: 800 }}>
                  Property Caretaker
                </span>
              </div>
            </div>

            {/* Property Selector */}
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Assigned Property:
              </label>
              <select
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: "1px solid var(--border-color)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
                value={activeProperty?.id || ""}
                onChange={(e) => {
                  const prop = properties.find((p) => p.id === e.target.value) || null;
                  selectProperty(prop);
                }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="tenant-sidebar-action">
            <Button
              fullWidth
              variant="contained"
              startIcon={<ShieldAlert size={16} />}
              onClick={() => {
                setError("");
                setActiveModal("incident");
                setMobileDrawerOpen(false);
              }}
              sx={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                fontWeight: 800,
                borderRadius: 2.5,
                textTransform: "none",
                py: 1,
                boxShadow: "0 4px 14px rgba(220,38,38,0.25)",
              }}
            >
              🚨 Report Site Incident
            </Button>
          </div>

          {/* Navigation Links with Real-Time Notification Counters */}
          <nav className="tenant-sidebar-nav" aria-label="Caretaker sections">
            {(Object.keys(tabLabels) as Tab[]).map((item) => {
              const isActive = tab === item;
              let badgeCount = 0;
              let badgeType: "danger" | "warning" | "info" = "info";

              if (item === "job-cards") {
                badgeCount = pendingJobCardsCount;
                badgeType = "warning";
              } else if (item === "appraisals") {
                badgeCount = pendingAppraisalsCount;
                badgeType = "warning";
              } else if (item === "handovers") {
                badgeCount = pendingHandoversCount;
                badgeType = "info";
              } else if (item === "incidents") {
                badgeCount = activeIncidentsCount;
                badgeType = "danger";
              } else if (item === "tasks") {
                badgeCount = openWorkOrdersCount;
                badgeType = "warning";
              } else if (item === "walkthrough") {
                badgeCount = dailyChecklist.length - checklistCompletedCount;
                badgeType = "info";
              }

              return (
                <button
                  key={item}
                  type="button"
                  className={`tenant-sidebar-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    selectTab(item);
                    setMobileDrawerOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  style={
                    isActive
                      ? { background: "#ccfbf1", color: "#0f766e", boxShadow: "inset 3px 0 #0d9488" }
                      : undefined
                  }
                >
                  <span className="tenant-nav-icon">{tabIcons[item]}</span>
                  <span className="tenant-nav-label">{tabLabels[item]}</span>
                  {badgeCount > 0 && <span className={`tenant-nav-badge ${badgeType}`}>{badgeCount}</span>}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Support / Hotlines */}
          <div className="tenant-sidebar-footer">
            <div className="tenant-support-card" style={{ border: "1px solid var(--border-color)" }}>
              <strong>Emergency Desk</strong>
              <p>Direct line to FM office & trades on-call.</p>
              <button
                type="button"
                className="tenant-support-link"
                style={{ color: "#0f766e", fontWeight: 800 }}
                onClick={() => {
                  selectTab("directory");
                  setMobileDrawerOpen(false);
                }}
              >
                Open Emergency Directory →
              </button>
            </div>
          </div>
        </aside>

        {mobileDrawerOpen && (
          <div className="tenant-sidebar-backdrop" onClick={() => setMobileDrawerOpen(false)} />
        )}

        {/* Main Work Area */}
        <main className="tenant-portal-main">
          {/* Hero Banner with Live Verification Context */}
          <section
            className="tenant-portal-hero"
            style={{
              background: "linear-gradient(135deg, #0f2b48 0%, #0f766e 100%)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div>
              <p className="eyebrow" style={{ color: "#99f6e4" }}>
                Field Operations Command
              </p>
              <h1 style={{ color: "#ffffff", margin: "2px 0 6px" }}>Good day, {userName.split(" ")[0]}.</h1>
              <p style={{ color: "rgba(255,255,255,0.9)", margin: 0 }}>
                Utility walk-throughs, contractor job card sign-offs, vendor appraisals, and daily rounds.
              </p>
              <div className="tenant-premises" style={{ color: "#ccfbf1", marginTop: 10 }}>
                <Building2 size={16} /> {activeProperty?.name || "All Properties"}
                <Chip
                  size="small"
                  label="Day Shift · On Duty"
                  sx={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", fontWeight: 800, ml: 1 }}
                />
              </div>
            </div>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Button
                variant="outlined"
                startIcon={<RefreshCw size={15} className={refreshing ? "spin" : ""} />}
                onClick={() => {
                  setRefreshing(true);
                  loadData();
                }}
                sx={{
                  color: "#ffffff",
                  borderColor: "rgba(255,255,255,0.4)",
                  fontWeight: 700,
                  "&:hover": { borderColor: "#ffffff", background: "rgba(255,255,255,0.1)" },
                }}
              >
                Refresh Data
              </Button>
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => {
                  setSelectedItem(null);
                  setActiveModal("meter-reading");
                }}
                sx={{
                  background: "#0d9488",
                  color: "#ffffff",
                  fontWeight: 800,
                  "&:hover": { background: "#0f766e" },
                }}
              >
                Capture Reading
              </Button>
            </Stack>
          </section>

          {/* Feedback Banners */}
          {error && <div className="form-error">{error}</div>}
          {successMsg && (
            <Alert severity="success" onClose={() => setSuccessMsg("")} sx={{ mb: 1, fontWeight: 600 }}>
              {successMsg}
            </Alert>
          )}

          {/* 1. COMMAND CENTER / OVERVIEW */}
          {tab === "overview" && (
            <>
              {/* Metric KPI Grid */}
              <section className="kpi-grid">
                <article
                  className="kpi-card clickable"
                  onClick={() => selectTab("meters")}
                  style={{ cursor: "pointer", borderLeft: "4px solid #0d9488" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="kpi-label">Active Meters</span>
                    <Droplets size={20} color="#0d9488" />
                  </div>
                  <strong className="kpi-value">{meters.length}</strong>
                  <span className="kpi-note">Ready for walk-through reading</span>
                </article>

                <article
                  className="kpi-card clickable"
                  onClick={() => selectTab("job-cards")}
                  style={{ cursor: "pointer", borderLeft: "4px solid #f59e0b" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="kpi-label">Job Cards to Sign</span>
                    <HardHat size={20} color="#f59e0b" />
                  </div>
                  <strong className="kpi-value">{pendingJobCardsCount}</strong>
                  <span className="kpi-note">Awaiting on-site verification</span>
                </article>

                <article
                  className="kpi-card clickable"
                  onClick={() => selectTab("appraisals")}
                  style={{ cursor: "pointer", borderLeft: "4px solid #3b82f6" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="kpi-label">Vendor Appraisals</span>
                    <FileCheck2 size={20} color="#3b82f6" />
                  </div>
                  <strong className="kpi-value">{pendingAppraisalsCount}</strong>
                  <span className="kpi-note">Contractors pending quality score</span>
                </article>

                <article
                  className="kpi-card clickable"
                  onClick={() => selectTab("handovers")}
                  style={{ cursor: "pointer", borderLeft: "4px solid #8b5cf6" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="kpi-label">Tenant Handovers</span>
                    <UserCheck size={20} color="#8b5cf6" />
                  </div>
                  <strong className="kpi-value">{pendingHandoversCount}</strong>
                  <span className="kpi-note">Move-in / Move-out inspections</span>
                </article>

                <article
                  className="kpi-card clickable"
                  onClick={() => selectTab("walkthrough")}
                  style={{ cursor: "pointer", borderLeft: "4px solid #10b981" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="kpi-label">Daily Rounds</span>
                    <CheckSquare size={20} color="#10b981" />
                  </div>
                  <strong className="kpi-value">
                    {checklistCompletedCount} / {dailyChecklist.length}
                  </strong>
                  <span className="kpi-note">Checklist items completed today</span>
                </article>

                <article
                  className="kpi-card clickable"
                  onClick={() => selectTab("incidents")}
                  style={{ cursor: "pointer", borderLeft: "4px solid #ef4444" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="kpi-label">Active Incidents</span>
                    <ShieldAlert size={20} color="#ef4444" />
                  </div>
                  <strong className="kpi-value">{activeIncidentsCount}</strong>
                  <span className="kpi-note">Open estate hazards</span>
                </article>
              </section>

              {/* Priority Action Queue */}
              <div className="dashboard-columns">
                {/* Urgent Checkpoints */}
                <article className="data-panel">
                  <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>⚡ On-Site Action Queue</h3>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                        Items awaiting caretaker inspection or digital sign-off
                      </p>
                    </div>
                  </div>

                  {pendingJobCardsCount === 0 && pendingAppraisalsCount === 0 && pendingHandoversCount === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
                      <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 8px" }} />
                      <strong>Action Queue Clear</strong>
                      <p style={{ fontSize: 12, margin: "4px 0 0" }}>All contractor job cards, appraisals, and handovers have been signed.</p>
                    </div>
                  ) : (
                    <Stack spacing={1.5}>
                      {/* Pending Job Cards */}
                      {jobCards
                        .filter((c) => c.status === "contractor_signed")
                        .slice(0, 3)
                        .map((card) => (
                          <div
                            key={card.id}
                            style={{
                              border: "1px solid #fde68a",
                              background: "#fffbeb",
                              padding: "12px 14px",
                              borderRadius: 10,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Chip size="small" label="Job Card" color="warning" sx={{ fontWeight: 800, fontSize: 11 }} />
                                <strong style={{ fontSize: 13.5 }}>{card.number}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>
                                Contractor {card.contractor_signatory || "signed"} · {card.property_name || activeProperty?.name}
                              </div>
                            </div>
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              onClick={() => {
                                setSelectedItem(card);
                                setSignatoryName(userName);
                                setActionNotes(card.completion_notes || "");
                                setActiveModal("job-card");
                              }}
                              sx={{ fontWeight: 800, textTransform: "none" }}
                            >
                              Inspect & Sign
                            </Button>
                          </div>
                        ))}

                      {/* Pending Appraisals */}
                      {appraisals
                        .filter((a) => a.status === "pending_caretaker")
                        .slice(0, 3)
                        .map((appr) => (
                          <div
                            key={appr.id}
                            style={{
                              border: "1px solid #bfdbfe",
                              background: "#eff6ff",
                              padding: "12px 14px",
                              borderRadius: 10,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Chip size="small" label="Vendor Appraisal" color="primary" sx={{ fontWeight: 800, fontSize: 11 }} />
                                <strong style={{ fontSize: 13.5 }}>{appr.supplier_name || "Contractor"}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: "#1e40af", marginTop: 4 }}>
                                Invoice {appr.invoice_code} · Contract {appr.contract_number}
                              </div>
                            </div>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              onClick={() => {
                                setSelectedItem(appr);
                                setAppraisalScores({ quality: 5, timeliness: 5, responsiveness: 5 });
                                setActionNotes("");
                                setActiveModal("appraisal");
                              }}
                              sx={{ fontWeight: 800, textTransform: "none" }}
                            >
                              Rate Vendor
                            </Button>
                          </div>
                        ))}
                    </Stack>
                  )}
                </article>

                {/* Today's Rounds & Estate Status */}
                <article className="data-panel">
                  <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📋 Morning Estate Rounds</h3>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                        {checklistCompletedCount} of {dailyChecklist.length} checkpoints checked
                      </p>
                    </div>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => selectTab("walkthrough")}
                      sx={{ fontWeight: 700, textTransform: "none" }}
                    >
                      View All
                    </Button>
                  </div>

                  <Stack spacing={1}>
                    {dailyChecklist.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleDailyItem(item.id)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: item.completed ? "var(--surface-muted)" : "var(--surface)",
                          border: "1px solid var(--border-color)",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => {}}
                          style={{ marginTop: 3, cursor: "pointer" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong
                            style={{
                              fontSize: 13,
                              textDecoration: item.completed ? "line-through" : "none",
                              color: item.completed ? "var(--text-secondary)" : "var(--text-primary)",
                            }}
                          >
                            {item.title}
                          </strong>
                          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                            {item.description}
                          </p>
                        </div>
                        {item.completed && item.time && (
                          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>{item.time}</span>
                        )}
                      </div>
                    ))}
                  </Stack>
                </article>
              </div>
            </>
          )}

          {/* 2. METER READINGS HUB */}
          {tab === "meters" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>⚡ Utility & Meter Reading Hub</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Capture water and power consumption across tenant units and common facilities.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <TextField
                    size="small"
                    placeholder="Search meter code or unit..."
                    value={meterSearch}
                    onChange={(e) => setMeterSearch(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: <Search size={15} style={{ marginRight: 6, opacity: 0.6 }} />,
                      },
                    }}
                    sx={{ width: 220 }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<Plus size={15} />}
                    onClick={() => {
                      setSelectedItem(null);
                      setActiveModal("meter-reading");
                    }}
                    sx={{ fontWeight: 800, background: "#0d9488", textTransform: "none" }}
                  >
                    Quick Entry
                  </Button>
                </div>
              </div>

              <div style={{ overflowX: "auto", marginTop: 14 }}>
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>Meter Code</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>Type</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>Location / Unit</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>Last Reading</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>Last Read Date</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meters
                      .filter((m) => {
                        if (!meterSearch) return true;
                        const q = meterSearch.toLowerCase();
                        return (
                          (m.code && m.code.toLowerCase().includes(q)) ||
                          (m.location && m.location.toLowerCase().includes(q)) ||
                          (m.unit_code && m.unit_code.toLowerCase().includes(q))
                        );
                      })
                      .map((meter) => (
                        <tr key={meter.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 800 }}>{meter.code || meter.number}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <Chip
                              size="small"
                              label={meter.utility_type === "water" ? "💧 Water" : "⚡ Electricity"}
                              sx={{
                                fontWeight: 800,
                                fontSize: 11,
                                background: meter.utility_type === "water" ? "#e0f2fe" : "#fef3c7",
                                color: meter.utility_type === "water" ? "#0369a1" : "#b45309",
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px 12px" }}>{meter.location || meter.unit_code || "Main Facility"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800 }}>
                            {meter.last_reading_value ? `${meter.last_reading_value} units` : "0.0"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                            {meter.last_read_at ? new Date(meter.last_read_at).toLocaleDateString() : "Pending"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSingleMeterReading({
                                  meterId: meter.id,
                                  currentValue: "",
                                  notes: "",
                                });
                                setActiveModal("meter-reading");
                              }}
                              sx={{ fontWeight: 800, textTransform: "none" }}
                            >
                              Record Reading
                            </Button>
                          </td>
                        </tr>
                      ))}
                    {meters.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "30px 12px", color: "var(--text-secondary)" }}>
                          No meters configured for this property.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {/* 3. JOB CARDS & SIGN-OFF */}
          {tab === "job-cards" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>🛠️ Contractor Job Cards & Sign-Off</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Physical work verified on-site by caretaker before manager approval and contractor payment release.
                  </p>
                </div>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={jobCardFilter === "pending_caretaker" ? "contained" : "outlined"}
                    color="warning"
                    onClick={() => setJobCardFilter("pending_caretaker")}
                    sx={{ fontWeight: 800, textTransform: "none" }}
                  >
                    Pending Caretaker ({pendingJobCardsCount})
                  </Button>
                  <Button
                    size="small"
                    variant={jobCardFilter === "all" ? "contained" : "outlined"}
                    onClick={() => setJobCardFilter("all")}
                    sx={{ fontWeight: 700, textTransform: "none" }}
                  >
                    All Job Cards
                  </Button>
                </Stack>
              </div>

              <div style={{ marginTop: 16 }}>
                <Stack spacing={2}>
                  {jobCards
                    .filter((c) => {
                      if (jobCardFilter === "pending_caretaker") return c.status === "contractor_signed";
                      return true;
                    })
                    .map((card) => {
                      const isPendingSign = card.status === "contractor_signed";
                      return (
                        <div
                          key={card.id}
                          style={{
                            border: isPendingSign ? "2px solid #f59e0b" : "1px solid var(--border-color)",
                            borderRadius: 12,
                            padding: "16px 18px",
                            background: "var(--surface)",
                            boxShadow: isPendingSign ? "0 4px 14px rgba(245,158,11,0.12)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <strong style={{ fontSize: 15 }}>{card.number}</strong>
                                <Chip
                                  size="small"
                                  label={card.status.replace("_", " ").toUpperCase()}
                                  color={isPendingSign ? "warning" : card.status === "verified" ? "success" : "default"}
                                  sx={{ fontWeight: 800, fontSize: 11 }}
                                />
                                {card.lpo_number && (
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>
                                    LPO: {card.lpo_number}
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-primary)" }}>
                                <strong>Assigned Contractor:</strong> {card.supplier_name || "Contractor Team"}
                              </p>
                              {card.completion_notes && (
                                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)", background: "var(--surface-muted)", padding: "6px 10px", borderRadius: 6 }}>
                                  <strong>Contractor Notes:</strong> &ldquo;{card.completion_notes}&rdquo;
                                </p>
                              )}
                            </div>

                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Download size={14} />}
                                onClick={() => downloadDoc(`/facility/job-cards/${card.id}/pdf/`, `${card.number}.pdf`)}
                                sx={{ fontWeight: 700, textTransform: "none" }}
                              >
                                PDF
                              </Button>
                              {isPendingSign && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  startIcon={<CheckSquare size={14} />}
                                  onClick={() => {
                                    setSelectedItem(card);
                                    setSignatoryName(userName);
                                    setActionNotes(card.completion_notes || "");
                                    setActiveModal("job-card");
                                  }}
                                  sx={{ fontWeight: 800, textTransform: "none" }}
                                >
                                  Sign Acceptance
                                </Button>
                              )}
                            </Stack>
                          </div>

                          {/* 4 Execution Checkpoints */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: 8,
                              marginTop: 14,
                              paddingTop: 12,
                              borderTop: "1px dashed var(--border-color)",
                            }}
                          >
                            <div>
                              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>1. Work Started</span>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>
                                {card.started_at ? "✅ Started" : "⏳ Pending"}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>2. Contractor</span>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>
                                {card.contractor_signed_at ? "✅ Signed" : "⏳ Pending"}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>3. Caretaker</span>
                              <div style={{ fontSize: 12, fontWeight: 700, color: card.caretaker_signed_at ? "#10b981" : "#d97706" }}>
                                {card.caretaker_signed_at ? `✅ ${card.caretaker_signatory || "Signed"}` : "⚠️ Needs Sign-off"}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>4. Manager</span>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>
                                {card.verified_at ? "✅ Verified" : "⏳ Pending"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {jobCards.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
                      No Job Cards found for this property.
                    </div>
                  )}
                </Stack>
              </div>
            </article>
          )}

          {/* 4. VENDOR PERFORMANCE APPRAISALS */}
          {tab === "appraisals" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>⭐ Service Provider Performance Appraisals</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Caretakers inspect recurring cleaning, security, and maintenance contracts before monthly invoice release.
                  </p>
                </div>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={appraisalFilter === "pending_caretaker" ? "contained" : "outlined"}
                    onClick={() => setAppraisalFilter("pending_caretaker")}
                    sx={{ fontWeight: 800, textTransform: "none" }}
                  >
                    Awaiting Caretaker ({pendingAppraisalsCount})
                  </Button>
                  <Button
                    size="small"
                    variant={appraisalFilter === "all" ? "contained" : "outlined"}
                    onClick={() => setAppraisalFilter("all")}
                    sx={{ fontWeight: 700, textTransform: "none" }}
                  >
                    All Audits
                  </Button>
                </Stack>
              </div>

              <div style={{ marginTop: 16 }}>
                <Stack spacing={2}>
                  {appraisals
                    .filter((a) => {
                      if (appraisalFilter === "pending_caretaker") return a.status === "pending_caretaker";
                      return true;
                    })
                    .map((appr) => {
                      const isPending = appr.status === "pending_caretaker";
                      return (
                        <div
                          key={appr.id}
                          style={{
                            border: isPending ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                            borderRadius: 12,
                            padding: "16px 18px",
                            background: "var(--surface)",
                            boxShadow: isPending ? "0 4px 14px rgba(59,130,246,0.12)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <strong style={{ fontSize: 15 }}>{appr.supplier_name || "Contractor"}</strong>
                                <Chip
                                  size="small"
                                  label={isPending ? "Awaiting Caretaker Audit" : appr.status.replace("_", " ").toUpperCase()}
                                  color={isPending ? "primary" : "default"}
                                  sx={{ fontWeight: 800, fontSize: 11 }}
                                />
                              </div>
                              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
                                Invoice Ref: <strong>{appr.invoice_code}</strong> · Contract: <strong>{appr.contract_number}</strong>
                              </div>
                            </div>

                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Download size={14} />}
                                onClick={() => downloadDoc(`/facility/contract-invoice-appraisals/${appr.id}/pdf/`, `${appr.invoice_code}-appraisal.pdf`)}
                                sx={{ fontWeight: 700, textTransform: "none" }}
                              >
                                PDF
                              </Button>
                              {isPending && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  onClick={() => {
                                    setSelectedItem(appr);
                                    setAppraisalScores({ quality: 5, timeliness: 5, responsiveness: 5 });
                                    setActionNotes("");
                                    setActiveModal("appraisal");
                                  }}
                                  sx={{ fontWeight: 800, textTransform: "none" }}
                                >
                                  Audit & Rate
                                </Button>
                              )}
                            </Stack>
                          </div>

                          {/* Scores summary */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                              gap: 8,
                              marginTop: 14,
                              paddingTop: 10,
                              borderTop: "1px dashed var(--border-color)",
                            }}
                          >
                            <div>
                              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Quality Score</span>
                              <div style={{ fontWeight: 800, fontSize: 13 }}>{appr.quality_score ? `${appr.quality_score} / 5` : "Pending"}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Timeliness Score</span>
                              <div style={{ fontWeight: 800, fontSize: 13 }}>{appr.timeliness_score ? `${appr.timeliness_score} / 5` : "Pending"}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Responsiveness</span>
                              <div style={{ fontWeight: 800, fontSize: 13 }}>{appr.responsiveness_score ? `${appr.responsiveness_score} / 5` : "Pending"}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Average Audit</span>
                              <div style={{ fontWeight: 900, fontSize: 13, color: "#0d9488" }}>
                                {appr.average_score ? `${appr.average_score} / 5` : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {appraisals.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
                      No vendor appraisals found.
                    </div>
                  )}
                </Stack>
              </div>
            </article>
          )}

          {/* 5. TENANT MOVE-IN / MOVE-OUT HANDOVERS */}
          {tab === "handovers" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>🔑 Tenant Move-In & Move-Out Handovers</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Inspect premises condition, key counts, and meter readings at tenant check-in or checkout.
                  </p>
                </div>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={handoverFilter === "pending_caretaker" ? "contained" : "outlined"}
                    color="secondary"
                    onClick={() => setHandoverFilter("pending_caretaker")}
                    sx={{ fontWeight: 800, textTransform: "none" }}
                  >
                    Pending Caretaker ({pendingHandoversCount})
                  </Button>
                  <Button
                    size="small"
                    variant={handoverFilter === "all" ? "contained" : "outlined"}
                    onClick={() => setHandoverFilter("all")}
                    sx={{ fontWeight: 700, textTransform: "none" }}
                  >
                    All Handovers
                  </Button>
                </Stack>
              </div>

              <div style={{ marginTop: 16 }}>
                <Stack spacing={2}>
                  {handovers
                    .filter((h) => {
                      if (handoverFilter === "pending_caretaker") return !h.caretaker_name;
                      return true;
                    })
                    .map((ho) => {
                      const isPending = !ho.caretaker_name;
                      return (
                        <div
                          key={ho.id}
                          style={{
                            border: isPending ? "2px solid #8b5cf6" : "1px solid var(--border-color)",
                            borderRadius: 12,
                            padding: "16px 18px",
                            background: "var(--surface)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <strong style={{ fontSize: 15 }}>Unit {ho.unit_code || "Unit"}</strong>
                                <Chip
                                  size="small"
                                  label={ho.handover_type === "move_out" ? "Move-Out Inspection" : "Move-In Handover"}
                                  color={ho.handover_type === "move_out" ? "warning" : "success"}
                                  sx={{ fontWeight: 800, fontSize: 11 }}
                                />
                                <Chip
                                  size="small"
                                  label={ho.status.toUpperCase()}
                                  variant="outlined"
                                  sx={{ fontWeight: 800, fontSize: 10.5 }}
                                />
                              </div>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                                Tenant: <strong>{ho.tenant_name || "New Tenant"}</strong> · Date: {ho.handover_date || "Today"}
                              </p>
                            </div>

                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Download size={14} />}
                                onClick={() => downloadDoc(`/property/handovers/${ho.id}/pdf/`, `Handover-${ho.unit_code}.pdf`)}
                                sx={{ fontWeight: 700, textTransform: "none" }}
                              >
                                PDF
                              </Button>
                              {isPending && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="secondary"
                                  onClick={() => {
                                    setSelectedItem(ho);
                                    setSignatoryName(userName);
                                    setActiveModal("handover");
                                  }}
                                  sx={{ fontWeight: 800, textTransform: "none" }}
                                >
                                  Sign Inspection
                                </Button>
                              )}
                            </Stack>
                          </div>
                        </div>
                      );
                    })}

                  {handovers.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
                      No handover records for this property.
                    </div>
                  )}
                </Stack>
              </div>
            </article>
          )}

          {/* 6. INCIDENTS & HAZARD LOG */}
          {tab === "incidents" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>🚨 On-Site Incident & Hazard Register</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Log safety risks, pipe bursts, power failures, or gate malfunctions immediately for management containment.
                  </p>
                </div>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Plus size={15} />}
                  onClick={() => setActiveModal("incident")}
                  sx={{ fontWeight: 800, textTransform: "none" }}
                >
                  Log New Incident
                </Button>
              </div>

              <div style={{ marginTop: 16 }}>
                <Stack spacing={1.5}>
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        background: "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: 14.5 }}>{inc.reference || inc.title}</strong>
                            <Chip
                              size="small"
                              label={inc.severity.toUpperCase()}
                              color={inc.severity === "critical" || inc.severity === "high" ? "error" : "warning"}
                              sx={{ fontWeight: 800, fontSize: 10.5 }}
                            />
                            <Chip
                              size="small"
                              label={inc.status.replace("_", " ").toUpperCase()}
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: 10.5 }}
                            />
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-primary)" }}>
                            <strong>Location:</strong> {inc.location || "Site"} · <strong>Category:</strong> {inc.category}
                          </p>
                          {inc.immediate_action && (
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b91c1c", background: "#fee2e2", padding: "4px 8px", borderRadius: 4 }}>
                              <strong>Immediate Action:</strong> {inc.immediate_action}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                          {inc.occurred_at ? new Date(inc.occurred_at).toLocaleString() : "Recent"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {incidents.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
                      No active incidents logged for this property.
                    </div>
                  )}
                </Stack>
              </div>
            </article>
          )}

          {/* 7. MY TASKS & WORK ORDERS */}
          {tab === "tasks" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>🔧 Assigned Work Orders & Maintenance</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Track corrective repairs, vendor visits, and preventative maintenance tasks.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <Stack spacing={1.5}>
                  {workOrders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        background: "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong>{order.number}</strong>
                            <Chip size="small" label={order.priority.toUpperCase()} color={order.priority === "critical" ? "error" : "warning"} sx={{ fontWeight: 800, fontSize: 10.5 }} />
                            <Chip size="small" label={order.status.replace("_", " ").toUpperCase()} variant="outlined" sx={{ fontWeight: 700, fontSize: 10.5 }} />
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 13 }}>{order.title}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                            Category: {order.category} · Location: {order.location || activeProperty?.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {workOrders.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
                      No open work orders found.
                    </div>
                  )}
                </Stack>
              </div>
            </article>
          )}

          {/* 8. DAILY WALK-THROUGH CHECKLIST */}
          {tab === "walkthrough" && (
            <article className="data-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📋 Daily Common Area Walk-Through Rounds</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    Standard morning & evening physical inspections. Check off each area as you inspect the site.
                  </p>
                </div>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDailyChecklist(DEFAULT_MORNING_ROUND);
                    setSuccessMsg("Checklist reset for new round.");
                  }}
                  sx={{ fontWeight: 700, textTransform: "none" }}
                >
                  Reset Daily Round
                </Button>
              </div>

              <div style={{ marginTop: 16 }}>
                <Stack spacing={1.5}>
                  {dailyChecklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleDailyItem(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "14px 16px",
                        borderRadius: 10,
                        background: item.completed ? "var(--surface-muted)" : "var(--surface)",
                        border: item.completed ? "1px solid #10b981" : "1px solid var(--border-color)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {}}
                        style={{ marginTop: 4, transform: "scale(1.2)", cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", textTransform: "uppercase" }}>
                            {item.category}
                          </span>
                          {item.completed && item.time && (
                            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>
                              ✓ Checked at {item.time}
                            </span>
                          )}
                        </div>
                        <strong
                          style={{
                            fontSize: 14,
                            display: "block",
                            margin: "2px 0",
                            textDecoration: item.completed ? "line-through" : "none",
                            color: item.completed ? "var(--text-secondary)" : "var(--text-primary)",
                          }}
                        >
                          {item.title}
                        </strong>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </Stack>
              </div>
            </article>
          )}

          {/* 9. EMERGENCY & TRADES DIRECTORY */}
          {tab === "directory" && (
            <article className="data-panel">
              <div className="panel-header">
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📞 Emergency & Trades Fast Dial Directory</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  Immediate on-site telephone numbers for utility emergencies, lift breakdowns, security, and fire services.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                  marginTop: 18,
                }}
              >
                {EMERGENCY_DIRECTORY.map((contact, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: 12,
                      padding: "16px 18px",
                      background: "var(--surface)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <strong style={{ fontSize: 14, color: "#0d9488" }}>{contact.trade}</strong>
                        <Chip
                          size="small"
                          label={contact.badge}
                          color={contact.badge.includes("24/7") || contact.badge === "Emergency" ? "error" : "primary"}
                          sx={{ fontWeight: 800, fontSize: 10.5 }}
                        />
                      </div>
                      <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800 }}>{contact.contact}</h4>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>{contact.role}</p>
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px dashed var(--border-color)" }}>
                      <a
                        href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: "#0f766e",
                          color: "#ffffff",
                          textDecoration: "none",
                          padding: "8px 14px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        <PhoneCall size={15} /> Call: {contact.phone}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </main>
      </div>

      {/* DIALOG 1: SIGN CONTRACTOR JOB CARD */}
      <Dialog open={activeModal === "job-card"} onClose={() => setActiveModal(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>Inspect & Sign Job Card: {selectedItem?.number}</DialogTitle>
        <DialogContent>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Confirm that physical work has been inspected on-site and completed to satisfactory standard.
          </p>
          <TextField
            fullWidth
            margin="normal"
            label="Caretaker Signatory Name"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            multiline
            rows={3}
            label="Caretaker Inspection Remarks & Site Acceptance Notes"
            placeholder="e.g. Inspected lighting replacement on 3rd floor. All fixtures illuminated and debris cleared."
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={actionBusy}
            onClick={handleSignJobCard}
            sx={{ fontWeight: 800 }}
          >
            {actionBusy ? "Signing..." : "Confirm Site Sign-off"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 2: RATE VENDOR PERFORMANCE APPRAISAL */}
      <Dialog open={activeModal === "appraisal"} onClose={() => setActiveModal(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>
          Rate Service Provider: {selectedItem?.supplier_name || "Contractor"}
        </DialogTitle>
        <DialogContent>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Rate monthly performance (1 - 5) for invoice <strong>{selectedItem?.invoice_code}</strong>.
          </p>

          <Stack spacing={2} sx={{ mt: 2 }}>
            <div>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Quality of Service (1 - 5)</Typography>
              <Rating
                value={appraisalScores.quality}
                onChange={(_, v) => setAppraisalScores((s) => ({ ...s, quality: v || 5 }))}
              />
            </div>
            <div>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Timeliness & SLA Adherence (1 - 5)</Typography>
              <Rating
                value={appraisalScores.timeliness}
                onChange={(_, v) => setAppraisalScores((s) => ({ ...s, timeliness: v || 5 }))}
              />
            </div>
            <div>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Responsiveness to Site Issues (1 - 5)</Typography>
              <Rating
                value={appraisalScores.responsiveness}
                onChange={(_, v) => setAppraisalScores((s) => ({ ...s, responsiveness: v || 5 }))}
              />
            </div>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Field Observations & Remarks"
              placeholder="e.g. Uniforms worn, perimeter manned at all times, no security lapses noted."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={actionBusy}
            onClick={handleSignAppraisal}
            sx={{ fontWeight: 800 }}
          >
            {actionBusy ? "Submitting..." : "Submit Audit & Sign"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 3: SIGN TENANT HANDOVER */}
      <Dialog open={activeModal === "handover"} onClose={() => setActiveModal(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>Sign Unit Handover: {selectedItem?.unit_code}</DialogTitle>
        <DialogContent>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Confirm that the unit condition checklist and key handovers have been verified on-site.
          </p>
          <TextField
            fullWidth
            margin="normal"
            label="Caretaker Signatory Name"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={actionBusy}
            onClick={handleSignHandover}
            sx={{ fontWeight: 800 }}
          >
            {actionBusy ? "Signing..." : "Sign as Caretaker"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 4: REPORT SITE INCIDENT */}
      <Dialog open={activeModal === "incident"} onClose={() => setActiveModal(null)} fullWidth maxWidth="sm">
        <form onSubmit={handleCreateIncident}>
          <DialogTitle sx={{ fontWeight: 800, color: "#dc2626" }}>🚨 Report Site Incident or Hazard</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              required
              margin="normal"
              label="Incident Title"
              placeholder="e.g. Main water pipe burst in basement parking"
              value={newIncident.title}
              onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
            />
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                fullWidth
                label="Category"
                value={newIncident.category}
                onChange={(e) => setNewIncident({ ...newIncident, category: e.target.value })}
              >
                <MenuItem value="plumbing">Plumbing & Water</MenuItem>
                <MenuItem value="electrical">Electrical & Power</MenuItem>
                <MenuItem value="security">Security & Access</MenuItem>
                <MenuItem value="lift">Elevator / Lift</MenuItem>
                <MenuItem value="fire">Fire & Safety</MenuItem>
                <MenuItem value="civil">Building / Civil</MenuItem>
              </TextField>
              <TextField
                select
                fullWidth
                label="Severity"
                value={newIncident.severity}
                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical (Emergency)</MenuItem>
              </TextField>
            </Stack>
            <TextField
              fullWidth
              margin="normal"
              label="Exact Location"
              placeholder="e.g. Block B, Basement Pump Room"
              value={newIncident.location}
              onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Immediate Containment Action Taken"
              placeholder="e.g. Main stopcock isolated, warned security guards to place warning cones."
              value={newIncident.immediate_action}
              onChange={(e) => setNewIncident({ ...newIncident, immediate_action: e.target.value })}
            />
            <TextField
              fullWidth
              margin="normal"
              multiline
              rows={2}
              label="Additional Incident Details"
              value={newIncident.description}
              onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button type="submit" variant="contained" color="error" disabled={actionBusy} sx={{ fontWeight: 800 }}>
              {actionBusy ? "Logging..." : "Submit Incident Report"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DIALOG 5: RECORD METER READING */}
      <Dialog open={activeModal === "meter-reading"} onClose={() => setActiveModal(null)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmitMeterReading}>
          <DialogTitle sx={{ fontWeight: 800 }}>Capture Utility Meter Reading</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              required
              margin="normal"
              label="Select Meter"
              value={singleMeterReading.meterId}
              onChange={(e) => setSingleMeterReading({ ...singleMeterReading, meterId: e.target.value })}
            >
              {meters.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.code || m.number} ({m.utility_type === "water" ? "Water" : "Power"}) — {m.location || m.unit_code || "Site"}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              required
              type="number"
              slotProps={{ htmlInput: { step: "any" } }}
              margin="normal"
              label="Current Dial / Reading Value"
              placeholder="e.g. 1420.5"
              value={singleMeterReading.currentValue}
              onChange={(e) => setSingleMeterReading({ ...singleMeterReading, currentValue: e.target.value })}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Caretaker Notes / Anomaly Observation"
              placeholder="e.g. Meter clear, seals intact."
              value={singleMeterReading.notes}
              onChange={(e) => setSingleMeterReading({ ...singleMeterReading, notes: e.target.value })}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={actionBusy} sx={{ fontWeight: 800 }}>
              {actionBusy ? "Recording..." : "Save Meter Reading"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
