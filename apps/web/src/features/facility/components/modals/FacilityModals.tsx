"use client";

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
}) {
  return (
    <>
      {createModal === "asset" && (
        <AssetOnboardingModal properties={properties} onClose={() => setCreateModal(null)} onSubmit={handleCreate} error={createError} creating={creating} />
      )}
      {createModal === "contractor" && (
        <ProviderOnboardingModal properties={properties} onClose={() => setCreateModal(null)} onSubmit={handleCreate} error={createError} creating={creating} />
      )}
      {/* Create work order modal */}
      {showCreate && (
        <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <div className="form-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <p className="eyebrow">Corrective maintenance</p>
                <h2>New Work Order</h2>
              </div>
              <button onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={createWorkOrder}>
              <div className="form-row">
                <label>
                  Work order number
                  <input value="Generated automatically on save" disabled aria-label="Work order number" data-testid="wo-number-input" />
                </label>
                <label>
                  Priority
                  <select name="priority" defaultValue="medium" data-testid="wo-priority-select">
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
              </div>
              <label>
                Issue title
                <input name="title" required placeholder="Describe the maintenance issue" data-testid="wo-title-input" />
              </label>
              <div className="form-row">
                <label>
                  Category
                  <input name="category" required placeholder="Mechanical" data-testid="wo-category-input" />
                </label>
                <label>
                  Property
                  <select name="property" required defaultValue="" data-testid="wo-property-select">
                    <option value="" disabled>Select property</option>
                    {properties.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {String(row.name)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea name="description" rows={4} data-testid="wo-description-input" />
              </label>
              {createError && <div className="form-error" role="alert">{createError}</div>}
              <input type="hidden" name="status" value="open" />
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="primary-action" data-testid="wo-submit-btn">Create Work Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action modal — inspections and service-request decisions */}
      {actionModal && (
        <Modal
          title={actionModal.type === "inspection"
            ? "Complete Inspection"
            : actionModal.type === "request-decision"
              ? `${actionModal.decision === "approve" ? "Approve" : "Reject"} Service Request · ${String(actionModal.row.reference ?? "")}`
              : "Resolve Service Request"}
          onClose={() => setActionModal(null)}
        >
          <form onSubmit={submitActionModal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {actionModal.type === "inspection" ? (
              <>
                <Field label="Inspection score" required>
                  <input type="number" name="score" min={0} max={100} step={1} required placeholder="0–100" />
                </Field>
                <Field label="Violations">
                  <input type="number" name="violations" min={0} step={1} defaultValue={0} />
                </Field>
                <Field label="Findings">
                  <textarea name="findings" rows={4} placeholder="Record the inspection findings" />
                </Field>
                <label style={{ alignItems: "center", display: "flex", fontSize: 13, gap: 8 }}>
                  <input type="checkbox" name="create_work_order" defaultChecked />
                  Create a corrective work order when the inspection fails
                </label>
              </>
            ) : actionModal.type === "request-decision" ? (
              <Field label={actionModal.decision === "reject" ? "Rejection reason" : "Approval notes"} required={actionModal.decision === "reject"}>
                <textarea name="notes" rows={4} required={actionModal.decision === "reject"} placeholder={actionModal.decision === "reject" ? "Explain why this request will not proceed" : "Budget, priority or assignment instructions"} />
              </Field>
            ) : (
              <Field label="Satisfaction score" required>
                <input type="number" name="satisfaction_score" min={1} max={5} step={1} required placeholder="1–5" />
              </Field>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setActionModal(null)}>Cancel</button>
              <button type="submit" className={`btn ${actionModal.type === "request-decision" && actionModal.decision === "reject" ? "danger" : "primary"}`}>
                {actionModal.type === "inspection"
                  ? "Complete Inspection"
                  : actionModal.type === "request-decision"
                    ? `${actionModal.decision === "approve" ? "Approve" : "Reject"} Request`
                    : "Resolve Request"}
              </button>
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
