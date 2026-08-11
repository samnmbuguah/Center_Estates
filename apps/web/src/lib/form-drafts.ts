"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";

type DraftEnvelope<T> = { version: number; savedAt: string; value: T };
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function useFormDraft<T>(key: string, initialValue: T, scope?: string | null): [
  T,
  Dispatch<SetStateAction<T>>,
  () => void,
  boolean,
] {
  const storageKey = useMemo(() => `ce-form-draft:v1:${scope || "anonymous"}:${key}`, [key, scope]);
  const initialSerialized = JSON.stringify(initialValue);
  const [restored, setRestored] = useState(false);
  const [value, setValue] = useState<T>(() => initialValue);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        const initial = JSON.parse(initialSerialized) as T;
        if (!raw) {
          setValue(initial);
          setRestored(false);
          return;
        }
        const envelope = JSON.parse(raw) as DraftEnvelope<T>;
        const current = envelope?.savedAt && Date.now() - new Date(envelope.savedAt).getTime() <= DRAFT_TTL_MS;
        if (current && envelope.version === 1 && envelope.value !== undefined && JSON.stringify(envelope.value) !== initialSerialized) {
          setValue(envelope.value);
          setRestored(true);
        } else {
          localStorage.removeItem(storageKey);
          setValue(initial);
          setRestored(false);
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSerialized, storageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (JSON.stringify(value) === initialSerialized) {
          localStorage.removeItem(storageKey);
          return;
        }
        const envelope: DraftEnvelope<T> = { version: 1, savedAt: new Date().toISOString(), value };
        localStorage.setItem(storageKey, JSON.stringify(envelope));
      } catch {
        // Storage can be unavailable or full; form entry must remain usable.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [initialSerialized, storageKey, value]);

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey);
    setRestored(false);
  }, [storageKey]);

  return [value, setValue, clear, restored];
}
