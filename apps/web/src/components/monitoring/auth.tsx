"use client";

import React from "react";
import { useAuth as usePlatformAuth } from "@/components/auth-provider";
import type { Me, TenantInfo } from "./api-types";

const CONSTRUCTION_PERMISSION_ALIASES: Record<string, string[]> = {
  "finance.admin": ["monitoring.finance", "monitoring.commercial", "monitoring.approve"],
  "finance.certificate.issue": ["monitoring.finance", "monitoring.commercial", "monitoring.certify"],
  "projects.edit": ["monitoring.project_admin", "monitoring.site"],
  "projects.requirements.waive": ["monitoring.project_admin", "monitoring.approve"],
  "documents.upload": ["monitoring.site", "monitoring.project_admin"],
  "site.reporting.view": ["monitoring.view", "monitoring.site"],
  "site.reporting.milestone.verify": ["monitoring.certify", "monitoring.approve"],
  "communication.post": ["monitoring.site", "monitoring.project_admin"],
  "drone.view": ["monitoring.view", "monitoring.site"],
  "bim.view": ["monitoring.view", "monitoring.site", "monitoring.commercial"],
  "users.create": ["monitoring.project_admin"],
  "users.edit": ["monitoring.project_admin"],
  "users.disable": ["monitoring.project_admin"],
  "settings.manage": ["monitoring.project_admin"],
};

export function useAuth() {
  const platformAuth = usePlatformAuth();
  const session = platformAuth.session;
  const user = session?.user;

  const isSuper = Boolean(user?.isSuperuser);
  const actualRoles = session?.roles?.length ? session.roles : (isSuper ? ["platform-admin"] : ["viewer"]);
  const actualPerms = session?.permissions?.length ? session.permissions : (isSuper ? ["*"] : ["monitoring.view"]);

  const me: Me | null = user
    ? {
        username: user.username || "user",
        email: user.email || "",
        first_name: user.firstName || "",
        last_name: user.lastName || "",
        is_superuser: isSuper,
        roles: actualRoles,
        permissions: actualPerms,
        tenants: (session?.organizations || []).map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          is_default: o.id === session?.activeOrganizationId,
          is_tenant_admin: isSuper || actualRoles.some((r) => r.includes("admin") || r.includes("manager")),
        })),
        tenant_id: session?.activeOrganizationId ?? null,
        must_change_password: false,
      }
    : null;

  const activeOrg = session?.organizations.find((o) => o.id === session.activeOrganizationId);
  const tenant: TenantInfo | null = session?.activeOrganizationId
    ? {
        id: session.activeOrganizationId,
        name: activeOrg?.name || "Active Org",
        slug: activeOrg?.slug || "active-org",
        is_default: true,
        is_tenant_admin: Boolean(me?.tenants.find((t) => t.id === session.activeOrganizationId)?.is_tenant_admin),
      }
    : null;

  const can = (perm: string): boolean => {
    if (!session) return false;
    if (isSuper || session.permissions.includes("*")) return true;
    if (platformAuth.can(perm)) return true;
    const aliases = CONSTRUCTION_PERMISSION_ALIASES[perm] || [];
    if (aliases.some((alias) => platformAuth.can(alias))) return true;
    // Role-name fallback when granular permission strings are not populated on a demo role
    const roleSet = new Set([
      ...(session.roles || []).map((r) => r.toLowerCase()),
      ...(session.roleNames || []).map((r) => r.toLowerCase()),
    ]);
    if ([...roleSet].some((r) => r.includes("admin") || r.includes("director") || r.includes("project manager"))) {
      return true;
    }
    if (perm.startsWith("finance.") && [...roleSet].some((r) => r.includes("qs") || r.includes("quantity") || r.includes("finance") || r.includes("commercial"))) {
      return true;
    }
    if ((perm.startsWith("site.") || perm.startsWith("documents.") || perm.startsWith("bim.") || perm.startsWith("drone.")) &&
        [...roleSet].some((r) => r.includes("site") || r.includes("clerk") || r.includes("engineer") || r.includes("architect"))) {
      return true;
    }
    return false;
  };

  return {
    me,
    loading: platformAuth.loading,
    error: null,
    signIn: (username?: string, password?: string) =>
      username && password
        ? platformAuth.login(username, password)
        : Promise.resolve(),

    signOut: () => platformAuth.logout(),
    can,
    tenant,
    switchTenant: (id: string) => platformAuth.selectOrganization(id),
    setTenantId: () => {},
    tenants: me?.tenants ?? [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
