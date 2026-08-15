"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, MenuItem, Paper, Select, Stack,
  TextField, Typography, ListSubheader
} from "@mui/material";
import { Plus, Save, ShieldCheck, Trash2, CheckSquare, Square } from "lucide-react";

import { apiErrorMessage, apiFetch } from "@/lib/api";

type Permission = { key: string; label: string; module: string; description: string };
type Role = {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  permission_keys: string[];
  assigned_users: number;
};

const moduleNames: Record<string, string> = {
  property: "🏢 Property Management",
  facility: "🔧 Facility Management",
  sales: "💰 Sales & Leasing",
  tender: "📋 Tender Engine",
  valuation: "📜 Valuation Services",
  monitoring: "📊 Construction Monitoring",
  companion: "🧭 Companion & Staff Performance",
};

export function RoleAccessManager({ organizationId }: { organizationId: string | null }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const active = roles.find((role) => role.id === activeId) ?? null;

  const load = useCallback(async (preferredId?: string) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [roleResponse, permissionResponse] = await Promise.all([
        apiFetch("/access/roles/", {}, organizationId),
        apiFetch("/access/permissions/", {}, organizationId),
      ]);
      if (!roleResponse.ok) throw new Error(await apiErrorMessage(roleResponse, "Roles could not be loaded."));
      if (!permissionResponse.ok) throw new Error(await apiErrorMessage(permissionResponse, "Permissions could not be loaded."));
      const roleList = await roleResponse.json() as Role[];
      setRoles(roleList);
      setPermissions(await permissionResponse.json() as Permission[]);
      const target = roleList.find((role) => role.id === preferredId)
        ?? roleList[0]
        ?? null;
      setActiveId(target?.id ?? "");
      setName(target?.name ?? "");
      setDescription(target?.description ?? "");
      setSelected(new Set(target?.permission_keys ?? []));
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : "Access settings could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  function selectRole(id: string) {
    const role = roles.find((item) => item.id === id);
    setActiveId(id);
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permission_keys ?? []));
    setNotice(null);
  }

  const grouped = useMemo(() => Object.entries(moduleNames).map(([module, label]) => ({
    module,
    label,
    permissions: permissions.filter((permission) => permission.module === module),
  })), [permissions]);

  const toggle = (key: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const selectModuleAll = (modulePerms: Permission[]) => {
    setSelected((current) => {
      const next = new Set(current);
      modulePerms.forEach((p) => next.add(p.key));
      return next;
    });
  };

  const clearModuleAll = (modulePerms: Permission[]) => {
    setSelected((current) => {
      const next = new Set(current);
      modulePerms.forEach((p) => next.delete(p.key));
      return next;
    });
  };

  async function saveRole() {
    if (!organizationId || !active || active.slug === "platform-admin") return;
    setSaving(true); setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(`/access/roles/${active.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, permission_keys: [...selected] }),
      }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Role changes could not be saved."));
      setNotice({ severity: "success", text: `${name} permissions saved successfully.` });
      await load(active.id);
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : "Role changes could not be saved." });
    } finally { setSaving(false); }
  }

  async function createRole() {
    if (!organizationId || !newName.trim()) return;
    setSaving(true); setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch("/access/roles/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || "Custom organization role", permission_keys: [] }),
      }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The role could not be created."));
      const created = await response.json() as Role;
      setCreateOpen(false); setNewName(""); setNewDesc("");
      await load(created.id);
      setNotice({ severity: "success", text: `Role '${created.name}' created. Configure active module permissions below.` });
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : "The role could not be created." });
    } finally { setSaving(false); }
  }

  async function deleteRole() {
    if (!organizationId || !active || active.is_system) return;
    if (!window.confirm(`Are you sure you want to delete custom role '${active.name}'?`)) return;
    setSaving(true); setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(`/access/roles/${active.id}/`, { method: "DELETE" }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The role could not be deleted."));
      setActiveId(""); await load();
      setNotice({ severity: "success", text: `Role '${active.name}' deleted.` });
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : "The role could not be deleted." });
    } finally { setSaving(false); }
  }

  const totalSelectedCount = selected.size;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>🔐 Embedded System Roles & Feature Access Matrix</Typography>
          <Typography variant="body2" color="text.secondary">
            Pre-configured default roles and custom organization roles across all 7 core platform modules.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setCreateOpen(true)} style={{ background: "#d92d2d", borderColor: "#d92d2d" }}>
          + Create Custom Role
        </Button>
      </Box>

      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      {loading ? <Typography color="text.secondary">Loading embedded system roles…</Typography> : (
        <>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, color: "text.secondary" }}>
                  SELECT EMBEDDED OR CUSTOM ROLE TO CONFIGURE:
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={activeId}
                  onChange={(event) => selectRole(event.target.value)}
                  aria-label="Select Role"
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{role.name}</Typography>
                        <Chip
                          size="small"
                          label={role.is_system ? "Default System Role" : "Custom"}
                          color={role.is_system ? "default" : "secondary"}
                          variant={role.is_system ? "outlined" : "filled"}
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              {active && (
                <Stack direction="row" spacing={1} sx={{ mt: { xs: 1, md: 2.5 } }}>
                  <Chip
                    color="primary"
                    variant="outlined"
                    label={`${active.assigned_users} assigned user${active.assigned_users === 1 ? "" : "s"}`}
                  />
                  <Chip
                    color={active.is_system ? "default" : "secondary"}
                    label={active.is_system ? "Default Embedded" : "Custom Role"}
                  />
                </Stack>
              )}
            </Stack>
          </Paper>

          {active && (
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
              <Stack spacing={2.5}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="Role name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={active.slug === "platform-admin"}
                  />
                  <TextField
                    fullWidth
                    label="Role description & purpose"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={active.slug === "platform-admin"}
                  />
                </Stack>

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Active Module Permissions ({totalSelectedCount} of {permissions.length} selected)
                  </Typography>
                  {active.slug !== "platform-admin" && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={<CheckSquare size={14} />}
                        onClick={() => setSelected(new Set(permissions.map((p) => p.key)))}
                      >
                        Grant All
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<Square size={14} />}
                        onClick={() => setSelected(new Set())}
                      >
                        Clear All
                      </Button>
                    </Stack>
                  )}
                </Box>

                {active.slug === "platform-admin" ? (
                  <Alert icon={<ShieldCheck size={20} />} severity="info">
                    <strong>Platform Administrator</strong> retains unrestricted, immutable superuser privileges across all modules, settings, and APIs.
                  </Alert>
                ) : grouped.map((group) => {
                  const groupSelectedCount = group.permissions.filter((p) => selected.has(p.key)).length;
                  return (
                    <Box key={group.module} sx={{ p: 2, borderRadius: 1.5, background: "var(--surface-2, rgba(0,0,0,0.02))", border: "1px solid var(--border)" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{group.label}</Typography>
                          <Chip
                            size="small"
                            label={`${groupSelectedCount}/${group.permissions.length}`}
                            color={groupSelectedCount > 0 ? "primary" : "default"}
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => selectModuleAll(group.permissions)} sx={{ fontSize: 11, py: 0.2 }}>
                            Select Module
                          </Button>
                          <Button size="small" color="inherit" onClick={() => clearModuleAll(group.permissions)} sx={{ fontSize: 11, py: 0.2 }}>
                            Clear
                          </Button>
                        </Stack>
                      </Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 1 }}>
                        {group.permissions.map((permission) => (
                          <FormControlLabel
                            key={permission.key}
                            control={<Checkbox size="small" checked={selected.has(permission.key)} onChange={() => toggle(permission.key)} />}
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12 }}>{permission.label}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{permission.key}</Typography>
                              </Box>
                            }
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}

                {active.slug !== "platform-admin" && (
                  <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2, pt: 1 }}>
                    <Button color="error" startIcon={<Trash2 size={17} />} disabled={active.is_system || saving} onClick={deleteRole}>
                      {active.is_system ? "Default System Role (Cannot delete)" : "Delete Custom Role"}
                    </Button>
                    <Button variant="contained" startIcon={<Save size={17} />} disabled={saving || !name.trim()} onClick={saveRole} style={{ background: "#d92d2d", borderColor: "#d92d2d" }}>
                      {saving ? "Saving Changes…" : `Save ${name} Permissions`}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}
        </>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>+ Create Custom Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Role Name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Senior Property Valuer"
            />
            <TextField
              fullWidth
              label="Role Description"
              value={newDesc}
              onChange={(event) => setNewDesc(event.target.value)}
              placeholder="e.g. Scoped to valuation instructions and peer report approvals"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving || !newName.trim()} onClick={createRole} style={{ background: "#d92d2d" }}>
            Create Role
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
