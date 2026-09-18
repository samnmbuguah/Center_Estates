"use client";

import { useState, useEffect } from "react";
import { Button, Checkbox, FormControlLabel, MenuItem, Step, StepLabel, Stepper, TextField } from "@mui/material";
import { Field, Modal, Panel, StatusPill } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtMoney } from "../../utils/sales.utils";
import { DField, FormError } from "../SalesUiComponents";
import { apiFetch } from "@/lib/api";

export function RegisterBuyerModal({
  open,
  onClose,
  onSubmit,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, string>>({
    reference: "",
    full_name: "",
    email: "",
    phone: "",
    id_number: "",
    tax_number: "",
    financing_type: "self",
    financier: "",
    address: "",
    sale_project: "",
    sale_unit: "",
    agreed_price: "",
    reservation_fee: "",
  });
  const [docsCheck, setDocsCheck] = useState({ offer_letter: false, id_copy: false, kra_pin: false });

  if (!open) return null;

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (step < 3) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  function handleSubmit() {
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v) payload[k] = v;
    }
    onSubmit(payload);
  }

  const stepLabels = ["Buyer Info", "Purchase Details", "Review & Submit"];

  return (
    <Modal title="Register Buyer" onClose={onClose} wide>
      <Stepper activeStep={step - 1} alternativeLabel sx={{ mb: 3 }}>
        {stepLabels.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      <FormError error={error} />

      {step === 1 && (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <TextField fullWidth size="small" label="Buyer reference" value={formData.reference} onChange={(e) => updateField("reference", e.target.value)} required placeholder="BUY-2026-0001" />
            <TextField fullWidth size="small" label="Full legal name" value={formData.full_name} onChange={(e) => updateField("full_name", e.target.value)} required placeholder="e.g. Apex Holdings Ltd" />
          </div>
          <div className="grid-2">
            <TextField fullWidth size="small" label="Email address" type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="buyer@domain.co.ke" />
            <TextField fullWidth size="small" label="Phone number" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+254 700 000 000" />
          </div>
          <div className="grid-2">
            <TextField fullWidth size="small" label="National / company ID" value={formData.id_number} onChange={(e) => updateField("id_number", e.target.value)} required placeholder="12345678" />
            <TextField fullWidth size="small" label="KRA PIN" value={formData.tax_number} onChange={(e) => updateField("tax_number", e.target.value)} placeholder="A000000000X" />
          </div>
          <div className="grid-2">
            <TextField select fullWidth size="small" label="Financing type" value={formData.financing_type} onChange={(e) => updateField("financing_type", e.target.value)}>
              <MenuItem value="self">Self-financed</MenuItem>
              <MenuItem value="bank">Bank-financed</MenuItem>
            </TextField>
            <TextField fullWidth size="small" label="Financier" value={formData.financier} onChange={(e) => updateField("financier", e.target.value)} placeholder="e.g. KCB Bank" disabled={formData.financing_type !== "bank"} helperText={formData.financing_type === "bank" ? "Required for bank-financed purchases" : "Select bank-financed to provide a financier"} />
          </div>
          <TextField fullWidth size="small" label="Address" multiline minRows={2} value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Postal / physical address" />
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <TextField fullWidth size="small" label="Project" value={formData.sale_project} onChange={(e) => updateField("sale_project", e.target.value)} placeholder="Project name or ID" />
            <TextField fullWidth size="small" label="Unit" value={formData.sale_unit} onChange={(e) => updateField("sale_unit", e.target.value)} placeholder="Unit code" />
          </div>
          <div className="grid-2">
            <TextField fullWidth size="small" label="Agreed price (KES)" type="number" value={formData.agreed_price} onChange={(e) => updateField("agreed_price", e.target.value)} placeholder="12500000" slotProps={{ htmlInput: { min: 1 } }} />
            <TextField fullWidth size="small" label="Deposit amount (KES)" type="number" value={formData.reservation_fee} onChange={(e) => updateField("reservation_fee", e.target.value)} placeholder="0" slotProps={{ htmlInput: { min: 0 } }} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <Panel title="Buyer Summary" style={{ marginBottom: 14 }}>
            <div className="fc-detail-grid">
              <DField label="Name" value={formData.full_name || "—"} />
              <DField label="Email" value={formData.email || "—"} />
              <DField label="Phone" value={formData.phone || "—"} />
              <DField label="ID" value={<span className="mono">{formData.id_number || "—"}</span>} />
              <DField label="KRA PIN" value={<span className="mono">{formData.tax_number || "—"}</span>} />
              <DField label="Financing" value={formData.financing_type === "bank" ? "Bank-Financed" : "Self-Financed"} />
              <DField label="Financier" value={formData.financier || "—"} />
              {formData.agreed_price && <DField label="Price" value={<span className="mono">{fmtMoney(formData.agreed_price)}</span>} />}
              {formData.reservation_fee && <DField label="Deposit" value={<span className="mono">{fmtMoney(formData.reservation_fee)}</span>} />}
            </div>
          </Panel>

          <Panel title="Documents Checklist">
            <div style={{ padding: 18 }}>
              {([
                { key: "offer_letter", label: "Offer Letter" },
                { key: "id_copy", label: "Buyer ID Copy" },
                { key: "kra_pin", label: "KRA PIN Certificate" },
              ] as const).map((d) => (
                <FormControlLabel
                  key={d.key}
                  control={<Checkbox
                    checked={docsCheck[d.key]}
                    onChange={(e) => setDocsCheck((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                  />}
                  label={d.label}
                />
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "space-between" }}>
          <div>
            {step > 1 && <Button type="button" variant="outlined" onClick={prevStep}>← Previous</Button>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" variant="outlined" onClick={onClose}>Cancel</Button>
            {step < 3 ? (
              <Button type="button" variant="contained" onClick={nextStep} disabled={step === 1 && (!formData.reference.trim() || !formData.full_name.trim() || !formData.id_number.trim())}>Next →</Button>
            ) : (
              <Button type="button" variant="contained" onClick={handleSubmit}>Register Buyer</Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function NewSaleModal({
  open,
  onClose,
  onSubmit,
  error,
  buyers,
  listings,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  buyers: Row[];
  listings: Row[];
}) {
  if (!open) return null;
  return (
    <Modal title="+ New Sale" onClose={onClose}>
      <FormError error={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
        }}
        style={{ display: "grid", gap: 16, marginTop: 4 }}
      >
        <div className="grid-2">
          <TextField fullWidth size="small" name="reference" label="Sale reference" required placeholder="SALE-2026-0001" />
          <TextField select fullWidth size="small" name="buyer" label="Buyer" required defaultValue="">
            <MenuItem value="" disabled>Select buyer…</MenuItem>
            {buyers.map((b) => (
              <MenuItem key={String(b.id)} value={String(b.id)}>
                {String(b.full_name ?? "—")} · {String(b.reference ?? "—")}
              </MenuItem>
            ))}
          </TextField>
        </div>
        <TextField select fullWidth size="small" name="listing" label="Unit listing" required defaultValue="">
          <MenuItem value="" disabled>Select listing…</MenuItem>
          {listings.map((l) => (
            <MenuItem key={String(l.id)} value={String(l.id)}>
              {String(l.project_name ?? "—")} · {String(l.unit_code ?? "—")} · {fmtMoney(l.list_price)}
            </MenuItem>
          ))}
        </TextField>
        <div className="grid-2">
          <TextField fullWidth size="small" name="agreed_price" label="Agreed price (KES)" type="number" required placeholder="12500000" slotProps={{ htmlInput: { min: 1 } }} />
          <TextField fullWidth size="small" name="reservation_fee" label="Reservation fee (KES)" type="number" defaultValue="0" slotProps={{ htmlInput: { min: 0 } }} />
        </div>
        <div className="modal-actions" style={{ marginTop: 8 }}>
          <Button type="button" variant="outlined" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Create Sale</Button>
        </div>
      </form>
    </Modal>
  );
}

export function RecordVisitModal({
  open,
  onClose,
  onSubmit,
  error,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  projects: Row[];
}) {
  if (!open) return null;

  const now = new Date();
  const defaultRef = `VS-${now.getFullYear()}-${String(Date.now()).slice(-4)}`;
  const defaultVisitDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <Modal title="📍 Record Site Visit (Clerk)" onClose={onClose}>
      <FormError error={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payload = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
          if (payload.visited_at) payload.visited_at = new Date(payload.visited_at).toISOString();
          onSubmit(payload);
        }}
        style={{ display: "grid", gap: 16, marginTop: 4 }}
      >
        <div className="grid-2" style={{ alignItems: "start" }}>
          <TextField
            fullWidth
            size="small"
            name="reference"
            label="Visit reference"
            defaultValue={defaultRef}
            helperText="Auto-generated; adjust before saving if needed"
          />
          <TextField
            fullWidth
            size="small"
            name="visitor_name"
            label="Visitor name *"
            required
            placeholder="Client full name"
          />
        </div>
        <div className="grid-2">
          <TextField
            fullWidth
            size="small"
            name="phone"
            label="Phone"
            placeholder="+254 700 000 000"
          />
          <TextField
            fullWidth
            size="small"
            name="email"
            label="Email"
            type="email"
            placeholder="visitor@domain.co.ke"
          />
        </div>
        <div className="grid-2">
          <TextField
            select
            fullWidth
            size="small"
            name="project"
            label="Project *"
            required
            defaultValue=""
          >
            <MenuItem value="" disabled>Select project…</MenuItem>
            {projects.map((p) => (
              <MenuItem key={String(p.id)} value={String(p.id)}>
                {String(p.name ?? "—")}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            size="small"
            name="interested_unit_type"
            label="Interested unit type"
            placeholder="e.g. 3-Bedroom Apartment"
          />
        </div>
        <TextField
          fullWidth
          size="small"
          name="visited_at"
          label="Visit date and time *"
          type="datetime-local"
          required
          defaultValue={defaultVisitDate}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          size="small"
          name="notes"
          label="Notes"
          multiline
          minRows={3}
          placeholder="Presentation summary, financing interest, next steps…"
        />
        <div className="modal-actions" style={{ marginTop: 8 }}>
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Record Visit
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewSalesProjectModal({
  open,
  onClose,
  onSubmit,
  error,
  properties,
  constructionProjects,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => void;
  error: string;
  properties: Row[];
  constructionProjects: Row[];
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [constructionId, setConstructionId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [autoList, setAutoList] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState("12500000");
  const [defaultDeposit, setDefaultDeposit] = useState("10");
  const [description, setDescription] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, any> = {
      name,
      code: code.trim() || undefined,
      property: propertyId ? propertyId : null,
      construction_project_id: constructionId || undefined,
      starts_on: startsOn || undefined,
      ends_on: endsOn || undefined,
      auto_list_units: autoList,
      default_list_price: autoList ? defaultPrice : undefined,
      default_deposit_percent: autoList ? defaultDeposit : undefined,
      metadata: { description },
    };
    onSubmit(payload);
  }

  function handleConstructionPick(id: string) {
    setConstructionId(id);
    const cp = constructionProjects.find((p) => String(p.id) === id);
    if (cp && !name) {
      setName(String(cp.name ?? ""));
    }
  }

  function handlePropertyPick(id: string) {
    setPropertyId(id);
    const prop = properties.find((p) => String(p.id) === id);
    if (prop && !name) {
      setName(`${String(prop.name ?? "")} Sales`);
    }
  }

  return (
    <Modal title="+ New Sales Project / Development Scheme" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={handleSubmit}>
        <div style={{ background: "var(--surface-2, #f8fafc)", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, border: "1px solid var(--border)" }}>
          💡 <strong>Sales Development Setup</strong>: Create an off-plan or completed scheme to manage unit availability, pricing tiers, and buyer sales pipeline.
        </div>

        <Field label="Project / Scheme Name" required>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lynx Ngong Rd Apartments - Phase 1"
          />
        </Field>

        <div className="grid-2">
          <Field label="Project Code (optional)">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SP-0001 (auto-generated if empty)"
            />
          </Field>
          <Field label="Target Completion Date">
            <input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Link Physical Property">
            <select value={propertyId} onChange={(e) => handlePropertyPick(e.target.value)}>
              <option value="">None / Standalone Scheme</option>
              {properties.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name ?? "—")} ({String(p.code ?? "—")})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Link Construction Project">
            <select value={constructionId} onChange={(e) => handleConstructionPick(e.target.value)}>
              <option value="">None / Direct Sales Only</option>
              {constructionProjects.map((cp) => (
                <option key={String(cp.id)} value={String(cp.id)}>
                  🏗️ {String(cp.name ?? "—")}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {propertyId && (
          <div style={{ background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 8, padding: 12, margin: "12px 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={autoList}
                onChange={(e) => setAutoList(e.target.checked)}
              />
              <span>Auto-generate sales listings for all units in this property</span>
            </label>
            {autoList && (
              <div className="grid-2" style={{ marginTop: 10 }}>
                <Field label="Default List Price (KES)" required>
                  <input
                    type="number"
                    min="1"
                    required
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(e.target.value)}
                    placeholder="12500000"
                  />
                </Field>
                <Field label="Min. Deposit %" required>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={defaultDeposit}
                    onChange={(e) => setDefaultDeposit(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <Field label="Commercial Notes & Marketing Summary">
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Off-plan payment terms, target buyer profile, amenities..."
          />
        </Field>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Create Sales Project</button>
        </div>
      </form>
    </Modal>
  );
}

export function NewListingModal({
  open,
  onClose,
  onSubmit,
  onBatchSubmit,
  onOpenNewProject,
  error,
  projects,
  units,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  onBatchSubmit?: (payload: Record<string, any>) => void;
  onOpenNewProject?: () => void;
  error: string;
  projects: Row[];
  units: Row[];
}) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [unlistedUnits, setUnlistedUnits] = useState<Row[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [listPrice, setListPrice] = useState("12500000");
  const [minDeposit, setMinDeposit] = useState("10");

  useEffect(() => {
    if (open && projects.length > 0 && !selectedProject) {
      setSelectedProject(String(projects[0].id));
    }
  }, [open, projects, selectedProject]);

  useEffect(() => {
    if (!open || !selectedProject) {
      setUnlistedUnits([]);
      return;
    }
    let active = true;
    setLoadingUnits(true);
    apiFetch(`/sales/inventory/unlisted-units/?project=${encodeURIComponent(selectedProject)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!active) return;
        setUnlistedUnits(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setUnlistedUnits([]);
      })
      .finally(() => {
        if (active) setLoadingUnits(false);
      });

    return () => { active = false; };
  }, [open, selectedProject]);

  if (!open) return null;

  if (projects.length === 0) {
    return (
      <Modal title="+ New Listing" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🏢</div>
          <h3 style={{ margin: "0 0 8px" }}>No Sales Projects Found</h3>
          <p className="muted" style={{ fontSize: 13, maxWidth: 360, margin: "0 auto 20px" }}>
            Before listing individual units, you must first have a Sales Project / Development Scheme.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            {onOpenNewProject && (
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onClose();
                  onOpenNewProject();
                }}
              >
                + Create First Sales Project
              </button>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  const effectiveUnits = unlistedUnits.length > 0 ? unlistedUnits : units;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isBatchMode && onBatchSubmit) {
      onBatchSubmit({
        project: selectedProject,
        list_price: listPrice,
        minimum_deposit_percent: minDeposit,
      });
    } else {
      const formData = new FormData(e.currentTarget);
      onSubmit(Object.fromEntries(formData.entries()) as Record<string, string>);
    }
  }

  return (
    <Modal title={isBatchMode ? "⚡ Batch List All Units" : "+ New Listing"} onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, margin: 0 }}>
            <Field label="Sales Project" required>
            <select
              name="project"
              required
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="" disabled>Select project…</option>
              {projects.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name ?? "—")} {p.code ? `(${String(p.code)})` : ""}
                </option>
              ))}
            </select>
          </Field>
          </div>
          {onOpenNewProject && (
            <button
              type="button"
              className="btn ghost sm"
              style={{ alignSelf: "flex-end", marginBottom: 2, marginLeft: 8, whiteSpace: "nowrap" }}
              onClick={() => {
                onClose();
                onOpenNewProject();
              }}
            >
              + New Project
            </button>
          )}
        </div>

        <div style={{ display: "flex", background: "var(--surface-2, #f1f5f9)", padding: 4, borderRadius: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn sm ${!isBatchMode ? "primary" : "ghost"}`}
            style={{ flex: 1 }}
            onClick={() => setIsBatchMode(false)}
          >
            Single Unit
          </button>
          <button
            type="button"
            className={`btn sm ${isBatchMode ? "primary" : "ghost"}`}
            style={{ flex: 1 }}
            onClick={() => setIsBatchMode(true)}
          >
            ⚡ Batch List All ({loadingUnits ? "…" : unlistedUnits.length} unlisted)
          </button>
        </div>

        {!isBatchMode ? (
          <Field label="Unit" required>
            <select name="unit" required defaultValue="">
              <option value="" disabled>
                {loadingUnits ? "Loading available units..." : unlistedUnits.length === 0 ? "No unlisted units in this project" : "Select unit…"}
              </option>
              {effectiveUnits.map((u) => (
                <option key={String(u.id)} value={String(u.id)}>
                  Unit {String(u.code ?? "—")} · {String(u.unit_type ?? "Standard")} · Floor {String(u.floor ?? "—")}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            <strong>Batch Unit Activation</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
              {unlistedUnits.length > 0
                ? `Will create sales listings for all ${unlistedUnits.length} unlisted units in this development with the pricing below.`
                : "No unlisted units currently available in this project's physical property."}
            </p>
          </div>
        )}

        <div className="grid-2">
          <Field label="List Price (KES)" required>
            <input
              name="list_price"
              type="number"
              min="1"
              required
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="12500000"
            />
          </Field>
          <Field label="Min. Deposit %" required>
            <input
              name="minimum_deposit_percent"
              type="number"
              min="0"
              max="100"
              required
              value={minDeposit}
              onChange={(e) => setMinDeposit(e.target.value)}
            />
          </Field>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn primary"
            disabled={isBatchMode && unlistedUnits.length === 0}
          >
            {isBatchMode ? `Batch List ${unlistedUnits.length} Units` : "Create Listing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentActionModal({
  payment,
  onClose,
  onAction,
  error,
}: {
  payment: Row | null;
  onClose: () => void;
  onAction: (payload: { action: "verify" | "reject" | "reverse"; reason?: string }) => void;
  error: string;
}) {
  const [reason, setReason] = useState("");
  if (!payment) return null;
  const status = String(payment.status ?? "");

  return (
    <Modal title={status === "pending" ? `Verify Payment ${String(payment.reference ?? "")}` : `Reverse Payment ${String(payment.reference ?? "")}`} onClose={onClose}>
      <FormError error={error} />
      <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Buyer</span><strong>{String(payment.buyer_name ?? "—")}</strong></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Sale</span><span className="mono">{String(payment.sale_reference ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Method</span><span>{String(payment.method ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Amount</span><strong className="mono">{fmtMoney(payment.amount)}</strong></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">External Ref</span><span className="mono">{String(payment.external_reference ?? "—")}</span></div>
      </div>
      {status === "pending" ? (
        <>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>
            Approving allocates the full amount to the linked installment and recalculates commission gates. Rejecting requires a reason that is retained in the audit trail.
          </p>
          <TextField fullWidth size="small" name="reason" label="Rejection reason" multiline minRows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. M-Pesa reference does not match, duplicate submission…" />
          <div className="modal-actions">
            <Button variant="outlined" color="error" disabled={!reason.trim()} onClick={() => onAction({ action: "reject", reason })}>Reject</Button>
            <Button variant="contained" onClick={() => onAction({ action: "verify" })}>Approve Payment</Button>
          </div>
        </>
      ) : (
        <>
          <TextField fullWidth size="small" name="reason" label="Reversal reason" required multiline minRows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this verified payment being reversed?" />
          <div className="modal-actions">
            <Button variant="outlined" onClick={onClose}>Cancel</Button>
            <Button variant="contained" color="error" disabled={!reason.trim()} onClick={() => onAction({ action: "reverse", reason })}>Reverse Payment</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function TransitionModal({
  title,
  row,
  options,
  onClose,
  onSubmit,
  error,
}: {
  title: string;
  row: Row | null;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (payload: { status: string; notes?: string }) => void;
  error: string;
}) {
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  if (!row) return null;
  const needsNotes = target === "cancelled";

  return (
    <Modal title={title} onClose={onClose}>
      <FormError error={error} />
      <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Reference</span><span className="mono">{String(row.reference ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Current Status</span><StatusPill value={String(row.status ?? "—")} /></div>
      </div>
      <TextField select fullWidth size="small" label="Move to" value={target} onChange={(e) => setTarget(e.target.value)} required slotProps={{ select: { native: true } }}>
          <option value="" disabled>Select next status…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </TextField>
      <TextField fullWidth size="small" label={needsNotes ? "Cancellation reason" : "Notes"} required={needsNotes} multiline minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={needsNotes ? "Required — retained in the audit trail." : "Optional note for the audit trail."} sx={{ mt: 2 }} />
      <div className="modal-actions">
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={needsNotes ? "error" : "primary"} disabled={!target || (needsNotes && !notes.trim())} onClick={() => onSubmit({ status: target, notes })}>Apply Transition</Button>
      </div>
    </Modal>
  );
}
