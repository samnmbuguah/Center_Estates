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
        <KpiCard icon="👥" iconBg="#e0e7ff" iconColor="#4f46e5" label="Team Members" value={number.format(totalMembers)} sub="Organization users" />
        <KpiCard icon="🛡️" iconBg="#fef3c7" iconColor="#92400e" label="Super Admins" value={number.format(adminCount)} sub="Full portfolio access" />
        <KpiCard icon="💼" iconBg="#e0f2fe" iconColor="#0284c7" label="Operational Staff" value={number.format(staffCount)} sub="Property-assigned staff" />
        <KpiCard icon="🏢" iconBg="#dcfce7" iconColor="#16a34a" label="Active Status" value={number.format(members.filter((m) => m.status === "active").length)} sub="Ready for task delegation" />
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
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Username</th>
                  <th>Contact Info</th>
                  <th>Assigned Roles</th>
                  <th>Assigned Properties (Matrix)</th>
                  <th>Access Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} onClick={() => setSelectedMember(m)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: m.is_organization_admin ? "#ea580c" : "#4f46e5",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {(m.first_name?.[0] || m.username?.[0] || "U").toUpperCase()}
                        </span>
                        <div>
                          <strong style={{ fontSize: 13, display: "block" }}>{m.full_name}</strong>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{m.username}</td>
                    <td style={{ fontSize: 12 }}>
                      <div>{m.email || <span className="muted">No email</span>}</div>
                      {m.phone_number && <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.phone_number}</div>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.roles?.length > 0 ? (
                          m.roles.map((r) => <Badge key={r.id} tone="purple">{r.name}</Badge>)
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Standard Member</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.is_organization_admin ? (
                          <Badge tone="blue">All Properties (Portfolio)</Badge>
                        ) : m.assigned_properties?.length > 0 ? (
                          m.assigned_properties.map((p) => (
                            <span key={p.id} className="fc-priority-chip" style={{ fontSize: 11 }}>
                              🏢 {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Unrestricted / General</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <StatusPill
                        value={m.is_organization_admin ? "Super Admin" : "Staff"}
                        tone={m.is_organization_admin ? "yellow" : "blue"}
                      />
                    </td>
                    <td>
                      {canManage && (
                        <button
                          className="btn ghost sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMemberModal(m);
                          }}
                        >
                          Edit Scope
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
                background: selectedMember.is_organization_admin ? "#ea580c" : "#4f46e5",
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
