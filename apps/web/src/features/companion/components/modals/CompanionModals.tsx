"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Modal, Panel } from "@/components/module-ui";
import { FeedbackThread, Row, TeamMember } from "../../types/companion.types";
import { EvidenceAttachmentUploader, type UploadedAttachment } from "../common/EvidenceAttachmentUploader";
import { Button, Typography, Box, Alert } from "@mui/material";
import { ExternalLink, UserPlus } from "lucide-react";

export function AddTeamMemberModal({
  open,
  onClose,
  onSubmit,
  properties,
  roles,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  properties: { id: string; name: string; code: string }[];
  roles: { id: string; name: string; slug: string }[];
  busy: boolean;
  error: string;
}) {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedProps, setSelectedProps] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setUsername("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setIsAdmin(false);
      setSelectedRoles([]);
      setSelectedProps([]);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      username,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phone,
      is_organization_admin: isAdmin,
      role_ids: selectedRoles,
      property_ids: selectedProps,
    });
    // Clear form fields after successful submission
    setUsername("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setIsAdmin(false);
    setSelectedRoles([]);
    setSelectedProps([]);
    onClose();
  }

  return (
    <Modal title="Add Team Member (Staff Creation)" onClose={onClose} wide>
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", color: "#b91c1c", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-2">
          <Field label="Username (Login Handle)" required>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. lydia, abel, sharon, marilyn"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </Field>
          <Field label="Email Address">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@centerestates.co.ke"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="First Name" required>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Lydia"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </Field>
          <Field label="Last Name" required>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Kipkorir"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </Field>
        </div>

        <Field label="Phone Number (for contact orientation & SMS alerts)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254 700 000 000"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </Field>

        <div style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Super Administrator (Full organization &amp; portfolio-wide access)
          </label>
        </div>

        {!isAdmin && (
          <>
            <Field label="Assigned Functional Roles">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 6, maxHeight: 130, overflowY: "auto" }}>
                {roles.map((r) => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.id)}
                      onChange={(e) => {
                        setSelectedRoles((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                      }}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Property Scoping Matrix (Assign to specific properties)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 6, maxHeight: 130, overflowY: "auto" }}>
                {properties.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12 }}>No properties available in this organization.</div>
                ) : (
                  properties.map((p) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedProps.includes(p.id)}
                        onChange={(e) => {
                          setSelectedProps((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id));
                        }}
                      />
                      🏢 {p.name} ({p.code})
                    </label>
                  ))
                )}
              </div>
            </Field>
          </>
        )}

        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !username.trim() || !firstName.trim()}>
            {busy ? "Creating…" : "Create Team Member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function EditMemberMatrixModal({
  member,
  onClose,
  onSubmit,
  properties,
  roles,
  busy,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSubmit: (memberId: string, payload: Record<string, unknown>) => Promise<void>;
  properties: { id: string; name: string; code: string }[];
  roles: { id: string; name: string; slug: string }[];
  busy: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(member?.is_organization_admin || false);
  const [phone, setPhone] = useState(member?.phone_number || "");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(member?.roles?.map((r) => r.id) || []);
  const [selectedProps, setSelectedProps] = useState<string[]>(member?.assigned_properties?.map((p) => p.id) || []);

  // Sync form with member data when member changes
  useEffect(() => {
    if (member) {
      setIsAdmin(member.is_organization_admin || false);
      setPhone(member.phone_number || "");
      setSelectedRoles(member.roles?.map((r) => r.id) || []);
      setSelectedProps(member.assigned_properties?.map((p) => p.id) || []);
    }
  }, [member]);

  if (!member) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(member!.id, {
      is_organization_admin: isAdmin,
      phone_number: phone,
      role_ids: selectedRoles,
      property_ids: selectedProps,
    });
    onClose();
  }

  return (
    <Modal title={`Modify Access Matrix — ${member.full_name}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 14, fontSize: 13, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8 }}>
          <div><span className="muted">User:</span> <strong>{member.full_name}</strong></div>
          <div><span className="muted">Username:</span> <span className="mono">{member.username}</span></div>
          <div><span className="muted">Email:</span> <span>{member.email || "—"}</span></div>
        </div>

        <Field label="Phone Number">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254 700 000 000"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </Field>

        <div style={{ padding: "10px 14px", background: isAdmin ? "#fef3c7" : "var(--surface-2)", borderRadius: 8, border: isAdmin ? "1px solid #fde68a" : "1px solid var(--border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: isAdmin ? "#92400e" : "var(--text)" }}>
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Super Administrator (Full Portfolio Access)
          </label>
        </div>

        <Field label="Assigned Functional Roles">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Select module roles:</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedRoles(roles.map((r) => r.id))}
                style={{ fontSize: 11, color: "var(--primary, #d92d2d)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoles([])}
                style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                Clear All
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 6, maxHeight: 150, overflowY: "auto" }}>
            {roles.map((r) => {
              const isSelected = selectedRoles.includes(r.id);
              return (
                <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "4px 6px", borderRadius: 4, background: isSelected ? "rgba(99, 102, 241, 0.08)" : "transparent" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      setSelectedRoles((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                    }}
                  />
                  <span style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? "#4338ca" : "var(--text)" }}>{r.name}</span>
                </label>
              );
            })}
          </div>
        </Field>

        <Field label={`Assigned Properties / Estates (${selectedProps.length} of ${properties.length} assigned)`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Check the properties this member manages:</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedProps(properties.map((p) => p.id))}
                style={{ fontSize: 11, color: "var(--primary, #d92d2d)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Select All ({properties.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedProps([])}
                style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                Clear All
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 6, maxHeight: 150, overflowY: "auto" }}>
            {properties.map((p) => {
              const isSelected = selectedProps.includes(p.id);
              return (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "4px 6px", borderRadius: 4, background: isSelected ? "rgba(2, 132, 199, 0.08)" : "transparent" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      setSelectedProps((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id));
                    }}
                  />
                  <span>🏢 <strong>{p.name}</strong> <span className="mono muted" style={{ fontSize: 10 }}>({p.code})</span></span>
                </label>
              );
            })}
          </div>
        </Field>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save Matrix"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateFeedbackModal({
  open,
  onClose,
  onSubmit,
  onUploadAttachment,
  busy,
  activePropertyName,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<{ url: string; name: string; size: number } | null>;
  busy: boolean;
  activePropertyName?: string;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"bug" | "operational" | "feature" | "general">("bug");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [module, setModule] = useState("general");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory("bug");
      setPriority("normal");
      setModule("general");
      setMessage("");
      setAttachment(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim() || busy) return;
    await onSubmit({
      title: title.trim(),
      category,
      priority,
      module,
      initial_message: message.trim(),
      attachment_url: attachment?.url || "",
    });
    // Clear all form fields after successful submission
    setTitle("");
    setCategory("bug");
    setPriority("normal");
    setModule("general");
    setMessage("");
    setAttachment(null);
    onClose();
  }

  return (
    <Modal title="💬 New Team Dialogue / Report Bug" onClose={onClose} wide>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Log bug reports, system suggestions, or questions directly to the technical team.
        </p>

        <div className="grid-2">
          <Field label="Category" required>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
              <option value="bug">🐛 Bug Report / Error</option>
              <option value="operational">🏢 Operational Inquiry</option>
              <option value="feature">✨ Feature Request</option>
              <option value="general">💬 General Team Discussion</option>
            </select>
          </Field>
          <Field label="Priority" required>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
              <option value="low">Low — Routine</option>
              <option value="normal">Normal — Standard</option>
              <option value="high">High — Important</option>
              <option value="urgent">Urgent — Blocking Work</option>
            </select>
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Related Module" required>
            <select value={module} onChange={(e) => setModule(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
              <option value="general">✨ General / Platform Wide</option>
              <option value="property">🏢 Property Management</option>
              <option value="facility">🛠️ Facility Management</option>
              <option value="sales">💼 Sales Management</option>
              <option value="finance">💰 Finance / Billing / Invoices</option>
              <option value="companion">🧭 Companion & Field Ops</option>
              <option value="hr">🌴 Staff Leave & HR Portal</option>
              <option value="login_auth">🔒 Authentication / Login</option>
            </select>
          </Field>
          <Field label="Property Scope">
            <input
              disabled
              value={activePropertyName ? `Open to All Teams (${activePropertyName})` : "Open to All Teams & Properties"}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)" }}
            />
          </Field>
        </div>

        <Field label="Topic / Bug Title" required>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Logout button in Chrome/Edge throws error, or Need water meter adjustment"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </Field>

        <Field label="Detailed Description / Steps to Reproduce" required>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what happened, what you expected, or your query for the team/developer…"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </Field>

        <Field label="Evidence / Screenshot Upload">
          {onUploadAttachment ? (
            <EvidenceAttachmentUploader
              attachment={attachment}
              onChange={setAttachment}
              onUpload={onUploadAttachment}
              disabled={busy}
            />
          ) : (
            <input
              value={attachment?.url || ""}
              onChange={(e) => setAttachment({ url: e.target.value, name: "Attachment" })}
              placeholder="https://... or uploaded image path"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          )}
        </Field>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !title.trim() || !message.trim()}>
            {busy ? "Submitting…" : "Post to Team Dialogue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AssignTaskModal({
  open,
  onClose,
  onSubmit,
  staffOptions,
  busy,
  activePropertyName,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  staffOptions: { user_id: string; name: string; username?: string; role_name?: string }[];
  busy: boolean;
  activePropertyName?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [slaDueAt, setSlaDueAt] = useState("");
  const [sourceModule, setSourceModule] = useState("property");
  const [sourceRef, setSourceRef] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("weekly");

  useEffect(() => {
    if (open) {
      setTitle("");
      setSelectedAssignees([]);
      setDescription("");
      setPriority("normal");
      setDueAt("");
      setSlaDueAt("");
      setSourceModule("property");
      setSourceRef("");
      setIsRecurring(false);
      setRecurrenceRule("weekly");
    }
  }, [open]);

  const handleNavigateToTeamMatrix = () => {
    onClose();
    router.push("/administration?tab=users");
  };

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      title,
      assignees: selectedAssignees,
      description,
      priority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      sla_due_at: slaDueAt ? new Date(slaDueAt).toISOString() : null,
      source_module: sourceModule,
      source_ref: sourceRef,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : "",
    });
    // Clear all form fields after successful submission
    setTitle("");
    setSelectedAssignees([]);
    setDescription("");
    setPriority("normal");
    setDueAt("");
    setSlaDueAt("");
    setSourceModule("property");
    setSourceRef("");
    setIsRecurring(false);
    setRecurrenceRule("weekly");
    onClose();
  }

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

  return (
    <Modal title="Assign Task" onClose={onClose} wide>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Title" required>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Inspect water pump, review tenant lease, verify payment voucher #PV-2041"
            style={inputStyle}
          />
        </Field>

        <Field label={`Assign to Team Member (${activePropertyName ? `Scoped to ${activePropertyName}` : "All Organization Staff"})`} required>
          <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 6, background: "var(--surface)" }}>
            {staffOptions.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Alert 
                  severity="info" 
                  icon={<UserPlus size={18} />}
                  action={
                    <Button 
                      size="small" 
                      variant="outlined"
                      startIcon={<ExternalLink size={14} />}
                      onClick={handleNavigateToTeamMatrix}
                    >
                      Go to Team Matrix
                    </Button>
                  }
                  sx={{ 
                    bgcolor: "rgba(79, 70, 229, 0.05)",
                    border: "1px solid rgba(79, 70, 229, 0.2)",
                    "& .MuiAlert-icon": { color: "#4f46e5" }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    No staff assigned to this property yet
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                    Add team members in the Team & Property Matrix to assign tasks
                  </Typography>
                </Alert>
              </Box>
            ) : (
              staffOptions.map((s) => (
                <label key={String(s.user_id)} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", padding: "4px 6px", borderRadius: 4, background: selectedAssignees.includes(String(s.user_id)) ? "rgba(234, 88, 12, 0.08)" : "transparent" }}>
                  <input
                    type="checkbox"
                    checked={selectedAssignees.includes(String(s.user_id))}
                    onChange={(e) => {
                      const uid = String(s.user_id);
                      setSelectedAssignees((prev) => e.target.checked ? [...prev, uid] : prev.filter((id) => id !== uid));
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <div>
                    <strong style={{ fontSize: 13 }}>{s.name}</strong>
                    {s.role_name && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({s.role_name})</span>}
                  </div>
                </label>
              ))
            )}
          </div>
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task details, requirements and expectations…"
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Priority" required>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Due date">
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="SLA due">
            <input type="datetime-local" value={slaDueAt} onChange={(e) => setSlaDueAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Source module">
            <input value={sourceModule} onChange={(e) => setSourceModule(e.target.value)} placeholder="e.g. property, facility, sales" style={inputStyle} />
          </Field>
          <Field label="Source reference">
            <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="e.g. lease LS-2026-0128, WO-2026-004" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Recurring task
          </label>
          {isRecurring && (
            <Field label="Frequency">
              <select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value)} style={inputStyle}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || selectedAssignees.length === 0 || !title.trim()}>
            {busy ? "Assigning…" : selectedAssignees.length > 0 ? `Assign to ${selectedAssignees.length} Staff` : "Assign Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateTemplateModal({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [descTemplate, setDescTemplate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [daysToDue, setDaysToDue] = useState("7");
  const [slaHours, setSlaHours] = useState("24");
  const [sourceModule, setSourceModule] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setTitleTemplate("");
      setDescTemplate("");
      setPriority("normal");
      setDaysToDue("7");
      setSlaHours("24");
      setSourceModule("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      name,
      title_template: titleTemplate,
      description_template: descTemplate,
      default_priority: priority,
      default_days_to_due: parseInt(daysToDue) || 7,
      sla_hours: parseInt(slaHours) || 24,
      source_module: sourceModule,
    });
    // Clear all form fields after successful submission
    setName("");
    setTitleTemplate("");
    setDescTemplate("");
    setPriority("normal");
    setDaysToDue("7");
    setSlaHours("24");
    setSourceModule("");
    onClose();
  }

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

  return (
    <Modal title="Create Task Template" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Template Name" required>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Generator Inspection" style={inputStyle} />
        </Field>
        <Field label="Title Template" required>
          <input required value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} placeholder="e.g. Perform {building} weekly inspection" style={inputStyle} />
        </Field>
        <Field label="Description Template">
          <textarea rows={2} value={descTemplate} onChange={(e) => setDescTemplate(e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Default Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Days to Due">
            <input type="number" min="1" value={daysToDue} onChange={(e) => setDaysToDue(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="SLA Hours">
            <input type="number" min="1" value={slaHours} onChange={(e) => setSlaHours(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field label="Source Module">
          <input value={sourceModule} onChange={(e) => setSourceModule(e.target.value)} placeholder="e.g. facility" style={inputStyle} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim() || !titleTemplate.trim()}>
            {busy ? "Saving…" : "Save Template"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DelegateTaskModal({
  task,
  onClose,
  onSubmit,
  staffOptions,
  busy,
}: {
  task: Row | null;
  onClose: () => void;
  onSubmit: (taskId: string, delegateeId: string, note: string) => Promise<void>;
  staffOptions: { user_id: string; name: string }[];
  busy: boolean;
}) {
  const [delegateeId, setDelegateeId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (task) {
      setDelegateeId("");
      setNote("");
    }
  }, [task]);

  if (!task) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!delegateeId) return;
    await onSubmit(String(task!.id), delegateeId, note);
    // Clear form fields after successful submission
    setDelegateeId("");
    setNote("");
    onClose();
  }

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

  return (
    <Modal title={`Delegate Task — ${String(task.title || "")}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Delegate to" required>
          <select value={delegateeId} onChange={(e) => setDelegateeId(e.target.value)} required style={inputStyle}>
            <option value="" disabled>Select team member…</option>
            {staffOptions.map((s) => (
              <option key={String(s.user_id)} value={String(s.user_id)}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Delegation Note / Instructions">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain what is delegated and any specific instructions…" style={inputStyle} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !delegateeId}>
            {busy ? "Delegating…" : "Confirm Delegation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CompleteTaskModal({
  task,
  open,
  onClose,
  onSubmit,
  onUploadAttachment,
  busy,
}: {
  task: Row | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Row, payload: { note?: string; attachment_url?: string; checklist?: any[] }) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<{ url: string; name: string; size: number } | null>;
  busy: boolean;
}) {
  const [note, setNote] = useState("");
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const rawChecklist = Array.isArray(task?.checklist) ? (task!.checklist as any[]) : [];
  const [checklist, setChecklist] = useState<any[]>(rawChecklist);
  const [originalChecklist, setOriginalChecklist] = useState<any[]>(rawChecklist);

  // Sync checklist when task changes
  useEffect(() => {
    if (task) {
      const newChecklist = Array.isArray(task.checklist) ? (task.checklist as any[]) : [];
      setChecklist(newChecklist);
      setOriginalChecklist(newChecklist);
    }
  }, [task]);

  if (!open || !task) return null;

  function toggleCheckItem(id: string) {
    setChecklist((prev) =>
      prev.map((it) => (it.id === id ? { ...it, completed: !it.completed } : it))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(task!, {
      note: note.trim(),
      attachment_url: attachment?.url || "",
      checklist,
    });
    // Clear form fields after successful submission
    setNote("");
    setAttachment(null);
    // Reset checklist to original task's checklist
    setChecklist(originalChecklist);
    onClose();
  }

  const allDone = checklist.length === 0 || checklist.every((c) => c.completed);
  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

  return (
    <Modal title={`✓ Complete Task — ${String(task.title || "")}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "rgba(13, 148, 136, 0.08)", border: "1px solid rgba(13, 148, 136, 0.25)", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#0d9488", letterSpacing: "0.5px" }}>Task Ref: {String(task.reference || "CPN")}</span>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginTop: 2 }}>{String(task.title)}</div>
          </div>
          <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: "rgba(13, 148, 136, 0.15)", color: "#0d9488", fontWeight: 700 }}>
            {String(task.priority || "normal").toUpperCase()}
          </span>
        </div>

        {checklist.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              Sub-tasks / Action Items Checklist ({checklist.filter((c) => c.completed).length}/{checklist.length} Completed)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-sunken)", padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}>
              {checklist.map((item) => (
                <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "var(--muted)" : "var(--text)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.completed)}
                    onChange={() => toggleCheckItem(item.id)}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                  <span>{item.title}</span>
                </label>
              ))}
            </div>
            {!allDone && (
              <div style={{ fontSize: 12, color: "#d97706", display: "flex", alignItems: "center", gap: 6 }}>
                <span>⚠️ Note: Some checklist sub-tasks are still unchecked.</span>
              </div>
            )}
          </div>
        )}

        <Field label="Resolution Notes / Work Summary" required>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the actions taken and outcome achieved to resolve this task…"
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Proof of Work / Photo Evidence (Optional)">
          <EvidenceAttachmentUploader
            attachment={attachment}
            onChange={setAttachment}
            onUpload={onUploadAttachment}
          />
        </Field>

        <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !note.trim()} style={{ background: "#16a34a", borderColor: "#16a34a" }}>
            {busy ? "Submitting…" : "✓ Confirm & Complete Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
