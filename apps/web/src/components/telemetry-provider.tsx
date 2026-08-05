"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { telemetry } from "@/lib/telemetry";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user) {
      telemetry.init(
        {
          id: session.user.id,
          username: session.user.username,
          role: session.roleNames?.[0] || session.roles?.[0] || "member",
        },
        session.activeOrganizationId,
      );
    }
  }, [session]);

  useEffect(() => {
    if (pathname && session?.user) {
      telemetry.trackPageView(pathname);
    }
  }, [pathname, session?.user]);

  return <>{children}</>;
}
