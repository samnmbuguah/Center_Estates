import * as SecureStore from "expo-secure-store";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL
  ?? process.env.EXPO_PUBLIC_API_BASE
  ?? "https://api.centerestates.com/api/v1/construction"
).replace(/\/+$/, "");

const TOKEN_KEY = "access_token";
const ME_KEY = "me_profile";
const TENANT_KEY = "active_tenant_id";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ME_KEY);
  await SecureStore.deleteItemAsync(TENANT_KEY);
}

/** Cache the signed-in profile so an offline cold-start can restore the
 *  session (permissions included) without a network round-trip. Stored as raw
 *  JSON to keep this module free of the Me type (avoids an import cycle). */
export async function getCachedProfile(): Promise<string | null> {
  return SecureStore.getItemAsync(ME_KEY);
}

export async function setCachedProfile(json: string): Promise<void> {
  await SecureStore.setItemAsync(ME_KEY, json);
}

/** Multi-tenant: persist the active tenant UUID so every API call carries
 *  X-Tenant-ID.  The server scopes all data to this tenant. */
export async function setActiveTenant(tenantId: string): Promise<void> {
  await SecureStore.setItemAsync(TENANT_KEY, tenantId);
}

export async function getActiveTenant(): Promise<string | null> {
  return SecureStore.getItemAsync(TENANT_KEY);
}

const NO_SLASH_PREFIXES = [
  "/me",
  "/sync/pull",
  "/sync/push",
  "/devices/register",
  "/media/upload",
  "/audit/verify",
];

export function apiUrl(path: string): string {
  const [pathname, search] = path.split("?");
  let normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const isNoSlash = NO_SLASH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
  const hasExtension = /\.[a-z0-9]+$/i.test(normalized);

  if (!isNoSlash && !hasExtension && !normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }
  const query = search !== undefined ? `?${search}` : "";
  return `${API_BASE}${normalized}${query}`;
}

export function mediaUrl(remotePath: string): string {
  if (!remotePath) return "";
  if (/^https?:\/\//i.test(remotePath)) return remotePath;
  const origin = API_BASE.replace(/\/api\/v1.*$/i, "");
  const normalized = remotePath.startsWith("/") ? remotePath : `/${remotePath}`;
  return `${origin}${normalized}`;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const tenantId = await getActiveTenant();
  if (tenantId) headers["X-Tenant-ID"] = tenantId;
  return headers;
}
