import { useState } from "react";
import { Row } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";
import { exportCsv } from "../../utils/facility.utils";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { Box, Button, Grid, Typography } from "@mui/material";
import { ClipboardList, Clock, AlertTriangle, TrendingUp, Wrench, Sparkles, CheckCircle2, Phone, Star } from "lucide-react";
import { Modal, Field } from "@/components/module-ui";
import { apiFetch } from "@/lib/api";

export function ServiceRequestsView({
  rows,
  kpis,
  onAction,
  permissions,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAction: (row: Row, action: string) => void;
  permissions: { canWork: boolean; canApprove: boolean };
  onAdd: () => void;
}) {
  const [currentTime] = useState(() => Date.now());

  // AI Triage Modal state
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triageSubject, setTriageSubject] = useState("");
  const [triageDescription, setTriageDescription] = useState("");
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<any | null>(null);

  const handleRunTriage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!triageDescription.trim()) return;
    setTriageLoading(true);
    setTriageResult(null);
    try {
      const res = await apiFetch("/facility/service-requests/ai-triage/", {
        method: "POST",
        body: JSON.stringify({
          subject: triageSubject,
          description: triageDescription,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTriageResult(data);
      }
    } catch {
      // ignore
    } finally {
      setTriageLoading(false);
    }
  };

  const openRowTriage = (row: Row) => {
    setTriageSubject(String(row.subject || ""));
    setTriageDescription(String(row.description || row.subject || ""));
    setShowTriageModal(true);
  };

  const displayRows = rows;

  const totalReq = Number(kpis?.openRequests ?? rows.length);
  const openReq = rows.filter((r) => ["new", "approved", "assigned"].includes(String(r.status))).length;
  const inProgressReq = rows.filter((r) => String(r.status) === "in_progress").length;
  const overdueReq = rows.filter((r) => Boolean(r.response_due_at) && new Date(String(r.response_due_at)).getTime() < currentTime && !["resolved", "closed", "rejected"].includes(String(r.status))).length;

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Service Requests Management
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                setTriageSubject("");
                setTriageDescription("");
                setTriageResult(null);
                setShowTriageModal(true);
              }}
              startIcon={<Sparkles size={16} />}
              sx={{
                background: "linear-gradient(135deg, var(--color-violet) 0%, var(--color-indigo) 100%)",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
              }}
            >
              AI Triage & Match
            </Button>
            {permissions.canWork && (
              <Button variant="contained" onClick={onAdd} startIcon={<Wrench size={18} />}>
                New Service Request
              </Button>
            )}
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "var(--color-indigo)", color: "white",
              textAlign: "center"
            }}>
              <ClipboardList size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{totalReq}</Typography>
              <Typography variant="caption">Open Requests</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "var(--color-amber)", color: "white",
              textAlign: "center"
            }}>
              <Clock size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{openReq}</Typography>
              <Typography variant="caption">New & Assigned</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "var(--color-blue)", color: "white",
              textAlign: "center"
            }}>
              <TrendingUp size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{inProgressReq}</Typography>
              <Typography variant="caption">In Progress</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: overdueReq > 0 ? "var(--color-danger)" : "var(--color-green)", color: "white",
              textAlign: "center"
            }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{overdueReq}</Typography>
              <Typography variant="caption">Overdue</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <EnhancedDataTable
        data={displayRows}
        columns={[
          { id: "reference", label: "Request ID", sortable: true, filterable: true },
          { id: "subject", label: "Subject", sortable: true, filterable: true },
          { id: "category", label: "Category", sortable: true, filterable: true },
          { id: "priority", label: "Priority", sortable: true, filterable: true },
          { id: "status", label: "Status", sortable: true, filterable: true, render: (value) => <FcStatus value={String(value)} /> },
          { id: "property_name", label: "Property", sortable: true, filterable: true },
          { id: "submitted_at", label: "Created", sortable: true, filterable: true },
          { id: "response_due_at", label: "Due Date", sortable: true, filterable: true },
          {
            id: "workflow_actions",
            label: "Workflow actions",
            render: (_value, row) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }} onClick={(event) => event.stopPropagation()}>
                <Button size="small" variant="outlined" color="secondary" onClick={() => openRowTriage(row)} sx={{ fontSize: 11, fontWeight: 700 }}>
                  🤖 Triage
                </Button>
                {String(row.status) === "new" && permissions.canApprove && (
                  <>
                    <Button size="small" variant="contained" color="success" onClick={() => onAction(row, "approve")}>Approve</Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => onAction(row, "reject")}>Reject</Button>
                  </>
                )}
                {String(row.status) === "approved" && permissions.canWork && (
                  <Button size="small" variant="contained" onClick={() => onAction(row, "convert")}>Create WO</Button>
                )}
                {["assigned", "in_progress"].includes(String(row.status)) && permissions.canWork && (
                  <Button size="small" variant="outlined" onClick={() => onAction(row, "resolve")}>Mark resolved</Button>
                )}
                {String(row.status) === "resolved" && (
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>Awaiting requester confirmation</Typography>
                )}
              </Box>
            ),
          },
        ]}
        loading={false}
        emptyTitle="No service requests"
        emptyDescription="Create a new service request to get started"
        onExport={(selectedRows) => exportCsv(selectedRows, "facility-service-requests.csv")}
        selectable
      />

      {/* AI Triage & Contractor Match Modal */}
      {showTriageModal && (
        <Modal
          title="🛠️ AI Maintenance Triage & Contractor Matching"
          onClose={() => {
            setShowTriageModal(false);
            setTriageResult(null);
          }}
          wide
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(79, 70, 229, 0.08) 100%)", border: "1px solid rgba(124, 58, 237, 0.2)" }}>
              <div style={{ fontWeight: 750, color: "var(--text-primary)", fontSize: 14 }}>
                Quartermaster AI Maintenance Diagnostic
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Enter the reported defect details to automatically classify trade, urgency SLA, estimated cost range, and match verified contractors.
              </div>
            </div>

            <form onSubmit={handleRunTriage} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Defect Title / Subject">
                <input
                  type="text"
                  placeholder="e.g. Master bedroom shower leaking into apartment below"
                  value={triageSubject}
                  onChange={(e) => setTriageSubject(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}
                />
              </Field>

              <Field label="Detailed Description / Tenant Report" required>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue symptoms, urgency, affected rooms or appliances…"
                  value={triageDescription}
                  onChange={(e) => setTriageDescription(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 }}
                />
              </Field>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="btn sm"
                  disabled={triageLoading || !triageDescription.trim()}
                  style={{
                    background: "linear-gradient(135deg, var(--color-violet) 0%, var(--color-indigo) 100%)",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    padding: "8px 18px",
                  }}
                >
                  <Sparkles size={14} style={{ marginRight: 6 }} />
                  {triageLoading ? "Analyzing Defect…" : "Run AI Triage"}
                </button>
              </div>
            </form>

            {triageResult && (
              <div style={{ padding: 16, borderRadius: 10, background: "var(--surface-2)", border: "1px solid rgba(124, 58, 237, 0.3)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>
                      Trade: <strong style={{ color: "var(--color-violet)" }}>{triageResult.detected_category?.toUpperCase()}</strong>
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 800,
                        background: triageResult.suggested_priority === "critical" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        color: triageResult.suggested_priority === "critical" ? "var(--color-danger)" : "var(--color-amber)",
                      }}
                    >
                      Priority: {triageResult.suggested_priority?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-emerald)" }}>
                    Est. Cost: KES {triageResult.estimated_cost_range?.min_kes?.toLocaleString()} - {triageResult.estimated_cost_range?.max_kes?.toLocaleString()}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--surface)", padding: "8px 12px", borderRadius: 6, border: "1px dashed var(--border)" }}>
                  💡 <strong>Diagnostic Note:</strong> {triageResult.urgency_reason}
                </div>

                {triageResult.recommended_contractors && triageResult.recommended_contractors.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                      Recommended Contractors ({triageResult.recommended_contractors.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {triageResult.recommended_contractors.map((c: any) => (
                        <div
                          key={c.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <strong style={{ fontSize: 13 }}>{c.name}</strong>
                              {c.is_trade_matched && (
                                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "var(--color-emerald)", fontWeight: 700 }}>
                                  ✓ Trade Match
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              Specialization: {c.specialization} · Tel: {c.phone || "—"} · Rating: ★ {c.rating}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn primary sm"
                            onClick={() => {
                              setShowTriageModal(false);
                              onAdd();
                            }}
                            style={{ fontWeight: 700, fontSize: 11 }}
                          >
                            Assign to WO →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

