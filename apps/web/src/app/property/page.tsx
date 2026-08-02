"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { propertyNav } from "@/lib/module-nav";

type Dashboard = {
  kpis: {
    properties: number;
    units: number;
    occupiedUnits: number;
    occupancyRate: number;
    activeLeases: number;
    activeTenants: number;
    outstanding: string;
    collectedYtd: string;
    expensesYtd: string;
  };
  recentLeases: Lease[];
  overdueInvoices: Invoice[];
  propertyMix: { property_type: string; count: number }[];
  collectionTrend: { month: string; billed: string; collected: string }[];
  leaseExpiry: { label: string; count: number }[];
  aging: { label: string; amount: string }[];
  portfolio: {
    id: string;
    name: string;
    units: number;
    occupied: number;
    vacant: number;
    occupancy: number;
    monthlyRent: string;
    outstanding: string;
  }[];
};
type Property = {
  id: string;
  code: string;
  name: string;
  property_type: string;
  city: string;
  status: string;
  units_count: number;
  latitude?: string | number | null;
  longitude?: string | number | null;
  address?: string;
  metadata?: Record<string, unknown>;
};
type Building = {
  id: string;
  code: string;
  name: string;
  property_name: string;
  floors: number;
};
type Unit = {
  id: string;
  code: string;
  property_name: string;
  building_name: string;
  floor: string;
  unit_type: string;
  area: string;
  status: string;
};
type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  starts_on: string;
  ends_on: string;
};
type Tenant = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  status: string;
};
type Lease = {
  id: string;
  reference: string;
  tenant_name: string;
  unit_code: string;
  property_name: string;
  starts_on: string;
  ends_on: string;
  monthly_rent: string;
  status: string;
};
type Invoice = {
  id: string;
  number: string;
  tenant_id: string;
  tenant_name: string;
  due_on: string;
  amount: string;
  balance: string;
  status: string;
};
type Expense = {
  id: string;
  supplier: string;
  property_name: string;
  category: string;
  invoice_number: string;
  incurred_on: string;
  amount: string;
  status: string;
};
type Receipt = {
  id: string;
  number: string;
  tenant_name: string;
  received_on: string;
  amount: string;
  payment_method: string;
  external_reference: string;
};
type Allocation = {
  id: string;
  receipt_number: string;
  invoice_number: string;
  tenant_name: string;
  amount: string;
};
type CreditNote = {
  id: string;
  number: string;
  invoice_number: string;
  tenant_name: string;
  issued_on: string;
  amount: string;
  reason: string;
  status: string;
};
type TenantDocument = {
  id: string;
  tenant_name: string;
  document_type: string;
  document_number: string;
  expires_on: string;
  status: string;
};
type RentSchedule = {
  id: string;
  lease_reference: string;
  tenant_name: string;
  period_start: string;
  period_end: string;
  due_on: string;
  total: string;
  status: string;
};
type Budget = {
  id: string;
  property: string;
  property_name: string;
  year: number;
  category: string;
  amount: string;
  actual_amount: string;
  variance: string;
  status: string;
};
type ServiceCharge = {
  id: string;
  property: string;
  name: string;
  method: string;
  annual_budget: string;
  starts_on: string;
  is_active: boolean;
};
type ServiceChargeAllocation = {
  id: string;
  service_charge_name: string;
  property_name: string;
  unit_code: string;
  ratio: string;
  annual_amount: string;
  monthly_amount: string;
};
type Reconciliation = {
  id: string;
  service_charge_name: string;
  property_name: string;
  period_start: string;
  period_end: string;
  budgeted_amount: string;
  actual_amount: string;
  variance: string;
  status: string;
};
type Arrears = {
  tenant: string;
  property: string;
  unit: string;
  outstanding: string;
  oldest_days: number;
  invoice_count: number;
};
type Report = { key: string; name: string; category: string };
type Reminder = {
  id: string;
  invoice_number: string;
  tenant_name: string;
  channel: string;
  recipient: string;
  message: string;
  sent_at: string;
};
type BankTransaction = {
  id: string;
  reference: string;
  transacted_on: string;
  description: string;
  amount: string;
  status: string;
  receipt_number: string;
};
type CollectionRow =
  | Property
  | Building
  | Unit
  | Project
  | Tenant
  | Lease
  | Invoice
  | Expense
  | Receipt
  | Allocation
  | CreditNote
  | TenantDocument
  | RentSchedule
  | Budget
  | ServiceCharge
  | ServiceChargeAllocation
  | Reconciliation
  | Arrears
  | Report
  | Reminder
  | BankTransaction;
type Tab =
  | "overview"
  | "properties"
  | "buildings"
  | "units"
  | "projects"
  | "tenants"
  | "tenant-documents"
  | "leases"
  | "rent-schedules"
  | "rent"
  | "arrears"
  | "reminders"
  | "receipts"
  | "receipt-allocations"
  | "bank-reconciliation"
  | "credit-notes"
  | "service-charges"
  | "service-charge-allocations"
  | "service-charge-reconciliations"
  | "budgets"
  | "expenses"
  | "reports";

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});
const labels: Record<Tab, string> = {
  overview: "Overview",
  properties: "Properties",
  buildings: "Buildings",
  units: "Units",
  projects: "Projects",
  tenants: "Tenants",
  "tenant-documents": "Tenant documents",
  leases: "Leases",
  "rent-schedules": "Rent schedules",
  rent: "Rent & invoices",
  arrears: "Arrears",
  reminders: "Reminders",
  receipts: "Receipts",
  "receipt-allocations": "Receipt allocations",
  "bank-reconciliation": "Bank reconciliation",
  "credit-notes": "Credit notes",
  "service-charges": "Service charge",
  "service-charge-allocations": "Charge allocations",
  "service-charge-reconciliations": "Reconciliations",
  budgets: "Budgets",
  expenses: "Expenses",
  reports: "Reports",
};

