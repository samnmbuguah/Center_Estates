"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type PropertyContextValue = {
  id: string;
  name: string;
  code?: string;
  status?: string;
  location?: string;
};

interface PropertyContextType {
  activeProperty: PropertyContextValue | null;
  selectProperty: (p: PropertyContextValue | null) => void;
}

const PropertyContext = createContext<PropertyContextType>({
  activeProperty: null,
  selectProperty: () => {},
});

const STORAGE_KEY = "ce-active-property";

export function PropertyWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeProperty, setActiveProperty] = useState<PropertyContextValue | null>(null);

  // Hydrate from sessionStorage only after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setActiveProperty(JSON.parse(raw) as PropertyContextValue);
    } catch {
      /* ignore */
    }
  }, []);

  const selectProperty = useCallback((p: PropertyContextValue | null) => {
    setActiveProperty(p);
    try {
      if (p) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return <PropertyContext.Provider value={{ activeProperty, selectProperty }}>{children}</PropertyContext.Provider>;
}

export function usePropertyContext() {
  return useContext(PropertyContext);
}
