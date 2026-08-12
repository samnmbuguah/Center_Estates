"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";

type DraftEnvelope<T> = { version: number; savedAt: string; value: T };
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DRAFT_CHANNEL_NAME = "ce-form-draft-channel";

export function useFormDraft<T>(key: string, initialValue: T, scope?: string | null): [
  T,
  Dispatch<SetStateAction<T>>,
  () => void,
  boolean,
  string | null,
] {
  const storageKey = useMemo(() => `ce-form-draft:v1:${scope || "anonymous"}:${key}`, [key, scope]);
  const initialSerialized = JSON.stringify(initialValue);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [value, setValue] = useState<T>(() => initialValue);

  // Restore initial or saved draft state
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        const initial = JSON.parse(initialSerialized) as T;
        if (!raw) {
          setValue(initial);
          setRestored(false);
          setSavedAt(null);
          return;
        }
        const envelope = JSON.parse(raw) as DraftEnvelope<T>;
        const current = envelope?.savedAt && Date.now() - new Date(envelope.savedAt).getTime() <= DRAFT_TTL_MS;
        if (current && envelope.version === 1 && envelope.value !== undefined && JSON.stringify(envelope.value) !== initialSerialized) {
          setValue(envelope.value);
          setRestored(true);
          setSavedAt(envelope.savedAt);
        } else {
          localStorage.removeItem(storageKey);
          setValue(initial);
          setRestored(false);
          setSavedAt(null);
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSerialized, storageKey]);

  // Sync saved draft to localStorage and post message to BroadcastChannel
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (JSON.stringify(value) === initialSerialized) {
          localStorage.removeItem(storageKey);
          return;
        }
        const isoNow = new Date().toISOString();
        const envelope: DraftEnvelope<T> = { version: 1, savedAt: isoNow, value };
        localStorage.setItem(storageKey, JSON.stringify(envelope));
        setSavedAt(isoNow);

        if (typeof BroadcastChannel !== "undefined") {
          try {
            const channel = new BroadcastChannel(DRAFT_CHANNEL_NAME);
            channel.postMessage({ key: storageKey, action: "saved", savedAt: isoNow });
            channel.close();
          } catch { /* BroadcastChannel optional fallback */ }
        }
      } catch {
        // Storage can be unavailable or full; form entry must remain usable.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [initialSerialized, storageKey, value]);

  // Listen for cross-tab storage / BroadcastChannel sync events
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      const channel = new BroadcastChannel(DRAFT_CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.key === storageKey && event.data?.action === "cleared") {
          setValue(JSON.parse(initialSerialized) as T);
          setRestored(false);
          setSavedAt(null);
        }
      };
      return () => channel.close();
    } catch {
      return;
    }
  }, [initialSerialized, storageKey]);

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey);
    setValue(JSON.parse(initialSerialized) as T);
    setRestored(false);
    setSavedAt(null);
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel(DRAFT_CHANNEL_NAME);
        channel.postMessage({ key: storageKey, action: "cleared" });
        channel.close();
      } catch { /* ignored */ }
    }
  }, [initialSerialized, storageKey]);

  return [value, setValue, clear, restored, savedAt];
}
