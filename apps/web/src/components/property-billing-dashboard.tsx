"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { AlertTriangle, CheckCircle2, FilePlus2, Send, WalletCards, Waves } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";

type Candidate = {
  id: string; tenant_name: string; property_name: string; unit_code: string; lease_reference: string;
  due_date: string; billing_items: Array<{ code: string; description: string; total?: string }>;
  total: string; status: string;
  issue_summary: Array<{ code: string; message: string; severity: string }>;
  invoice_number?: string;
};
type BillingIssue = { id: string; code: string; message: string; severity: string; status: string; resolution_notes?: string };
type BillingRun = {
  id: string; period_start: string; period_end: string; status: string;
  totals: Record<string, string | number>; candidates: Candidate[]; issues: BillingIssue[];
};
type Invoice = { id: string; number: string; tenant_name: string; unit_code: string; amount: string; status: string; issued_on: string };

const statusColor = (status: string): "success" | "error" | "warning" | "default" =>
  status === "ready" || status === "generated" || status === "issued" || status === "approved"
    ? "success"
    : status === "issue" || status === "overdue" || status === "blocking"
      ? "error"
      : status === "review" || status === "preparing" || status === "warning"
        ? "warning"
        : "default";

function issueResolution(code: string): { label: string; href: string } | null {
  if (code.includes("water") || code.includes("meter")) return { label: "Open meters", href: "/facility?tab=meters" };
  if (code.includes("lease") || code.includes("rent")) return { label: "Open leases", href: "/property?tab=leases" };
  if (code.includes("duplicate") || code.includes("invoice")) return { label: "Invoice register", href: "/property?tab=rent" };
  return null;
}

