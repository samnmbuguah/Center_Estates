import { ChevronRight, Users } from "lucide-react";
import { addProjectMember, inviteUser, removeProjectMember } from "../../api";

export interface StepTeamAssignmentProps {
  project: any;
  projectMembers: any[];
  setProjectMembers: (v: any[]) => void;
  allUsers: any[];
  roles: { slug: string; name: string }[];
  inviteEmail: string; setInviteEmail: (v: string) => void;
  inviteName: string; setInviteName: (v: string) => void;
  inviteMsg: string | null; setInviteMsg: (v: string | null) => void;
  customRole: string; setCustomRole: (v: string) => void;
  customUserId: string; setCustomUserId: (v: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  hasModule: (key: string) => boolean;
  loadProjectMembers: () => void;
  onNext: () => void;
}

export function StepTeamAssignment({
  project, projectMembers, setProjectMembers, allUsers, roles,
  inviteEmail, setInviteEmail, inviteName, setInviteName,
  inviteMsg, setInviteMsg,
  customRole, setCustomRole, customUserId, setCustomUserId,
  submitting, setSubmitting,
  hasModule,
  loadProjectMembers,
  onNext,
}: StepTeamAssignmentProps) {
  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteMsg("Enter an email address"); return; }
    setSubmitting(true);
    setInviteMsg(null);
    try {
      await inviteUser({ email: inviteEmail.trim(), name: inviteName.trim() || undefined });
      setInviteMsg(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail(""); setInviteName("");
    } catch (e) {
      setInviteMsg((e as Error).message);
    }
    setSubmitting(false);
  }

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 14px 0", fontSize: 15 }}>Team & Stakeholders</h3>
      <p className="muted" style={{ marginBottom: 14 }}>Assign existing users to each role. Invite new people by email if needed.</p>

      <div style={{ display: "grid", gap: 8 }}>
        {[
          { slug: "client", label: "Developer / Owner" },
          ...(hasModule("financials") ? [{ slug: "financier", label: "Financier" }] : []),
          ...(hasModule("progress_tracking") ? [
            { slug: "project_manager", label: "Project Manager" },
            { slug: "structural_engineer", label: "Structural Engineer" },
            { slug: "clerk_of_works", label: "Clerk of Works" },
          ] : []),
          { slug: "architect", label: "Architect" },
          ...(hasModule("financials") ? [{ slug: "qs", label: "Quantity Surveyor" }] : []),
          { slug: "mep_engineer", label: "MEP Engineer" },
        ].map(roleDef => {
          const assigned = projectMembers.find((m: any) => m.role === roleDef.slug);
          return (
            <div key={roleDef.slug} className="row" style={{ gap: 8, padding: "4px 8px", borderRadius: 8, background: "var(--surface-2)" }}>
              <span style={{ minWidth: 140, fontSize: 14, fontWeight: 500 }}>{roleDef.label}</span>
              {assigned ? (
                <span style={{ fontSize: 13 }}>{assigned.username}
                  <button className="btn ghost sm" style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px" }}
                    onClick={async () => {
                      if (!confirm(`Remove ${assigned.username} from this project?`)) return;
                      await removeProjectMember(project?.id, assigned.id);
                      loadProjectMembers();
                    }}>✕</button>
                </span>
              ) : (
                <select style={{ fontSize: 13, minWidth: 160 }} value=""
                  onChange={async e => {
                    const userId = e.target.value;
                    if (!userId || !project) return;
                    try {
                      await addProjectMember(project.id, { user_id: userId, role: roleDef.slug });
                      loadProjectMembers();
                    } catch (err: any) { setInviteMsg("Error: " + err.message); }
                  }}>
                  <option value="">(assign)</option>
                  {allUsers
                    .filter(u => !projectMembers.find((m: any) => m.username === u.username))
                    .filter(u => !roleDef.slug || (u.roles || []).includes(roleDef.slug))
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
        <select value={customRole} onChange={e => setCustomRole(e.target.value)}
          style={{ flex: 1, minWidth: 160, fontSize: 13 }}>
          <option value="">Other role...</option>
          <option value="contractor">Main Contractor</option>
          <option value="sub_contractor">Sub Contractor</option>
          <option value="buyer">Buyer</option>
          <option value="advocate">Advocate / Legal</option>
          <option value="auditor">Auditor / Regulator</option>
          <option value="bank_relationship_manager">Bank Relationship Manager</option>
          <option value="drone_operator">Drone Operator</option>
          <option value="relationship_manager">Relationship Manager</option>
          <option value="sales_personnel">Sales Personnel</option>
          <option value="sales_agent">Sales Agent</option>
          <option value="sales_clerk">Sales Clerk</option>
          <option value="unit_buyer">Buyer / Purchaser</option>
        </select>
        <select value={customUserId} onChange={e => setCustomUserId(e.target.value)}
          style={{ flex: 1, minWidth: 140, fontSize: 13 }}>
          <option value="">(select person)</option>
          {allUsers
            .filter(u => !projectMembers.find((m: any) => m.username === u.username))
            .filter(u => !customRole || (u.roles || []).includes(customRole))
            .map((u: any) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
        <button className="btn sm" disabled={!customRole || !customUserId || !project}
          onClick={async () => {
            if (!project) return;
            try {
              await addProjectMember(project.id, { user_id: customUserId, role: customRole });
              setCustomRole(""); setCustomUserId("");
              loadProjectMembers();
            } catch (err: any) { setInviteMsg("Error: " + err.message); }
          }}>
          + Add
        </button>
      </div>

      {projectMembers.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
          {projectMembers.length} member{projectMembers.length !== 1 ? "s" : ""} assigned
        </div>
      )}

      {projectMembers.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Assigned Team:</div>
          {projectMembers.map((m: any) => (
            <div key={m.id} className="row" style={{ gap: 6, fontSize: 13, padding: "2px 0" }}>
              <span style={{ color: "var(--muted)", minWidth: 140 }}>{m.role_name || m.role}</span>
              <span>{m.username}</span>
            </div>
          ))}
        </div>
      )}

      {inviteMsg && (
        <div style={{ marginTop: 12, padding: 8, borderRadius: 6, fontSize: 13,
          background: inviteMsg.includes("Error") ? "rgba(239,68,68,0.1)" : "rgba(251,191,36,0.1)",
          color: inviteMsg.includes("Error") ? "var(--danger)" : "var(--warning)",
        }}>{inviteMsg}</div>
      )}

      <button className="btn primary" style={{ marginTop: 16 }} onClick={onNext}>
        Continue <ChevronRight size={16} />
      </button>
    </div>
  );
}
