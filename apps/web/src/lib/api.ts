export type Organization = { id: string; name: string; slug: string; is_default: boolean; is_admin: boolean };
export type ModuleEntitlement = { slug: string; name: string; limits: Record<string, unknown> };
export type Session = {
  user: { id: number; username: string; email: string; firstName: string; lastName: string };
  organizations: Organization[];
  activeOrganizationId: string | null;
  modules: ModuleEntitlement[];
};

export async function apiFetch(path: string, init: RequestInit = {}, organizationId?: string | null) {
  const headers = new Headers(init.headers);
  if (organizationId) headers.set("X-Organization-ID", organizationId);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" });
}

export function csrfFromCookie() {
  return document.cookie.split("; ").find((value) => value.startsWith("csrftoken="))?.split("=")[1] ?? "";
}