export function PropertyBillingDashboard({ onNavigate, onSingleInvoice }: { onNavigate: (tab: string) => void; onSingleInvoice: () => void }) {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [run, setRun] = useState<BillingRun | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [overrideIssue, setOverrideIssue] = useState<BillingIssue | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");
  const canFinance = can("property.finance");
  const canApprove = can("property.approve");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const [runResponse, invoiceResponse] = await Promise.all([
      apiFetch("/property/billing-runs/", {}, organizationId),
      apiFetch("/property/invoices/", {}, organizationId),
    ]);
    if (!runResponse.ok || !invoiceResponse.ok) {
      setError(await apiErrorMessage(!runResponse.ok ? runResponse : invoiceResponse, "Billing information could not be loaded."));
      setLoading(false); return;
    }
    const runRows = await runResponse.json() as BillingRun[];
    const invoiceRows = await invoiceResponse.json() as Invoice[];
    setInvoices(invoiceRows);
    const matching = runRows.find(item => item.period_start.startsWith(month));
    setRun(matching ?? null);
    setSelected(matching?.candidates.filter(item => item.status === "ready").map(item => item.id) ?? []);
    setLoading(false);
  }, [month, organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action); setError(""); setNotice("");
    const [year, monthNumber] = month.split("-").map(Number);
    const periodStart = `${month}-01`;
    const periodEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const response = action === "create"
      ? await apiFetch("/property/billing-runs/", { method: "POST", body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }) }, organizationId)
      : await apiFetch(`/property/billing-runs/${run?.id}/${action}/`, { method: "POST", body: JSON.stringify(action === "generate" ? { candidate_ids: selected } : {}) }, organizationId);
    if (!response.ok) setError(await apiErrorMessage(response, `The billing ${action} action could not be completed.`));
    else {
      const labels: Record<string, string> = {
        create: "Monthly billing queue created.",
        prepare: "Readiness check completed.",
        approve: "Billing run approved. Invoices can now be generated.",
        generate: "Selected invoices were generated.",
      };
      setNotice(labels[action] ?? "Billing action completed.");
    }
    await load(); setBusy("");
  }

  async function authorizeOverride() {
    if (!organizationId || !run || !overrideIssue) return;
    setBusy("override"); setError(""); setNotice("");
    const response = await apiFetch(`/property/billing-runs/${run.id}/resolve-issue/`, {
      method: "POST", body: JSON.stringify({ issue: overrideIssue.id, status: "overridden", notes: overrideNotes }),
    }, organizationId);
    if (!response.ok) setError(await apiErrorMessage(response, "The billing exception could not be authorized."));
    else {
      setOverrideIssue(null); setOverrideNotes("");
      setNotice("Exception authorized. Candidate totals have been refreshed.");
    }
    await load(); setBusy("");
  }

  const totals = run?.totals ?? {};
  const ready = Number(totals.ready ?? run?.candidates.filter(item => item.status === "ready").length ?? 0);
  const issues = Number(totals.with_issues ?? run?.candidates.filter(item => item.status === "issue").length ?? 0);
  const blockingOpen = Boolean(run?.issues.some(issue => issue.severity === "blocking" && issue.status === "open"));
  const generatedThisMonth = invoices.filter(item => item.issued_on?.startsWith(month));
  const paidThisMonth = generatedThisMonth.filter(item => item.status === "paid");
  const overdue = invoices.filter(item => item.status === "overdue");
  const waterIssues = run?.issues.filter(item => item.code.includes("water") || item.code.includes("meter")) ?? [];
  const workflow = ["Check readiness", "Review invoices", "Approve billing", "Generate invoices", "Track collections"];
  const workflowStep = !run ? 0 : run.status === "preparing" ? 0 : run.status === "review" ? 1 : run.status === "approved" ? 3 : run.status === "generated" ? 4 : 1;

  const visibleCandidates = useMemo(() => {
    const rows = run?.candidates ?? [];
    const query = search.trim().toLowerCase();
    return rows.filter(candidate => {
      if (statusFilter !== "all" && candidate.status !== statusFilter) return false;
      if (!query) return true;
      return [candidate.tenant_name, candidate.lease_reference, candidate.unit_code, candidate.property_name]
        .join(" ").toLowerCase().includes(query);
    });
  }, [run, search, statusFilter]);

  const readyVisibleIds = visibleCandidates.filter(item => item.status === "ready").map(item => item.id);
  const allReadySelected = readyVisibleIds.length > 0 && readyVisibleIds.every(id => selected.includes(id));

  if (loading) return <LoadingState rows={6} />;
  return <Box sx={{ display: "grid", gap: 2 }}>
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
      <Box>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 900 }}>Rent and billing</Typography>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Billing & invoicing dashboard</Typography>
        <Typography variant="body2" color="text.secondary">Prepare, validate, approve and issue invoices from tenancy terms and approved meter readings.</Typography>
      </Box>
      <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {run && <Chip color={statusColor(run.status)} label={`Run: ${run.status.replaceAll("_", " ")}`} sx={{ fontWeight: 800 }} />}
        <TextField type="month" size="small" label="Billing month" value={month} onChange={event => setMonth(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 190 }} />
      </Stack>
    </Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
    {!canFinance && !canApprove && (
      <Alert severity="info">You can review the billing queue, but preparing, approving or generating invoices requires finance or approval rights.</Alert>
    )}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", lg: "repeat(7, minmax(0,1fr))" }, gap: 1.25 }}>
      {[
        ["Invoices to bill", Number(totals.candidates ?? 0), totals.total_amount ?? 0, "primary"],
        ["Ready", ready, totals.amount_ready ?? 0, "success"], ["With issues", issues, totals.amount_with_issues ?? 0, "warning"],
        ["Generated", generatedThisMonth.length, generatedThisMonth.reduce((sum, row) => sum + Number(row.amount), 0), "primary"],
        ["Paid", paidThisMonth.length, paidThisMonth.reduce((sum, row) => sum + Number(row.amount), 0), "success"],
        ["Overdue", overdue.length, overdue.reduce((sum, row) => sum + Number(row.amount), 0), "error"],
        ["Collection target", "—", totals.total_amount ?? 0, "success"],
      ].map(([label, value, amount, color]) => (
        <Paper key={String(label)} variant="outlined" sx={{ p: 1.5, borderRadius: 3, borderTop: 3, borderTopColor: `${color}.main`, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>{value}</Typography>
          <Typography variant="caption" sx={{ fontWeight: 800 }}>{money.format(Number(amount))}</Typography>
        </Paper>
      ))}
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.15fr 1fr" }, gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Invoice actions</Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          {!run && <Button variant="contained" disabled={!canFinance || Boolean(busy)} onClick={() => void mutate("create")}>Create monthly queue</Button>}
          {run && <Button variant="contained" startIcon={<CheckCircle2 size={17} />} disabled={!canFinance || Boolean(busy) || run.status === "generated"} onClick={() => void mutate("prepare")}>Check readiness</Button>}
          <Button variant="outlined" startIcon={<FilePlus2 size={17} />} onClick={onSingleInvoice}>Single invoice</Button>
          <Button variant="outlined" onClick={() => onNavigate("rent")}>Invoice register</Button>
          <Button variant="outlined" onClick={() => onNavigate("credit-notes")}>Credit notes</Button>
          <Button variant="outlined" onClick={() => onNavigate("receipts")}>Receipts</Button>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Workflow</Typography>
        <Stack direction="row" sx={{ alignItems: "center", gap: .75, overflowX: "auto", pb: .5 }}>
          {workflow.map((label, index) => (
            <Box key={label} sx={{ display: "flex", alignItems: "center", gap: .75, flexShrink: 0 }}>
              <Chip size="small" color={index <= workflowStep ? "primary" : "default"} label={`${index + 1} ${label}`} />
              {index < workflow.length - 1 && <Typography color="text.secondary">›</Typography>}
            </Box>
          ))}
        </Stack>
      </Paper>
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0,1.65fr) minmax(310px,.75fr)" }, gap: 2 }}>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap", borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Invoices scheduled for billing — {month}</Typography>
            <Typography variant="caption" color="text.secondary">Generated from active lease terms, billing profiles and approved meter readings.</Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {run?.status === "review" && (
              <Button
                variant="outlined"
                disabled={!canApprove || Boolean(busy) || blockingOpen}
                onClick={() => void mutate("approve")}
                title={blockingOpen ? "Resolve or authorize blocking issues first" : undefined}
              >
                Approve run
              </Button>
            )}
            {run?.status === "approved" && (
              <Button variant="contained" startIcon={<Send size={16} />} disabled={!canFinance || selected.length === 0 || Boolean(busy)} onClick={() => void mutate("generate")}>
                Generate {selected.length} invoices
              </Button>
            )}
          </Stack>
        </Box>
        {run && (
          <Box sx={{ px: 2, py: 1.25, display: "flex", gap: 1, flexWrap: "wrap", borderBottom: 1, borderColor: "divider", alignItems: "center" }}>
            <TextField size="small" label="Search queue" value={search} onChange={event => setSearch(event.target.value)} sx={{ minWidth: 200 }} />
            <TextField select size="small" label="Status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} sx={{ minWidth: 140 }}>
              {[["all", "All"], ["ready", "Ready"], ["issue", "Issues"], ["generated", "Generated"], ["excluded", "Excluded"]].map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
            {readyVisibleIds.length > 0 && (
              <FormControlLabel
                control={<Checkbox size="small" checked={allReadySelected} onChange={() => setSelected(allReadySelected ? selected.filter(id => !readyVisibleIds.includes(id)) : Array.from(new Set([...selected, ...readyVisibleIds])))} />}
                label="Select all ready"
              />
            )}
            <Typography variant="caption" color="text.secondary">{visibleCandidates.length} of {run.candidates.length} shown · {selected.length} selected</Typography>
          </Box>
        )}
        {busy && <LinearProgress />}
        {!run ? (
          <EmptyState title="No billing queue prepared" description={canFinance ? "Create the monthly queue for the selected property, then run readiness checks before invoices are issued." : "A finance user must create the monthly queue before invoices can be prepared."} />
        ) : visibleCandidates.length === 0 ? (
          <EmptyState title="No matching invoices" description="Adjust the status or search filters, or re-run readiness to rebuild the queue." />
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th></th><th>Tenant</th><th>Property / unit</th><th>Due</th><th>Billing items</th><th>Amount</th><th>Status</th><th>Issue</th>
                </tr>
              </thead>
              <tbody>
                {visibleCandidates.map(candidate => (
                  <tr key={candidate.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${candidate.tenant_name}`}
                        disabled={candidate.status !== "ready"}
                        checked={selected.includes(candidate.id)}
                        onChange={() => setSelected(current => current.includes(candidate.id) ? current.filter(id => id !== candidate.id) : [...current, candidate.id])}
                      />
                    </td>
                    <td>
                      <strong>{candidate.tenant_name}</strong><br />
                      <small>{candidate.lease_reference}{candidate.invoice_number ? ` · ${candidate.invoice_number}` : ""}</small>
                    </td>
                    <td>{candidate.property_name} / {candidate.unit_code}</td>
                    <td>{candidate.due_date}</td>
                    <td>
                      {candidate.billing_items.map(item => item.code).join(", ") || "—"}
                      {candidate.billing_items.some(item => item.code.toUpperCase() === "WATER") && (
                        <Typography component="span" variant="caption" color="primary" sx={{ display: "block" }}>Includes metered water</Typography>
                      )}
                    </td>
                    <td><strong>{money.format(Number(candidate.total))}</strong></td>
                    <td><Chip size="small" color={statusColor(candidate.status)} label={candidate.status.replaceAll("_", " ")} /></td>
                    <td>
                      <Typography variant="caption" color={candidate.issue_summary.some(item => item.severity === "blocking") ? "error" : "text.secondary"}>
                        {candidate.issue_summary.map(item => item.message).join(" · ") || "—"}
                      </Typography>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Paper>

      <Stack sx={{ gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Waves size={18} />
            <Typography sx={{ fontWeight: 900 }}>Water billing readiness</Typography>
          </Stack>
          <Typography variant="h5" color={waterIssues.length ? "error.main" : "success.main"} sx={{ fontWeight: 900, mt: 2 }}>
            {waterIssues.length ? "Not ready" : "Ready"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
            {waterIssues.length
              ? `${waterIssues.length} meter-reading issue${waterIssues.length === 1 ? "" : "s"} must be resolved or authorized.`
              : "No blocking water-reading issues in this run."}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>
            <Button component={Link} href="/facility?tab=meters">Review meters</Button>
            <Button onClick={() => onNavigate("calendar")}>Deadlines</Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <WalletCards size={18} />
            <Typography sx={{ fontWeight: 900 }}>Recent invoices</Typography>
          </Stack>
          {invoices.slice(0, 5).map(invoice => (
            <Box key={invoice.id} sx={{ py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", gap: 1 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{invoice.number}</Typography>
                <Typography variant="caption" color="text.secondary">{invoice.tenant_name} · {invoice.unit_code}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{money.format(Number(invoice.amount))}</Typography>
                <Typography variant="caption">{invoice.status}</Typography>
              </Box>
            </Box>
          ))}
          <Button sx={{ mt: 1 }} onClick={() => onNavigate("rent")}>Open invoice register</Button>
        </Paper>

        {run?.issues.some(issue => issue.status === "open") && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
              <AlertTriangle size={18} />
              <Typography sx={{ fontWeight: 900 }}>Readiness exceptions</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Correct the source record and run readiness again. An approver may authorize a documented exception where policy permits.
            </Typography>
            {run.issues.filter(issue => issue.status === "open").map(issue => {
              const action = issueResolution(issue.code);
              return (
                <Box key={issue.id} sx={{ py: 1.25, borderTop: 1, borderColor: "divider" }}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "start", gap: 1 }}>
                    <Box>
                      <Chip size="small" color={issue.severity === "blocking" ? "error" : "warning"} label={issue.code.replaceAll("_", " ")} />
                      <Typography variant="body2" sx={{ mt: .75 }}>{issue.message}</Typography>
                    </Box>
                    <Stack direction="row" sx={{ gap: .5, flexWrap: "wrap" }}>
                      {action && <Button size="small" component={Link} href={action.href}>{action.label}</Button>}
                      {canApprove && <Button size="small" onClick={() => { setOverrideIssue(issue); setOverrideNotes(""); }}>Authorize override</Button>}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Paper>
        )}
      </Stack>
    </Box>

    <Dialog open={Boolean(overrideIssue)} onClose={() => setOverrideIssue(null)} fullWidth maxWidth="sm">
      <DialogTitle>Authorize billing exception</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This does not repair source data. It records an approver-authorized exception and permits the affected invoice candidate to proceed.
        </Alert>
        <Typography sx={{ fontWeight: 800, mb: 1 }}>{overrideIssue?.message}</Typography>
        <TextField
          autoFocus required fullWidth multiline minRows={3}
          label="Approval rationale"
          value={overrideNotes}
          onChange={event => setOverrideNotes(event.target.value)}
          helperText="Explain the evidence, business reason and follow-up action."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOverrideIssue(null)}>Cancel</Button>
        <Button variant="contained" color="warning" disabled={!overrideNotes.trim() || Boolean(busy)} onClick={() => void authorizeOverride()}>
          Authorize exception
        </Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
