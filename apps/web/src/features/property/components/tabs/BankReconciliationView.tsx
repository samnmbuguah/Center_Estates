"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Badge, ErrorBanner, Field, KpiCard, KpiStrip, Modal, Panel, StatusPill,
} from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import type { BankTransactionRow, Row } from "../../types/property.types";
import { fmtDate, kM, kN } from "../../utils/property.utils";
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ArrowRight, Landmark, RefreshCw, Upload, Bot, Sparkles, Zap,
} from "lucide-react";


// ---------------------------------------------------------------------------
// Charge-type intelligence helpers
// Reads RENT-/SC-/WATER-/MF- prefixes from description, extracted_mpesa_ref
// or bank reference to show operators what the deposit is likely paying for.
// ---------------------------------------------------------------------------
const CHARGE_PREFIX_MAP: Record<string, { label: string; bg: string; color: string }> = {
  "RENT":  { label: "Rent",           bg: "rgba(59,130,246,0.13)",  color: "#2563eb" },
  "SC":    { label: "Service Charge", bg: "rgba(139,92,246,0.13)",  color: "#7c3aed" },
  "WATER": { label: "Water",          bg: "rgba(20,184,166,0.13)",  color: "#0d9488" },
  "MF":    { label: "Mgmt Fee",       bg: "rgba(245,158,11,0.13)",  color: "#d97706" },
};

function detectChargePrefix(tx: BankTransactionRow): string | null {
  const candidates = [
    tx.extracted_mpesa_ref,
    tx.reference,
    (tx as any).receipt_invoice_type,
    tx.description,
    tx.raw_details,
  ];
  const upper = candidates.filter(Boolean).join(" ").toUpperCase();
  for (const prefix of Object.keys(CHARGE_PREFIX_MAP)) {
    if (upper.includes(`${prefix}-`) || upper.startsWith(prefix)) return prefix;
  }
  return null;
}

function ChargePrefixBadge({ tx }: { tx: BankTransactionRow }) {
  // Prefer backend-provided invoice type on matched rows
  const invType = String((tx as any).receipt_invoice_type || "").toLowerCase();
  let prefix: string | null = null;
  if (invType === "rent") prefix = "RENT";
  else if (invType === "service_charge" || invType === "sc") prefix = "SC";
  else if (invType === "water" || invType === "utility") prefix = "WATER";
  else if (invType.includes("mgmt") || invType.includes("management")) prefix = "MF";
  else prefix = detectChargePrefix(tx);

  if (!prefix) return null;
  const style = CHARGE_PREFIX_MAP[prefix];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "1px 7px", borderRadius: 4,
      background: style.bg, color: style.color,
      fontWeight: 700, fontSize: 10, letterSpacing: 0.3,
    }}>
      {prefix === "SC" ? "🏢" : prefix === "WATER" ? "💧" : prefix === "MF" ? "📋" : "🏠"} {style.label}
    </span>
  );
}

interface InvoiceOption {
  id: string;
  number: string;
  amount: number;
  balance: number;
  status: string;
  tenant_name?: string;
  unit_code?: string;
  property_name?: string;
}

