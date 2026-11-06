import { useCallback, useEffect, useRef, useState } from "react";
import { store } from "../store/tinybase";

export const DRAFTS_TABLE = "_form_drafts";

/**
 * Hook to automatically persist and restore form drafts across screen switches,
 * app backgrounding, or unexpected app termination.
 *
 * Backed by TinyBase (reactive SQLite persistence).
 *
 * @param draftKey Unique key identifying the form/screen (e.g., `daily_log_${projectId}_${date}`)
 * @param initialValues Default initial values if no draft exists
 * @param debounceMs Milliseconds to debounce auto-saving to SQLite (defaults to 300ms)
 */
export function useFormDraft<T extends Record<string, any>>(
  draftKey: string,
  initialValues: T,
  debounceMs = 300,
) {
  const [formState, setFormState] = useState<T>(initialValues);
  const [isRestored, setIsRestored] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Restore draft on mount or draftKey change
  useEffect(() => {
    try {
      const row = store.getRow(DRAFTS_TABLE, draftKey);
      if (row && typeof row.payload === "string") {
        const parsed = JSON.parse(row.payload);
        setFormState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn(`Failed to restore draft for ${draftKey}:`, e);
    } finally {
      setIsRestored(true);
    }
  }, [draftKey]);

  // 2. Debounced save to TinyBase / SQLite
  const saveDraft = useCallback(
    (values: T) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        try {
          store.setRow(DRAFTS_TABLE, draftKey, {
            payload: JSON.stringify(values),
            updated_at: Date.now(),
          });
        } catch (e) {
          console.warn(`Failed to save draft for ${draftKey}:`, e);
        }
      }, debounceMs);
    },
    [draftKey, debounceMs],
  );

  // 3. Clear draft when form is successfully submitted or reset
  const clearDraft = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    try {
      store.delRow(DRAFTS_TABLE, draftKey);
    } catch (e) {
      console.warn(`Failed to clear draft for ${draftKey}:`, e);
    }
  }, [draftKey]);

  // 4. Update helper that merges changes and triggers debounced save
  const updateForm = useCallback(
    (updates: Partial<T> | ((prev: T) => T)) => {
      setFormState((prev) => {
        const next = typeof updates === "function" ? updates(prev) : { ...prev, ...updates };
        saveDraft(next);
        return next;
      });
    },
    [saveDraft],
  );

  return {
    formState,
    setFormState,
    updateForm,
    clearDraft,
    isRestored,
  };
}
