import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { usePropertyContext } from "@/lib/property-context";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import {
  PropertyTab, Row, ID, PropertyRow, BuildingRow, UnitRow, ProjectRow,
  TenantRow, TenantDocumentRow, LeaseRow, RentScheduleRow, InvoiceRow,
  InvoicePreview, ReceiptRow, ReminderRow, BankTransactionRow, ExpenseRow,
  BudgetRow, ServiceChargeRow, ServiceChargeAllocationRow,
  ServiceChargeReconciliationRow, ReceiptAllocationRow, CreditNoteRow,
  AgingTenantRow, AgingAnalytics, FinancialAnalytics, ReportItem,
  DashboardData, RentSection, ScSection, TenancySection, FinancialsSection,
  BillingContext, BillingSection, ReceiptingSection,
  labels,
} from "../types/property.types";

export function defaultManualInvoiceSubtotal(invoiceType: string, monthlyRent: number, months = 1) {
  return invoiceType === "rent" && monthlyRent > 0 ? String(monthlyRent * months) : "";
}

export function usePropertyLogic({
  initialTab = "properties",
  standaloneOnboarding = false,
}: {
  initialTab?: string;
  standaloneOnboarding?: boolean;
}) {

  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const { selectProperty, activeProperty } = usePropertyContext();
  const canOperate = can("property.operations");
  const canLease = can("property.leasing");
  const canFinance = can("property.finance");
  const canApprove = can("property.approve");
  const searchParams = useSearchParams();
  const normalizeLegacyTab = (value: string): PropertyTab => {
    if (value === "financials") return "receipting";
    if (value === "tenancy") return "tenants";
    if (value === "rent") return "billing";
    if (value === "credit-notes") return "billing";
    if (value === "rent-schedules") return "receipting";
    if (value === "payments" || value === "receipts" || value === "receipt-allocations") return "receipting";
    return value as PropertyTab;
  };

  const [tab, setTab] = useState<PropertyTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && labels[q as PropertyTab]) return normalizeLegacyTab(q);
    }
    // Default directly to properties register inside Property Management module.
    if (!activeProperty && typeof window !== "undefined") return "properties";
    return normalizeLegacyTab(initialTab || "properties");
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rentInvoices, setRentInvoices] = useState<InvoiceRow[]>([]);
  const [analytics, setAnalytics] = useState<AgingAnalytics | null>(null);
  const [financial, setFinancial] = useState<FinancialAnalytics | null>(null);
  const [creditNotes, setCreditNotes] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [criticalServiceCharges, setCriticalServiceCharges] = useState<Row[]>([]);
  const [reminders, setReminders] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rentSection, setRentSection] = useState<RentSection>("invoices");
  const [billingSection, setBillingSection] = useState<BillingSection>("pipeline");
  const [receiptingSection, setReceiptingSection] = useState<ReceiptingSection>("receipts");
  const [tenancySection, setTenancySection] = useState<TenancySection>("occupancy");
  const [tenantsRows, setTenantsRows] = useState<Row[]>([]);
  const [leasesRows, setLeasesRows] = useState<Row[]>([]);
  const [tenantDocsRows, setTenantDocsRows] = useState<Row[]>([]);
  const [tenancyUnitsRows, setTenancyUnitsRows] = useState<Row[]>([]);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [portalTenant, setPortalTenant] = useState<TenantRow | null>(null);

  // Selecting a property row sets the global property context (visible across
  // Property / Facility / Companion modules via PropertyContextBar) and opens
  // the property dashboard. Only genuine property rows may set the scope —
  // tenants/units/leases also carry a `code`, so we require a property marker.
  const handleSelectRow = (row: Row) => {
    setSelectedRow(row);
    const isPropertyRow = Boolean(
      row && (
        row.property_type !== undefined
        || row.occupied !== undefined
        || row.units_count !== undefined
      ),
    );
    if (isPropertyRow) {
      selectProperty({
        id: String(row.id),
        name: String(row.name ?? row.property_name ?? "Property"),
        code: String(row.code ?? ""),
        status: String(row.status ?? "Active"),
        location: String(row.city ?? row.location ?? ""),
      });
      handleSelectTab("overview");
    }
  };

  const [showAddProperty, setShowAddProperty] = useState(standaloneOnboarding);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showBulkTenantUpload, setShowBulkTenantUpload] = useState(false);
  const [showEditTenant, setShowEditTenant] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);
  const [showAddLease, setShowAddLease] = useState(false);
  const [showRecordReceipt, setShowRecordReceipt] = useState(false);
  const [showInvoiceComposer, setShowInvoiceComposer] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showAddServiceCharge, setShowAddServiceCharge] = useState(false);
  const [financialIntake, setFinancialIntake] = useState<"budget" | "expense" | "credit-note" | null>(null);
  const [matchTarget, setMatchTarget] = useState<BankTransactionRow | null>(null);
  const [renewalTarget, setRenewalTarget] = useState<LeaseRow | null>(null);
  const [terminationTarget, setTerminationTarget] = useState<LeaseRow | null>(null);
  const [reconciliationTarget, setReconciliationTarget] = useState<ServiceChargeRow | null>(null);
  const [documentRejectTarget, setDocumentRejectTarget] = useState<TenantDocumentRow | null>(null);
  const [confirmVoidInvoice, setConfirmVoidInvoice] = useState<InvoiceRow | null>(null);
  const [confirmRejectBudget, setConfirmRejectBudget] = useState<BudgetRow | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<ID>("");
  const [wizardStep, setWizardStep] = useState(1);
  const [propertyData, setPropertyData] = useState<Record<string, string>>({});
  const [unitMix, setUnitMix] = useState<{ type: string; count: number; size: number }[]>([{ type: "", count: 1, size: 0 }]);

  const [tenantOptions, setTenantOptions] = useState<Row[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<Row[]>([]);
  const [unitOptions, setUnitOptions] = useState<Row[]>([]);
  const [invoiceOptions, setInvoiceOptions] = useState<Row[]>([]);
  const [receiptOptions, setReceiptOptions] = useState<Row[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Row[]>([]);
  const [leaseOptions, setLeaseOptions] = useState<LeaseRow[]>([]);
  const [handovers, setHandovers] = useState<Row[]>([]);
  const [billingContext, setBillingContext] = useState<BillingContext | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState({ number: "", lease: "", invoice_type: "rent", issued_on: "", due_on: "", subtotal: "", tax_rate: "0" });

  // The global sidebar uses query-string links so it can navigate directly to
  // a workspace section without remounting the module. Keep the local tab state
  // synchronized with that URL (including browser back/forward navigation).
  useEffect(() => {
    const requested = searchParams.get("tab") as PropertyTab | null;
    if (!requested || !labels[requested]) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSearch("");
      setSelectedRow(null);
      setRows([]);
      setTab(normalizeLegacyTab(requested));
      if (requested === "rent") setBillingSection("invoices");
      if (requested === "credit-notes") setBillingSection("credit-notes");
      if (requested === "rent-schedules") setReceiptingSection("schedules");
      if (requested === "receipt-allocations") setReceiptingSection("allocations");
      if (requested === "payments" || requested === "receipts") setReceiptingSection("receipts");
    });
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("action") !== "add-property") return;
    queueMicrotask(() => setShowAddProperty(true));
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("action") !== "add-tenant") return;
    queueMicrotask(() => {
      setTab("tenants");
      setShowAddTenant(true);
    });
  }, [searchParams]);

  const loadVersion = useRef(0);
  const failCount = useRef(0);

  const endpointFor = (t: PropertyTab): string => {
    const map: Partial<Record<PropertyTab, string>> = {
      properties: "properties",
      owners: "owners",
      buildings: "buildings",
      units: "units",
      projects: "projects",
      tenants: "tenants",
      "tenant-documents": "tenant-documents",
      leases: "leases",
      "rent-schedules": "rent-schedules",
      rent: "invoices",
      reminders: "invoice-reminders",
      receipts: "receipts",
      payments: "receipts",
      "receipt-allocations": "receipt-allocations",
      "bank-reconciliation": "bank-transactions",
      "credit-notes": "credit-notes",
      "service-profiles": "service-profiles",
      "service-charges": "service-charges",
      "service-charge-allocations": "service-charge-allocations",
      "service-charge-reconciliations": "service-charge-reconciliations",
      budgets: "budgets",
      expenses: "expenses",
    };
    return map[t] ?? "";
  };

  const rentEndpoint = (s: RentSection): string => {
    if (s === "receipts") return "receipts";
    if (s === "reminders") return "invoice-reminders";
    return "invoices";
  };

  const loadData = useCallback(async () => {
    if (!organizationId || standaloneOnboarding) return;
    if (tab === "tenancy-reports" || tab === "financial-reports" || tab === "tickets" || tab === "calendar" || tab === "feedback-qr") {
      setLoading(false);
      return;
    }
    if (tab === "billing" && billingSection === "pipeline") {
      setLoading(false);
      return;
    }
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    failCount.current = 0;
    const q = encodeURIComponent(search);
    const fail = () => {
      if (version !== loadVersion.current) return;
      failCount.current++;
      if (failCount.current >= 3) {
        setError("Data could not be loaded after multiple attempts. Please check your connection and retry.");
      } else {
        setError("Property data could not be loaded. Please retry.");
      }
    };
    try {
      if (tab === "overview" || tab === "owner-portal" || tab === "forecast") {
        const res = await apiFetch("/property/dashboard/", {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setDashboard(data as DashboardData);
      } else if (tab === "arrears") {
        const [agingRes, reminderRes] = await Promise.all([
          apiFetch(`/property/analytics/aging/?search=${q}`, {}, organizationId),
          apiFetch("/property/invoice-reminders/?search=", {}, organizationId),
        ]);
        if (!agingRes.ok) { fail(); return; }
        const agingData = await agingRes.json();
        if (version !== loadVersion.current) return;
        setAnalytics(agingData as AgingAnalytics);
        setRows(((agingData as AgingAnalytics).tenants ?? []) as Row[]);
        if (reminderRes.ok) {
          const reminderData = await reminderRes.json().catch(() => []);
          setReminders(Array.isArray(reminderData) ? reminderData as Row[] : []);
        }
      } else if (tab === "billing") {
        if (billingSection === "invoices") {
          const [listRes, agingRes] = await Promise.all([
            apiFetch(`/property/invoices/?search=${q}`, {}, organizationId),
            apiFetch("/property/analytics/aging/?search=", {}, organizationId),
          ]);
          if (!listRes.ok) { fail(); return; }
          const listData = await listRes.json();
          if (version !== loadVersion.current) return;
          const list = Array.isArray(listData) ? listData as Row[] : [];
          setRows(list);
          setRentInvoices(list as InvoiceRow[]);
          if (agingRes.ok) {
            const agingData = await agingRes.json().catch(() => null);
            if (agingData) setAnalytics(agingData as AgingAnalytics);
          }
        } else if (billingSection === "credit-notes") {
          const res = await apiFetch(`/property/credit-notes/?search=${q}`, {}, organizationId);
          if (!res.ok) { fail(); return; }
          const data = await res.json();
          if (version !== loadVersion.current) return;
          setRows(Array.isArray(data) ? data as Row[] : []);
          setCreditNotes(Array.isArray(data) ? data as Row[] : []);
        }
      } else if (tab === "receipting") {
        if (receiptingSection === "schedules") {
          const res = await apiFetch(`/property/rent-schedules/?search=${q}`, {}, organizationId);
          if (!res.ok) { fail(); return; }
          const data = await res.json();
          if (version !== loadVersion.current) return;
          setRows(Array.isArray(data) ? data as Row[] : []);
        } else if (receiptingSection === "allocations") {
          const res = await apiFetch(`/property/receipt-allocations/?search=${q}`, {}, organizationId);
          if (!res.ok) { fail(); return; }
          const data = await res.json();
          if (version !== loadVersion.current) return;
          setRows(Array.isArray(data) ? data as Row[] : []);
        } else if (receiptingSection === "credit-notes") {
          const res = await apiFetch(`/property/credit-notes/?search=${q}`, {}, organizationId);
          if (!res.ok) { fail(); return; }
          const data = await res.json();
          if (version !== loadVersion.current) return;
          const notes = Array.isArray(data) ? data as Row[] : [];
          setRows(notes);
          setCreditNotes(notes);
        } else {
          const listRes = await apiFetch(`/property/receipts/?search=${q}`, {}, organizationId);
          if (!listRes.ok) { fail(); return; }
          const listData = await listRes.json();
          if (version !== loadVersion.current) return;
          setRows(Array.isArray(listData) ? listData as Row[] : []);
        }
      } else if (tab === "reports") {
        const res = await apiFetch(`/property/analytics/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows((data as { reports?: Row[] }).reports ?? []);
      } else if (tab === "rent") {
        if (rentSection === "arrears") {
          const agingRes = await apiFetch("/property/analytics/aging/?search=", {}, organizationId);
          if (agingRes.ok) {
            const agingData = await agingRes.json();
            if (version !== loadVersion.current) return;
            setAnalytics(agingData as AgingAnalytics);
            setRows(((agingData as AgingAnalytics).tenants ?? []) as Row[]);
          } else {
            setRows([]);
          }
        } else {
          const [listRes, agingRes] = await Promise.all([
            apiFetch(`/property/${rentEndpoint(rentSection)}/?search=${q}`, {}, organizationId),
            apiFetch("/property/analytics/aging/?search=", {}, organizationId),
          ]);
          if (!listRes.ok) { fail(); return; }
          const listData = await listRes.json();
          if (version !== loadVersion.current) return;
          const list = Array.isArray(listData) ? listData as Row[] : [];
          setRows(list);
          if (agingRes.ok) {
            const agingData = await agingRes.json().catch(() => null);
            if (agingData) setAnalytics(agingData as AgingAnalytics);
          }
          if (rentSection === "invoices" || rentSection === "ledger") {
            setRentInvoices(list as InvoiceRow[]);
          }
        }
      } else if (tab === "expenses") {
        const [listRes, finRes] = await Promise.all([
          apiFetch(`/property/expenses/?search=${q}`, {}, organizationId),
          apiFetch("/property/analytics/income-expenses/?search=", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(listData) ? listData as Row[] : []);
        if (finRes.ok) {
          const finData = await finRes.json().catch(() => null);
          if (finData) setFinancial(finData as FinancialAnalytics);
        }
      } else if (tab === "receipts" || tab === "payments") {
        const [listRes, cnRes] = await Promise.all([
          apiFetch(`/property/receipts/?search=${q}`, {}, organizationId),
          apiFetch("/property/credit-notes/?search=", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(listData) ? listData as Row[] : []);
        if (cnRes.ok) {
          const cnData = await cnRes.json().catch(() => []);
          setCreditNotes(Array.isArray(cnData) ? cnData as Row[] : []);
        }
      } else if (tab === "tenancy") {
        const [unitsRes, tenantsRes, leasesRes, docsRes, ageRes] = await Promise.all([
          apiFetch(`/property/units/?search=${q}`, {}, organizationId),
          apiFetch(`/property/tenants/?search=${q}`, {}, organizationId),
          apiFetch(`/property/leases/?search=${q}`, {}, organizationId),
          apiFetch(`/property/tenant-documents/?search=${q}`, {}, organizationId),
          apiFetch("/property/analytics/aging/?search=", {}, organizationId),
        ]);
        if (!unitsRes.ok || !tenantsRes.ok || !leasesRes.ok || !docsRes.ok) { fail(); return; }
        const unitsData = await unitsRes.json();
        const tenantsData = await tenantsRes.json();
        const leasesData = await leasesRes.json();
        const docsData = await docsRes.json();
        if (version !== loadVersion.current) return;
        const tenantsList = Array.isArray(tenantsData) ? tenantsData as Row[] : [];
        const leasesList = Array.isArray(leasesData) ? leasesData as Row[] : [];
        const docsList = Array.isArray(docsData) ? docsData as Row[] : [];
        setTenancyUnitsRows(Array.isArray(unitsData) ? unitsData as Row[] : []);
        if (ageRes.ok) {
          const ageData = await ageRes.json();
          const ageTenants = (ageData as AgingAnalytics).tenants ?? [];
          const byName = new Map(ageTenants.map((t) => [String(t.tenant), t]));
          const merged = tenantsList.map((r) => ({ ...r, ...(byName.get(String((r as TenantRow).name)) ?? {}) }));
          setTenantsRows(merged);
        } else {
          setTenantsRows(tenantsList);
        }
        setLeasesRows(leasesList);
        setTenantDocsRows(docsList);
      } else if (tab === "properties") {
        const [listRes, dashRes] = await Promise.all([
          apiFetch(`/property/properties/?search=${q}`, {}, organizationId),
          apiFetch("/property/dashboard/", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const list = Array.isArray(listData) ? listData as Row[] : [];
        if (dashRes.ok) {
          const dash = await dashRes.json();
          const portfolio = (dash as DashboardData).portfolio ?? [];
          const byId = new Map(portfolio.map((p) => [String(p.id), p]));
          const merged = list.map((p) => ({ ...p, ...(byId.get(String((p as PropertyRow).id)) ?? {}) }));
          if (version === loadVersion.current) setRows(merged);
        } else if (version === loadVersion.current) {
          setRows(list);
        }
      } else if (tab === "handover-exit") {
        const [hRes, cRes, lRes] = await Promise.all([
          apiFetch("/property/handovers/?search=", {}, organizationId),
          apiFetch("/property/exit-clearances/?search=", {}, organizationId),
          apiFetch("/property/leases/?search=", {}, organizationId),
        ]);
        if (!hRes.ok || !cRes.ok) { fail(); return; }
        const hData = await hRes.json();
        const cData = await cRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(hData) ? hData as Row[] : []);
        setHandovers(Array.isArray(cData) ? cData as Row[] : []);
        if (lRes.ok) {
          const lData = await lRes.json();
          setLeaseOptions(Array.isArray(lData) ? (lData as unknown as LeaseRow[]) : []);
        }
      } else if (tab === "tenants" || tab === "leases") {
        const [listRes, ageRes] = await Promise.all([
          apiFetch(`/property/${endpointFor(tab)}/?search=${q}`, {}, organizationId),
          apiFetch("/property/analytics/aging/?search=", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const list = Array.isArray(listData) ? listData as Row[] : [];
        if (ageRes.ok) {
          const ageData = await ageRes.json();
          const ageTenants = (ageData as AgingAnalytics).tenants ?? [];
          const byName = new Map(ageTenants.map((t) => [String(t.tenant), t]));
          const merged = list.map((r) => ({ ...r, ...(byName.get(String((r as TenantRow).name)) ?? {}) }));
          if (version === loadVersion.current) setRows(merged);
        } else if (version === loadVersion.current) {
          setRows(list);
        }
      } else if (tab === "service-profiles") {
        const res = await apiFetch(`/facility/service-profiles/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? (data as Row[]) : ((data as { results?: Row[] }).results ?? []));
      } else if (tab === "service-charges") {
        const res = await apiFetch(`/property/service-charges/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data as Row[] : []);
      } else if (tab === "fees") {
        const res = await apiFetch(`/property/service-charges/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data as Row[] : []);
      } else if (tab === "critical-dates") {
        const [leasesRes, scRes] = await Promise.all([
          apiFetch(`/property/leases/?search=${q}`, {}, organizationId),
          apiFetch(`/property/service-charges/?search=${q}`, {}, organizationId),
        ]);
        if (!leasesRes.ok || !scRes.ok) { fail(); return; }
        const leasesData = await leasesRes.json();
        const scData = await scRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(leasesData) ? leasesData as Row[] : []);
        setLeasesRows(Array.isArray(leasesData) ? leasesData as Row[] : []);
        setCriticalServiceCharges(Array.isArray(scData) ? scData as Row[] : []);
      } else {
        const ep = endpointFor(tab);
        const res = await apiFetch(`/property/${ep}/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data as Row[] : []);
      }
    } catch {
      if (version === loadVersion.current) {
        failCount.current++;
        if (failCount.current >= 3) {
          setError("Unable to connect after multiple attempts. Please check your connection and retry.");
        } else {
          setError("Unable to connect to property management service.");
        }
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, organizationId, activeProperty?.id, rentSection, billingSection, receiptingSection, standaloneOnboarding]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  useEffect(() => {
    if (tab === "critical-dates" && organizationId) {
      apiFetch("/facility/contractors/", {}, organizationId).then(r => r.ok ? r.json() : []).then((d) => setContractors(Array.isArray(d) ? d : []));
      apiFetch("/facility/inspections/", {}, organizationId).then(r => r.ok ? r.json() : []).then((d) => setInspections(Array.isArray(d) ? d : []));
    }
  }, [tab, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    if (showAddLease || showUploadDoc || showRecordReceipt) {
      void apiFetch("/property/tenants/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setTenantOptions(Array.isArray(d) ? d : []));
    }
    if (showRecordReceipt) {
      void apiFetch("/property/owners/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setOwnerOptions(Array.isArray(d) ? d : []));
    }
    if (showInvoiceComposer) {
      void apiFetch("/property/leases/?status=active&search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((leases: unknown) => {
          const items = Array.isArray(leases) ? leases : [];
          setLeaseOptions(items as LeaseRow[]);
          // Auto-select the first lease and auto-fill rent so the user never
          // has to touch the dropdown when there's only one active lease.
          if (items.length > 0) {
            setInvoiceDraft((prev) => {
              if (prev.lease) return prev; // user already changed it
              const first = items[0] as LeaseRow;
              const rentVal = Number(first.monthly_rent ?? 0);
              const months = billingContext?.months_count || 1;
              return {
                ...prev,
                lease: String(first.id),
                subtotal: defaultManualInvoiceSubtotal(prev.invoice_type, rentVal, months) || prev.subtotal,
              };
            });
          }
        });
    }
    if (showAddServiceCharge || financialIntake === "budget" || financialIntake === "expense") {
      void apiFetch("/property/properties/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setPropertyOptions(Array.isArray(d) ? d : []));
    }
    if (financialIntake === "credit-note") {
      void apiFetch("/property/invoices/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setInvoiceOptions(Array.isArray(d) ? d.filter((invoice: InvoiceRow) => Number(invoice.balance ?? 0) > 0 && ["issued", "overdue", "partial"].includes(String(invoice.status))) : []));
    }
    if (showAddLease) {
      void apiFetch("/property/units/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUnitOptions(Array.isArray(d) ? d : []));
    }
    if (showRecordReceipt) {
      void apiFetch("/property/invoices/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setInvoiceOptions(Array.isArray(d) ? d : []));
    }
    if (matchTarget) {
      void apiFetch("/property/receipts/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setReceiptOptions(Array.isArray(d) ? d : []));
    }
  }, [showAddLease, showUploadDoc, showRecordReceipt, showInvoiceComposer, showAddServiceCharge, financialIntake, matchTarget, organizationId, activeProperty?.id, billingContext?.months_count]);

  const openInvoiceComposer = (ctx?: BillingContext | null) => {
    setBillingContext(ctx ?? null);
    const issued = new Date();
    const due = new Date(issued);
    due.setDate(due.getDate() + 30);
    setInvoiceDraft({
      number: "",
      lease: "", invoice_type: "rent",
      issued_on: issued.toISOString().slice(0, 10), due_on: due.toISOString().slice(0, 10),
      subtotal: "", tax_rate: "0",
    });
    setInvoicePreview(null);
    setShowInvoiceComposer(true);
  };

  /** Fetch the suggested billable amount for a non-rent category from billing
   *  profiles / service-charge allocations — the same sources the bulk pipeline
   *  uses. Keeps single and bulk invoicing aligned. */
  const fetchSuggestedSubtotalForType = async (invoiceType: string, leaseId: string, months: number) => {
    if (!organizationId || !leaseId || invoiceType === "rent") return;
    try {
      const lease = leaseOptions.find((l) => String(l.id) === leaseId) as Record<string, unknown> | undefined;
      const unitId = lease?.unit as string | undefined;
      let total = 0;
      let found = false;
      // Try billing profiles first (recurring service charges, utilities, etc.).
      const profileRes = await apiFetch(`/property/billing-profiles/?lease=${leaseId}`, {}, organizationId);
      if (profileRes.ok) {
        const profiles = (await profileRes.json()) as Array<Record<string, unknown>>;
        const typeKey = invoiceType.replace(/-/g, "_");
        const matched = profiles.filter((p) => {
          const code = String((p.billing_item as Record<string, unknown>)?.code ?? p.billing_item ?? "").toLowerCase();
          const cat = String(p.income_category ?? (p.billing_item as Record<string, unknown>)?.income_category ?? "").toLowerCase();
          return code.includes(typeKey) || cat.includes(typeKey) || (code.includes("service_charge") && typeKey === "service_charge") || (code.includes("utility") && typeKey === "utility");
        });
        if (matched.length) {
          total = matched.reduce((sum, p) => sum + Number(p.amount ?? p.rate ?? 0), 0) * months;
          found = true;
        }
      }
      // Fallback to service-charge allocations for the unit.
      if (!found && invoiceType === "service_charge" && unitId) {
        const scRes = await apiFetch(`/property/service-charge-allocations/?unit=${unitId}`, {}, organizationId);
        if (scRes.ok) {
          const allocs = (await scRes.json()) as Array<Record<string, unknown>>;
          if (allocs.length) {
            total = allocs.reduce((sum, a) => sum + Number(a.monthly_amount ?? a.annual_amount ?? 0) / (a.annual_amount ? 12 : 1), 0) * months;
            found = true;
          }
        }
      }
      // Fallback to unit charge rules.
      if (!found && unitId) {
        const ruleRes = await apiFetch(`/property/unit-charge-rules/?unit=${unitId}`, {}, organizationId);
        if (ruleRes.ok) {
          const rules = (await ruleRes.json()) as Array<Record<string, unknown>>;
          const matched = rules.filter((r) => {
            const code = String((r.billing_item as Record<string, unknown>)?.code ?? "").toLowerCase();
            return code === invoiceType.replace(/-/g, "_") || code.includes(invoiceType.replace(/-/g, "_"));
          });
          if (matched.length) {
            total = matched.reduce((sum, r) => sum + Number((r as Record<string, unknown>).rate ?? (r as Record<string, unknown>).amount ?? 0), 0) * months;
            found = true;
          }
        }
      }
      // Fallback to lease metadata (onboarding stores 25/sqft × area).
      // Blueshield case: no billing profile, but lease.metadata has 47900 directly.
      if (!found && lease && invoiceType === "service_charge") {
        const meta = (lease as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
        const monthly = meta?.monthly_service_charge_excl_vat ?? meta?.service_charge ?? meta?.serviceCharge;
        if (monthly != null && String(monthly).trim() !== "") {
          const v = Number(monthly);
          if (!Number.isNaN(v) && v > 0) {
            total = v * months;
            found = true;
          }
        } else {
          const rate = Number(meta?.service_charge_rate_per_sqft ?? 0);
          const area = Number((lease as Record<string, unknown>).area ?? 0);
          if (rate > 0 && area > 0) {
            total = rate * area * months;
            found = true;
          }
        }
      }
      if (found && total > 0) {
        setInvoiceDraft((prev) => (prev.invoice_type === invoiceType && prev.lease === leaseId ? { ...prev, subtotal: String(Math.round(total)) } : prev));
        setInvoicePreview(null);
      }
    } catch {
      // Leave subtotal as-is (empty/cleared) on fetch failure; user enters manually.
    }
  };

  const updateInvoiceDraft = (field: keyof typeof invoiceDraft, value: string) => {
    setInvoiceDraft((current) => {
      const updated = { ...current, [field]: value };
      if (field === "lease" && value) {
        const selectedLease = leaseOptions.find((l) => String(l.id) === value);
        if (selectedLease) {
          const rentVal = Number(selectedLease.monthly_rent ?? 0);
          const months = billingContext?.months_count || 1;
          updated.subtotal = defaultManualInvoiceSubtotal(current.invoice_type, rentVal, months);
          if (current.invoice_type !== "rent") {
            void fetchSuggestedSubtotalForType(current.invoice_type, value, months);
          }
          // Always ensure due_on is set relative to issued_on
          const issued = new Date(current.issued_on || new Date());
          const due = new Date(issued);
          due.setDate(due.getDate() + 5);
          updated.due_on = due.toISOString().slice(0, 10);
        }
      }
      if (field === "invoice_type") {
        const selectedLease = leaseOptions.find((lease) => String(lease.id) === current.lease);
        const months = billingContext?.months_count || 1;
        const rentVal = Number(selectedLease?.monthly_rent ?? 0);
        // Rent is the only amount carried directly by the lease.
        updated.subtotal = defaultManualInvoiceSubtotal(value, rentVal, months);
        // For non-rent categories, fetch the correct billable amount from the
        // same sources the bulk pipeline uses so both flows stay aligned.
        if (value !== "rent" && selectedLease) {
          void fetchSuggestedSubtotalForType(value, String(selectedLease.id), months);
        }
      }
      return updated;
    });
    setInvoicePreview(null);
  };

  async function previewInvoice() {
    if (!organizationId || !invoiceDraft.lease || Number(invoiceDraft.subtotal) <= 0) {
      setError("Select a lease and enter a positive subtotal before previewing the invoice.");
      return;
    }
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/invoices/preview/", {
      method: "POST",
      body: JSON.stringify({
        lease: invoiceDraft.lease, invoice_type: invoiceDraft.invoice_type,
        subtotal: Number(invoiceDraft.subtotal), tax_rate: Number(invoiceDraft.tax_rate), due_on: invoiceDraft.due_on,
      }),
    }, organizationId);
    if (response.ok) {
      setInvoicePreview(await response.json() as InvoicePreview);
      setError("");
    } else {
      const body = await response.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Invoice preview failed.");
    }
  }

  async function submitInvoiceDraft(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!organizationId || !invoiceDraft.lease || Number(invoiceDraft.subtotal) <= 0) {
      setError("Select a lease and enter a positive subtotal before saving the invoice.");
      return;
    }
    setError("");
    const selectedLease = leaseOptions.find((l) => String(l.id) === invoiceDraft.lease);
    const propName = invoicePreview?.property ?? (selectedLease as unknown as Record<string, unknown>)?.property_name ?? "";
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/invoices/", {
      method: "POST",
      body: JSON.stringify({
        lease: invoiceDraft.lease,
        invoice_type: invoiceDraft.invoice_type,
        issued_on: invoiceDraft.issued_on,
        due_on: invoiceDraft.due_on,
        subtotal: Number(invoiceDraft.subtotal),
        tax_rate: Number(invoiceDraft.tax_rate),
        metadata: {
          source: "manual",
          property_name: propName,
          billing_context: billingContext ? {
            mode: billingContext.mode,
            period_start: billingContext.period_start,
            period_end: billingContext.period_end,
            months_count: billingContext.months_count,
            label: billingContext.label,
          } : undefined,
        },
      }),
    }, organizationId);
    if (response.ok) {
      setShowInvoiceComposer(false);
      setInvoicePreview(null);
      await loadData();
      setRentSection("invoices");
      setTab("rent");
    } else {
      const body = await response.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Invoice draft could not be saved.");
    }
  }

  async function submitAddProperty() {
    const payload = {
      name: String(propertyData.name ?? "").trim(),
      property_type: String(propertyData.type ?? "commercial"),
      city: String(propertyData.city ?? ""),
      address: String(propertyData.address ?? ""),
      country: String(propertyData.country ?? "KE"),
      status: "draft",
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/properties/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      const prop = await res.json();
      for (const unit of unitMix) {
        if (unit.count > 0 && unit.type.trim()) {
          await apiFetch(`/property/properties/${prop.id}/bulk-units/`, {
            method: "POST",
            headers: { "X-CSRFToken": csrfFromCookie() },
            body: JSON.stringify({
              count: unit.count,
              start: 1,
              prefix: unit.type.trim().replace(/\s+/g, "-").toUpperCase().slice(0, 20),
              unit_type: unit.type.trim(),
              area: unit.size || null,
            }),
          }, organizationId);
        }
      }
      setShowAddProperty(false);
      setWizardStep(1);
      setPropertyData({});
      setUnitMix([{ type: "", count: 1, size: 0 }]);
      setTab("properties");
      loadData();
    } else {
      setError("Property save failed. Check required fields.");
    }
  }

  async function submitEditTenant(data: Record<string, unknown>) {
    if (!editTenant?.id || !organizationId) return;
    try {
      const response = await apiFetch(`/property/tenants/${editTenant.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, organizationId);
      if (response.ok) {
        setShowEditTenant(false);
        setEditTenant(null);
        loadData();
      } else {
        const body = await response.json().catch(() => ({}));
        setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Tenant update failed.");
      }
    } catch {
      setError("Tenant update failed. Check your connection and retry.");
    }
  }

  async function submitAddLease(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      reference: String(raw.reference ?? "").trim(),
      unit: String(raw.unit ?? ""),
      tenant: String(raw.tenant ?? ""),
      starts_on: String(raw.starts_on ?? ""),
      ends_on: String(raw.ends_on ?? ""),
      monthly_rent: Number(raw.monthly_rent ?? 0),
      deposit: Number(raw.deposit ?? 0),
      escalation_percent: Number(raw.escalation_percent ?? 0),
      escalation_interval_months: Number(raw.escalation_interval_months ?? 12),
      billing_day: Number(raw.billing_day ?? 1),
      status: "draft",
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/leases/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowAddLease(false);
      setTab("leases");
      loadData();
    } else {
      setError("Lease registration failed.");
    }
  }

  async function submitUploadDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      tenant: String(raw.tenant ?? ""),
      document_type: String(raw.document_type ?? ""),
      document_number: String(raw.document_number ?? ""),
      file_url: String(raw.file_url ?? ""),
      issued_on: raw.issued_on ? String(raw.issued_on) : null,
      expires_on: raw.expires_on ? String(raw.expires_on) : null,
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/tenant-documents/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowUploadDoc(false);
      setTab("tenant-documents");
      loadData();
    } else {
      setError("Document upload failed. Check the tenant and required fields.");
    }
  }

  async function submitRecordReceipt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payer = String(raw.payer ?? "");
    const [payerTypeFromPayer, payerId] = payer.split(":", 2);
    const payerType = String(raw.payer_type ?? "tenant");
    if (!payerId || !["tenant", "landlord"].includes(payerType) || payerType !== payerTypeFromPayer) {
      setError("Select a payer that matches the payer type (Tenant or Landlord).");
      return;
    }
    const payload = {
      payer_type: payerType,
      tenant: payerType === "tenant" ? payerId : null,
      owner: payerType === "landlord" ? payerId : null,
      invoice: raw.invoice ? String(raw.invoice) : null,
      received_on: String(raw.received_on ?? ""),
      amount: Number(raw.amount ?? 0),
      payment_method: String(raw.payment_method ?? "bank_transfer"),
      external_reference: String(raw.external_reference ?? ""),
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/receipts/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowRecordReceipt(false);
      // Switch to the ledger and let its property-scoped effect fetch the
      // current data. Calling the previous loader here races that fetch.
      setReceiptingSection("receipts");
      setTab("receipting");
    } else {
      setError("Receipt recording failed.");
    }
  }

  async function submitBankMatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matchTarget) return;
    const form = new FormData(e.currentTarget);
    const receiptId = String(form.get("receipt") ?? "");
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/bank-transactions/${matchTarget.id}/match/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ receipt: receiptId }),
    }, organizationId);
    if (res.ok) {
      setMatchTarget(null);
      setTab("bank-reconciliation");
      loadData();
    } else {
      setError("Bank match failed. Receipt amount must equal the transaction.");
    }
  }

  async function submitServiceCharge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      property: String(form.get("property") ?? ""),
      name: String(form.get("name") ?? "").trim(),
      method: String(form.get("method") ?? "area"),
      starts_on: String(form.get("starts_on") ?? ""),
      annual_budget: Number(form.get("annual_budget") ?? 0),
      is_active: true,
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/service-charges/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowAddServiceCharge(false);
      setTab("service-charges");
      loadData();
    } else {
      setError("Service charge setup failed. Check the property, dates, and budget.");
    }
  }

  async function submitFinancialIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!financialIntake) return;
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const endpoint = financialIntake === "credit-note" ? "credit-notes" : financialIntake === "expense" ? "expenses" : "budgets";
    const payload = financialIntake === "credit-note"
      ? {
          number: String(raw.number ?? "").trim() || undefined,
          invoice: String(raw.invoice ?? ""),
          issued_on: String(raw.issued_on ?? "") || new Date().toISOString().slice(0, 10),
          amount: Number(raw.amount ?? 0),
          reason: String(raw.reason ?? "").trim(),
        }
      : financialIntake === "expense"
        ? {
            property: String(raw.property ?? ""), supplier: String(raw.supplier ?? "").trim(),
            invoice_number: String(raw.invoice_number ?? "").trim(), category: String(raw.category ?? "").trim(),
            incurred_on: String(raw.incurred_on ?? ""), description: String(raw.description ?? "").trim(), amount: Number(raw.amount ?? 0),
          }
        : {
            property: String(raw.property ?? ""), year: Number(raw.year ?? new Date().getFullYear()),
            category: String(raw.category ?? "").trim(), amount: Number(raw.amount ?? 0),
          };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/${endpoint}/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      const destination: PropertyTab = financialIntake === "credit-note" ? "credit-notes" : financialIntake === "expense" ? "expenses" : "budgets";
      setFinancialIntake(null);
      setTab(destination);
      loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      const message = Object.values(body as Record<string, unknown>).flat().join(" ");
      setError(message || "The financial record could not be saved.");
    }
  }

  async function generateServiceChargeAllocations(row: ServiceChargeRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/service-charges/${row.id}/generate-allocations/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      const allocations = await res.json();
      setSearch("");
      setSelectedRow(null);
      setRows(Array.isArray(allocations) ? allocations : []);
      setTab("service-charge-allocations");
    } else {
      setError("Charge allocation failed. Confirm the property has eligible units.");
    }
  }

  async function submitServiceChargeReconciliation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reconciliationTarget) return;
    const form = new FormData(e.currentTarget);
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/service-charges/${reconciliationTarget.id}/reconcile/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ period_start: String(form.get("period_start") ?? ""), period_end: String(form.get("period_end") ?? "") }),
    }, organizationId);
    if (res.ok) {
      const reconciliation = await res.json();
      setReconciliationTarget(null);
      setRows([reconciliation as Row]);
      setTab("service-charge-reconciliations");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Service-charge reconciliation failed.");
    }
  }

  async function handleReviewReconciliation(row: ServiceChargeReconciliationRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/service-charge-reconciliations/${row.id}/review/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
    }, organizationId);
    if (res.ok) {
      const updated = await res.json();
      setRows((prev) => prev.map((r) => (r.id === row.id ? (updated as Row) : r)));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Failed to mark reconciliation as reviewed.");
    }
  }

  async function handleApproveReconciliation(row: ServiceChargeReconciliationRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/service-charge-reconciliations/${row.id}/approve/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
    }, organizationId);
    if (res.ok) {
      const updated = await res.json();
      setRows((prev) => prev.map((r) => (r.id === row.id ? (updated as Row) : r)));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Failed to approve reconciliation.");
    }
  }

  async function handleDownloadReconciliationPdf(row: ServiceChargeReconciliationRow) {
    const res = await apiFetch(`/property/service-charge-reconciliations/${row.id}/pdf/`, {}, organizationId);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `service-charge-reconciliation-${row.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  }

  async function submitDocumentRejection(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!documentRejectTarget) return;
    const form = new FormData(e.currentTarget);
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/tenant-documents/${documentRejectTarget.id}/reject/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ reason: String(form.get("reason") ?? "").trim() }),
    }, organizationId);
    if (res.ok) {
      setDocumentRejectTarget(null);
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Document rejection failed.");
    }
  }

  async function runPropertyAction(endpoint: string, id: ID, action: string, failureMessage: string, payload: Record<string, unknown> = {}) {
    if (!id) { await loadData(); return; }
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/${endpoint}/${id}/${action}/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || failureMessage);
    }
  }

  async function downloadReportCSV(key: string, start?: string, end?: string) {
    const query = new URLSearchParams(); if (start) query.set("start", start); if (end) query.set("end", end);
    const res = await apiFetch(`/property/analytics/exports/${key}/?${query.toString()}`, {}, organizationId);
    if (!res.ok) {
      setError("Unable to generate report download.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `property-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadApiFile(path: string, fallbackName: string) {
    const res = await apiFetch(path, {}, organizationId);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Unable to generate document.");
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const name = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  }

  function downloadReport(key: string, output: "csv" | "pdf" | "xlsx" = "csv", start?: string, end?: string) {
    if (output === "csv") { void downloadReportCSV(key, start, end); return; }
    const query = new URLSearchParams({ output }); if (start) query.set("start", start); if (end) query.set("end", end);
    void downloadApiFile(`/property/analytics/exports/${key}/?${query.toString()}`, `property-${key}.${output}`);
  }

  const downloadInvoicePdf = (row: InvoiceRow) => void downloadApiFile(`/property/invoices/${row.id}/pdf/`, `invoice-${row.number ?? row.id}.pdf`);
  const downloadReceiptPdf = (row: ReceiptRow) => void downloadApiFile(`/property/receipts/${row.id}/pdf/`, `receipt-${row.number ?? row.id}.pdf`);
  const downloadTenantStatement = (row: TenantRow) => void downloadApiFile(`/property/tenants/${row.id}/statement.pdf/`, `tenant-statement-${row.code ?? row.id}.pdf`);

  const handleDeleteTenant = useCallback(async (tenant: TenantRow) => {
    if (!organizationId) return;
    if (!window.confirm(`Are you sure you want to delete tenant "${tenant.name}" (${tenant.code})? This will permanently delete duplicate or erroneous records that have no active leases or invoices.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/property/tenants/${tenant.id}/`, {
        method: "DELETE",
      }, organizationId);
      if (res.ok) {
        setError("");
        if (selectedRow && String(selectedRow.id) === String(tenant.id)) {
          setSelectedRow(null);
        }
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Cannot delete tenant. Active leases, invoices or posted transactions exist.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to delete tenant");
    }
  }, [organizationId, selectedRow, loadData, setError]);

  const handleActivateTenant = useCallback(async (tenant: TenantRow) => {
    if (!organizationId) return;
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/property/tenants/${tenant.id}/activate/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({}),
      }, organizationId);
      if (res.ok) {
        setError("");
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Failed to activate tenant and leases.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to activate tenant");
    }
  }, [organizationId, loadData, setError]);

  const handleBulkActivateTenants = useCallback(async (tenantIds: string[]) => {
    if (!organizationId || !tenantIds.length) return;
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/property/tenants/bulk-activate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ tenant_ids: tenantIds }),
      }, organizationId);
      if (res.ok) {
        setError("");
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Failed to bulk activate tenants.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to bulk activate tenants");
    }
  }, [organizationId, loadData, setError]);

  const handleBulkActivateLeases = useCallback(async (leaseIds: string[]) => {
    if (!organizationId || !leaseIds.length) return;
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/property/leases/bulk-activate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ lease_ids: leaseIds }),
      }, organizationId);
      if (res.ok) {
        setError("");
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Failed to bulk activate leases.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to bulk activate leases");
    }
  }, [organizationId, loadData, setError]);

  const downloadTenancyTemplate = () => {
    void downloadReportCSV("lease-expiry");
  };

  const handleInvoiceAction = (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => {
    if (action === "void") {
      handleVoidInvoicePrompt(row);
      return;
    }
    void runPropertyAction("invoices", row.id, action, `Invoice ${action.replace(/-/g, " ")} failed.`);
  };

  async function runLeaseAction(row: LeaseRow, action: "activate" | "renew" | "terminate") {
    if (action === "renew") { setRenewalTarget(row); return; }
    if (action === "terminate") { setTerminationTarget(row); return; }
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/leases/${row.id}/${action}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      loadData();
    } else {
      setError("Lease action failed. Confirm the lease is a draft.");
    }
  }

  async function submitLeaseRenewal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!renewalTarget) return;
    const form = new FormData(e.currentTarget);
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/leases/${renewalTarget.id}/renew/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        reference: String(form.get("reference") ?? "").trim(),
        starts_on: String(form.get("starts_on") ?? renewalTarget.ends_on ?? ""),
        ends_on: String(form.get("ends_on") ?? ""),
        monthly_rent: Number(form.get("monthly_rent") ?? 0),
      }),
    }, organizationId);
    if (res.ok) {
      setRenewalTarget(null);
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Lease renewal failed.");
    }
  }

  async function confirmLeaseTermination() {
    if (!terminationTarget) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/leases/${terminationTarget.id}/terminate/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      setTerminationTarget(null);
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Lease termination failed.");
    }
  }

  async function sendReminder(row: ReminderRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/invoice-reminders/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        invoice: String(row.invoice ?? ""),
        channel: "portal",
      }),
    }, organizationId);
    if (res.ok) {
      loadData();
    } else {
      setError("Reminder could not be sent.");
    }
  }

  async function sendInvoiceReminder(row: InvoiceRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/invoices/${row.id}/send-reminder/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({ channel: "portal" }),
    }, organizationId);
    if (res.ok) {
      setError("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Invoice reminder could not be sent.");
    }
  }

  const navigateRemindersForTenant = (tenantName: string) => {
    setSearch(tenantName);
    setTab("reminders");
  };

  const openRecordReceipt = (invoiceId?: ID) => {
    setReceiptInvoice(invoiceId ?? "");
    setShowRecordReceipt(true);
  };

  const openTenantPortal = (row: Row) => {
    if (typeof window !== "undefined") {
      window.open(`/tenant-portal?tenant=${row.id}`, "_blank", "noopener,noreferrer");
    }
  };

  const downloadDocument = (row: Row) => {
    const url = String(row.file_url ?? "");
    if (!url) {
      setError("This document has no attached file URL.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSelectTab = (id: string) => {
    setSearch("");
    setSelectedRow(null);
    setRows([]);
    setTab(id as PropertyTab);
    // Update URL without full page reload
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).get("tab") as PropertyTab | null;
      if (next && labels[next]) setTab(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!standaloneOnboarding) return;
    document.body.classList.add("property-onboarding-mode");
    return () => document.body.classList.remove("property-onboarding-mode");
  }, [standaloneOnboarding]);

  const [todayStr, setTodayStr] = useState("");
  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const handleDownloadDoc = downloadDocument;
  const handleVerifyDoc = (row: Row) => void runPropertyAction("tenant-documents", row.id as ID, "verify", "Verification failed.");
  const handleRejectDocPrompt = (row: Row) => setDocumentRejectTarget(row as TenantDocumentRow);
  const handleSendReminder = (row: Row) => {
    if ("amount" in row || "invoice_type" in row) {
      void sendInvoiceReminder(row as InvoiceRow);
    } else {
      void sendReminder(row as ReminderRow);
    }
  };
  const handleGenerateScheduleInvoice = (schedule: RentScheduleRow, taxRate = 0) => {
    void runPropertyAction("rent-schedules", schedule.id, "generate-invoice", "Invoice generation failed.", { tax_rate: taxRate });
  };
  const handleVoidInvoicePrompt = (row: Row) => setConfirmVoidInvoice(row as InvoiceRow);
  const handleApproveBudget = (row: Row) => void runPropertyAction("budgets", row.id as ID, "approve", "Budget approval failed.");
  const handleRejectBudgetPrompt = (row: Row) => setConfirmRejectBudget(row as BudgetRow);
  const handleExportReport = (key: string, format?: "csv" | "pdf" | "xlsx", start?: string, end?: string) => {
    downloadReport(key, format, start, end);
  };
  const handleCreateBudget = (propId?: string | null) => {
    setFinancialIntake("budget");
  };
  const handleCreateExpense = (propId?: string | null) => {
    setFinancialIntake("expense");
  };
  const handleCreateCreditNote = (invoiceId?: string | null) => {
    setFinancialIntake("credit-note");
  };
  const [voidCreditNoteTarget, setVoidCreditNoteTarget] = useState<CreditNoteRow | null>(null);
  const handleVoidCreditNote = (cn: CreditNoteRow) => {
    setVoidCreditNoteTarget(cn);
  };
  const submitVoidCreditNote = async (reason: string) => {
    if (!voidCreditNoteTarget?.id || !organizationId) return;
    try {
      const res = await apiFetch(`/property/credit-notes/${voidCreditNoteTarget.id}/void/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }, organizationId);
      if (res.ok) {
        setVoidCreditNoteTarget(null);
        loadData();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Credit note void failed.");
      }
    } catch {
      setError("Credit note void failed. Check your connection and retry.");
    }
  };
  const handleQuickReceipt = (invoice: InvoiceRow) => {
    openRecordReceipt(invoice.id);
  };
  const handleInvoiceLeaseChange = (leaseId: string) => {
    updateInvoiceDraft("lease", leaseId);
  };
  const handleInvoiceTypeChange = (invoiceType: string) => {
    updateInvoiceDraft("invoice_type", invoiceType);
  };

  return {
    organizationId,
    activeProperty,
    selectProperty,
    canOperate,
    canLease,
    canFinance,
    canApprove,
    tab,
    setTab,
    dashboard,
    rows,
    rentInvoices,
    analytics,
    financial,
    creditNotes,
    reminders,
    contractors,
    inspections,
    criticalServiceCharges,
    search,
    setSearch,
    loading,
    error,
    rentSection,
    setRentSection,
    billingSection,
    setBillingSection,
    receiptingSection,
    setReceiptingSection,
    tenancySection,
    setTenancySection,
    tenantsRows,
    leasesRows,
    tenantDocsRows,
    tenancyUnitsRows,
    selectedRow,
    setSelectedRow,
    handleSelectRow,
    handleSelectTab,
    portalTenant,
    setPortalTenant,
    showAddProperty,
    setShowAddProperty,
    showAddTenant,
    setShowAddTenant,
    showBulkTenantUpload,
    setShowBulkTenantUpload,
    showEditTenant,
    setShowEditTenant,
    editTenant,
    setEditTenant,
    submitEditTenant,
    showAddLease,
    setShowAddLease,
    showRecordReceipt,
    setShowRecordReceipt,
    showInvoiceComposer,
    setShowInvoiceComposer,
    showUploadDoc,
    setShowUploadDoc,
    showAddServiceCharge,
    setShowAddServiceCharge,
    financialIntake,
    setFinancialIntake,
    matchTarget,
    setMatchTarget,
    renewalTarget,
    setRenewalTarget,
    terminationTarget,
    setTerminationTarget,
    reconciliationTarget,
    setReconciliationTarget,
    documentRejectTarget,
    setDocumentRejectTarget,
    confirmVoidInvoice,
    setConfirmVoidInvoice,
    confirmRejectBudget,
    setConfirmRejectBudget,
    receiptInvoice,
    setReceiptInvoice,
    wizardStep,
    setWizardStep,
    propertyData,
    setPropertyData,
    unitMix,
    setUnitMix,
    tenantOptions,
    ownerOptions,
    unitOptions,
    invoiceOptions,
    receiptOptions,
    propertyOptions,
    leaseOptions,
    handovers,
    billingContext,
    setBillingContext,
    openInvoiceComposer,
    updateInvoiceDraft,
    invoicePreview,
    setInvoicePreview,
    invoiceDraft,
    setInvoiceDraft,
    previewInvoice,
    onAddPropertySubmit: submitAddProperty,
    onAddTenantSubmit: () => {},
    onAddLeaseSubmit: submitAddLease,
    onRecordReceiptSubmit: submitRecordReceipt,
    onComposeInvoiceSubmit: submitInvoiceDraft,
    onUploadDocSubmit: submitUploadDoc,
    onAddServiceChargeSubmit: submitServiceCharge,
    onFinancialIntakeSubmit: submitFinancialIntake,
    onMatchSubmit: submitBankMatch,
    onRenewLeaseSubmit: submitLeaseRenewal,
    onTerminateLeaseSubmit: confirmLeaseTermination,
    onReconcileSubmit: submitServiceChargeReconciliation,
    onRejectDocumentSubmit: submitDocumentRejection,
    onVoidInvoiceConfirm: () => {
      const row = confirmVoidInvoice;
      setConfirmVoidInvoice(null);
      if (row) void runPropertyAction("invoices", row.id, "void", "Invoice void failed.");
    },
    onRejectBudgetConfirm: () => {
      const row = confirmRejectBudget;
      setConfirmRejectBudget(null);
      if (row) void runPropertyAction("budgets", row.id, "reject", "Budget rejection failed.");
    },
    onInvoiceLeaseChange: handleInvoiceLeaseChange,
    onInvoiceTypeChange: handleInvoiceTypeChange,
    handleDownloadDoc,
    handleVerifyDoc,
    handleRejectDocPrompt,
    handleSendReminder,
    handleGenerateScheduleInvoice,
    handleVoidInvoicePrompt,
    handleApproveBudget,
    handleRejectBudgetPrompt,
    handleExportReport,
    handleCreateBudget,
    handleCreateExpense,
    handleCreateCreditNote,
    voidCreditNoteTarget,
    setVoidCreditNoteTarget,
    handleVoidCreditNote,
    submitVoidCreditNote,
    handleQuickReceipt,
    handleInvoiceAction,
    runLeaseAction,
    downloadInvoicePdf,
    downloadReceiptPdf,
    downloadTenantStatement,
    handleDeleteTenant,
    handleActivateTenant,
    handleBulkActivateTenants,
    handleBulkActivateLeases,
    generateServiceChargeAllocations,
    handleReviewReconciliation,
    handleApproveReconciliation,
    handleDownloadReconciliationPdf,
    fetchData: loadData,
  };
}