export default function PropertyManagementPage() {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const canOperate = can("property.operations") || can("property.manage");
  const canLease = can("property.leasing") || can("property.manage");
  const canFinance = can("property.finance") || can("property.manage");
  const canApprove = can("property.approve");
  const canReport = can("property.report");
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showTenant, setShowTenant] = useState(false);
  const [showTenantDocument, setShowTenantDocument] = useState(false);
  const [showLease, setShowLease] = useState(false);
  const [financialIntake, setFinancialIntake] = useState<"expense" | "budget" | "service-charge" | null>(null);
  const [tenantOptions, setTenantOptions] = useState<Tenant[]>([]);
  const [unitOptions, setUnitOptions] = useState<Unit[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Property[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const loadVersion = useRef(0);
  const tabRef = useRef(tab);

  const endpoint = useMemo(
    () =>
      (
        ({
          properties: "properties",
          buildings: "buildings",
          units: "units",
          projects: "projects",
          tenants: "tenants",
          "tenant-documents": "tenant-documents",
          leases: "leases",
          "rent-schedules": "rent-schedules",
          rent: "invoices",
          arrears: "analytics/aging",
          reminders: "invoice-reminders",
          receipts: "receipts",
          "receipt-allocations": "receipt-allocations",
          "bank-reconciliation": "bank-transactions",
          "credit-notes": "credit-notes",
          "service-charges": "service-charges",
          "service-charge-allocations": "service-charge-allocations",
          "service-charge-reconciliations": "service-charge-reconciliations",
          budgets: "budgets",
          expenses: "expenses",
          reports: "analytics",
        }) as Partial<Record<Tab, string>>
      )[tab],
    [tab],
  );

  const load = useCallback(async () => {
    if (!organizationId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    const path =
      tab === "overview"
        ? "/property/dashboard/"
        : `/property/${endpoint}/?search=${encodeURIComponent(search)}`;
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) {
      setError("Property data could not be loaded. Please try again.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (version !== loadVersion.current) return;
    if (tab === "overview") setDashboard(data as Dashboard);
    else if (tab === "arrears") setRows(data.tenants ?? []);
    else if (tab === "reports") setRows(data.reports ?? []);
    else setRows(data);
    setLoading(false);
  }, [endpoint, organizationId, search, tab]);

  useEffect(() => {
    const delay = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(delay);
  }, [load, search]);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    if (!showReceipt || !organizationId) return;
    apiFetch("/property/invoices/", {}, organizationId)
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Invoice[]) => {
        const open = items.filter(
          (item) =>
            Number(item.balance) > 0 &&
            ["issued", "partial", "overdue"].includes(item.status),
        );
        setOpenInvoices(open);
        setSelectedInvoice(open[0]?.id ?? "");
      });
  }, [organizationId, showReceipt]);
  useEffect(() => {
    if ((!showTenantDocument && !showLease) || !organizationId) return;
    Promise.all([
      apiFetch("/property/tenants/", {}, organizationId).then(response => response.ok ? response.json() : []),
      showLease ? apiFetch("/property/units/?status=available", {}, organizationId).then(response => response.ok ? response.json() : []) : Promise.resolve([]),
    ]).then(([tenants, units]) => { setTenantOptions(tenants); if (showLease) setUnitOptions(units); });
  }, [organizationId, showLease, showTenantDocument]);
  useEffect(() => {
    if (!financialIntake || !organizationId) return;
    apiFetch("/property/properties/", {}, organizationId).then(response => response.ok ? response.json() : []).then(setPropertyOptions);
  }, [financialIntake, organizationId]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const unitCount = Number(payload.unit_count || 0);
    const unitPayload = {
      count: unitCount,
      start: Number(payload.unit_start || 1),
      prefix: payload.unit_prefix,
      floor: payload.unit_floor,
      unit_type: payload.unit_type,
      area: payload.unit_area,
    };
    for (const key of [
      "unit_count",
      "unit_start",
      "unit_prefix",
      "unit_floor",
      "unit_type",
      "unit_area",
    ])
      delete payload[key];
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/property/properties/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    if (!response.ok) {
      setError(
        "The property could not be saved. Check the required fields and unique code.",
      );
      return;
    }
    const property = await response.json();
    if (unitCount > 0) {
      const unitsResponse = await apiFetch(
        `/property/properties/${property.id}/bulk-units/`,
        {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(unitPayload),
        },
        organizationId,
      );
      if (!unitsResponse.ok) {
        setError(
          "The property was saved, but its unit mix could not be generated.",
        );
        setShowCreate(false);
        setTab("properties");
        await load();
        return;
      }
    }
    setShowCreate(false);
    setTab("properties");
    await load();
  }

  async function recordReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invoice = openInvoices.find((item) => item.id === selectedInvoice);
    if (!invoice) {
      setError("Select an open invoice.");
      return;
    }
    const payload: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    payload.invoice = invoice.id;
    payload.tenant = invoice.tenant_id;
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/property/receipts/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.amount?.[0] ?? "Receipt could not be posted.");
      return;
    }
    setShowReceipt(false);
    setTab("receipt-allocations");
    await load();
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    payload.metadata = {
      registration_number: payload.registration_number,
      billing_preference: payload.billing_preference,
    };
    delete payload.registration_number;
    delete payload.billing_preference;
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/property/tenants/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(
        Object.values(body).flat().join(" ") ||
          "The tenant could not be created.",
      );
      return;
    }
    setShowTenant(false);
    setTab("tenants");
    await load();
  }

  async function createTenantDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/property/tenant-documents/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(
        Object.values(body).flat().join(" ") ||
          "The tenant document could not be registered.",
      );
      return;
    }
    setShowTenantDocument(false);
    setTab("tenant-documents");
    await load();
  }

  async function createLease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/leases/", {method:"POST",headers:{"X-CSRFToken":csrfFromCookie()},body:JSON.stringify(payload)}, organizationId);
    if (!response.ok) {
      const body=await response.json().catch(()=>({}));
      setError(Object.values(body).flat().join(" ")||"The lease could not be created.");
      return;
    }
    setShowLease(false); setTab("leases"); await load();
  }

  async function createFinancialRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!financialIntake) return;
    const payload=Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint=financialIntake === "expense" ? "expenses" : financialIntake === "budget" ? "budgets" : "service-charges";
    await apiFetch("/auth/csrf/");
    const response=await apiFetch(`/property/${endpoint}/`,{method:"POST",headers:{"X-CSRFToken":csrfFromCookie()},body:JSON.stringify(payload)},organizationId);
    if(!response.ok){const body=await response.json().catch(()=>({}));setError(Object.values(body).flat().join(" ")||`The ${financialIntake} could not be saved.`);return;}
    setFinancialIntake(null);setTab(financialIntake === "expense" ? "expenses" : financialIntake === "budget" ? "budgets" : "service-charges");await load();
  }

  async function runAction(path: string) {
    const actionTab = tab;
    setError("");
    await apiFetch("/auth/csrf/");
    let payload: Record<string, string> = path.endsWith("/reconcile/")
      ? {
          period_start: `${new Date().getFullYear()}-01-01`,
          period_end: new Date().toISOString().slice(0, 10),
        }
      : {};
    if (path.endsWith("/send-reminder/")) payload = { channel: "portal" };
    if (path.endsWith("/renew/")) {
      const lease = (rows as Lease[]).find((row) => path.includes(row.id));
      if (!lease) return;
      const reference = window.prompt(
        "Renewal reference",
        `${lease.reference}-R1`,
      );
      if (!reference) return;
      const suggestedEnd = new Date(lease.ends_on);
      suggestedEnd.setFullYear(suggestedEnd.getFullYear() + 1);
      const endsOn = window.prompt(
        "New lease end date",
        suggestedEnd.toISOString().slice(0, 10),
      );
      if (!endsOn) return;
      const monthlyRent = window.prompt("New monthly rent", lease.monthly_rent);
      if (!monthlyRent) return;
      payload = { reference, ends_on: endsOn, monthly_rent: monthlyRent };
    }
    const response = await apiFetch(
      `/property/${path}`,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = Object.values(body).flat().join(" ");
      setError(detail || "The workflow action could not be completed.");
      return;
    }
    if (tabRef.current === actionTab) await load();
  }

  async function downloadReport(kind: string) {
    const response = await apiFetch(
      `/property/analytics/exports/${kind}/`,
      {},
      organizationId,
    );
    if (!response.ok) {
      setError("The report could not be generated.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `property-${kind}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const kpis = dashboard?.kpis;
  const monthlyRentTotal = dashboard?.portfolio.reduce((sum, item) => sum + Number(item.monthlyRent || 0), 0) ?? 0;
  const collected = Number(kpis?.collectedYtd ?? 0);
  const outstanding = Number(kpis?.outstanding ?? 0);
  const collectionBase = collected + outstanding;
  const collectionRate = collectionBase > 0 ? Math.round((collected / collectionBase) * 1000) / 10 : 0;
  const todayLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const selectSection = (id: string) => {
    setSearch("");
    setRows([]);
    setTab(id as Tab);
  };
  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Portfolio workspace"
      title="Property Management"
      subtitle="Occupancy, leases, rent collections and operating costs in one view."
      accent="#e23b3b"
      groups={propertyNav}
      activeId={tab}
      onSelect={selectSection}
      contextLabel="Section"
      contextValue={labels[tab]}
      actions={
        <>
          <span className="welcome-meta">📅 {todayLabel}</span>
          {canFinance && <button className="secondary-action" onClick={() => setShowReceipt(true)}>Record receipt</button>}
          {canOperate && <button className="primary-action" onClick={() => setShowCreate(true)}>+ Add property</button>}
        </>
      }
    >
      <div className="property-app">
      {error && (
        <div className="form-error">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className="data-loading">Loading live portfolio data…</div>
      ) : tab === "overview" && kpis ? (
        <>
          <section className="kpi-grid property-kpis">
            <IconKpi
              icon="🏢"
              tone="#fee2e2"
              color="#dc2626"
              label="Total Properties"
              value={String(kpis.properties)}
              note={`${kpis.units} total units`}
              onClick={() => setTab("properties")}
            />
            <IconKpi
              icon="🔑"
              tone="#e0e7ff"
              color="#4f46e5"
              label="Occupied Units"
              value={String(kpis.occupiedUnits)}
              note={`${kpis.occupancyRate}% Occupancy`}
              onClick={() => setTab("units")}
            />
            <IconKpi
              icon="👥"
              tone="#dbeafe"
              color="#2563eb"
              label="Total Tenants"
              value={String(kpis.activeTenants)}
              note={`${kpis.activeLeases} active leases`}
              onClick={() => setTab("tenants")}
            />
            <IconKpi
              icon="💰"
              tone="#dcfce7"
              color="#16a34a"
              label="Monthly Rent"
              value={money.format(monthlyRentTotal)}
              note={`${money.format(Number(kpis.collectedYtd))} collected YTD`}
              onClick={() => setTab("rent")}
            />
            <IconKpi
              icon="⚠"
              tone="#fee2e2"
              color="#dc2626"
              label="Outstanding rent"
              value={money.format(Number(kpis.outstanding))}
              note="Open invoice balances"
              onClick={() => setTab("arrears")}
            />
          </section>
          <section className="property-insight-grid">
            <article className="data-panel">
              <PanelTitle
                title="Monthly rent collection trend"
                action="Rent collection"
                onClick={() => setTab("rent")}
              />
              <CollectionTrend rows={dashboard.collectionTrend} />
            </article>
            <article className="data-panel">
              <PanelTitle
                title="Rent collection summary"
                action="View arrears"
                onClick={() => setTab("arrears")}
              />
              <div className="donut-panel">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#e23b3b 0% ${collectionRate}%, #243852 ${collectionRate}% 100%)`,
                  }}
                >
                  <strong>{collectionRate}%</strong>
                  <small>Collected</small>
                </div>
                <div className="donut-legend">
                  <span>
                    <i style={{ background: "#e23b3b" }} />
                    Collected
                    <b>{money.format(collected)}</b>
                  </span>
                  <span>
                    <i style={{ background: "#243852" }} />
                    Outstanding
                    <b>{money.format(outstanding)}</b>
                  </span>
                </div>
              </div>
            </article>
            <article className="data-panel property-alert-panel">
              <div className="collection-rate-card">
                <small>Rent Collection (YTD)</small>
                <div className="rent-summary-list">
                  <div>
                    <span>Total billed (collected + open)</span>
                    <b>{money.format(collectionBase)}</b>
                  </div>
                  <div>
                    <span>Total collected</span>
                    <b>{money.format(collected)}</b>
                  </div>
                  <div>
                    <span>Collection rate</span>
                    <b>{collectionRate}%</b>
                  </div>
                  <div>
                    <span>Outstanding</span>
                    <b>{money.format(outstanding)}</b>
                  </div>
                </div>
                {canFinance && (
                  <button
                    className="collection-cta"
                    onClick={() => setShowReceipt(true)}
                  >
                    ＋ Record rent payment
                  </button>
                )}
              </div>
              <PanelTitle
                title="Top overdue tenants"
                action="View all"
                onClick={() => setTab("arrears")}
              />
              {dashboard.overdueInvoices.length ? (
                dashboard.overdueInvoices.map((item) => (
                  <button
                    className="invoice-alert"
                    key={item.id}
                    onClick={() => setTab("rent")}
                  >
                    <span>
                      <strong>{item.tenant_name}</strong>
                      <small>
                        {item.number} · due {item.due_on}
                      </small>
                    </span>
                    <b>{money.format(Number(item.balance))}</b>
                  </button>
                ))
              ) : (
                <Empty text="No overdue invoices." />
              )}
            </article>
          </section>
          <section className="property-lower-grid">
            <article className="data-panel">
              <PanelTitle
                title="Property portfolio summary"
                action="View properties"
                onClick={() => setTab("properties")}
              />
              <DataTable
                headers={[
                  "Property",
                  "Units",
                  "Occupied",
                  "Vacant",
                  "Occupancy",
                  "Monthly rent",
                  "Outstanding",
                ]}
                rows={dashboard.portfolio.map((item) => [
                  item.name,
                  item.units,
                  item.occupied,
                  item.vacant,
                  `${item.occupancy}%`,
                  money.format(Number(item.monthlyRent)),
                  money.format(Number(item.outstanding)),
                ])}
              />
            </article>
            <article className="data-panel">
              <PanelTitle
                title="Lease expiry overview"
                action="View leases"
                onClick={() => setTab("leases")}
              />
              <div className="expiry-list">
                {dashboard.leaseExpiry.map((item) => (
                  <button key={item.label} onClick={() => setTab("leases")}>
                    <span>Expiring in {item.label}</span>
                    <b>{item.count}</b>
                  </button>
                ))}
              </div>
            </article>
            <article className="data-panel">
              <PanelTitle
                title="Rent ageing summary"
                action="Ageing report"
                onClick={() => setTab("arrears")}
              />
              <AgingSummary rows={dashboard.aging} />
              <PanelTitle
                title="Quick actions"
                action="Reports"
                onClick={() => setTab("reports")}
              />
              <div className="property-quick-actions">
                {canOperate && (
                  <button onClick={() => setShowCreate(true)}>
                    ＋ Add new property
                  </button>
                )}
                {canLease && (
                  <button onClick={() => setShowLease(true)}>
                    ⌁ Add new lease
                  </button>
                )}
                {canLease && (
                  <button onClick={() => setShowTenant(true)}>
                    ♙ Add new tenant
                  </button>
                )}
                {canFinance && (
                  <button onClick={() => setShowReceipt(true)}>
                    ◎ Record rent payment
                  </button>
                )}
                {canFinance && (
                  <button onClick={() => setTab("expenses")}>
                    ▣ Income & expenses
                  </button>
                )}
                {canReport && (
                  <button onClick={() => setTab("reports")}>
                    ⇩ Export reports
                  </button>
                )}
              </div>
            </article>
          </section>
          <section className="summary-strip">
            <span>
              <b>{money.format(Number(kpis.expensesYtd))}</b>Operating expenses
              YTD
            </span>
            {dashboard.propertyMix.map((item) => (
              <span key={item.property_type}>
                <b>{item.count}</b>
                {item.property_type || "Unclassified"} properties
              </span>
            ))}
          </section>
        </>
      ) : (
        <Collection
          tab={tab}
          rows={rows}
          search={search}
          onSearch={setSearch}
          onAction={runAction}
          onDownload={downloadReport}
          onAddTenant={() => setShowTenant(true)}
          onAddTenantDocument={() => setShowTenantDocument(true)}
          onAddLease={() => setShowLease(true)}
          onAddExpense={() => setFinancialIntake("expense")}
          onAddBudget={() => setFinancialIntake("budget")}
          onAddServiceCharge={() => setFinancialIntake("service-charge")}
          permissions={{ canLease, canFinance, canApprove, canReport }}
        />
      )}
      {showCreate && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowCreate(false)}
        >
          <div
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-property"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">New portfolio record</p>
                <h2 id="new-property">Add property</h2>
              </div>
              <button aria-label="Close" onClick={() => setShowCreate(false)}>
                ×
              </button>
            </div>
            <form onSubmit={createProperty}>
              <label>
                Property code
                <input name="code" required placeholder="CE-NRB-002" />
              </label>
              <label>
                Property name
                <input
                  name="name"
                  required
                  placeholder="Riverside Apartments"
                />
              </label>
              <div className="form-row">
                <label>
                  Type
                  <input name="property_type" placeholder="Residential" />
                </label>
                <label>
                  City
                  <input name="city" placeholder="Nairobi" />
                </label>
              </div>
              <label>
                Status
                <select name="status" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label>
                Address
                <textarea name="address" rows={2} />
              </label>
              <p className="eyebrow">Optional unit mix</p>
              <div className="form-row">
                <label>
                  Number of units
                  <input
                    name="unit_count"
                    type="number"
                    min="0"
                    max="500"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Starting number
                  <input
                    name="unit_start"
                    type="number"
                    min="1"
                    defaultValue="1"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Unit prefix
                  <input name="unit_prefix" placeholder="A-" />
                </label>
                <label>
                  Unit type
                  <input name="unit_type" placeholder="Apartment" />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Floor
                  <input name="unit_floor" placeholder="1" />
                </label>
                <label>
                  Area per unit (m²)
                  <input
                    name="unit_area"
                    type="number"
                    min="0.01"
                    step="0.01"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="primary-action" type="submit">
                  Save property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showReceipt && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowReceipt(false)}
        >
          <div
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-receipt"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">Rent collection</p>
                <h2 id="record-receipt">Record and allocate receipt</h2>
              </div>
              <button aria-label="Close" onClick={() => setShowReceipt(false)}>
                ×
              </button>
            </div>
            <form onSubmit={recordReceipt}>
              <label>
                Open invoice
                <select
                  required
                  value={selectedInvoice}
                  onChange={(event) => setSelectedInvoice(event.target.value)}
                >
                  <option value="" disabled>
                    Select invoice
                  </option>
                  {openInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.number} — {invoice.tenant_name} —{" "}
                      {money.format(Number(invoice.balance))}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Receipt number
                  <input required name="number" placeholder="RCT-2026-0419" />
                </label>
                <label>
                  Received on
                  <input required type="date" name="received_on" />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Amount
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="amount"
                    max={
                      openInvoices.find((item) => item.id === selectedInvoice)
                        ?.balance
                    }
                  />
                </label>
                <label>
                  Method
                  <select name="payment_method" defaultValue="bank_transfer">
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>
              </div>
              <label>
                External reference
                <input
                  name="external_reference"
                  placeholder="Bank or M-Pesa reference"
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={() => setShowReceipt(false)}>
                  Cancel
                </button>
                <button className="primary-action">Post receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showTenant && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowTenant(false)}
        >
          <div
            className="form-modal tenant-intake-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-tenant"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">Tenant onboarding</p>
                <h2 id="new-tenant">Add new tenant</h2>
              </div>
              <button aria-label="Close" onClick={() => setShowTenant(false)}>
                ×
              </button>
            </div>
            <form onSubmit={createTenant}>
              <div className="form-section-title">
                <b>1</b>
                <span>
                  Basic information<small>Identity and classification</small>
                </span>
              </div>
              <div className="form-row">
                <label>
                  Tenant code
                  <input name="code" required placeholder="TEN-0042" />
                </label>
                <label>
                  Tenant type
                  <select name="tenant_type" defaultValue="company">
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                    <option value="government">Government</option>
                  </select>
                </label>
              </div>
              <label>
                Tenant name / company
                <input name="name" required />
              </label>
              <div className="form-row">
                <label>
                  Registration / ID number
                  <input name="registration_number" />
                </label>
                <label>
                  KRA PIN / Tax ID
                  <input name="tax_id" />
                </label>
              </div>
              <div className="form-section-title">
                <b>2</b>
                <span>
                  Contact & billing<small>Primary communication details</small>
                </span>
              </div>
              <div className="form-row">
                <label>
                  Email
                  <input name="email" type="email" />
                </label>
                <label>
                  Phone
                  <input name="phone" placeholder="+254…" />
                </label>
              </div>
              <label>
                Billing address
                <textarea name="billing_address" rows={3} />
              </label>
              <div className="form-row">
                <label>
                  Status
                  <select name="status" defaultValue="prospect">
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                <label>
                  Billing preference
                  <select name="billing_preference" defaultValue="email_portal">
                    <option value="email_portal">Email and portal</option>
                    <option value="email">Email only</option>
                    <option value="portal">Portal only</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowTenant(false)}>
                  Cancel
                </button>
                <button className="primary-action">Save tenant</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showTenantDocument && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowTenantDocument(false)}
        >
          <div
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-document"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">Tenant compliance</p>
                <h2 id="tenant-document">Register tenant document</h2>
              </div>
              <button
                aria-label="Close"
                onClick={() => setShowTenantDocument(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={createTenantDocument}>
              <label>
                Tenant
                <select required name="tenant" defaultValue="">
                  <option value="" disabled>
                    Select tenant
                  </option>
                  {tenantOptions.map((tenant) => (
                    <option value={tenant.id} key={tenant.id}>
                      {tenant.code} — {tenant.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Document type
                  <select
                    name="document_type"
                    defaultValue="registration_certificate"
                  >
                    <option value="registration_certificate">
                      Registration certificate
                    </option>
                    <option value="tax_certificate">Tax certificate</option>
                    <option value="identity">Identity document</option>
                    <option value="insurance">Insurance</option>
                    <option value="lease_support">Lease support</option>
                  </select>
                </label>
                <label>
                  Document number
                  <input name="document_number" />
                </label>
              </div>
              <label>
                Secure document URL
                <input
                  name="file_url"
                  type="url"
                  required
                  placeholder="https://documents.example/tenant/file.pdf"
                />
              </label>
              <div className="form-row">
                <label>
                  Issued on
                  <input name="issued_on" type="date" />
                </label>
                <label>
                  Expires on
                  <input name="expires_on" type="date" />
                </label>
              </div>
              <p className="form-help">
                The document enters pending review. A leasing officer can verify
                it after checking the original evidence.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowTenantDocument(false)}
                >
                  Cancel
                </button>
                <button className="primary-action">Register document</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showLease && (
        <div className="modal-backdrop" onMouseDown={() => setShowLease(false)}>
          <div className="form-modal tenant-intake-modal" role="dialog" aria-modal="true" aria-labelledby="new-lease" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-title"><div><p className="eyebrow">Lease administration</p><h2 id="new-lease">Create lease</h2></div><button aria-label="Close" onClick={() => setShowLease(false)}>×</button></div>
            <form onSubmit={createLease}>
              <div className="form-section-title"><b>1</b><span>Parties and premises<small>Select a tenant and currently available unit</small></span></div>
              <label>Lease reference<input name="reference" required placeholder="LS-2026-0042" /></label>
              <div className="form-row"><label>Tenant<select name="tenant" required defaultValue=""><option value="" disabled>Select tenant</option>{tenantOptions.map(tenant => <option value={tenant.id} key={tenant.id}>{tenant.code} — {tenant.name}</option>)}</select></label><label>Available unit<select name="unit" required defaultValue=""><option value="" disabled>Select unit</option>{unitOptions.map(unit => <option value={unit.id} key={unit.id}>{unit.property_name} — {unit.code}</option>)}</select></label></div>
              <div className="form-section-title"><b>2</b><span>Commercial terms<small>Dates, rent, deposit and escalation</small></span></div>
              <div className="form-row"><label>Starts on<input name="starts_on" type="date" required /></label><label>Ends on<input name="ends_on" type="date" required /></label></div>
              <div className="form-row"><label>Monthly rent<input name="monthly_rent" type="number" min="0.01" step="0.01" required /></label><label>Deposit<input name="deposit" type="number" min="0" step="0.01" defaultValue="0" /></label></div>
              <div className="form-row"><label>Annual escalation (%)<input name="escalation_percent" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Billing day<input name="billing_day" type="number" min="1" max="28" defaultValue="1" /></label></div>
              <p className="form-help">The lease is saved as a draft. Activation is a separate controlled action that checks occupancy conflicts and updates the unit and tenant.</p>
              <div className="form-actions"><button type="button" onClick={() => setShowLease(false)}>Cancel</button><button className="primary-action">Save draft lease</button></div>
            </form>
          </div>
        </div>
      )}
      {financialIntake && (
        <div className="modal-backdrop" onMouseDown={() => setFinancialIntake(null)}>
          <div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="financial-intake" onMouseDown={event=>event.stopPropagation()}>
            <div className="modal-title"><div><p className="eyebrow">Property finance</p><h2 id="financial-intake">{financialIntake === "expense" ? "Record supplier expense" : financialIntake === "budget" ? "Create budget line" : "Set up service charge"}</h2></div><button aria-label="Close" onClick={()=>setFinancialIntake(null)}>×</button></div>
            <form onSubmit={createFinancialRecord}>
              <label>Property<select name="property" required defaultValue=""><option value="" disabled>Select property</option>{propertyOptions.map(property=><option key={property.id} value={property.id}>{property.code} — {property.name}</option>)}</select></label>
              {financialIntake === "expense" ? <><div className="form-row"><label>Supplier<input name="supplier" required /></label><label>Supplier invoice<input name="invoice_number" /></label></div><div className="form-row"><label>Category<input name="category" required placeholder="Utilities" /></label><label>Incurred on<input name="incurred_on" type="date" required /></label></div><label>Description<textarea name="description" rows={3}/></label><label>Expense amount<input name="amount" type="number" min="0.01" step="0.01" required /></label></> : financialIntake === "budget" ? <><div className="form-row"><label>Budget year<input name="year" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} required /></label><label>Category<input name="category" required placeholder="Repairs and maintenance" /></label></div><label>Annual budget<input name="amount" type="number" min="0" step="0.01" required /></label></> : <><label>Scheme name<input name="name" required placeholder="2026 Commercial Service Charge" /></label><div className="form-row"><label>Allocation method<select name="method" defaultValue="area"><option value="area">Floor area</option><option value="equal">Equal share</option><option value="fixed">Fixed amount</option></select></label><label>Starts on<input name="starts_on" type="date" required /></label></div><label>Annual service budget<input name="annual_budget" type="number" min="0" step="0.01" required /></label><input type="hidden" name="is_active" value="true" /></>}
              <p className="form-help">This record starts in draft and must follow the controlled submit and approval workflow before it affects approved reporting.</p>
              <div className="form-actions"><button type="button" onClick={()=>setFinancialIntake(null)}>Cancel</button><button className="primary-action">Save draft</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuleShell>
  );
}

function IconKpi({
  icon,
  tone,
  color,
  label,
  value,
  note,
  onClick,
}: {
  icon: string;
  tone: string;
  color: string;
  label: string;
  value: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button className="icon-kpi" onClick={onClick}>
      <span style={{ background: tone, color }} aria-hidden="true">
        {icon}
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <b>{note}</b>
      </div>
    </button>
  );
}
function PanelTitle({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <header className="panel-title">
      <h2>{title}</h2>
      <button onClick={onClick}>{action} →</button>
    </header>
  );
}
function Status({ value }: { value?: string }) {
  const safe = value || "unknown";
  return (
    <span className={`data-status status-${safe}`}>
      {safe.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((value, cell) => (
                <td key={cell}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No matching records found." />
  );
}
function CollectionTrend({ rows }: { rows: Dashboard["collectionTrend"] }) {
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [Number(row.billed), Number(row.collected)]),
  );
  return rows.length ? (
    <div
      className="collection-chart"
      aria-label="Monthly billed and collected rent"
    >
      <div className="chart-plot">
        {rows.map((row) => (
          <div className="chart-month" key={row.month}>
            <div className="chart-bars">
              <i
                className="billed"
                style={{
                  height: `${Math.max(3, (Number(row.billed) / max) * 100)}%`,
                }}
                title={`Billed ${money.format(Number(row.billed))}`}
              />
              <i
                className="collected"
                style={{
                  height: `${Math.max(3, (Number(row.collected) / max) * 100)}%`,
                }}
                title={`Collected ${money.format(Number(row.collected))}`}
              />
            </div>
            <span>{row.month}</span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span>
          <i className="collected" />
          Collected
        </span>
        <span>
          <i className="billed" />
          Billed
        </span>
      </div>
    </div>
  ) : (
    <Empty text="Collection data will appear after invoices and receipts are posted." />
  );
}
function AgingSummary({ rows }: { rows: Dashboard["aging"] }) {
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  return (
    <div className="aging-summary">
      <div className="aging-total">
        <span>Total outstanding</span>
        <strong>{money.format(total)}</strong>
      </div>
      {rows.map((row) => (
        <button key={row.label}>
          <span>
            <i
              style={{
                width: `${total ? (Number(row.amount) / total) * 100 : 0}%`,
              }}
            />
          </span>
          <b>{row.label}</b>
          <small>{money.format(Number(row.amount))}</small>
        </button>
      ))}
    </div>
  );
}

function Collection({
  tab,
  rows,
  search,
  onSearch,
  onAction,
  onDownload,
  onAddTenant,
  onAddTenantDocument,
  onAddLease,
  onAddExpense,
  onAddBudget,
  onAddServiceCharge,
  permissions,
}: {
  tab: Tab;
  rows: CollectionRow[];
  search: string;
  onSearch: (value: string) => void;
  onAction: (path: string) => Promise<void>;
  onDownload: (kind: string) => Promise<void>;
  onAddTenant: () => void;
  onAddTenantDocument: () => void;
  onAddLease: () => void;
  onAddExpense: () => void;
  onAddBudget: () => void;
  onAddServiceCharge: () => void;
  permissions: {
    canLease: boolean;
    canFinance: boolean;
    canApprove: boolean;
    canReport: boolean;
  };
}) {
  const { canLease, canFinance, canApprove, canReport } = permissions;
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [registerView, setRegisterView] = useState<"table" | "map">("table");
  let headers: string[] = [],
    values: React.ReactNode[][] = [];
  let propertyRows: Property[] = [];
  if (tab === "properties") {
    propertyRows = (rows as Property[]).filter((r) => {
      if (typeFilter !== "all" && (r.property_type || "Unclassified") !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (cityFilter !== "all" && (r.city || "—") !== cityFilter) return false;
      return true;
    });
    headers = ["Property", "Type", "Location", "Units", "Status"];
    values = propertyRows.map((r) => [
      <div className="property-cell" key={r.id}>
        <span className={`property-thumb ${(r.property_type || "").toLowerCase()}`} aria-hidden="true">
          {(r.name || "P").slice(0, 1)}
        </span>
        <span>
          <strong>{r.name}</strong>
          <small>{r.code}</small>
        </span>
      </div>,
      r.property_type || "—",
      r.city || "—",
      r.units_count,
      <Status key={`s-${r.id}`} value={r.status} />,
    ]);
  }
  if (tab === "buildings") {
    headers = ["Code", "Building", "Property", "Floors"];
    values = (rows as Building[]).map((r) => [
      r.code,
      r.name,
      r.property_name,
      r.floors,
    ]);
  }
  if (tab === "units") {
    headers = [
      "Unit",
      "Property",
      "Building",
      "Floor",
      "Type",
      "Area",
      "Status",
    ];
    values = (rows as Unit[]).map((r) => [
      r.code,
      r.property_name,
      r.building_name || "—",
      r.floor || "—",
      r.unit_type || "—",
      r.area || "—",
      <Status key={r.id} value={r.status} />,
    ]);
  }
  if (tab === "projects") {
    headers = ["Code", "Project", "Starts", "Ends", "Status"];
    values = (rows as Project[]).map((r) => [
      r.code,
      r.name,
      r.starts_on || "—",
      r.ends_on || "—",
      <Status key={r.id} value={r.status} />,
    ]);
  }
  if (tab === "tenants") {
    headers = ["Code", "Tenant", "Email", "Phone", "Status"];
    values = (rows as Tenant[]).map((r) => [
      r.code,
      r.name,
      r.email || "—",
      r.phone || "—",
      <Status key={r.id} value={r.status} />,
    ]);
  }
  if (tab === "leases") {
    headers = [
      "Reference",
      "Tenant",
      "Property / unit",
      "Start",
      "End",
      "Rent",
      "Status",
      "Actions",
    ];
    values = (rows as Lease[]).map((r) => [
      r.reference,
      r.tenant_name,
      `${r.property_name} · ${r.unit_code}`,
      r.starts_on,
      r.ends_on,
      money.format(Number(r.monthly_rent)),
      <Status key={r.id} value={r.status} />,
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          !canLease
            ? []
            : r.status === "draft"
              ? [["Activate", `leases/${r.id}/activate/`]]
              : ["active", "expiring"].includes(r.status)
                ? [
                    ["Renew", `leases/${r.id}/renew/`],
                    ["Terminate", `leases/${r.id}/terminate/`],
                  ]
                : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "rent") {
    headers = [
      "Invoice",
      "Tenant",
      "Due date",
      "Amount",
      "Balance",
      "Status",
      "Actions",
    ];
    values = (rows as Invoice[]).map((r) => [
      r.number,
      r.tenant_name,
      r.due_on,
      money.format(Number(r.amount)),
      money.format(Number(r.balance)),
      <Status key={r.id} value={r.status} />,
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          !canFinance
            ? []
            : r.status === "draft"
              ? [["Issue", `invoices/${r.id}/issue/`]]
              : ["issued", "overdue", "partial"].includes(r.status)
                ? [
                    ["Send reminder", `invoices/${r.id}/send-reminder/`],
                    ...(["issued", "overdue"].includes(r.status) && canApprove
                      ? [["Void", `invoices/${r.id}/void/`]]
                      : []),
                  ]
                : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "expenses") {
    headers = [
      "Date",
      "Invoice",
      "Supplier",
      "Property",
      "Category",
      "Amount",
      "Status",
      "Actions",
    ];
    values = (rows as Expense[]).map((r) => [
      r.incurred_on,
      r.invoice_number || "—",
      r.supplier,
      r.property_name,
      r.category,
      money.format(Number(r.amount)),
      <Status key={r.id} value={r.status} />,
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          !canFinance
            ? []
            : ["draft", "rejected"].includes(r.status)
              ? [["Submit", `expenses/${r.id}/submit/`]]
              : r.status === "pending" && canApprove
                ? [
                    ["Approve", `expenses/${r.id}/approve/`],
                    ["Reject", `expenses/${r.id}/reject/`],
                  ]
                : r.status === "approved" && canApprove
                  ? [["Mark paid", `expenses/${r.id}/mark-paid/`]]
                  : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "receipts") {
    headers = [
      "Receipt",
      "Tenant",
      "Received",
      "Amount",
      "Method",
      "Reference",
    ];
    values = (rows as Receipt[]).map((r) => [
      r.number,
      r.tenant_name,
      r.received_on,
      money.format(Number(r.amount)),
      r.payment_method.replaceAll("_", " "),
      r.external_reference || "—",
    ]);
  }
  if (tab === "receipt-allocations") {
    headers = ["Receipt", "Invoice", "Tenant", "Allocated"];
    values = (rows as Allocation[]).map((r) => [
      r.receipt_number,
      r.invoice_number,
      r.tenant_name,
      money.format(Number(r.amount)),
    ]);
  }
  if (tab === "credit-notes") {
    headers = [
      "Credit note",
      "Invoice",
      "Tenant",
      "Issued",
      "Amount",
      "Reason",
      "Status",
    ];
    values = (rows as CreditNote[]).map((r) => [
      r.number,
      r.invoice_number,
      r.tenant_name,
      r.issued_on,
      money.format(Number(r.amount)),
      r.reason,
      <Status key={r.id} value={r.status} />,
    ]);
  }
  if (tab === "tenant-documents") {
    headers = ["Tenant", "Document", "Number", "Expires", "Status", "Actions"];
    values = (rows as TenantDocument[]).map((r) => [
      r.tenant_name,
      r.document_type.replaceAll("_", " "),
      r.document_number || "—",
      r.expires_on || "—",
      <Status key={r.id} value={r.status} />,
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          canLease && r.status === "pending"
            ? [["Verify", `tenant-documents/${r.id}/verify/`]]
            : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "rent-schedules") {
    headers = [
      "Lease",
      "Tenant",
      "Period start",
      "Period end",
      "Due",
      "Total",
      "Status",
      "Actions",
    ];
    values = (rows as RentSchedule[]).map((r) => [
      r.lease_reference,
      r.tenant_name,
      r.period_start,
      r.period_end,
      r.due_on,
      money.format(Number(r.total)),
      <Status key={r.id} value={r.status} />,
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          canFinance && r.status === "upcoming"
            ? [["Generate invoice", `rent-schedules/${r.id}/generate-invoice/`]]
            : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "budgets") {
    headers = [
      "Year",
      "Property",
      "Category",
      "Budget",
      "Actual",
      "Variance",
      "Status",
      "Actions",
    ];
    values = (rows as Budget[]).map((r) => [
      r.year,
      r.property_name,
      r.category,
      money.format(Number(r.amount)),
      money.format(Number(r.actual_amount)),
      money.format(Number(r.variance)),
      <Status key={r.id} value={r.status} />,
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          !canFinance
            ? []
            : ["draft", "rejected"].includes(r.status)
              ? [["Submit", `budgets/${r.id}/submit/`]]
              : r.status === "pending" && canApprove
                ? [
                    ["Approve", `budgets/${r.id}/approve/`],
                    ["Reject", `budgets/${r.id}/reject/`],
                  ]
                : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "service-charges") {
    headers = [
      "Scheme",
      "Property ID",
      "Method",
      "Annual budget",
      "Starts",
      "Active",
    ];
    values = (rows as ServiceCharge[]).map((r) => [
      r.name,
      r.property,
      r.method,
      money.format(Number(r.annual_budget)),
      r.starts_on,
      r.is_active ? "Yes" : "No",
    ]);
  }
  if (tab === "service-charges") {
    headers.push("Actions");
    values = (rows as ServiceCharge[]).map((r) => [
      r.name,
      r.property,
      r.method,
      money.format(Number(r.annual_budget)),
      r.starts_on,
      r.is_active ? "Yes" : "No",
      <ActionButtons
        key={`a-${r.id}`}
        actions={
          canFinance
            ? [
                ["Allocate", `service-charges/${r.id}/generate-allocations/`],
                ["Reconcile YTD", `service-charges/${r.id}/reconcile/`],
              ]
            : []
        }
        run={onAction}
      />,
    ]);
  }
  if (tab === "service-charge-allocations") {
    headers = ["Scheme", "Property", "Unit", "Ratio", "Annual", "Monthly"];
    values = (rows as ServiceChargeAllocation[]).map((r) => [
      r.service_charge_name,
      r.property_name,
      r.unit_code,
      `${(Number(r.ratio) * 100).toFixed(2)}%`,
      money.format(Number(r.annual_amount)),
      money.format(Number(r.monthly_amount)),
    ]);
  }
  if (tab === "service-charge-reconciliations") {
    headers = [
      "Scheme",
      "Property",
      "Period start",
      "Period end",
      "Budget",
      "Actual",
      "Variance",
      "Status",
    ];
    values = (rows as Reconciliation[]).map((r) => [
      r.service_charge_name,
      r.property_name,
      r.period_start,
      r.period_end,
      money.format(Number(r.budgeted_amount)),
      money.format(Number(r.actual_amount)),
      money.format(Number(r.variance)),
      <Status key={r.id} value={r.status} />,
    ]);
  }
  if (tab === "arrears") {
    headers = [
      "Tenant",
      "Property",
      "Unit",
      "Invoices",
      "Outstanding",
      "Oldest debt",
    ];
    values = (rows as Arrears[]).map((r) => [
      r.tenant,
      r.property,
      r.unit,
      r.invoice_count,
      money.format(Number(r.outstanding)),
      `${r.oldest_days} days`,
    ]);
  }
  if (tab === "reports") {
    headers = ["Report", "Category", "Export"];
    values = (rows as Report[]).map((r) => [
      r.name,
      r.category,
      canReport ? (
        <button
          className="secondary-action"
          key={r.key}
          onClick={() => void onDownload(r.key)}
        >
          Download CSV
        </button>
      ) : (
        "—"
      ),
    ]);
  }
  if (tab === "reminders") {
    headers = ["Invoice", "Tenant", "Channel", "Recipient", "Message", "Sent"];
    values = (rows as Reminder[]).map((r) => [
      r.invoice_number,
      r.tenant_name,
      r.channel,
      r.recipient,
      r.message,
      r.sent_at.slice(0, 16).replace("T", " "),
    ]);
  }
  if (tab === "bank-reconciliation") {
    headers = [
      "Bank reference",
      "Date",
      "Description",
      "Amount",
      "Receipt",
      "Status",
    ];
    values = (rows as BankTransaction[]).map((r) => [
      r.reference,
      r.transacted_on,
      r.description || "—",
      money.format(Number(r.amount)),
      r.receipt_number || "—",
      <Status key={r.id} value={r.status} />,
    ]);
  }
  const propertyTypes = tab === "properties"
    ? Array.from(new Set((rows as Property[]).map((r) => r.property_type || "Unclassified")))
    : [];
  const propertyCities = tab === "properties"
    ? Array.from(new Set((rows as Property[]).map((r) => r.city || "—")))
    : [];
  const propertyStatuses = tab === "properties"
    ? Array.from(new Set((rows as Property[]).map((r) => r.status)))
    : [];
  const propertyStats = tab === "properties"
    ? {
        total: rows.length,
        units: (rows as Property[]).reduce((sum, r) => sum + Number(r.units_count || 0), 0),
        active: (rows as Property[]).filter((r) => r.status === "active").length,
        types: propertyTypes.length,
      }
    : null;

  return (
    <>
    {tab === "properties" && propertyStats && (
      <section className="register-kpi-strip" aria-label="Property register summary">
        <article><small>Total Properties</small><strong>{propertyStats.total}</strong><b>Active register</b></article>
        <article><small>Active Properties</small><strong>{propertyStats.active}</strong><b>Operational</b></article>
        <article><small>Total Units</small><strong>{propertyStats.units}</strong><b>Across portfolio</b></article>
        <article><small>Property Types</small><strong>{propertyStats.types}</strong><b>Classifications</b></article>
        <article><small>Locations</small><strong>{propertyCities.length}</strong><b>Cities / areas</b></article>
        <article><small>Showing</small><strong>{values.length}</strong><b>After filters</b></article>
      </section>
    )}
    <article className={`data-panel collection-panel ${tab === "properties" ? "property-register-table" : ""}`}>
      <header className="collection-title">
        <div>
          <p className="eyebrow">Live records</p>
          <h2>{labels[tab]}</h2>
        </div>
        <div className="collection-actions">
          {tab === "tenants" && canLease && (
            <button className="secondary-action" onClick={onAddTenant}>
              + Add tenant
            </button>
          )}
          {tab === "tenant-documents" && canLease && (
            <button className="secondary-action" onClick={onAddTenantDocument}>
              + Register document
            </button>
          )}
          {tab === "leases" && canLease && (
            <button className="secondary-action" onClick={onAddLease}>+ Create lease</button>
          )}
          {tab === "expenses" && canFinance && <button className="secondary-action" onClick={onAddExpense}>+ Record expense</button>}
          {tab === "budgets" && canFinance && <button className="secondary-action" onClick={onAddBudget}>+ Add budget line</button>}
          {tab === "service-charges" && canFinance && <button className="secondary-action" onClick={onAddServiceCharge}>+ Set up charge</button>}
          <input
            aria-label={`Search ${labels[tab]}`}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={tab === "properties" ? "Search properties, buildings, address…" : "Search records…"}
          />
        </div>
      </header>
      {tab === "properties" && (
        <div className="register-filter-bar">
          <div className="filter-group">
            <select aria-label="Property type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Property Types</option>
              {propertyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select aria-label="Location filter" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="all">All Locations</option>
              {propertyCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              {propertyStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div>
              <button className={`view-option ${registerView === "table" ? "active" : ""}`} aria-label="Table view" onClick={() => setRegisterView("table")}>☷</button>
              <button className={`view-option ${registerView === "map" ? "active" : ""}`} aria-label="Map view" onClick={() => setRegisterView("map")}>⌖</button>
            </div>
          </div>
          <span className="welcome-meta">Showing {values.length} of {rows.length} properties</span>
        </div>
      )}
      {tab === "properties" && registerView === "map" ? (
        <div className="property-map-panel">
          <div className="property-map-canvas" role="img" aria-label="Property portfolio map">
            {propertyRows.map((property, index) => {
              const lat = Number(property.latitude ?? -1.286);
              const lng = Number(property.longitude ?? 36.817);
              // Project Nairobi-ish coordinates into the canvas with light scatter for missing points.
              const top = property.latitude == null ? 20 + (index % 5) * 14 : Math.min(85, Math.max(8, ((lat + 1.4) / 0.4) * 100));
              const left = property.longitude == null ? 18 + (index % 6) * 12 : Math.min(90, Math.max(8, ((lng - 36.7) / 0.3) * 100));
              return (
                <span
                  className="property-map-pin"
                  key={property.id}
                  style={{ top: `${top}%`, left: `${left}%` }}
                  title={`${property.name} · ${property.city || "Location"}`}
                >
                  <b>{(property.name || "P").slice(0, 1)}</b>
                </span>
              );
            })}
          </div>
          <div className="property-map-legend">
            {propertyRows.slice(0, 6).map((property) => (
              <span key={property.id}>
                <b>{property.name}</b>
                {" · "}
                {property.city || "—"}
                {property.latitude != null ? ` · ${Number(property.latitude).toFixed(3)}, ${Number(property.longitude).toFixed(3)}` : " · coordinates pending"}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <DataTable headers={headers} rows={values} />
      )}
    </article>
    </>
  );
}

function ActionButtons({
  actions,
  run,
}: {
  actions: string[][];
  run: (path: string) => Promise<void>;
}) {
  if (!actions.length) return <span>—</span>;
  return (
    <div className="table-actions">
      {actions.map(([label, path]) => (
        <button key={path} onClick={() => void run(path)}>
          {label}
        </button>
      ))}
    </div>
  );
}
