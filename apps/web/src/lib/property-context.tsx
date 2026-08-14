"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

export type PropertyContextValue = {
  id: string;
  name: string;
  code?: string;
  status?: string;
  location?: string;
};

interface PropertyContextType {
  activeProperty: PropertyContextValue | null;
  properties: PropertyContextValue[];
  loadingProperties: boolean;
  propertyContextReady: boolean;
  selectProperty: (p: PropertyContextValue | null) => void;
}

const PropertyContext = createContext<PropertyContextType>({
  activeProperty: null,
  properties: [],
  loadingProperties: false,
  propertyContextReady: false,
  selectProperty: () => {},
});

const STORAGE_KEY = "ce-active-property";

export function PropertyWorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [activeProperty, setActiveProperty] = useState<PropertyContextValue | null>(null);
  const [properties, setProperties] = useState<PropertyContextValue[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propertyContextReady, setPropertyContextReady] = useState(false);
  const organizationId = session?.activeOrganizationId ?? null;
  const needsPropertyContext = Boolean(session?.modules.some((module) => module.slug === "property" || module.slug === "facility"));
  const storageKey = organizationId ? `${STORAGE_KEY}:${organizationId}` : STORAGE_KEY;

  // Hydrate the last property for this organization after mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        // Deliberate storage hydration on mount (not a cascading render).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveProperty(JSON.parse(raw) as PropertyContextValue);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!organizationId || !needsPropertyContext) {
      queueMicrotask(() => {
        setProperties([]);
        setActiveProperty(null);
        setPropertyContextReady(true);
      });
      return;
    }
    let cancelled = false;
    setPropertyContextReady(false);
    setLoadingProperties(true);
    apiFetch("/property/properties/", { headers: { "X-Property-Scope": "portfolio" } }, organizationId)
      .then(async (response) => response.ok ? response.json() : [])
      .then((data) => {
        if (cancelled) return;
        const source = Array.isArray(data) ? data : data.results ?? [];
        const rows: PropertyContextValue[] = source.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          name: String(row.name ?? "Property"),
          code: row.code ? String(row.code) : undefined,
          status: row.status ? String(row.status) : undefined,
          location: [row.address, row.city].filter(Boolean).map(String).join(", "),
        }));
        setProperties(rows);
        setActiveProperty((current) => {
          let stored: PropertyContextValue | null = null;
          try {
            const raw = localStorage.getItem(storageKey);
            stored = raw ? JSON.parse(raw) as PropertyContextValue : null;
          } catch { /* ignore malformed storage */ }
          const selected = rows.find((row) => row.id === (current?.id ?? stored?.id)) ?? rows[0] ?? null;
          if (selected) localStorage.setItem(storageKey, JSON.stringify(selected));
          return selected;
        });
      })
      .catch(() => { if (!cancelled) setProperties([]); })
      .finally(() => {
        if (!cancelled) {
          setLoadingProperties(false);
          setPropertyContextReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [needsPropertyContext, organizationId, storageKey]);

  const selectProperty = useCallback((p: PropertyContextValue | null) => {
    setActiveProperty(p);
    try {
      if (p) localStorage.setItem(storageKey, JSON.stringify(p));
      else localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return <PropertyContext.Provider value={{ activeProperty, properties, loadingProperties, propertyContextReady, selectProperty }}>{children}</PropertyContext.Provider>;
}

export function usePropertyContext() {
  return useContext(PropertyContext);
}
