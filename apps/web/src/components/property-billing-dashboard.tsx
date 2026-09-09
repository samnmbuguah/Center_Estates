"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { LoadingState, money } from "@/components/module-ui";
import { BillingRun, BillingIssue, Candidate, Invoice, InvoiceChargeType, candidateHasChargeType, invoiceChargeType, isMissingWaterReading } from "./billing/types";
import { BillingHeader, BillingMode } from "./billing/BillingHeader";
import { BillingActionBanner } from "./billing/BillingActionBanner";
import { BillingChargeRollup } from "./billing/BillingChargeRollup";
import { BillingKpis } from "./billing/BillingKpis";
import { CandidateTable } from "./billing/CandidateTable";
import { CandidatePreviewDrawer } from "./billing/CandidatePreviewDrawer";
import { OverrideDialog } from "./billing/OverrideDialog";
import { QuickRecordMeterModal } from "./billing/QuickRecordMeterModal";
import { LettingFeeModal } from "@/features/property/components/modals/LettingFeeModal";

export type BillingContext = {
  mode: string;
  period_start: string;
  period_end: string;
  months_count: number;
  label: string;
};

export function PropertyBillingDashboard({ onNavigate, onSingleInvoice, onLettingFeeInvoice }: { onNavigate: (tab: string) => void; onSingleInvoice: (ctx: BillingContext) => void; onLettingFeeInvoice?: () => void }) {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  
  const [billingTarget, setBillingTarget] = useState<"tenant" | "landlord">("tenant");
  const [mode, setMode] = useState<BillingMode>("monthly");
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [quarterYear, setQuarterYear] = useState(now.getFullYear());
  const [quarterIndex, setQuarterIndex] = useState(Math.floor(now.getMonth() / 3) + 1); // 1, 2, 3, 4
  const [customStart, setCustomStart] = useState(`${now.getFullYear()}-01`);
  const [customEnd, setCustomEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const [allRuns, setAllRuns] = useState<BillingRun[]>([]);
  const [run, setRun] = useState<BillingRun | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [landlordInvoices, setLandlordInvoices] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [landlordFeeType, setLandlordFeeType] = useState<"management" | "letting" | "service_charge">("management");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chargeTypeFilter, setChargeTypeFilter] = useState<InvoiceChargeType | "all">("all");
  const [search, setSearch] = useState("");
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [recordMeterCandidate, setRecordMeterCandidate] = useState<Candidate | null>(null);
  const [overrideIssue, setOverrideIssue] = useState<BillingIssue | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");
  const [lettingModalOpen, setLettingModalOpen] = useState(false);

  const canFinance = can("property.finance");
  const canApprove = can("property.approve");

  // Calculate period_start and period_end based on active billing mode
  const { period_start, period_end, formattedPeriod } = useMemo(() => {
    if (mode === "monthly") {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const end = `${month}-${String(lastDay).padStart(2, "0")}`;
      const label = new Date(y, m - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
      return { period_start: start, period_end: end, formattedPeriod: label };
    }
    if (mode === "quarterly") {
      const startMonth = (quarterIndex - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const start = `${quarterYear}-${String(startMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(quarterYear, endMonth, 0)).getUTCDate();
      const end = `${quarterYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const qNames = ["Jan – Mar", "Apr – Jun", "Jul – Sep", "Oct – Dec"];
      const label = `Q${quarterIndex} ${quarterYear} (${qNames[quarterIndex - 1]})`;
      return { period_start: start, period_end: end, formattedPeriod: label };
    }
    // Custom / Multi-month
    const [sy, sm] = customStart.split("-").map(Number);
    const [ey, em] = customEnd.split("-").map(Number);
    const start = `${customStart}-01`;
    const lastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate();
    const end = `${customEnd}-${String(lastDay).padStart(2, "0")}`;
    const monthsCount = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    const sLabel = new Date(sy, sm - 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" });
    const eLabel = new Date(ey, em - 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" });
    const label = `${sLabel} – ${eLabel} (${monthsCount} Months)`;
    return { period_start: start, period_end: end, formattedPeriod: label };
  }, [mode, month, quarterYear, quarterIndex, customStart, customEnd]);

  const changeMonth = (offset: number) => {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const changeQuarter = (offset: number) => {
    let nextQ = quarterIndex + offset;
    let nextY = quarterYear;
    if (nextQ > 4) { nextQ = 1; nextY += 1; }
    if (nextQ < 1) { nextQ = 4; nextY -= 1; }
    setQuarterIndex(nextQ);
    setQuarterYear(nextY);
  };

  const handlePrev = () => {
    if (mode === "monthly") changeMonth(-1);
    else if (mode === "quarterly") changeQuarter(-1);
  };

  const handleNext = () => {
    if (mode === "monthly") changeMonth(1);
    else if (mode === "quarterly") changeQuarter(1);
  };

  const load = useCallback(async (showSkeleton = false) => {
    if (!organizationId) return;
    if (showSkeleton) setLoading(true);
    setError("");
    try {
      const [runRes, invRes, propRes, llInvRes, ownersRes, unitsRes] = await Promise.all([
        apiFetch("/property/billing-runs/", {}, organizationId),
        apiFetch("/property/invoices/", {}, organizationId),
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/property/landlord-invoices/", {}, organizationId),
        apiFetch("/property/owners/", {}, organizationId),
        apiFetch("/property/units/", {}, organizationId),
      ]);
      if (!runRes.ok || !invRes.ok) {
        setError(await apiErrorMessage(!runRes.ok ? runRes : invRes, "Billing data could not be loaded."));
        setLoading(false);
        return;
      }
      const runRows = (await runRes.json()) as BillingRun[];
      const invRows = (await invRes.json()) as Invoice[];
      setAllRuns(runRows);
      setInvoices(invRows);
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(Array.isArray(propData) ? propData : propData.results ?? []);
      }
      if (llInvRes.ok) {
        const llData = await llInvRes.json();
        setLandlordInvoices(Array.isArray(llData) ? llData : llData.results ?? []);
      }
      if (ownersRes.ok) {
        const oData = await ownersRes.json();
        setOwners(Array.isArray(oData) ? oData : oData.results ?? []);
      }
      if (unitsRes.ok) {
        const uData = await unitsRes.json();
        setUnits(Array.isArray(uData) ? uData : uData.results ?? []);
      }
    } catch {
      setError("Failed to communicate with billing service.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(true); }, [load]);

  // Deep-link: /property?tab=billing&billing_type=service_charge pre-selects the filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bt = params.get("billing_type") || params.get("invoice_type") || params.get("charge_type");
    if (bt) {
      const norm = bt.toLowerCase().replace("-", "_");
      if (norm === "servicecharge") setChargeTypeFilter("service_charge");
      else if (["rent", "service_charge", "utility", "other"].includes(norm)) setChargeTypeFilter(norm as InvoiceChargeType);
      else if (norm === "landlord") setBillingTarget("landlord");
    }
  }, []);

  // Synchronously match run from allRuns when period or allRuns change — instant transition with zero flicker
  useEffect(() => {
    const matching = allRuns.find(r => r.period_start === period_start && r.period_end === period_end)
      || allRuns.find(r => r.period_start === period_start);
    setRun(matching ?? null);
  }, [allRuns, period_start, period_end]);

  // Auto-scan and auto-prepare queue whenever period or filters change
  const lastScannedKey = useRef<string>("");
  useEffect(() => {
    if (!organizationId || loading || busy || billingTarget !== "tenant") return;
    const scanKey = `${period_start}_${period_end}_${chargeTypeFilter}`;
    if (lastScannedKey.current === scanKey) return;

    const matching = allRuns.find(r => r.period_start === period_start && r.period_end === period_end)
      || allRuns.find(r => r.period_start === period_start);

    if (!matching) {
      lastScannedKey.current = scanKey;
      void mutate("create");
    } else if (matching.status === "preparing" && (!matching.candidates || matching.candidates.length === 0)) {
      lastScannedKey.current = scanKey;
      void mutate("prepare");
    }
  }, [organizationId, loading, busy, billingTarget, period_start, period_end, chargeTypeFilter, allRuns]);

  // Compute Landlord Candidates dynamically based on managed properties and contracted revenue
  const landlordCandidates = useMemo<Candidate[]>(() => {
    if (properties.length === 0) return [];
    const startMonthStr = period_start.slice(0, 7);
    const candidatesList: Candidate[] = [];
    const isLetting = landlordFeeType === "letting";
    const isServiceCharge = landlordFeeType === "service_charge";

    // Letting fees are issued on-demand (not auto-scanned). Only show what's already been invoiced.
    if (isLetting) {
      const lettingInvoices = landlordInvoices.filter(
        (inv) => inv.fee_type === "letting" && inv.billing_period === startMonthStr
      );
      for (const inv of lettingInvoices) {
        const unitsDisplay = inv.metadata?.units_display || inv.metadata?.unit_codes?.join(", ") || "—";
        const feeAmt = Number(inv.fee_amount || inv.total_amount || 0);
        candidatesList.push({
          id: `landlord-letting-${inv.id}`,
          tenant_name: inv.landlord_name || "Landlord",
          property_name: inv.property_name || "",
          unit_code: unitsDisplay,
          lease_reference: inv.number || `LETTING-FEE-${startMonthStr}`,
          due_date: inv.due_on || period_end,
          billing_items: [{ code: "letting_fee", description: `Letting Fee (${unitsDisplay})`, amount: String(feeAmt), total: String(feeAmt), billed: true, invoice_number: inv.number }],
          total: String(feeAmt),
          status: "generated",
          issue_summary: [],
          metadata: { property_id: inv.property, owner_id: inv.owner, rent_collected: 0, fee_rate: 0, unit_codes: inv.metadata?.unit_codes || [], units_display: unitsDisplay, invoice_id: inv.id, invoice_number: inv.number },
        } as any);
      }
      return candidatesList;
    }

    if (isServiceCharge) {
      const [startYear, startMonth] = period_start.slice(0, 7).split("-").map(Number);
      const [endYear, endMonth] = period_end.slice(0, 7).split("-").map(Number);
      const months = Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth + 1);
      for (const property of properties) {
        const propertyUnits = units.filter((unit) => String(unit.property_id || unit.property) === String(property.id));
        for (const unit of propertyUnits) {
          const ownerId = unit.owner_id || unit.owner;
          if (!ownerId || String(unit.service_charge_payer || "").toLowerCase() !== "owner") continue;
          const monthlyAmount = Number(unit.common_area_fee_amount || unit.metadata?.monthly_service_charge_excl_vat || unit.metadata?.service_charge || 0);
          const subtotal = Math.round(monthlyAmount * months * 100) / 100;
          const vatRate = Number(unit.metadata?.service_charge_vat_rate ?? unit.metadata?.vat_rate ?? 0);
          const total = Math.round(subtotal * (1 + vatRate / 100) * 100) / 100;
          const owner = owners.find((candidate) => String(candidate.id) === String(ownerId));
          const existing = invoices.find((invoice) =>
            String(invoice.owner_id || invoice.owner) === String(ownerId) &&
            String(invoice.unit_id || invoice.unit) === String(unit.id) &&
            invoiceChargeType(invoice.invoice_type || invoice.charge_type || "") === "service_charge" &&
            (invoice.metadata?.billing_period === startMonthStr || (invoice.issued_on >= period_start && invoice.issued_on <= period_end))
          );
          candidatesList.push({
            id: `owner-service-charge-${unit.id}`,
            tenant_name: owner?.name || unit.owner_name || "Unassigned owner",
            property_name: property.name,
            unit_code: unit.code,
            lease_reference: `OWNER-SC-${startMonthStr}`,
            due_date: period_end,
            billing_items: [{ code: "service_charge", description: `Owner service charge for Unit ${unit.code} (${months} ${months === 1 ? "month" : "months"})`, amount: String(total), total: String(total), billed: Boolean(existing), invoice_number: existing?.number }],
            total: String(total),
            status: existing ? "generated" : subtotal > 0 ? "ready" : "excluded",
            issue_summary: subtotal > 0 ? [] : [{ code: "NO_SERVICE_CHARGE", message: `Set the owner service-charge amount for Unit ${unit.code} during onboarding.`, severity: "warning" }],
            metadata: { property_id: property.id, owner_id: ownerId, unit_id: unit.id, unit_codes: [unit.code], units_display: unit.code, subtotal, vat_rate: vatRate, invoice_id: existing?.id, invoice_number: existing?.number },
          } as any);
        }
      }
      return candidatesList;
    }

    for (const p of properties) {
      // Find all units belonging to this property
      const propertyUnits = units.filter(
        (u) =>
          String(u.property) === String(p.id) ||
          String(u.property_id) === String(p.id) ||
          u.property_name?.toLowerCase() === p.name?.toLowerCase()
      );

      // Check if property has individual sectional unit owners
      const unitOwnerIds = new Set<string>();
      propertyUnits.forEach((u) => {
        const oId = u.owner_id || u.owner;
        if (oId) unitOwnerIds.add(String(oId));
      });

      if (unitOwnerIds.size > 0) {
        // Sectional Title / Multi-Owner Property: generate candidates per unit owner
        for (const oId of unitOwnerIds) {
          const ownerObj = owners.find((o) => String(o.id) === String(oId));
          const ownerUnits = propertyUnits.filter(
            (u) => String(u.owner_id || u.owner) === String(oId)
          );
          const ownerName = ownerObj?.name || ownerUnits[0]?.owner_name || `Landlord (${ownerUnits[0]?.code || "Unit"})`;
          const ownerCode = ownerObj?.code || ownerUnits[0]?.owner_code || "";
          const unitCodes = ownerUnits.map((u) => u.code);
          const unitIds = new Set(ownerUnits.map((u) => String(u.id)));

          // Find invoices specifically for this landlord's units during the period
          const ownerInvoices = invoices.filter((inv) => {
            const matchesUnit =
              (inv.unit && unitIds.has(String(inv.unit))) ||
              (inv.unit_id && unitIds.has(String(inv.unit_id))) ||
              (inv.unit_code && unitCodes.includes(inv.unit_code));
            const matchesOwner =
              String(inv.owner_id) === String(oId) ||
              String(inv.unit_owner_id) === String(oId) ||
              inv.owner_name?.toLowerCase() === ownerName.toLowerCase() ||
              inv.unit_owner_name?.toLowerCase() === ownerName.toLowerCase();
            const dateMatch = inv.issued_on >= period_start && inv.issued_on <= period_end;
            return (matchesUnit || matchesOwner) && dateMatch;
          });

          // Collections for management commission
          const rentCollected = ownerInvoices
            .filter(
              (inv) =>
                inv.invoice_type?.toLowerCase().includes("rent") ||
                inv.charge_type === "rent"
            )
            .reduce((sum, inv) => {
              const paid = Number(
                inv.amount_paid ?? (Number(inv.amount || 0) - Number(inv.balance || 0))
              );
              return sum + (paid > 0 ? paid : 0);
            }, 0);

          const mgmtRate = Number(
            ownerUnits[0]?.rental_commission_rate || p.management_fee_rate || 5.0
          );
          const lettingFeeRate = ownerUnits.reduce((s, u) => s + Number(u.letting_fee_amount || 0), 0);

          const billedAmount = Math.round(rentCollected * (mgmtRate / 100));

          // Check if already billed (management commission only)
          const existingLandlordInv = landlordInvoices.find(
            (inv) =>
              (String(inv.owner) === String(oId) ||
                String(inv.owner_id) === String(oId) ||
                inv.metadata?.owner_id === String(oId) ||
                inv.landlord_name?.toLowerCase() === ownerName.toLowerCase()) &&
              (String(inv.property) === String(p.id) ||
                inv.property_name?.toLowerCase() === p.name?.toLowerCase()) &&
              inv.billing_period === startMonthStr &&
              (inv.fee_type === "management" || !inv.fee_type)
          );

          const isBilled = Boolean(existingLandlordInv);
          const invoiceNumber = existingLandlordInv?.number;
          const invoiceId = existingLandlordInv?.id;
          const isReady = billedAmount > 0;

          const unitCodesStr = unitCodes.length <= 3
            ? unitCodes.join(", ")
            : `${unitCodes.slice(0, 2).join(", ")} +${unitCodes.length - 2} more (${unitCodes.length} units)`;

          candidatesList.push({
            id: `landlord-${p.id}-${oId}`,
            tenant_name: ownerName,
            property_name: p.name,
            unit_code: unitCodesStr,
            lease_reference: `MGMT-COMMISSION-${startMonthStr}`,
            due_date: period_end,
            billing_items: [
              {
                code: "mgmt_fee",
                description: billedAmount > 0
                  ? `Management Commission (${mgmtRate.toFixed(2)}% of ${money.format(rentCollected)} collected rent from ${unitCodesStr})`
                  : `Management Commission (${mgmtRate.toFixed(2)}% — KES 0 collected from ${unitCodesStr})`,
                amount: String(billedAmount),
                total: String(billedAmount),
                billed: isBilled,
                invoice_number: invoiceNumber,
              },
            ],
            total: String(billedAmount),
            status: isBilled ? "generated" : isReady ? "ready" : "excluded",
            issue_summary: isReady
              ? []
              : [{ code: "NO_COLLECTIONS", message: `Awaiting rent collections for ${unitCodesStr}. Management fee is charged only upon receipted funds.`, severity: "warning" }],
            metadata: {
              property_id: p.id,
              owner_id: oId,
              owner_code: ownerCode,
              rent_collected: rentCollected,
              fee_rate: mgmtRate,
              unit_codes: unitCodes,
              units_display: unitCodesStr,
              invoice_id: invoiceId,
              invoice_number: invoiceNumber,
            },
          } as any);
        }
      } else {
        // Single Owner Property (e.g. standalone building)
        const propertyInvoices = invoices.filter(
          (inv) =>
            (inv.property_id === p.id ||
              inv.property_name?.toLowerCase() === p.name?.toLowerCase()) &&
            inv.issued_on >= period_start &&
            inv.issued_on <= period_end
        );
        const rentCollected = propertyInvoices
          .filter(
            (inv) =>
              inv.invoice_type?.toLowerCase().includes("rent") ||
              inv.charge_type === "rent"
          )
          .reduce((sum, inv) => {
            const paid = Number(
              inv.amount_paid ?? (Number(inv.amount || 0) - Number(inv.balance || 0))
            );
            return sum + (paid > 0 ? paid : 0);
          }, 0);

        const mgmtRate = Number(p.management_fee_rate || 5.0);
        const billedAmount = Math.round(rentCollected * (mgmtRate / 100));

        const ownerName = p.owner_name || p.landlord_name || `${p.name} Property Owner`;
        const existingLandlordInv = landlordInvoices.find(
          (inv) =>
            (String(inv.property) === String(p.id) ||
              inv.property_name?.toLowerCase() === p.name?.toLowerCase()) &&
            inv.billing_period === startMonthStr &&
            (inv.fee_type === "management" || !inv.fee_type)
        );

        const isBilled = Boolean(existingLandlordInv);
        const invoiceNumber = existingLandlordInv?.number;
        const invoiceId = existingLandlordInv?.id;
        const isReady = billedAmount > 0;

        candidatesList.push({
          id: `landlord-${p.id}`,
          tenant_name: ownerName,
          property_name: p.name,
          unit_code: `${p.units_count || p.total_units || propertyUnits.length || "Whole"} Units`,
          lease_reference: `MGMT-COMMISSION-${startMonthStr}`,
          due_date: period_end,
          billing_items: [
            {
              code: "mgmt_fee",
              description: billedAmount > 0
                ? `Management Commission (${mgmtRate.toFixed(2)}% of ${money.format(rentCollected)} collected rent)`
                : `Management Commission (${mgmtRate.toFixed(2)}% — KES 0 collected)`,
              amount: String(billedAmount),
              total: String(billedAmount),
              billed: isBilled,
              invoice_number: invoiceNumber,
            },
          ],
          total: String(billedAmount),
          status: isBilled ? "generated" : isReady ? "ready" : "excluded",
          issue_summary: isReady
            ? []
            : [{ code: "NO_COLLECTIONS", message: "Awaiting rent collections. Management fee is charged only upon receipted funds.", severity: "warning" }],
          metadata: {
            property_id: p.id,
            owner_id: null,
            rent_collected: rentCollected,
            fee_rate: mgmtRate,
            unit_codes: [],
            units_display: `${p.units_count || p.total_units || propertyUnits.length || "Whole"} Units`,
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
          },
        } as any);
      }
    }

    return candidatesList;
  }, [properties, owners, units, invoices, landlordInvoices, period_start, period_end, landlordFeeType]);

  const prepareTypesBody = chargeTypeFilter !== "all"
    ? { invoice_types: chargeTypeFilter === "utility" ? ["water", "electricity", "utility"] : [chargeTypeFilter] }
    : {};

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action); setError(""); setNotice("");

    // Landlord Billing Generation
    if (billingTarget === "landlord" && action === "generate") {
      try {
        const selectedCandidates = landlordCandidates.filter((c) => selected.includes(c.id) && c.status === "ready");
        const startMonthStr = period_start.slice(0, 7);
        let successCount = 0;
        let lastErrorMsg = "";

        for (const cand of selectedCandidates) {
          const meta = (cand as any).metadata || {};
          const propId = meta.property_id || cand.id.split("-")[1];
          const ownerId = meta.owner_id || null;
          const rentCollected = meta.rent_collected ?? 0;
          const feeRate = meta.fee_rate ?? 5.0;
          const isLetting = landlordFeeType === "letting";
          const isServiceCharge = landlordFeeType === "service_charge";
          const billedAmount = Number(cand.total || 0);

          if (isServiceCharge) {
            const invoiceRes = await apiFetch("/property/invoices/", {
              method: "POST",
              body: JSON.stringify({
                recipient_type: "owner",
                owner: ownerId,
                unit: meta.unit_id,
                invoice_type: "service_charge",
                charge_type: "service_charge",
                subtotal: Number(meta.subtotal || billedAmount),
                tax_rate: Number(meta.vat_rate || 0),
                amount: billedAmount,
                issued_on: period_start,
                due_on: cand.due_date || period_end,
                metadata: { billing_period: startMonthStr, property_id: propId, unit_codes: meta.unit_codes },
              }),
            }, organizationId);
            if (!invoiceRes.ok) {
              lastErrorMsg = await apiErrorMessage(invoiceRes, "Failed to create the owner service-charge invoice.");
              continue;
            }
            let created = await invoiceRes.json();
            if (canApprove) {
              const transitions = created.status === "draft"
                ? ["submit-review", "approve", "issue"]
                : created.status === "review"
                  ? ["approve", "issue"]
                  : created.status === "approved"
                    ? ["issue"]
                    : [];
              let completed = created.status === "issued" || created.status === "paid";
              for (const transition of transitions) {
                const transitionRes = await apiFetch(`/property/invoices/${created.id}/${transition}/`, { method: "POST", body: "{}" }, organizationId);
                if (!transitionRes.ok) {
                  lastErrorMsg = await apiErrorMessage(transitionRes, `Invoice ${created.number} was created but could not be fully issued.`);
                  break;
                }
                created = await transitionRes.json();
                completed = created.status === "issued" || created.status === "paid";
              }
              if (!completed) continue;
            }
            successCount++;
            continue;
          }

          const res = await apiFetch(
            "/property/landlord-invoices/",
            {
              method: "POST",
              body: JSON.stringify({
                property: propId,
                owner: ownerId,
                landlord_name: cand.tenant_name,
                billing_period: startMonthStr,
                fee_type: landlordFeeType,
                gross_collections: isLetting ? 0 : rentCollected,
                fee_rate: isLetting ? 0 : feeRate,
                due_on: cand.due_date || period_end,
                notes: isLetting
                  ? `Tenant Placement & Letting Fee for ${cand.unit_code} (${cand.property_name}).`
                  : `Property Management Commission for ${formattedPeriod}. Gross collected rent from ${cand.unit_code}: KES ${rentCollected.toLocaleString()}.`,
                metadata: {
                  owner_id: ownerId,
                  owner_code: meta.owner_code,
                  units: meta.unit_codes,
                  units_display: cand.unit_code,
                },
              }),
            },
            organizationId
          );

          if (!res.ok) {
            lastErrorMsg = await apiErrorMessage(res, "Failed to generate landlord invoice.");
          } else {
            successCount++;
          }
        }

        if (successCount > 0) {
          const typeLabel = landlordFeeType === "letting" ? "Letting Fee" : landlordFeeType === "service_charge" ? "Owner Service Charge" : "Management Commission";
          setNotice(`Generated ${successCount} Landlord ${typeLabel} Invoice(s) for ${formattedPeriod}.`);
        }
        if (lastErrorMsg) {
          setError(lastErrorMsg);
        }
      } catch {
        setError("Failed to generate landlord invoices.");
      }
      await load();
      setBusy("");
      return;
    }

    // Tenant Billing Run Mutate
    const body: Record<string, unknown> = action === "create"
      ? { period_start, period_end }
      : action === "generate"
        ? {
            candidate_ids: selected,
            ...prepareTypesBody,
          }
        : action === "prepare"
          ? prepareTypesBody
          : {};
    let res = action === "create"
      ? await apiFetch("/property/billing-runs/", { method: "POST", body: JSON.stringify(body) }, organizationId)
      : await apiFetch(`/property/billing-runs/${run?.id}/${action}/`, { method: "POST", body: JSON.stringify(body) }, organizationId);

    if (action === "create" && res.ok) {
      const createdRun = (await res.json()) as BillingRun;
      res = await apiFetch(
        `/property/billing-runs/${createdRun.id}/prepare/`,
        { method: "POST", body: JSON.stringify(prepareTypesBody) },
        organizationId,
      );
    }

    if (!res.ok) {
      if (res.status === 404 && action === "prepare") {
        setRun(null);
        setBusy("");
        await mutate("create");
        return;
      }
      setError(await apiErrorMessage(res, `Billing ${action} failed.`));
    }
    else if (action === "generate") {
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const g = Number(json.generated_count ?? 0);
      const s = Number(json.skipped_duplicate ?? 0);
      setNotice(s > 0 ? `${g} invoice(s) generated, ${s} already billed for this period — skipped (no duplicates created).` : `${g} invoice(s) generated for ${formattedPeriod}.`);
    } else { setNotice({ create: `Readiness scan for ${formattedPeriod} is complete.`, prepare: "Readiness check complete.", approve: "Run confirmed — ready to generate." }[action] ?? "Done."); }
    await load(); setBusy("");
  }

  async function authorizeOverride() {
    if (!organizationId || !run || !overrideIssue) return;
    setBusy("override"); setError(""); setNotice("");
    const res = await apiFetch(`/property/billing-runs/${run.id}/resolve-issue/`, { method: "POST", body: JSON.stringify({ issue: overrideIssue.id, status: "overridden", notes: overrideNotes }) }, organizationId);
    if (!res.ok) { setError(await apiErrorMessage(res, "Override failed.")); }
    else { setOverrideIssue(null); setOverrideNotes(""); setNotice("Exception overridden."); }
    await load(); setBusy("");
  }

  const isCandidateReady = (c: Candidate, filter: InvoiceChargeType | "all"): boolean => {
    if (c.status === "issue" || c.status === "excluded") return false;
    if (billingTarget === "landlord") {
      return (c.billing_items || []).some((it: any) => !it.billed);
    }
    if (filter === "all") {
      return (c.billing_items || []).some((it: any) => !it.billed);
    }
    return (c.billing_items || []).some((it: any) => {
      const t = invoiceChargeType(it.code);
      const matchesType = filter === "utility" ? t === "utility" : t === filter;
      return matchesType && !it.billed;
    });
  };

  const rawCandidates = billingTarget === "landlord" ? landlordCandidates : (run?.candidates ?? []);

  const totals = useMemo(() => {
    if (billingTarget === "landlord") {
      const totalAmt = landlordCandidates.reduce((s, c) => s + Number(c.total || 0), 0);
      const readyAmt = landlordCandidates.filter(c => c.status === "ready").reduce((s, c) => s + Number(c.total || 0), 0);
      return {
        total_candidates: landlordCandidates.length,
        ready_count: landlordCandidates.filter(c => c.status === "ready").length,
        total_amount: totalAmt,
        ready_amount: readyAmt,
        with_issues: 0,
      };
    }
    return run?.totals ?? {};
  }, [billingTarget, landlordCandidates, run]);

  const issues = Number(totals.with_issues ?? run?.candidates.filter(c => c.status === "issue").length ?? 0);
  const blockingOpen = Boolean(run?.issues?.some(i => i.severity === "blocking" && i.status === "open"));
  const generatedThisPeriod = invoices.filter(i => i.issued_on >= period_start && i.issued_on <= period_end);

  const filteredReadyForBanner = useMemo(() => {
    return rawCandidates.filter((c) => isCandidateReady(c, chargeTypeFilter)).length;
  }, [rawCandidates, chargeTypeFilter, billingTarget]);

  const typeCounts = useMemo(() => {
    const rows = rawCandidates;
    const counts: Record<string, number> = { rent: 0, service_charge: 0, utility: 0, other: 0 };
    for (const c of rows) {
      for (const t of new Set(c.billing_items.map((it) => {
        const code = String(it.code || "").trim().toLowerCase();
        if (code === "rent") return "rent";
        if (code === "sc" || code === "service_charge") return "service_charge";
        if (code === "water" || code === "electricity" || code === "utility") return "utility";
        return "other";
      }))) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [rawCandidates]);

  const visibleCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawCandidates.filter(c => {
      if (billingTarget === "tenant") {
        if (chargeTypeFilter !== "all" && !candidateHasChargeType(c, chargeTypeFilter)) return false;
      }
      // In landlord mode, hide "excluded" candidates (0-amount / no collections) when filter is "all"
      // — showing KES 0 rows is noise. Users can set statusFilter to see them explicitly.
      if (billingTarget === "landlord" && statusFilter === "all" && c.status === "excluded") return false;
      if (statusFilter === "ready" && !isCandidateReady(c, chargeTypeFilter)) return false;
      if (statusFilter === "generated" && isCandidateReady(c, chargeTypeFilter)) return false;
      if (statusFilter !== "all" && statusFilter !== "ready" && statusFilter !== "generated" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.tenant_name, c.lease_reference, c.unit_code, c.property_name].join(" ").toLowerCase().includes(q);
    });
  }, [rawCandidates, search, statusFilter, chargeTypeFilter, billingTarget]);

  const readyVisibleIds = visibleCandidates.filter(c => isCandidateReady(c, chargeTypeFilter)).map(c => c.id);
  const allReadySelected = readyVisibleIds.length > 0 && readyVisibleIds.every(id => selected.includes(id));

  useEffect(() => {
    const readyIds = rawCandidates.filter((c) => isCandidateReady(c, chargeTypeFilter)).map((c) => c.id);
    setSelected(readyIds);
  }, [run?.id, chargeTypeFilter, billingTarget, rawCandidates.length]);

  if (loading && allRuns.length === 0) return <LoadingState rows={6} />;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
      {error && <Alert severity="error" action={<button className="btn ghost sm" onClick={() => void load()}>Retry</button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <BillingHeader
        formattedPeriod={formattedPeriod}
        runStatus={billingTarget === "landlord" ? (filteredReadyForBanner > 0 ? "ready" : "generated") : (run?.status ?? null)}
        billingTarget={billingTarget}
        onBillingTargetChange={(target) => {
          setBillingTarget(target);
          setSearch("");
          setStatusFilter("all");
        }}
        mode={mode}
        onModeChange={setMode}
        onPrev={handlePrev}
        onNext={handleNext}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <BillingKpis
        totals={totals}
        ready={filteredReadyForBanner}
        issues={issues}
        generatedCount={generatedThisPeriod.length}
        generatedAmount={generatedThisPeriod.reduce((a, i) => a + Number(i.amount), 0)}
      />

      <BillingChargeRollup
        candidates={rawCandidates}
        activeFilter={chargeTypeFilter}
        billingTarget={billingTarget}
        onSelectFilter={(t) => {
          setChargeTypeFilter(t);
          const matching = rawCandidates.filter((c) => isCandidateReady(c, t)).map((c) => c.id);
          setSelected(matching);
        }}
      />

      {billingTarget === "landlord" && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            background: "#ffffff",
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Owner Billing Type:
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => { setLandlordFeeType("management"); setChargeTypeFilter("all"); setSelected([]); }}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 750,
                border: "none",
                cursor: "pointer",
                background: landlordFeeType === "management" ? "#1d4ed8" : "#f1f5f9",
                color: landlordFeeType === "management" ? "#ffffff" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              🏢 Management Commission (Collections)
            </button>
            <button
              type="button"
              onClick={() => { setLandlordFeeType("letting"); setChargeTypeFilter("all"); setSelected([]); }}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 750,
                border: "none",
                cursor: "pointer",
                background: landlordFeeType === "letting" ? "#7c3aed" : "#f1f5f9",
                color: landlordFeeType === "letting" ? "#ffffff" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              🔑 Letting & Placement Fees
            </button>
            <button
              type="button"
              onClick={() => { setLandlordFeeType("service_charge"); setChargeTypeFilter("service_charge"); setSelected([]); }}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 750,
                border: "none", cursor: "pointer",
                background: landlordFeeType === "service_charge" ? "#0f766e" : "#f1f5f9",
                color: landlordFeeType === "service_charge" ? "#ffffff" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              🧾 Owner Service Charge
            </button>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            {landlordFeeType === "management"
              ? "Calculated strictly per unit owner based on receipted tenant rent"
              : landlordFeeType === "letting"
                ? "Billed on unit tenant placement agreements"
                : "Generated per unit where onboarding assigns service charge to the owner"}
          </span>
        </div>
      )}

      <BillingActionBanner
        hasRun={billingTarget === "landlord" ? true : Boolean(run)}
        isPreparing={billingTarget === "landlord" ? false : run?.status === "preparing"}
        isReview={billingTarget === "landlord" ? true : run?.status === "review"}
        isApproved={billingTarget === "landlord" ? true : run?.status === "approved"}
        formattedMonth={formattedPeriod}
        ready={filteredReadyForBanner}
        issues={issues}
        selectedCount={selected.length}
        chargeTypeFilter={chargeTypeFilter}
        billingTarget={billingTarget}
        typeCounts={typeCounts}
        pendingWaterCount={rawCandidates.filter((c) => isMissingWaterReading(c)).length}
        onLogMeters={() => onNavigate("meters")}
        onChargeTypeFilter={(t: InvoiceChargeType | "all") => {
          setChargeTypeFilter(t);
          const matching = rawCandidates.filter((c) => isCandidateReady(c, t)).map((c) => c.id);
          setSelected(matching);
        }}
        blockingOpen={blockingOpen}
        busy={busy}
        canFinance={canFinance}
        canApprove={canApprove}
        onInitialize={() => void mutate("create")}
        onRecheck={() => void mutate("prepare")}
        onApprove={() => void mutate("approve")}
        onGenerate={() => void mutate("generate")}
        onSingleInvoice={() => onSingleInvoice({ mode, period_start, period_end, months_count: (() => {
          const [sy, sm] = period_start.split("-").map(Number);
          const [ey, em] = period_end.split("-").map(Number);
          return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
        })(), label: formattedPeriod })}
        onLettingFeeInvoice={landlordFeeType === "letting" ? () => setLettingModalOpen(true) : undefined}
      />

      <CandidateTable
        candidates={visibleCandidates}
        run={billingTarget === "landlord" ? true : Boolean(run)}
        search={search}
        statusFilter={statusFilter}
        chargeTypeFilter={chargeTypeFilter}
        billingTarget={billingTarget}
        typeCounts={typeCounts}
        selected={selected}
        allReadySelected={allReadySelected}
        readyCount={readyVisibleIds.length}
        busy={busy}
        formattedMonth={formattedPeriod}
        runPeriodStart={run?.period_start ?? period_start}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onChargeTypeFilter={(t) => {
          setChargeTypeFilter(t);
          if (t !== "all") {
            setSelected((prev) => prev.filter((id) => {
              const c = rawCandidates.find((x) => x.id === id);
              return c ? candidateHasChargeType(c, t) : true;
            }));
          }
        }}
        onSelectAll={() => setSelected(allReadySelected ? selected.filter(id => !readyVisibleIds.includes(id)) : Array.from(new Set([...selected, ...readyVisibleIds])))}
        onSelect={(id) => setSelected(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])}
        onPreview={setPreviewCandidate}
        onOverride={(c) => setOverrideIssue(c.issue_summary?.[0] ? { id: c.id, code: c.issue_summary[0].code, message: c.issue_summary[0].message, severity: c.issue_summary[0].severity, status: "open" } : null)}
        onRecordMeter={setRecordMeterCandidate}
        onSingleInvoice={() => onSingleInvoice({ mode, period_start, period_end, months_count: (() => {
          const [sy, sm] = period_start.split("-").map(Number);
          const [ey, em] = period_end.split("-").map(Number);
          return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
        })(), label: formattedPeriod })}
        onNavigate={onNavigate}
      />

      <OverrideDialog
        issue={overrideIssue}
        notes={overrideNotes}
        busy={busy}
        onNotesChange={setOverrideNotes}
        onAuthorize={() => void authorizeOverride()}
        onClose={() => { setOverrideIssue(null); setOverrideNotes(""); }}
      />

      {previewCandidate && (
        <CandidatePreviewDrawer
          candidate={previewCandidate}
          onClose={() => setPreviewCandidate(null)}
          onRecordMeter={(c) => {
            setPreviewCandidate(null);
            setRecordMeterCandidate(c);
          }}
        />
      )}

      <QuickRecordMeterModal
        candidate={recordMeterCandidate}
        periodEnd={run?.period_end ?? period_end}
        open={Boolean(recordMeterCandidate)}
        onClose={() => setRecordMeterCandidate(null)}
        onSuccess={async () => {
          setNotice("Water meter reading recorded and approved! Refreshing billing queue…");
          await mutate("prepare");
          await load();
        }}
      />

      <LettingFeeModal
        open={lettingModalOpen}
        onClose={() => setLettingModalOpen(false)}
        units={units}
        propertyId={properties[0]?.id}
        onSuccess={() => {
          setLandlordFeeType("letting");
          void load();
        }}
      />
    </Box>
  );
}
