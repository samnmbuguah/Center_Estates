import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as LocalAuthentication from "expo-local-authentication";

import { ApiError, fetchMe, login as apiLogin, registerDevice, type Me } from "../api/client";
import useNotifications from "../hooks/useNotifications";
import { ed25519Signer } from "../signing/ed25519Signer";
import { clearToken, getCachedProfile, getToken, setActiveTenant, setCachedProfile } from "../sync/api";
import { startAutoSync } from "../sync/autoSync";

interface AuthState {
  isAuthenticated: boolean;
  restoring: boolean;
  /** A stored session exists but needs a biometric unlock before entering. */
  locked: boolean;
  signingIn: boolean;
  error: string | null;
  me: Me | null;
  can: (perm: string) => boolean;
  signIn: (username: string, password: string) => Promise<void>;
  /** Biometric-unlock the persisted session (no password / no network). */
  unlock: () => Promise<void>;
  signOut: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthed] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [locked, setLocked] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const stopAutoSync = useRef<(() => void) | null>(null);

  // Register for push notifications when authenticated.
  // The hook handles permission request + token registration with the server.
  // It's safe to call unconditionally; authHeaders will fail silently if not authed.
  useNotifications();

  // Restore a previous session on cold start. The JWT + last profile are kept
  // in SecureStore, so we can re-hydrate offline (field use) without a network
  // round-trip. We DON'T enter the app directly — a stored session is LOCKED
  // and requires a biometric unlock (no password, works offline). Only an
  // actively-rejected token (401) forces a fresh login.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!(await getToken())) return;
        const cached = await getCachedProfile();
        if (active) {
          if (cached) setMe(JSON.parse(cached) as Me);
          setLocked(true); // -> LockScreen (biometric unlock)
        }
        try {
          const fresh = await fetchMe();
          await setCachedProfile(JSON.stringify(fresh));
          if (fresh.tenant_id) await setActiveTenant(fresh.tenant_id);
          if (active) setMe(fresh);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await clearToken();
            if (active) { setLocked(false); setAuthed(false); setMe(null); }
          }
          // Network error (status 0): keep the cached session for offline use.
        }
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Biometric unlock of the persisted session. Devices without biometric
  // hardware/enrolment are not locked out — they enter directly.
  async function unlock() {
    setError(null);
    try {
      const [hasHw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHw || !enrolled) {
        setLocked(false);
        setAuthed(true);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Construction Management",
        cancelLabel: "Cancel",
      });
      if (res.success) {
        setLocked(false);
        setAuthed(true);
      } else {
        setError("Biometric unlock cancelled or failed. Try again.");
      }
    } catch {
      setError("Biometric unlock is unavailable on this device.");
    }
  }

  // Auto-sync only while signed in (foreground return + heartbeat).
  useEffect(() => {
    if (isAuthenticated) {
      stopAutoSync.current = startAutoSync();
      return () => {
        stopAutoSync.current?.();
        stopAutoSync.current = null;
      };
    }
    return undefined;
  }, [isAuthenticated]);

  async function signIn(username: string, password: string) {
    setSigningIn(true);
    setError(null);
    try {
      await apiLogin(username, password);
      // Device key enrolment is best-effort — login succeeds without it.
      try {
        const deviceId = await ed25519Signer.deviceId();
        const publicKey = await ed25519Signer.publicKeyBase64();
        await registerDevice(deviceId, publicKey).catch(() => {});
      } catch {}
      const profile = await fetchMe();
      await setCachedProfile(JSON.stringify(profile));
      if (profile.tenant_id) await setActiveTenant(profile.tenant_id);
      setMe(profile);
      setLocked(false);
      setAuthed(true);
    } catch (e: any) {
      const msg = e?.message || e?.toString() || "unknown error";
      setError(msg);
      throw e;
    } finally {
      setSigningIn(false);
    }
  }

  function signOut() {
    setAuthed(false);
    setLocked(false);
    setMe(null);
    clearToken().catch(() => {});
  }

  const can = (perm: string) => !!me && (me.is_superuser || me.permissions.includes(perm));

  return (
    <AuthCtx.Provider value={{ isAuthenticated, restoring, locked, signingIn, error, me, can, signIn, unlock, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
