"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { CommandCenterWorkspace } from "@/components/command-center-workspace";
import { LoadingState } from "@/components/module-ui";

export default function WorkspacesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="page-wrap" style={{ padding: 40 }}>
        <LoadingState rows={4} />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <CommandCenterWorkspace />;
}
