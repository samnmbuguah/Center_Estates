import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import { ShieldCheck, Users, Search, Plus, Key, FileClock } from "lucide-react";

import {
  fetchAuditLogs,
  fetchRoles,
  fetchUsers,
  type AuditLog,
  type Role,
  type UserProfile,
} from "../api";
import { formatDateTime } from "../lib/format";
import { KpiCard } from "../components/KpiCard";
import { PageEmpty, PageError, PageLoading, StatusPill, TableEmpty } from "../components/PageState";

export function Administration() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, roleList, auditRes] = await Promise.all([
        fetchUsers(),
        fetchRoles().catch(() => [] as Role[]),
        fetchAuditLogs({ limit: 20 }).catch(() => ({ total: 0, offset: 0, limit: 20, results: [] as AuditLog[] })),
      ]);
      setUsers(Array.isArray(userList) ? userList : []);
      setRoles(Array.isArray(roleList) ? roleList : []);
      setAuditLogs(Array.isArray(auditRes?.results) ? auditRes.results : []);
      setAuditTotal(Number(auditRes?.total ?? 0));
    } catch (e) {
      setError((e as Error).message || "Failed to load administration data");
      setUsers([]);
      setRoles([]);
      setAuditLogs([]);
      setAuditTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) => {
      const hay = [
        u.username,
        u.email,
        ...(u.roles || []),
        ...(u.tenants || []).map((t) => t.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  const activeUsers = users.filter((u) => u.is_active !== false).length;
  const roleCount = roles.length;

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
            Administration & System Security
          </h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Users, roles, and immutable audit trail from the live API
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => navigate("/app/roles")}>
            <Key size={15} style={{ marginRight: 4 }} /> Roles
          </button>
          <button className="btn ghost" onClick={() => navigate("/app/audit-log")}>
            <FileClock size={15} style={{ marginRight: 4 }} /> Audit Log
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "#d92d2d", borderColor: "#d92d2d" }}
            onClick={() => navigate("/app/users")}
          >
            <Plus size={15} style={{ marginRight: 4 }} /> Add System User
          </button>
        </div>
      </div>

      {error && <PageError message={error} onRetry={load} />}

      {loading ? (
        <PageLoading />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <KpiCard
              label="Active System Users"
              value={activeUsers}
              sub={`${users.length} total`}
              color="var(--text)"
              icon={<Users size={18} />}
              to="/app/users"
            />
            <KpiCard
              label="Configured Roles"
              value={roleCount}
              color="#00a3ff"
              icon={<Key size={18} />}
              to="/app/roles"
            />
            <KpiCard
              label="Access Control"
              value={roleCount > 0 ? "RBAC" : "—"}
              sub={roleCount > 0 ? `${roleCount} role${roleCount === 1 ? "" : "s"} defined` : "No roles returned"}
              color="#10b981"
              icon={<ShieldCheck size={18} />}
              to="/app/roles"
            />
            <KpiCard
              label="Audit Log Entries"
              value={auditTotal}
              sub={`Showing latest ${auditLogs.length}`}
              color="var(--text)"
              icon={<FileClock size={18} />}
              to="/app/audit-log"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px, 420px)", gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>USER ADMINISTRATION</h3>
                <div style={{ position: "relative", width: 220 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    placeholder="Search user name or role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: "100%", paddingLeft: 32, paddingRight: 10, height: 34, borderRadius: 6,
                      background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12,
                    }}
                  />
                </div>
              </div>

              {users.length === 0 ? (
                <PageEmpty
                  title="No users found"
                  description="Invite users from the Users page to populate the directory."
                  action={{ label: "Open Users", onClick: () => navigate("/app/users") }}
                  icon={<Users size={40} />}
                />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                        <th style={{ padding: 8 }}>User</th>
                        <th style={{ padding: 8 }}>Assigned Roles</th>
                        <th style={{ padding: 8 }}>Tenant / Org</th>
                        <th style={{ padding: 8 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((usr) => (
                        <tr key={usr.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: 8 }}>
                            <div style={{ fontWeight: 700, color: "var(--text)" }}>
                              {usr.username}
                              {usr.is_superuser ? (
                                <span style={{ marginLeft: 6, fontSize: 10, color: "var(--muted)" }}>admin</span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{usr.email || "—"}</div>
                          </td>
                          <td style={{ padding: 8, color: "#00a3ff", fontWeight: 600 }}>
                            {(usr.roles || []).length ? usr.roles.join(", ") : "—"}
                          </td>
                          <td style={{ padding: 8, color: "var(--muted)" }}>
                            {(usr.tenants || []).map((t) => t.name).filter(Boolean).join(", ") || "—"}
                          </td>
                          <td style={{ padding: 8 }}>
                            <StatusPill
                              label={usr.is_active === false ? "Inactive" : "Active"}
                              tone={usr.is_active === false ? "neutral" : "success"}
                            />
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableEmpty colSpan={4} label="No users match this search." />
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <button className="btn ghost sm" onClick={() => navigate("/app/users")}>
                  Manage all users →
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>SYSTEM SECURITY AUDIT TRAIL</h3>
                <span
                  style={{ fontSize: 12, color: "#00a3ff", cursor: "pointer" }}
                  onClick={() => navigate("/app/audit-log")}
                >
                  View Complete Audit Log →
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <PageEmpty
                  title="No audit entries"
                  description="Recent audit activity will appear here when available."
                  icon={<FileClock size={36} />}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        background: "var(--surface-2)",
                        padding: 12,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4, gap: 8 }}>
                        <strong style={{ color: "#00a3ff" }}>{log.action || log.category || "EVENT"}</strong>
                        <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                        {log.user || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {[log.resource, log.details].filter(Boolean).join(" — ") || "—"}
                      </div>
                      {log.outcome && (
                        <div style={{ marginTop: 6 }}>
                          <StatusPill
                            label={log.outcome}
                            tone={
                              log.outcome === "success"
                                ? "success"
                                : log.outcome === "error" || log.outcome === "blocked"
                                  ? "danger"
                                  : "warning"
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
