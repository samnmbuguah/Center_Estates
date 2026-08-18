"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth-provider";

export interface UserPermissions {
  isSuperAdmin: boolean;
  isFieldStaff: boolean;
  canViewTeamMatrix: boolean;
  canViewPerformance: boolean;
  canViewStaff: boolean;
  canViewAuditEvents: boolean;
  canManageTasks: boolean;
  canAssignTasks: boolean;
  canViewHrRequests: boolean;
  canViewLeaveRequests: boolean;
  canViewFeedback: boolean;
  canUseCompanion: boolean;
}

export function usePermissions(): UserPermissions {
  const { session } = useAuth();

  const isSuperAdmin = Boolean(
    session?.user?.isSuperuser ||
    session?.roles?.includes("platform-admin") ||
    session?.roles?.includes("super-admin")
  );

  const isFieldStaff = Boolean(
    isSuperAdmin ||
      session?.roles?.includes("caretaker") ||
      session?.roles?.includes("facility_manager") ||
      session?.roles?.includes("property_manager") ||
      session?.roles?.includes("technician") ||
      session?.roles?.includes("admin")
  );

  return useMemo<UserPermissions>(() => ({
    isSuperAdmin,
    isFieldStaff,
    canViewTeamMatrix: isSuperAdmin,
    canViewPerformance: isSuperAdmin,
    canViewStaff: isSuperAdmin,
    canViewAuditEvents: isSuperAdmin,
    canManageTasks: isFieldStaff,
    canAssignTasks: isSuperAdmin,
    canViewHrRequests: true, // Available to all authenticated users
    canViewLeaveRequests: true, // Available to all authenticated users
    canViewFeedback: true, // Available to all authenticated users
    canUseCompanion: true, // Available to all authenticated users
  }), [isSuperAdmin, isFieldStaff]);
}
