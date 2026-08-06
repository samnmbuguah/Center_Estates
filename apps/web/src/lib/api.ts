export type Organization = { id: string; name: string; slug: string; is_default: boolean; is_admin: boolean };
export type ModuleEntitlement = { slug: string; name: string; limits: Record<string, unknown> };
export type DemoIdentity = {
  id: number;
  username: string;
  label: string;
  roleSlug: string;
  roleName: string;
  module: string;
  isAdmin: boolean;
  isCurrent: boolean;
};
export type DemoIdentityGroup = {
  module: string;
  label: string;
  identities: DemoIdentity[];
};
export type Session = {
  user: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    isSuperuser?: boolean;
  };
  organizations: Organization[];
  activeOrganizationId: string | null;
  modules: ModuleEntitlement[];
  roles: string[];
  roleNames?: string[];
  permissions: string[];
  impersonating?: boolean;
  canSwitchIdentity?: boolean;
};

export async function apiFetch(path: string, init: RequestInit = {}, organizationId?: string | null) {
  const headers = new Headers(init.headers);
  if (organizationId) headers.set("X-Organization-ID", organizationId);
  const csrf = csrfFromCookie();
  if (csrf && !headers.has("X-CSRFToken")) headers.set("X-CSRFToken", csrf);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let p = path.replace(/\/+/g, "/");
  p = p.replace(/^\/hs-incidents/, "/safety-incidents");
  p = p.replace(/^\/calendar\/events/, "/calendar");
  p = p.replace(/^\/store\/items/, "/store-items");
  p = p.replace(/^\/projects\/[^/]*\/lifecycle/, "/lifecycle");
  p = p.replace(/^\/projects\/[^/]*\/milestones/, "/milestones");
  p = p.replace(/^\/projects\/[^/]*\/quality-tests/, "/quality-tests");
  p = p.replace(/^\/projects\/[^/]*\/advance-payments/, "/advance-payments");

  const [base, query] = p.split("?");
  const slashedBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = query ? `${slashedBase}?${query}` : slashedBase;

  const isConstruction = [
    "/projects",
    "/milestones",
    "/milestone-verifications",
    "/evidence",
    "/daily-logs",
    "/risks",
    "/tickets",
    "/work-plan",
    "/boq",
    "/variations",
    "/quality-tests",
    "/rfis",
    "/safety-incidents",
    "/calendar",
    "/documents",
    "/lifecycle",
    "/materials",
    "/requisitions",
    "/certificates",
    "/disbursements",
    "/drawdowns",
  ].some((ep) => cleanPath.startsWith(ep));

  const fullPath = isConstruction ? `/construction${cleanPath}` : cleanPath;
  return fetch(`/api/v1${fullPath}`, { ...init, headers, credentials: "include" });
}

export function csrfFromCookie() {
  return document.cookie.split("; ").find((value) => value.startsWith("csrftoken="))?.split("=")[1] ?? "";
}
