"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandCenterWorkspace } from "@/components/command-center-workspace";
import { isSalesOnlyHost } from "@/lib/site-mode";

export default function WorkspacesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const salesOnly = mounted && isSalesOnlyHost();
  useEffect(() => {
    if (salesOnly) router.replace("/sales");
  }, [router, salesOnly]);
  if (salesOnly) return null;
  return <CommandCenterWorkspace />;
}
