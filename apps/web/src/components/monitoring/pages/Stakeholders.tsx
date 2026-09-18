import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import { Users, UserCheck, Search, Plus, Mail } from "lucide-react";

import {
  fetchProjectMembers,
  fetchUsers,
  type ProjectMember,
  type UserProfile,
} from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { KpiCard } from "../components/KpiCard";
import { PageEmpty, PageError, PageLoading, StatusPill, TableEmpty } from "../components/PageState";

type StakeholderRow = {
  key: string;
  name: string;
  email: string;
  roles: string[];
  is_active: boolean | undefined;
  source: "user" | "member";
  projectRole?: string;
  label?: string;
  tenantNames?: string[];
};

function roleList(u: UserProfile): string[] {
  if (Array.isArray(u.roles) && u.roles.length) return u.roles;
  return [];
}

export function Stakeholders() {
  const navigate = useNavigate();
  const { activeProjectId, activeProject, loading: wsLoading } = useWorkspace();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [scope, setScope] = useState<"all" | "project">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, memberList] = await Promise.all([
        fetchUsers(),
        activeProjectId
          ? fetchProjectMembers(activeProjectId).catch(() => [] as ProjectMember[])
          : Promise.resolve([] as ProjectMember[]),
      ]);
      setUsers(Array.isArray(userList) ? userList : []);
      setMembers(Array.isArray(memberList) ? memberList : []);
    } catch (e) {
      setError((e as Error).message || "Failed to load stakeholders");
      setUsers([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ProjectMember>();
    for (const m of members) {
      if (m.user_id) map.set(String(m.user_id), m);
      if (m.username) map.set(`u:${m.username}`, m);
    }
    return map;
  }, [members]);

  const rows: StakeholderRow[] = useMemo(() => {
    if (scope === "project" && activeProjectId) {
      return members.map((m) => ({
        key: `m-${m.id}`,
        name: m.username || m.email || `Member #${m.id}`,
        email: m.email || "",
        roles: [m.role_name || m.role].filter(Boolean),
        is_active: true,
        source: "member" as const,
        projectRole: m.role_name || m.role,
        label: m.label,
      }));
    }

    // Prefer tenant users; enrich with project membership when available
    if (users.length) {
      return users.map((u) => {
        const m =
          memberByUserId.get(String(u.id)) ||
          memberByUserId.get(`u:${u.username}`);
        return {
          key: `u-${u.id}`,
          name: u.username,
          email: u.email || "",
          roles: roleList(u),
          is_active: u.is_active,
          source: "user" as const,
          projectRole: m?.role_name || m?.role,
          label: m?.label,
          tenantNames: (u.tenants || []).map((t) => t.name).filter(Boolean),
        };
      });
    }

    // Fallback: show project members only if user list empty but members exist
    return members.map((m) => ({
      key: `m-${m.id}`,
      name: m.username || m.email || `Member #${m.id}`,
      email: m.email || "",
      roles: [m.role_name || m.role].filter(Boolean),
      is_active: true,
      source: "member" as const,
      projectRole: m.role_name || m.role,
      label: m.label,
    }));
  }, [scope, activeProjectId, users, members, memberByUserId]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      r.roles.forEach((role) => set.add(role));
      if (r.projectRole) set.add(r.projectRole);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (roleFilter !== "all") {
        const hit =
          r.roles.some((x) => x === roleFilter) ||
          r.projectRole === roleFilter;
        if (!hit) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.name, r.email, ...r.roles, r.projectRole, r.label, ...(r.tenantNames || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, roleFilter, search]);

  const activeCount = rows.filter((r) => r.is_active !== false).length;
  const uniqueRoles = allRoles.length;

  if (wsLoading && loading) {
    return <div style={{ padding: 20 }}><PageLoading /></div>;
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
            Stakeholders Directory
          </h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Users and project members from live API data
            {activeProject ? ` · Project: ${activeProject.name}` : ""}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/app/users")}
        >
          <Plus size={15} style={{ marginRight: 4 }} /> Manage Users
        </button>
      </div>

      {error && <PageError message={error} onRetry={load} />}

      {loading ? (
        <PageLoading />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <KpiCard label="Total Stakeholders" value={rows.length} color="var(--text)" icon={<Users size={18} />} />
            <KpiCard label="Active" value={activeCount} color="var(--color-emerald)" icon={<UserCheck size={18} />} />
            <KpiCard label="Distinct Roles" value={uniqueRoles} color="var(--color-brand-blue)" />
            <KpiCard
              label="On Active Project"
              value={members.length}
              color="var(--color-amber)"
              sub={activeProject?.name || (activeProjectId ? "Project members" : "No project selected")}
            />
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>STAKEHOLDER DIRECTORY</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "all" | "project")}
                  style={{ height: 34, borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, padding: "0 8px" }}
                >
                  <option value="all">All users</option>
                  <option value="project" disabled={!activeProjectId}>
                    Project members{activeProjectId ? ` (${members.length})` : ""}
                  </option>
                </select>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ height: 34, borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, padding: "0 8px" }}
                >
                  <option value="all">All roles</option>
                  {allRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <div style={{ position: "relative", width: 240 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    placeholder="Search name, role, email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: "100%", paddingLeft: 32, paddingRight: 10, height: 34, borderRadius: 6,
                      background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12,
                    }}
                  />
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <PageEmpty
                title="No stakeholders found"
                description={
                  scope === "project"
                    ? "This project has no members yet. Add members from the project detail page."
                    : "No users were returned by the API."
                }
                action={{ label: "Open Users", onClick: () => navigate("/app/users") }}
                icon={<Users size={40} />}
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: 8 }}>Name</th>
                      <th style={{ padding: 8 }}>Email</th>
                      <th style={{ padding: 8 }}>Roles</th>
                      <th style={{ padding: 8 }}>Project Role</th>
                      <th style={{ padding: 8 }}>Tenants</th>
                      <th style={{ padding: 8 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((stk) => (
                      <tr key={stk.key} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: 8, fontWeight: 700, color: "var(--text)" }}>
                          {stk.name}
                          {stk.label ? (
                            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{stk.label}</div>
                          ) : null}
                        </td>
                        <td style={{ padding: 8, color: "var(--muted)" }}>
                          {stk.email ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Mail size={12} /> {stk.email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: 8, fontWeight: 600 }}>
                          {stk.roles.length ? stk.roles.join(", ") : "—"}
                        </td>
                        <td style={{ padding: 8, color: "var(--color-brand-blue)", fontWeight: 600 }}>
                          {stk.projectRole || "—"}
                        </td>
                        <td style={{ padding: 8, color: "var(--muted)" }}>
                          {stk.tenantNames?.length ? stk.tenantNames.join(", ") : "—"}
                        </td>
                        <td style={{ padding: 8 }}>
                          <StatusPill
                            label={stk.is_active === false ? "Inactive" : "Active"}
                            tone={stk.is_active === false ? "neutral" : "success"}
                          />
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <TableEmpty colSpan={6} label="No stakeholders match this filter." />
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
