"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Download, Plus } from "lucide-react";
import { Field, Modal, money } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

export function ExpenditureView({ rows, organizationId, propertyId, canApprove, reload }: {
  rows: Row[];
  organizationId: string | null;
  propertyId: string | null;
  canApprove: boolean;
  reload: () => Promise<void>;
}) {
  const [floatAllocated, setFloatAllocated] = useState(0);
  const [showRecord, setShowRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{ row: Row; action: "approve" | "reject" } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    apiFetch("/facility/budgets/", {}, organizationId)
      .then(async (response) => response.ok ? response.json() : [])
      .then((budgets: Row[]) => setFloatAllocated(
        budgets.reduce((total, budget) => total + Number(budget.allocated_amount ?? 0), 0),
      ))
      .catch(() => setFloatAllocated(0));
  }, [organizationId, propertyId]);

  const spent = rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const remaining = floatAllocated - spent;
  const spentPct = floatAllocated > 0 ? Math.max(0, Math.min(100, Math.round((spent / floatAllocated) * 100))) : 0;

  const expenditures = rows;

  async function recordExpenditure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !propertyId) {
      setFormError("Select a property before recording expenditure.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFormError("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/expenses/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
      property: propertyId,
      spent_on: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
      category: String(form.get("category") ?? "General"),
      description: String(form.get("description") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      float_reference: String(form.get("float_ref") ?? ""),
      supplier: String(form.get("supplier") ?? ""),
      receipt_reference: String(form.get("receipt_reference") ?? ""),
      }),
    }, organizationId);
    setSaving(false);
    if (!response.ok) {
      setFormError(await apiErrorMessage(response, "The expenditure could not be saved."));
      return;
    }
    setShowRecord(false);
    await reload();
  }

  async function decideExpense(row: Row, action: "approve" | "reject", notes = "") {
    if (!organizationId || !row.id) return;
    setActionId(String(row.id));
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/expenses/${row.id}/${action}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, organizationId);
    setActionId(null);
    if (!response.ok) {
      setFormError(await apiErrorMessage(response, `The expense could not be ${action}d.`));
      return;
    }
    setDecisionTarget(null);
    await reload();
  }

  return (
    <>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-.02em" }}>Expenditure & Landlord Floats</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mt: 0.5 }}>
            Track the landlord float cash-flow advance against facilities expenditure.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => { setFormError(""); setShowRecord(true); }}
          sx={{ fontWeight: 800 }}
        >
          Record Expenditure
        </Button>
      </Box>

      {/* Float KPI cards */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2, border: "1.5px solid", borderColor: "info.main", bgcolor: "rgba(37, 99, 235, 0.04)" }}>
          <Typography variant="caption" color="info.main" sx={{ fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", display: "block", mb: 1 }}>
            Landlord Float Allocated
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>{money.format(floatAllocated)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mt: 1.25, display: "block" }}>
            From the approved FM budget for this property
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", display: "block", mb: 1 }}>Spent</Typography>
          <Typography variant="h5" sx={{ fontWeight: 900 }} color="error">{money.format(spent)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{spentPct}% of allocated float</Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", display: "block", mb: 1 }}>Remaining Balance</Typography>
          <Typography variant="h5" sx={{ fontWeight: 900 }} color={remaining < 0 ? "error" : "success.main"}>
            {money.format(Math.max(remaining, 0))}
          </Typography>
          {remaining < 0 && (
            <Typography variant="caption" color="error" sx={{ fontWeight: 800 }}>
              Float exceeded by {money.format(Math.abs(remaining))}
            </Typography>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", display: "block", mb: 1 }}>Float Utilization</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.75 }}>
            <LinearProgress
              variant="determinate"
              value={spentPct}
              color={spentPct >= 100 ? "error" : spentPct >= 75 ? "warning" : "success"}
              sx={{ flex: 1, height: 10, borderRadius: 99 }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{spentPct}%</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>remaining = float − sum(spent)</Typography>
        </Paper>
      </Box>

      {formError && <Box className="form-error" role="alert" sx={{ mb: 2 }}>{formError}</Box>}

      {/* Expenditure table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Expenditures ({expenditures.length})</Typography>
          <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={() => exportCsv(expenditures, "facility-expenditures.csv")} sx={{ fontWeight: 800 }}>
            Export
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Float Reference</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                {canApprove && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {expenditures.length > 0 ? expenditures.map((e) => (
                <TableRow key={String(e.id)} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 750 }}>
                      {e.spent_on ? new Date(String(e.spent_on)).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700, textTransform: "capitalize" }}>{String(e.category ?? "—")}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(e.description ?? "—")}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{money.format(Number(e.amount ?? 0))}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>
                      {String(e.float_reference ?? "—")}
                    </Typography>
                  </TableCell>
                  <TableCell><FcStatus value={String(e.status ?? "pending")} /></TableCell>
                  {canApprove && (
                    <TableCell>
                      {e.status === "pending" ? (
                        <Box sx={{ display: "flex", gap: 0.75 }}>
                          <Button size="small" variant="contained" color="success" disabled={actionId === String(e.id)}
                            onClick={() => { setFormError(""); setDecisionTarget({ row: e, action: "approve" }); }}>
                            Approve
                          </Button>
                          <Button size="small" variant="outlined" color="error" disabled={actionId === String(e.id)}
                            onClick={() => { setFormError(""); setDecisionTarget({ row: e, action: "reject" }); }}>
                            Reject
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Reviewed</Typography>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={canApprove ? 7 : 6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No expenditures recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Record expenditure modal */}
      {showRecord && (
        <Modal title="Record Expenditure" onClose={() => setShowRecord(false)}>
          <form onSubmit={recordExpenditure} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Date" required>
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Category" required>
                <select name="category" defaultValue="General">
                  <option value="Repairs">Repairs</option>
                  <option value="Parts">Parts / Materials</option>
                  <option value="Labor">Labor</option>
                  <option value="Utilities">Utilities</option>
                  <option value="General">General</option>
                </select>
              </Field>
            </div>
            <Field label="Description" required>
              <input name="description" required placeholder="e.g. Generator oil top-up" />
            </Field>
            <div className="grid-2">
              <Field label="Amount" required>
                <input name="amount" type="number" min={0} step={1} required placeholder="0" />
              </Field>
              <Field label="Float reference">
                <input name="float_ref" placeholder={`FLT-${new Date().getFullYear()}`} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Supplier / payee"><input name="supplier" autoComplete="organization" /></Field>
              <Field label="Receipt reference"><input name="receipt_reference" autoComplete="off" /></Field>
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowRecord(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Record Expenditure"}</button>
            </div>
          </form>
        </Modal>
      )}
      {decisionTarget && (
        <Modal title={`${decisionTarget.action === "approve" ? "Approve" : "Reject"} Expenditure`} onClose={() => setDecisionTarget(null)}>
          <form onSubmit={(event) => {
            event.preventDefault();
            const notes = String(new FormData(event.currentTarget).get("notes") ?? "");
            void decideExpense(decisionTarget.row, decisionTarget.action, notes);
          }} style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              {String(decisionTarget.row.description ?? "Expense")} · {money.format(Number(decisionTarget.row.amount ?? 0))}
            </p>
            <Field label="Decision notes" required={decisionTarget.action === "reject"}>
              <textarea name="notes" rows={4} required={decisionTarget.action === "reject"} placeholder={decisionTarget.action === "reject" ? "Explain why this expense is rejected" : "Optional verification note"} />
            </Field>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setDecisionTarget(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={actionId === String(decisionTarget.row.id)}>
                {actionId === String(decisionTarget.row.id) ? "Saving…" : decisionTarget.action === "approve" ? "Approve expense" : "Reject expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
