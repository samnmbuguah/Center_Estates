"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, MenuItem, Paper, Select, Stack,
  TextField, Typography,
} from "@mui/material";
import { Plus, Save, ShieldCheck, Trash2 } from "lucide-react";

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
  property: "Property Management",
  facility: "Facility Management",
  companion: "Companion",
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

  // The effect synchronizes this client-side editor with the access-control API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setNotice({ severity: "success", text: `${name} permissions saved.` });
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
        body: JSON.stringify({ name: newName.trim(), description: "Custom organization role", permission_keys: [] }),
      }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The role could not be created."));
      const created = await response.json() as Role;
      setCreateOpen(false); setNewName("");
      await load(created.id);
      setNotice({ severity: "success", text: `${created.name} created. Select the features it can use.` });
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : "The role could not be created." });
    } finally { setSaving(false); }
  }

  async function deleteRole() {
    if (!organizationId || !active || active.is_system) return;
    if (!window.confirm(`Delete ${active.name}?`)) return;
    setSaving(true); setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(`/access/roles/${active.id}/`, { method: "DELETE" }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The role could not be deleted."));
      setActiveId(""); await load();
      setNotice({ severity: "success", text: `${active.name} deleted.` });
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : "The role could not be deleted." });
    } finally { setSaving(false); }
  }

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Roles and feature access</Typography>
          <Typography variant="body2" color="text.secondary">Keep roles broad. Use the matrix to decide what each role can view, manage, approve, and export.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setCreateOpen(true)}>Create role</Button>
      </Box>

      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      {loading ? <Typography color="text.secondary">Loading access controls…</Typography> : (
        <>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
              <Select fullWidth size="small" value={activeId} onChange={(event) => selectRole(event.target.value)} aria-label="Role">
                {roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
              </Select>
              {active && <Chip label={`${active.assigned_users} assigned user${active.assigned_users === 1 ? "" : "s"}`} />}
              {active?.is_system && <Chip color="primary" variant="outlined" label="Default role" />}
            </Stack>
          </Paper>

          {active && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField fullWidth label="Role name" value={name} onChange={(event) => setName(event.target.value)} disabled={active.slug === "platform-admin"} />
                <TextField fullWidth label="Purpose" value={description} onChange={(event) => setDescription(event.target.value)} disabled={active.slug === "platform-admin"} />
              </Stack>
              <Divider />
              {active.slug === "platform-admin" ? (
                <Alert icon={<ShieldCheck size={20} />} severity="info">Platform administrators always have every feature and action.</Alert>
              ) : grouped.map((group) => (
                <Box key={group.module}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{group.label}</Typography>
                    <Button size="small" onClick={() => setSelected((current) => {
                      const next = new Set(current);
                      const allSelected = group.permissions.every((permission) => next.has(permission.key));
                      group.permissions.forEach((permission) => allSelected ? next.delete(permission.key) : next.add(permission.key));
                      return next;
                    })}>Toggle module</Button>
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 1 }}>
                    {group.permissions.map((permission) => (
                      <FormControlLabel key={permission.key} control={<Checkbox checked={selected.has(permission.key)} onChange={() => toggle(permission.key)} />} label={<Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{permission.label}</Typography><Typography variant="caption" color="text.secondary">{permission.key}</Typography></Box>} />
                    ))}
                  </Box>
                </Box>
              ))}
              {active.slug !== "platform-admin" && <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                <Button color="error" startIcon={<Trash2 size={17} />} disabled={active.is_system || saving} onClick={deleteRole}>Delete custom role</Button>
                <Button variant="contained" startIcon={<Save size={17} />} disabled={saving || !name.trim()} onClick={saveRole}>{saving ? "Saving…" : "Save role"}</Button>
              </Stack>}
            </Stack>
          </Paper>}
        </>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create a custom role</DialogTitle>
        <DialogContent><TextField autoFocus fullWidth label="Role name" value={newName} onChange={(event) => setNewName(event.target.value)} sx={{ mt: 1 }} helperText="Example: Regional Property Supervisor" /></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="contained" disabled={saving || !newName.trim()} onClick={createRole}>Create role</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
