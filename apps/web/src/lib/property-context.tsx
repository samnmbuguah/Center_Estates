"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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
  activeModule: string;
  selectProperty: (p: PropertyContextValue | null) => void;
}

const PropertyContext = createContext<PropertyContextType>({
  activeProperty: null,
  properties: [],
  loadingProperties: false,
  propertyContextReady: false,
  activeModule: "",
  selectProperty: () => {},
});

const STORAGE_KEY = "ce-active-property";

const MODULE_BY_PATH: Array<[string, string]> = [
  ["/property", "property"],
  ["/facility", "facility"],
  ["/facility-portal", "facility"],
  ["/caretaker-portal", "facility"],
  ["/sales", "sales"],
  ["/buyer-portal", "sales"],
  ["/agent-portal", "sales"],
  ["/monitoring", "monitoring"],
  ["/tender", "tender"],
  ["/valuation", "valuation"],
];

function moduleFromPathname(pathname: string): string {
  const match = MODULE_BY_PATH.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? match[1] : "";
}

export function PropertyWorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const pathname = usePathname();
  const [activeProperty, setActiveProperty] = useState<PropertyContextValue | null>(null);
  const [properties, setProperties] = useState<PropertyContextValue[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propertyContextReady, setPropertyContextReady] = useState(false);
  const organizationId = session?.activeOrganizationId ?? null;
  const activeModule = moduleFromPathname(pathname);
  const needsPropertyContext = Boolean(session?.modules.some((module) =>
    ["property", "facility", "sales", "monitoring", "tender", "valuation"].includes(module.slug),
  ));
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
    const propertiesUrl = activeModule
      ? `/property/properties/?module=${encodeURIComponent(activeModule)}`
      : "/property/properties/";
    apiFetch(propertiesUrl, { headers: { "X-Property-Scope": "portfolio" } }, organizationId)
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
  }, [needsPropertyContext, organizationId, storageKey, activeModule]);

  const selectProperty = useCallback((p: PropertyContextValue | null) => {
    setActiveProperty(p);
    try {
      if (p) localStorage.setItem(storageKey, JSON.stringify(p));
      else localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return <PropertyContext.Provider value={{ activeProperty, properties, loadingProperties, propertyContextReady, activeModule, selectProperty }}>{children}</PropertyContext.Provider>;
}

export function usePropertyContext() {
  return useContext(PropertyContext);
}
