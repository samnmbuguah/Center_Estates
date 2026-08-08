import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchProjects } from "../api";

export interface ProjectOption {
  id: string;
  name: string;
  code?: string;
  location?: string;
  stage?: string;
  budget?: number;
  physical_progress?: number;
  health?: "On Track" | "At Risk" | "Delayed";
  modules?: string[];
}

interface WorkspaceContextType {
  activeProjectId: string;
  activeProject: ProjectOption | null;
  projects: ProjectOption[];
  selectProject: (id: string) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeProjectId: "",
  activeProject: null,
  projects: [],
  selectProject: () => {},
  loading: true,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    // SSR-safe: sessionStorage is only available on the client. Reading it
    // during hydration would produce a server/client render mismatch (#418).
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("activeProject") || "";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setProjects(list);
        // Tenant changes can leave a project id from the previous tenant in
        // sessionStorage. Never keep a stale id that would generate a burst of
        // project-scoped 404s; select the first project in the current scope.
        if (list.length > 0 && (!activeProjectId || !list.some((p: ProjectOption) => p.id === activeProjectId))) {
          const defaultId = list[0].id;
          setActiveProjectId(defaultId);
          sessionStorage.setItem("activeProject", defaultId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    if (id) {
      sessionStorage.setItem("activeProject", id);
    } else {
      sessionStorage.removeItem("activeProject");
    }
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || (projects[0] ?? null);

  return (
    <WorkspaceContext.Provider
      value={{
        activeProjectId: activeProject?.id || activeProjectId || "",
        activeProject,
        projects,
        selectProject,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
