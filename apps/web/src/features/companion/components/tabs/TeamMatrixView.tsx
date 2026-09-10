"use client";

import { useState } from "react";
import { Badge, DetailDrawer, EmptyState, Field, KpiCard, KpiStrip, Modal, number, Panel, StatusPill } from "@/components/module-ui";
import { TeamMember } from "../../types/companion.types";
import { fmtDateTime } from "../../utils/companion.utils";

export function TeamMatrixView({
  members,
  loading,
  canManage,
  openAddMemberModal,
  openEditMemberModal,
}: {
  members: TeamMember[];
  loading: boolean;
  canManage: boolean;
  openAddMemberModal: () => void;
  openEditMemberModal: (m: TeamMember) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const totalMembers = members.length;
  const adminCount = members.filter((m) => m.is_organization_admin).length;
  const staffCount = totalMembers - adminCount;

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.full_name || "").toLowerCase().includes(q) ||
      (m.username || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q) ||
      (m.phone_number || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="👥" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Team Members" value={number.format(totalMembers)} sub="Organization users" />
        <KpiCard icon="🛡️" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-strong)" label="Super Admins" value={number.format(adminCount)} sub="Full portfolio access" />
        <KpiCard icon="💼" iconBg="var(--color-sky-bg)" iconColor="var(--color-sky)" label="Operational Staff" value={number.format(staffCount)} sub="Property-assigned staff" />
        <KpiCard icon="🏢" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Active Status" value={number.format(members.filter((m) => m.status === "active").length)} sub="Ready for task delegation" />
      </KpiStrip>

      <Panel
        title="Team Members & Property Assignment Matrix"
        badge={filteredMembers.length}
        action={
          canManage ? (
            <button className="btn primary sm" onClick={openAddMemberModal}>
              Add Team Member (Lydia, Abel, Sharon…)
            </button>
          ) : null
        }
      >
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12 }}>
          <input
            type="search"
            placeholder="Search by name, username, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", maxWidth: 360, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
          />
        </div>

        {filteredMembers.length === 0 ? (
          <div style={{ padding: 36 }}>
            <EmptyState
              icon="👥"
              title="No team members found"
              description="Create user profiles for your team (e.g. Lydia, Abel, Sharon, Marilyn) and assign them to specific properties."
              action={canManage ? <button className="btn primary sm" onClick={openAddMemberModal}>Add Team Member</button> : undefined}
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="fc-data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>Staff Member & Contact</th>
                  <th style={{ width: "28%" }}>Assigned Roles</th>
                  <th style={{ width: "26%" }}>Assigned Properties (Matrix)</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} onClick={() => setSelectedMember(m)} style={{ cursor: "pointer" }}>
                    <td style={{ verticalAlign: "top" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            minWidth: 32,
                            borderRadius: "50%",
                            background: m.is_organization_admin ? "linear-gradient(135deg, var(--color-danger), var(--color-danger-strong))" : "linear-gradient(135deg, var(--color-indigo), #3730a3)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {(m.first_name?.[0] || m.username?.[0] || "U").toUpperCase()}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 13, color: "var(--text)" }}>{m.full_name || m.username}</strong>
                            <span className="mono" style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--border)" }}>
                              @{m.username}
                            </span>
                            {m.is_organization_admin && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "var(--color-amber-bg)", color: "var(--color-amber-strong)", padding: "1px 6px", borderRadius: 10 }}>
                                Super Admin
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                            {m.email && <span>✉️ {m.email}</span>}
                            {m.phone_number && <span>📞 {m.phone_number}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.roles?.length > 0 ? (
                          m.roles.map((r) => <Badge key={r.id} tone={m.is_organization_admin ? "purple" : "blue"}>{r.name}</Badge>)
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Standard Member</span>
                        )}
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.is_organization_admin ? (
                          <span style={{ fontSize: 11, padding: "2px 8px", background: "var(--color-sky-bg)", color: "var(--color-sky-deep)", borderRadius: 4, fontWeight: 600, border: "1px solid #bae6fd" }}>
                            🌐 All Properties (Portfolio)
                          </span>
                        ) : m.assigned_properties?.length > 0 ? (
                          m.assigned_properties.map((p) => (
                            <span key={p.id} className="fc-priority-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              🏢 <strong>{p.name}</strong> <span className="mono muted">({p.code})</span>
                            </span>
                          ))
                        ) : m.roles?.some((r) => r.slug === "property-manager" || r.name.toLowerCase().includes("property manager")) ? (
                          <span style={{ fontSize: 11, padding: "2px 8px", background: "var(--color-amber-bg)", color: "var(--color-amber-strong)", borderRadius: 4, fontWeight: 700, border: "1px solid var(--color-amber-200)" }}>
                            🔒 Self-Created Only (0 Assigned)
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Unrestricted / General</span>
                        )}
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top", textAlign: "right" }}>
                      {canManage && (
                        <button
                          className="btn ghost sm"
                          style={{ fontSize: 12, padding: "4px 10px", fontWeight: 600 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMemberModal(m);
                          }}
                        >
                          Edit Matrix
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selectedMember && (
        <DetailDrawer title={`Staff Profile — ${selectedMember.full_name}`} onClose={() => setSelectedMember(null)} width={420}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: selectedMember.is_organization_admin ? "var(--color-orange)" : "var(--color-indigo)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {(selectedMember.first_name?.[0] || selectedMember.username?.[0] || "U").toUpperCase()}
            </span>
            <div>
              <strong style={{ fontSize: 15 }}>{selectedMember.full_name}</strong>
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>@{selectedMember.username}</div>
            </div>
            <StatusPill value={selectedMember.status} tone={selectedMember.status === "active" ? "green" : "gray"} />
          </div>

          <div className="fc-detail-grid" style={{ marginBottom: 18 }}>
            <div>
              <span className="muted" style={{ fontSize: 11, display: "block" }}>Email</span>
              <strong style={{ fontSize: 13 }}>{selectedMember.email || "—"}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: 11, display: "block" }}>Phone</span>
              <strong style={{ fontSize: 13 }}>{selectedMember.phone_number || "—"}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: 11, display: "block" }}>Access</span>
              <strong style={{ fontSize: 13 }}>{selectedMember.is_organization_admin ? "Super Administrator" : "Operational Member"}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: 11, display: "block" }}>Created</span>
              <span style={{ fontSize: 12 }}>{fmtDateTime(selectedMember.created_at)}</span>
            </div>
          </div>

          <Panel title="Assigned Properties (Scoping Matrix)" style={{ marginBottom: 18 }}>
            <div style={{ padding: 14 }}>
              {selectedMember.is_organization_admin ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                  ✓ As an organization Super Administrator, this user has access to all current and future properties.
                </p>
              ) : selectedMember.assigned_properties?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedMember.assigned_properties.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "var(--surface-2)", borderRadius: 6, fontSize: 12 }}>
                      <strong>🏢 {p.name}</strong>
                      <span className="mono muted">{p.code}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  No specific property restrictions applied (General portfolio visibility).
                </p>
              )}
            </div>
          </Panel>

          {canManage && (
            <button
              className="btn primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                const m = selectedMember;
                setSelectedMember(null);
                openEditMemberModal(m);
              }}
            >
              ⚙️ Modify Roles &amp; Property Matrix
            </button>
          )}
        </DetailDrawer>
      )}
    </>
  );
}