export function BankReconciliationView({
  rows,
  loading,
  search,
  setSearch,
  organizationId,
  canFinance = false,
  onMatch = () => {},
  onRecordReceipt = () => {},
  onRefresh = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  organizationId?: string | null;
  canFinance?: boolean;
  onMatch?: (r: BankTransactionRow) => void;
  onRecordReceipt?: () => void;
  onRefresh?: () => void;
}) {
  const transactions = rows as BankTransactionRow[];
  const [activeTab, setActiveTab] = useState<"all" | "unreceipted" | "matched" | "charges">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [importSummary, setImportSummary] = useState<{
    total_parsed?: number;
    created?: number;
    skipped?: number;
    auto_matched?: number;
    unreceipted_credits?: number;
  } | null>(null);

  // Quick Receipt modal state
  const [quickReceiptTarget, setQuickReceiptTarget] = useState<BankTransactionRow | null>(null);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paymentChannel, setPaymentChannel] = useState<"mpesa" | "bank_transfer">("bank_transfer");

  // AI Auto-Match state
  const [showAiMatchModal, setShowAiMatchModal] = useState(false);
  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const [aiMatchStats, setAiMatchStats] = useState<{ total: number; matched: number; highConfidence: number } | null>(null);
  const [aiMatchLoading, setAiMatchLoading] = useState(false);
  const [aiBatchBusy, setAiBatchBusy] = useState(false);

  const runAiMatch = async () => {
    setAiMatchLoading(true);
    setShowAiMatchModal(true);
    try {
      const res = await apiFetch("/property/bank-transactions/ai-match/", {}, organizationId ?? undefined);
      if (res.ok) {
        const data = await res.json();
        setAiMatches(data.matches || []);
        setAiMatchStats({
          total: data.total_unmatched || 0,
          matched: data.matched_count || 0,
          highConfidence: data.high_confidence_count || 0,
        });
      }
    } catch {
      // ignore
    } finally {
      setAiMatchLoading(false);
    }
  };

  const approveAiMatch = async (match: any) => {
    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const res = await apiFetch(`/property/bank-transactions/${match.transaction_id}/quick-receipt/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          invoice_id: match.suggested_invoice.id,
          payment_channel: match.extracted_mpesa_ref ? "mpesa" : "bank_transfer",
          payer_name: match.extracted_payer_name || match.suggested_invoice.tenant_name,
        }),
      }, organizationId ?? undefined);
      if (res.ok) {
        setAiMatches((prev) => prev.filter((m) => m.transaction_id !== match.transaction_id));
        setFeedback({ type: "success", message: `Successfully receipted and matched ${match.transaction_ref}!` });
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  const approveAllHighConfidence = async () => {
    const highConf = aiMatches.filter((m) => m.is_high_confidence);
    if (!highConf.length) return;
    setAiBatchBusy(true);
    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const payload = {
        items: highConf.map((m) => ({
          transaction_id: m.transaction_id,
          invoice_id: m.suggested_invoice.id,
        })),
      };
      const res = await apiFetch("/property/bank-transactions/batch-quick-receipt/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, organizationId ?? undefined);
      if (res.ok) {
        const data = await res.json();
        setFeedback({
          type: "success",
          message: `Successfully batch receipted and reconciled ${data.processed_count} transactions!`,
        });
        setShowAiMatchModal(false);
        onRefresh();
      }
    } catch {
      // ignore
    } finally {
      setAiBatchBusy(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);


  // Fetch available invoices for quick receipting
  useEffect(() => {
    if (quickReceiptTarget) {
      setLoadingInvoices(true);
      apiFetch("/property/invoices/", {}, organizationId ?? undefined)
        .then((res) => (res.ok ? res.json() : []))
        .then((data: any[]) => {
          const valid = (Array.isArray(data) ? data : [])
            .filter((inv) => Number(inv.balance ?? 0) > 0 && inv.status !== "draft" && inv.status !== "voided")
            .map((inv) => ({
              id: String(inv.id),
              number: String(inv.number ?? "INV"),
              amount: Number(inv.amount ?? 0),
              balance: Number(inv.balance ?? 0),
              status: String(inv.status ?? ""),
              tenant_name: String(inv.tenant_name || inv.lease?.tenant?.name || ""),
              unit_code: String(inv.unit_code || inv.lease?.unit?.code || ""),
              property_name: String(inv.property_name || inv.lease?.unit?.property_name || ""),
            }));
          setInvoices(valid);

          // Find optimal auto-match candidate
          const rawMatch = quickReceiptTarget.extracted_account || quickReceiptTarget.extracted_mpesa_ref || "";
          const targetAmt = Number(quickReceiptTarget.amount ?? 0);
          const bestMatch = valid.find(
            (i) => (rawMatch && i.number.toLowerCase().includes(rawMatch.toLowerCase())) ||
                   (Math.abs(i.balance - targetAmt) < 0.01 && (quickReceiptTarget.extracted_payer_name && i.tenant_name?.toLowerCase().includes(quickReceiptTarget.extracted_payer_name.toLowerCase())))
          );

          if (bestMatch) {
            setSelectedInvoiceId(bestMatch.id);
            setPayerName(quickReceiptTarget.extracted_payer_name || bestMatch.tenant_name || "");
          } else if (valid.length > 0) {
            setSelectedInvoiceId(valid[0].id);
            setPayerName(quickReceiptTarget.extracted_payer_name || valid[0].tenant_name || "");
          }

          setPaymentChannel(quickReceiptTarget.transaction_type === "mpesa_sweep" ? "mpesa" : "bank_transfer");
        })
        .catch(() => setInvoices([]))
        .finally(() => setLoadingInvoices(false));
    }
  }, [quickReceiptTarget, organizationId]);

  const summary = useMemo(() => {
    const unreceipted = transactions.filter((t) => {
      if (t.status === "matched") return false;
      const isCredit = Number(t.money_in ?? 0) > 0 || (!t.money_in && !t.money_out && Number(t.amount ?? 0) > 0);
      const isFee = t.transaction_type === "bank_fee" || t.transaction_type === "tax";
      return isCredit && !isFee;
    });

    const matched = transactions.filter((t) => t.status === "matched");
    const charges = transactions.filter((t) => t.transaction_type === "bank_fee" || t.transaction_type === "tax" || Number(t.money_out ?? 0) > 0);

    const totalInflow = transactions.reduce((sum, t) => sum + Number(t.money_in || (t.status === "matched" ? t.amount : 0) || 0), 0);
    const unreceiptedTotal = unreceipted.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const matchedTotal = matched.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const chargesTotal = charges.reduce((sum, t) => sum + Number(t.money_out || t.amount || 0), 0);

    return {
      unreceipted,
      matched,
      charges,
      totalInflow,
      unreceiptedTotal,
      matchedTotal,
      chargesTotal,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (activeTab === "unreceipted") {
        return summary.unreceipted.some((u) => u.id === t.id);
      }
      if (activeTab === "matched") {
        return t.status === "matched";
      }
      if (activeTab === "charges") {
        return summary.charges.some((c) => c.id === t.id);
      }
      return true;
    });
  }, [transactions, activeTab, summary]);

  async function processFile(file: File) {
    if (!file) return;

    setImporting(true);
    setFeedback(null);
    setImportSummary(null);

    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const data = new FormData();
      data.append("file", file);

      const response = await apiFetch("/property/bank-transactions/import-statement/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: data,
      }, organizationId ?? undefined);

      if (!response.ok) {
        throw new Error(await apiErrorMessage(response, "The bank statement could not be parsed."));
      }

      const result = await response.json().catch(() => ({}));
      setImportSummary(result);
      setShowImportModal(true);
      setFeedback({
        type: "success",
        message: `Statement imported successfully! ${Number(result.created ?? 0)} lines created, ${Number(result.auto_matched ?? 0)} auto-matched, ${Number(result.unreceipted_credits ?? 0)} unreceipted deposits flagged.`,
      });
      onRefresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "The bank statement could not be imported.",
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleImportStatement(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await processFile(file);
  }

  async function submitQuickReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickReceiptTarget || !selectedInvoiceId) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const response = await apiFetch(`/property/bank-transactions/${quickReceiptTarget.id}/quick-receipt/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          invoice_id: selectedInvoiceId,
          payment_channel: paymentChannel,
          payer_name: payerName.trim(),
        }),
      }, organizationId ?? undefined);

      if (!response.ok) {
        throw new Error(await apiErrorMessage(response, "Could not create and match receipt."));
      }

      const updatedTx = await response.json();
      setQuickReceiptTarget(null);
      setFeedback({
        type: "success",
        message: `Receipt created and bank transaction ${quickReceiptTarget.reference} reconciled successfully!`,
      });
      onRefresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to create receipt.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function addStatementLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const response = await apiFetch("/property/bank-transactions/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          reference: String(values.reference ?? "").trim(),
          transacted_on: String(values.transacted_on ?? ""),
          description: String(values.description ?? "").trim(),
          amount: Number(values.amount ?? 0),
          money_in: Number(values.amount ?? 0),
        }),
      }, organizationId ?? undefined);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The statement line could not be saved."));
      setShowAdd(false);
      setFeedback({ type: "success", message: "Statement line added." });
      onRefresh();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "The statement line could not be saved." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {feedback?.type === "error" && <ErrorBanner message={feedback.message} onRetry={onRefresh} />}
      {feedback?.type === "success" && (
        <div role="status" className="card" style={{ padding: "12px 16px", borderColor: "rgba(22, 163, 74, 0.35)", background: "rgba(22, 163, 74, 0.09)", color: "var(--text-primary)", fontWeight: 650 }}>
          ✓ {feedback.message}
        </div>
      )}

      <ViewToolbar
        title="Bank Reconciliation & Intelligence"
        subtitle="Upload bank statements (NCBA, Equity, KCB, Stanbic, Co-op, M-Pesa) to automatically flag unreceipted deposits and reconcile ledger proof of payments."
        search={search}
        onSearch={setSearch}
        placeholder="Search bank reference, M-PESA code, unit, payer or amount…"
      >
        {canFinance && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn sm"
              onClick={runAiMatch}
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Sparkles size={14} /> AI Auto-Match
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setShowDropzone(!showDropzone)}
              style={{ fontWeight: 600, border: "1px solid var(--border-color)", background: "var(--bg-surface)" }}
            >
              <UploadCloud size={14} style={{ marginRight: 5 }} /> {showDropzone ? "Hide Upload Zone" : "Upload Statement (.xlsx, .csv)"}
            </button>
            <button type="button" className="btn primary sm" onClick={() => setShowAdd(true)}>
              + Add Manual Line
            </button>
          </div>
        )}
      </ViewToolbar>


      {/* Interactive Drag & Drop Statement Dropzone */}
      {canFinance && (showDropzone || transactions.length === 0) && (
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) await processFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? "2px dashed #6366f1" : "1.5px dashed var(--border)",
            background: isDragging
              ? "rgba(99, 102, 241, 0.08)"
              : "radial-gradient(ellipse at top, rgba(99, 102, 241, 0.04) 0%, var(--surface) 100%)",
            borderRadius: 12,
            padding: "20px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            position: "relative",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={handleImportStatement}
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: isDragging ? "rgba(99, 102, 241, 0.2)" : "var(--surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDragging ? "#6366f1" : "var(--primary)",
            }}>
              <UploadCloud size={24} className={importing ? "animate-bounce" : ""} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {importing ? "Processing and auto-matching statement…" : isDragging ? "Drop your bank statement file here" : "Drag & drop bank statement (.xlsx, .csv) or click to browse"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Automatic multi-pattern matching for M-Pesa, NCBA, Equity, KCB, Stanbic & Co-op statements
              </div>
            </div>

            {/* Supported Kenyan Commercial Bank Badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Auto-Parsed Formats:</span>
              {[
                { name: "NCBA Bank", color: "#2563eb", bg: "rgba(37,99,235,0.08)" },
                { name: "Equity EazzyBiz", color: "#b91c1c", bg: "rgba(185,28,28,0.08)" },
                { name: "KCB Corporate", color: "#15803d", bg: "rgba(21,128,61,0.08)" },
                { name: "Stanbic Bank", color: "#0284c7", bg: "rgba(2,132,199,0.08)" },
                { name: "Co-op Omni", color: "#047857", bg: "rgba(4,120,87,0.08)" },
                { name: "M-PESA Business", color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
              ].map((b) => (
                <span key={b.name} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: b.bg, color: b.color, border: `1px solid ${b.color}22` }}>
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}


      <KpiStrip cols={4}>
        <KpiCard
          icon="🏦"
          iconBg="#dbeafe"
          iconColor="#1d4ed8"
          label="Total Bank Inflow"
          value={kM(summary.totalInflow)}
          sub={`${kN(transactions.length)} statement lines`}
        />
        <KpiCard
          icon="✓"
          iconBg="#dcfce7"
          iconColor="#15803d"
          label="Reconciled Revenue"
          value={kN(summary.matched.length)}
          sub={kM(summary.matchedTotal)}
        />
        <KpiCard
          icon="⚠️"
          iconBg="#fef3c7"
          iconColor="#b45309"
          label="Unreceipted Deposits"
          value={kN(summary.unreceipted.length)}
          sub={`${kM(summary.unreceiptedTotal)} Action Required`}
        />
        <KpiCard
          icon="🏛️"
          iconBg="#f3e8ff"
          iconColor="#7e22ce"
          label="Bank Charges & Tax"
          value={kN(summary.charges.length)}
          sub={kM(summary.chargesTotal)}
        />
      </KpiStrip>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-color)", paddingBottom: 6 }}>
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`btn ${activeTab === "all" ? "primary" : "ghost"} sm`}
          style={{ borderRadius: 6 }}
        >
          All Transactions ({transactions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("unreceipted")}
          className={`btn ${activeTab === "unreceipted" ? "primary" : "ghost"} sm`}
          style={{
            borderRadius: 6,
            background: activeTab === "unreceipted" ? "#b45309" : undefined,
            color: activeTab === "unreceipted" ? "#ffffff" : summary.unreceipted.length ? "#b45309" : undefined,
            fontWeight: summary.unreceipted.length ? 700 : undefined,
          }}
        >
          ⚠️ Unreceipted Deposits ({summary.unreceipted.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("matched")}
          className={`btn ${activeTab === "matched" ? "primary" : "ghost"} sm`}
          style={{ borderRadius: 6 }}
        >
          ✓ Reconciled ({summary.matched.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("charges")}
          className={`btn ${activeTab === "charges" ? "primary" : "ghost"} sm`}
          style={{ borderRadius: 6 }}
        >
          🏛️ Bank Charges ({summary.charges.length})
        </button>
      </div>

      <Panel title={`Bank Statement Lines (${filteredTransactions.length})`}>
        <ListState
          loading={loading}
          empty={filteredTransactions.length === 0}
          emptyTitle="No statement lines found"
          emptyDesc={
            transactions.length === 0
              ? "Upload an NBK or Stanbic bank statement file (.xlsx, .csv) to auto-extract deposits and match them to tenant receipts."
              : "No transactions match the selected filter."
          }
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Date & Reference</th>
                  <th>Type & Channel</th>
                  <th>Extracted Details</th>
                  <th>Narration</th>
                  <th style={{ textAlign: "right" }}>Money In (KES)</th>
                  <th>Reconciliation Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const isCredit = Number(tx.money_in ?? 0) > 0 || (!tx.money_in && !tx.money_out && Number(tx.amount ?? 0) > 0);
                  const isMatched = tx.status === "matched";
                  const isUnreceipted = !isMatched && isCredit && tx.transaction_type !== "bank_fee" && tx.transaction_type !== "tax";

                  return (
                    <tr
                      key={String(tx.id)}
                      style={{
                        background: isUnreceipted ? "rgba(245, 158, 11, 0.05)" : undefined,
                        borderLeft: isUnreceipted ? "3px solid #f59e0b" : undefined,
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{fmtDate(tx.transacted_on)}</div>
                        <div className="mono" style={{ color: "var(--primary)", fontWeight: 700, fontSize: 12 }}>
                          {String(tx.reference ?? "—")}
                        </div>
                      </td>
                      <td>
                        {tx.transaction_type === "mpesa_sweep" && <Badge tone="green">M-PESA Sweep</Badge>}
                        {tx.transaction_type === "direct_deposit" && <Badge tone="blue">Direct Deposit</Badge>}
                        {tx.transaction_type === "cheque" && <Badge tone="purple">Cheque</Badge>}
                        {tx.transaction_type === "bank_fee" && <Badge tone="gray">Bank Fee</Badge>}
                        {tx.transaction_type === "tax" && <Badge tone="gray">Excise / Tax</Badge>}
                        {(!tx.transaction_type || tx.transaction_type === "other") && <Badge tone="gray">Other</Badge>}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {/* Charge-type intelligence badge — derived from reference prefix or matched invoice */}
                          <ChargePrefixBadge tx={tx} />
                          {tx.extracted_mpesa_ref && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>
                              📱 M-PESA: <span className="mono">{tx.extracted_mpesa_ref}</span>
                            </span>
                          )}
                          {tx.extracted_account && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                              🏢 Unit/Acc: {tx.extracted_account}
                            </span>
                          )}
                          {tx.extracted_payer_name && (
                            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              👤 {tx.extracted_payer_name}
                            </span>
                          )}
                          {!tx.extracted_mpesa_ref && !tx.extracted_account && !tx.extracted_payer_name && !detectChargePrefix(tx) && (
                            <span className="muted" style={{ fontSize: 11 }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ maxWidth: 280, fontSize: 12, lineHeight: 1.35, color: "var(--text-secondary)" }}>
                        {String(tx.description || tx.raw_details || "—")}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">
                        {isCredit ? (
                          <span style={{ color: "#16a34a" }}>+{kM(tx.money_in || tx.amount)}</span>
                        ) : (
                          <span style={{ color: "#dc2626" }}>-{kM(tx.money_out || tx.amount)}</span>
                        )}
                      </td>
                      <td>
                        {isMatched ? (
                          <div>
                            <StatusPill value="matched" />
                            {tx.receipt_number && (
                              <div className="mono" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                {tx.receipt_number} {tx.receipt_unit ? `(${tx.receipt_unit})` : ""}
                              </div>
                            )}
                          </div>
                        ) : isUnreceipted ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: "#fef3c7",
                              color: "#92400e",
                              fontWeight: 700,
                              fontSize: 11,
                              border: "1px solid #fde68a",
                            }}
                          >
                            ⚠️ Unreceipted
                          </span>
                        ) : (
                          <StatusPill value="unmatched" />
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isUnreceipted && canFinance && (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              className="btn primary sm"
                              style={{ background: "#16a34a", borderColor: "#16a34a", fontSize: 12, padding: "4px 8px" }}
                              onClick={() => setQuickReceiptTarget(tx)}
                            >
                              + Create & Match Receipt
                            </button>
                            <button
                              type="button"
                              className="btn ghost sm"
                              style={{ fontSize: 12, padding: "4px 8px" }}
                              onClick={() => onMatch(tx)}
                            >
                              Link Existing
                            </button>
                          </div>
                        )}
                        {!isUnreceipted && !isMatched && canFinance && (
                          <button
                            type="button"
                            className="btn ghost sm"
                            style={{ fontSize: 12 }}
                            onClick={() => onMatch(tx)}
                          >
                            Match Receipt
                          </button>
                        )}
                        {isMatched && (
                          <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 600 }}>✓ Reconciled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      {/* Quick Receipt Modal */}
      {quickReceiptTarget && (
        <Modal
          title={`1-Click Receipting: Bank Deposit KES ${Number(quickReceiptTarget.amount ?? 0).toLocaleString()}`}
          onClose={() => setQuickReceiptTarget(null)}
        >
          <form onSubmit={submitQuickReceipt} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(37, 99, 235, 0.06)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                fontSize: 13,
              }}
            >
              <div><strong>Bank Reference:</strong> <span className="mono">{quickReceiptTarget.reference}</span></div>
              <div><strong>Deposit Date:</strong> {fmtDate(quickReceiptTarget.transacted_on)}</div>
              {quickReceiptTarget.extracted_mpesa_ref && (
                <div><strong>Extracted M-PESA:</strong> <span className="mono">{quickReceiptTarget.extracted_mpesa_ref}</span></div>
              )}
              {quickReceiptTarget.extracted_account && (
                <div><strong>Extracted Unit / Account:</strong> {quickReceiptTarget.extracted_account}</div>
              )}
              {quickReceiptTarget.description && (
                <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 12 }}>
                  <em>Narration: {quickReceiptTarget.description}</em>
                </div>
              )}
            </div>

            <Field label="Apply Payment to Invoice" required>
              {loadingInvoices ? (
                <p className="muted">Loading available invoices…</p>
              ) : invoices.length === 0 ? (
                <p className="muted" style={{ color: "#dc2626" }}>
                  No open invoices with positive balances found. Please issue an invoice first or match an existing receipt.
                </p>
              ) : (
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoices.find((i) => i.id === e.target.value);
                    if (inv && !payerName) setPayerName(inv.tenant_name || "");
                  }}
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-color)" }}
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.number} — {inv.tenant_name} ({inv.unit_code}) | Balance: KES {inv.balance.toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Payer Name" required>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Name on receipt"
                required
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Payment Channel">
                <select
                  value={paymentChannel}
                  onChange={(e) => setPaymentChannel(e.target.value as any)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-color)" }}
                >
                  <option value="bank_transfer">Direct Bank Transfer</option>
                  <option value="mpesa">M-PESA Paybill / Till</option>
                </select>
              </Field>

              <Field label="Receipt Amount (KES)">
                <input
                  type="text"
                  disabled
                  value={`KES ${Number(quickReceiptTarget.amount ?? 0).toLocaleString()}`}
                  style={{ background: "var(--bg-muted)", fontWeight: 700 }}
                />
              </Field>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setQuickReceiptTarget(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={submitting || !selectedInvoiceId || invoices.length === 0}
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
              >
                {submitting ? "Posting & Reconciling…" : "✓ Post Receipt & Reconcile"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manual Statement Line Modal */}
      {showAdd && (
        <Modal title="Add Manual Bank Statement Line" onClose={() => setShowAdd(false)}>
          <form onSubmit={addStatementLine} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Enter an external bank deposit or transfer line to reconcile against tenant receipts.
            </p>
            <Field label="Bank Reference" required>
              <input name="reference" required placeholder="e.g. FT25074RP3BM or STAN-123456" />
            </Field>
            <Field label="Transaction Date" required>
              <input name="transacted_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Deposit Amount (KES)" required>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
            </Field>
            <Field label="Narration / Description">
              <textarea name="description" rows={3} placeholder="Paste bank narration or payer notes" />
            </Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "Saving…" : "Save Statement Line"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Post-Import Reconciliation Breakdown Modal */}
      {showImportModal && importSummary && (

        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileSpreadsheet size={18} color="#10b981" />
              <span>Bank Statement Import & Auto-Match Report</span>
            </div>
          }
          onClose={() => setShowImportModal(false)}
          maxWidth="md"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Auto Match Rate Card */}
            <div style={{
              padding: "16px",
              borderRadius: 10,
              background: "radial-gradient(ellipse at top, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#34d399" }}>
                    ✓ Statement Processed Successfully
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Rule 1–4 Auto-Matching applied across all active invoices & receipts
                  </div>
                </div>
                <span className="badge badge-green" style={{ fontSize: 12, fontWeight: 800 }}>
                  {Number(importSummary.created ?? 0) > 0
                    ? `${Math.round((Number(importSummary.auto_matched ?? 0) / Number(importSummary.created ?? 1)) * 100)}% Reconciled`
                    : "100% Synced"}
                </span>
              </div>

              {/* Progress meter bar */}
              <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Number(importSummary.created ?? 0) > 0 ? Math.min(100, Math.round((Number(importSummary.auto_matched ?? 0) / Number(importSummary.created ?? 1)) * 100)) : 100}%`,
                    background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                    transition: "width 0.4s ease-in-out",
                  }}
                />
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <div style={{ padding: "12px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Total Parsed</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{importSummary.total_parsed ?? 0}</div>
              </div>
              <div style={{ padding: "12px", borderRadius: 8, background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>New Lines</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6", marginTop: 2 }}>{importSummary.created ?? 0}</div>
              </div>
              <div style={{ padding: "12px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Auto-Matched</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 2 }}>{importSummary.auto_matched ?? 0}</div>
              </div>
              <div style={{ padding: "12px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Unreceipted</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b", marginTop: 2 }}>{importSummary.unreceipted_credits ?? 0}</div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              {Number(importSummary.unreceipted_credits ?? 0) > 0 && (
                <button
                  type="button"
                  className="btn primary sm"
                  style={{ background: "#b45309", borderColor: "#b45309" }}
                  onClick={() => {
                    setActiveTab("unreceipted");
                    setShowImportModal(false);
                  }}
                >
                  <AlertTriangle size={13} style={{ marginRight: 4 }} /> Review {importSummary.unreceipted_credits} Unreceipted Deposits
                </button>
              )}
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowImportModal(false)}
              >
                Close Report
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* AI Auto-Match Intelligence Modal */}
      {showAiMatchModal && (
        <Modal
          title="🤖 AI Bank Narrative Auto-Matcher"
          onClose={() => setShowAiMatchModal(false)}
          wide
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(79, 70, 229, 0.08) 100%)", border: "1px solid rgba(124, 58, 237, 0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 750, color: "var(--text-primary)", fontSize: 14 }}>
                  Quartermaster AI Statement Intelligence
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  Analyzing statement narratives for unit codes, tenant names, phone numbers, and exact invoice balances.
                </div>
              </div>
              {aiMatchStats && (
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 700, fontSize: 12 }}>
                    {aiMatchStats.highConfidence} High Confidence
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-secondary)", fontWeight: 600, fontSize: 12 }}>
                    {aiMatchStats.matched} of {aiMatchStats.total} Matched
                  </span>
                </div>
              )}
            </div>

            {aiMatchLoading ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600 }}>Quartermaster AI is scanning open invoices and matching narratives…</div>
              </div>
            ) : aiMatches.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>All deposits are reconciled!</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>No unmatched bank statement lines were found requiring reconciliation.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "55vh", overflowY: "auto", paddingRight: 4 }}>
                {aiMatches.map((m) => (
                  <div
                    key={m.transaction_id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: m.is_high_confidence ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>
                            {kM(m.amount)}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {m.transacted_on} · Ref: <strong style={{ color: "var(--text-primary)" }}>{m.transaction_ref}</strong>
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: m.is_high_confidence ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                              color: m.is_high_confidence ? "#10b981" : "#f59e0b",
                            }}
                          >
                            {Math.round(m.confidence * 100)}% Match
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                          Narrative: <em>&ldquo;{m.narrative || "—"}&rdquo;</em>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn primary sm"
                        onClick={() => approveAiMatch(m)}
                        style={{
                          background: m.is_high_confidence ? "#16a34a" : "#4f46e5",
                          borderColor: m.is_high_confidence ? "#16a34a" : "#4f46e5",
                          fontWeight: 700,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        ✓ Match & Receipt
                      </button>
                    </div>

                    <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--surface)", border: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <div>
                        <span style={{ color: "var(--muted)" }}>Matched To: </span>
                        <strong>{m.suggested_invoice.tenant_name}</strong> (Unit {m.suggested_invoice.unit_code}) · Invoice <strong className="mono">{m.suggested_invoice.number}</strong>
                      </div>
                      <div style={{ color: "#10b981", fontWeight: 700 }}>
                        Balance: {kM(m.suggested_invoice.balance)}
                      </div>
                    </div>

                    {m.match_reasons && m.match_reasons.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {m.match_reasons.map((r: string, idx: number) => (
                          <span key={idx} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.08)", color: "#6366f1", fontWeight: 600 }}>
                            ✓ {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowAiMatchModal(false)}
              >
                Close
              </button>

              {aiMatches.some((m) => m.is_high_confidence) && (
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={approveAllHighConfidence}
                  disabled={aiBatchBusy}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    fontWeight: 800,
                    padding: "8px 18px",
                  }}
                >
                  <Zap size={14} style={{ marginRight: 6 }} />
                  {aiBatchBusy
                    ? "Batch Receipting…"
                    : `Approve & Receipt All ${aiMatches.filter((m) => m.is_high_confidence).length} High-Confidence Matches`}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


