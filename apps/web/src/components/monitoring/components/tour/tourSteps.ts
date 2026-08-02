export interface TourStep {
  id: string;
  target: string;
  targetFallback?: string;
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
  route?: string;
  action?: "click" | "navigate";
  highlightPadding?: number;
  sectionTitle?: string;
}

export type RoleTourKey =
  | "clerk_of_works"
  | "project_manager"
  | "qs"
  | "financier"
  | "admin"
  | "structural_engineer"
  | "contractor"
  | "default";
