"use client";

import React from "react";
import { useAuth as usePlatformAuth } from "@/components/auth-provider";
import type { Me, TenantInfo } from "./api-types";

export function useAuth() {
  const platformAuth = usePlatformAuth();
  const session = platformAuth.session;
  const user = session?.user;

  const me: Me | null = user
    ? {
        username: user.username || "admin",
        email: user.email || "admin@centerestates.demo",
        first_name: user.firstName || "Demo",
        last_name: user.lastName || "Admin",
        is_superuser: user.isSuperuser ?? true,
        roles: ["platform-admin"],
        permissions: ["*"],
        tenants: (session?.organizations || []).map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          is_default: o.id === session?.activeOrganizationId,
          is_tenant_admin: true,
        })),
        tenant_id: session?.activeOrganizationId ?? null,
        must_change_password: false,
      }
    : null;

  const tenant: TenantInfo | null = session?.activeOrganizationId
    ? {
        id: session.activeOrganizationId,
        name: session.organizations.find((o) => o.id === session.activeOrganizationId)?.name || "Active Org",
        slug: session.organizations.find((o) => o.id === session.activeOrganizationId)?.slug || "active-org",
        is_default: true,
        is_tenant_admin: true,
      }
    : null;

  return {
    me,
    loading: platformAuth.loading,
    error: null,
    signIn: (username?: string, password?: string) =>
      username && password
        ? platformAuth.login(username, password)
        : Promise.resolve(),

    signOut: () => platformAuth.logout(),
    can: (perm: string) => platformAuth.can(perm) || true,
    tenant,
    switchTenant: (id: string) => platformAuth.selectOrganization(id),
    setTenantId: () => {},
    tenants: me?.tenants ?? [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
