import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PropertyTab, labels } from "../types/property.types";

export function usePropertyFilters({
  initialTab = "properties",
  activeProperty = null,
}: {
  initialTab?: string;
  activeProperty?: { id: string; name: string } | null;
}) {
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<PropertyTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && labels[q as PropertyTab]) return q as PropertyTab;
    }
    if (!activeProperty && typeof window !== "undefined") return "properties";
    return (initialTab as PropertyTab) || "properties";
  });

  const [search, setSearch] = useState("");

  useEffect(() => {
    const requested = searchParams.get("tab") as PropertyTab | null;
    if (!requested || !labels[requested]) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSearch("");
      setTab(requested);
    });
    return () => { cancelled = true; };
  }, [searchParams]);

  return {
    tab,
    setTab,
    search,
    setSearch,
    searchParams,
  };
}
