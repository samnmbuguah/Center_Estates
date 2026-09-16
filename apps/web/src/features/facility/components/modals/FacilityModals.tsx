"use client";

import { Alert, Button, Checkbox, FormControlLabel, TextField } from "@mui/material";
import { Field, Modal } from "@/components/module-ui";
import { ActionModal, Row } from "../../types/facility.types";
import { AssetOnboardingModal, ProviderOnboardingModal } from "./FacilityOnboardingModals";

export function FacilityModals({
  showCreate,
  setShowCreate,
  createWorkOrder,
  actionModal,
  setActionModal,
  submitActionModal,
  createModal,
  setCreateModal,
  handleCreate,
  properties,
  assets,
  createError,
  creating,
  assetKind,
}: {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  createWorkOrder: (e: any) => void;
  actionModal: ActionModal;
  setActionModal: (v: ActionModal) => void;
  submitActionModal: (e: any) => void;
  createModal: "asset" | "contractor" | "inspection" | "service-request" | "ppm" | null;
  setCreateModal: (v: "asset" | "contractor" | "inspection" | "service-request" | "ppm" | null) => void;
  handleCreate: (e: any) => Promise<boolean>;
  properties: Row[];
  assets: Row[];
  createError: string;
  creating: boolean;
  assetKind: "asset" | "spare_part" | "consumable";
}) {
  return (
    <>
      {createModal === "asset" && (
        <AssetOnboardingModal assetKind={assetKind} properties={properties} onClose={() => setCreateModal(null)} onSubmit={handleCreate} error={createError} creating={creating} />
      )}
      {createModal === "contractor" && (
        <ProviderOnboardingModal properties={properties} onClose={() => setCreateModal(null)} onSubmit={handleCreate} error={createError} creating={creating} />
      )}
      {/* Create work order modal */}
      {showCreate && (
        <Modal title="New Work Order" onClose={() => setShowCreate(false)} wide>
            <form onSubmit={createWorkOrder} style={{ display: "grid", gap: 16 }}>
              <Alert severity="info" variant="outlined">Corrective maintenance request. The work-order number is generated automatically when saved.</Alert>
              <div className="grid-2">
                <TextField fullWidth size="small" label="Work order number" value="Generated automatically on save" disabled slotProps={{ htmlInput: { "aria-label": "Work order number", "data-testid": "wo-number-input" } }} />
                <TextField select fullWidth size="small" name="priority" label="Priority" defaultValue="medium" slotProps={{ select: { native: true }, htmlInput: { "data-testid": "wo-priority-select" } }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </TextField>
              </div>
              <TextField fullWidth size="small" name="title" label="Issue title" required placeholder="Describe the maintenance issue" slotProps={{ htmlInput: { "data-testid": "wo-title-input" } }} />
              <div className="grid-2">
                <TextField fullWidth size="small" name="category" label="Category" required placeholder="Mechanical" slotProps={{ htmlInput: { "data-testid": "wo-category-input" } }} />
                <TextField select fullWidth size="small" name="property" label="Property" required defaultValue="" slotProps={{ select: { native: true }, htmlInput: { "data-testid": "wo-property-select" } }}>
                  <option value="" disabled>Select property</option>
                  {properties.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                  ))}
                </TextField>
              </div>
              <TextField fullWidth size="small" name="description" label="Description" multiline minRows={4} slotProps={{ htmlInput: { "data-testid": "wo-description-input" } }} />
              {createError && <Alert severity="error" role="alert">{createError}</Alert>}
              <input type="hidden" name="status" value="open" />
              <div className="form-actions" style={{ gap: 10 }}>
                <Button type="button" variant="outlined" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" variant="contained" data-testid="wo-submit-btn">Create Work Order</Button>
              </div>
            </form>
        </Modal>
      )}

      {/* Action modal — inspections and service-request decisions */}
      {actionModal && (
        <Modal
          title={actionModal.type === "inspection"
            ? "Complete Inspection"
            : actionModal.type === "request-decision"
              ? `${actionModal.decision === "approve" ? "Approve" : "Reject"} Service Request · ${String(actionModal.row.reference ?? "")}`
              : "Mark Service Request Resolved"}
          onClose={() => setActionModal(null)}
        >
          <form onSubmit={submitActionModal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {actionModal.type === "inspection" ? (
              <>
                <Field label="Inspection score" required>
                  <TextField fullWidth size="small" type="number" name="score" required placeholder="0–100" slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }} />
                </Field>
                <Field label="Violations">
                  <TextField fullWidth size="small" type="number" name="violations" defaultValue={0} slotProps={{ htmlInput: { min: 0, step: 1 } }} />
                </Field>
                <Field label="Findings">
                  <TextField fullWidth size="small" name="findings" multiline minRows={4} placeholder="Record the inspection findings" />
                </Field>
                <FormControlLabel control={<Checkbox name="create_work_order" defaultChecked />} label="Create a corrective work order when the inspection fails" />
              </>
            ) : actionModal.type === "request-decision" ? (
              <Field label={actionModal.decision === "reject" ? "Rejection reason" : "Approval notes"} required={actionModal.decision === "reject"}>
                <TextField fullWidth size="small" name="notes" multiline minRows={4} required={actionModal.decision === "reject"} placeholder={actionModal.decision === "reject" ? "Explain why this request will not proceed" : "Budget, priority or assignment instructions"} />
              </Field>
            ) : (
              <div className="info-banner">
                This records that maintenance work is complete and asks the requester to confirm it. The request only closes after the requester accepts the work; they can reopen it with a reason.
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button type="button" variant="outlined" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button type="submit" variant="contained" color={actionModal.type === "request-decision" && actionModal.decision === "reject" ? "error" : "primary"}>
                {actionModal.type === "inspection"
                  ? "Complete Inspection"
                  : actionModal.type === "request-decision"
                    ? `${actionModal.decision === "approve" ? "Approve" : "Reject"} Request`
                    : "Mark resolved & notify requester"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create asset modal */}
      {false && createModal === "asset" && (
        <Modal title="Add New Asset" onClose={() => setCreateModal(null)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Asset code" required>
                <input name="code" required placeholder="AST-0001249" />
              </Field>
              <Field label="Category" required>
                <input name="category" required placeholder="Lift Systems" />
              </Field>
            </div>
            <Field label="Asset name" required>
              <input name="name" required placeholder="OTIS Lift – Lift 2" />
            </Field>
            <div className="grid-2">
              <Field label="Property" required>
                <select name="property" required defaultValue="">
                  <option value="" disabled>Select property</option>
                  {properties.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Purchase value">
                <input name="purchase_value" type="number" min={0} step={1} defaultValue={0} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Condition">
                <select name="condition" defaultValue="good">
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="out_of_service">Out of service</option>
                </select>
              </Field>
              <Field label="Status">
                <select name="is_active" defaultValue="true">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
              <button type="submit" className="btn primary">Add Asset</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create contractor modal */}
      {false && createModal === "contractor" && (
        <Modal title="Add Contractor" onClose={() => setCreateModal(null)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Contractor code" required>
                <input name="code" required placeholder="C-2026-0001" />
              </Field>
              <Field label="Specialty" required>
                <input name="specialty" required placeholder="Plumbing &amp; Drainage" />
              </Field>
            </div>
            <Field label="Company name" required>
              <input name="name" required placeholder="Acme Facilities Ltd." />
            </Field>
            <div className="grid-2">
              <Field label="Contact person">
                <input name="contact_name" placeholder="Jane Doe" />
              </Field>
              <Field label="Phone">
                <input name="phone" placeholder="0712 345 678" />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Email">
                <input name="email" type="email" placeholder="contact@acme.co.ke" />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="review">Under review</option>
                  <option value="suspended">Suspended</option>
                  <option value="expired">Compliance expired</option>
                </select>
              </Field>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
              <button type="submit" className="btn primary">Add Contractor</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create inspection modal */}
      {createModal === "inspection" && (
        <Modal title="New Inspection" onClose={() => setCreateModal(null)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Reference" required>
                <input name="reference" required placeholder="INSP-2026-0057" data-testid="insp-ref-input" />
              </Field>
              <Field label="Type" required>
                <select name="inspection_type" defaultValue="routine" data-testid="insp-type-select">
                  <option value="compliance">Compliance</option>
                  <option value="statutory">Statutory</option>
                  <option value="routine">Routine</option>
                  <option value="preventive">Preventive</option>
                </select>
              </Field>
            </div>
            <Field label="Title" required>
              <input name="title" required placeholder="Fire Extinguisher Check" data-testid="insp-title-input" />
            </Field>
            <div className="grid-2">
              <Field label="Property" required>
                <select name="property" required defaultValue="" data-testid="insp-property-select">
                  <option value="" disabled>Select property</option>
                  {properties.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Asset">
                <select name="asset" defaultValue="" data-testid="insp-asset-select">
                  <option value="">None</option>
                  {assets.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{String(row.code)} – {String(row.name)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Scheduled on" required>
              <input name="scheduled_on" type="date" required data-testid="insp-date-input" />
            </Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
              <button type="submit" className="btn primary" data-testid="insp-submit-btn">Create Inspection</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create service request modal */}
      {createModal === "service-request" && (
        <Modal title="New Service Request" onClose={() => setCreateModal(null)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Subject / Title" required>
              <input name="subject" required placeholder="e.g. AC not cooling – Office 38" data-testid="sr-title-input" />
            </Field>
            <div className="grid-2">
              <Field label="Category">
                <select name="category" defaultValue="General" data-testid="sr-category-input">
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Fire Safety">Fire Safety</option>
                  <option value="Carpentry">Carpentry</option>
                  <option value="General">General</option>
                </select>
              </Field>
              <Field label="Priority">
                <select name="priority" defaultValue="medium" data-testid="sr-priority-select">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Reference">
                <input name="reference" placeholder="e.g. SR-2026-0188" />
              </Field>
              <Field label="Property">
                <select name="property" defaultValue="">
                  <option value="" disabled>Select property</option>
                  {properties.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Reported on">
              <input name="submitted_at" type="date" />
            </Field>
            <Field label="Description">
              <textarea name="description" rows={3} placeholder="What needs attention?" />
            </Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
              <button type="submit" className="btn primary" data-testid="sr-submit-btn">Create Request</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create PPM task modal */}
      {createModal === "ppm" && (
        <Modal title="Create PPM Task" onClose={() => setCreateModal(null)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Task code" required>
                <input name="code" required placeholder="PPM-2026-0459" />
              </Field>
              <Field label="Frequency" required>
                <select name="frequency" defaultValue="monthly">
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biannual">Biannual</option>
                  <option value="annual">Annual</option>
                </select>
              </Field>
            </div>
            <Field label="Task name" required>
              <input name="name" required placeholder="Lift Preventive Maintenance" />
            </Field>
            <div className="grid-2">
              <Field label="Asset" required>
                <select name="asset" required defaultValue="">
                  <option value="" disabled>Select asset</option>
                  {assets.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{String(row.code)} – {String(row.name)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Next due on" required>
                <input name="next_due_on" type="date" required />
              </Field>
            </div>
            <Field label="Estimated hours">
              <input name="estimated_hours" type="number" min={0} step={0.5} defaultValue={1} />
            </Field>
            <Field label="Instructions">
              <textarea name="instructions" rows={3} />
            </Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
              <button type="submit" className="btn primary">Create Task</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
