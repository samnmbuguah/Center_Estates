export type SalesTab =
  | "overview"
  | "clerk"
  | "inventory"
  | "buyers"
  | "leads"
  | "outreach"
  | "cms"
  | "sales"
  | "installments"
  | "payments"
  | "site-visits"
  | "commissions"
  | "handover"
  | "performance"
  | "reports"
  | "documents"
  | "audit-events"
  | "tickets"
  | "calendar"
  | "bank-reconciliation";

export type Row = Record<string, unknown>;

export type OutreachCampaignModule =
  | "property"
  | "facility"
  | "construction"
  | "valuation"
  | "tender"
  | "sales";

export type OutreachSequenceStep = {
  id?: string;
  step_number: number;
  delay_days: number;
  channel: "email" | "linkedin" | "whatsapp" | "call";
  subject_template: string;
  body_template: string;
  call_to_action: string;
  is_active: boolean;
};

export type OutreachCampaign = {
  id: string;
  name: string;
  target_module: OutreachCampaignModule;
  status: "draft" | "active" | "paused" | "archived";
  icp_description?: string;
  target_icp?: string;
  target_roles?: string[];
  acute_pain_points?: string[];
  pain_points?: string;
  killer_hook?: string;
  value_proposition?: string;
  primary_value_prop?: string;
  booking_url?: string;
  steps?: OutreachSequenceStep[];
  prospects_count?: number;
  contacted_count?: number;
  replied_count?: number;
  demos_count?: number;
  created_at: string;
  updated_at: string;
};

export type OutreachActivity = {
  id: string;
  prospect: string;
  step_number: number;
  channel: string;
  status: "drafted" | "sent" | "delivered" | "opened" | "replied" | "bounced";
  subject: string;
  body: string;
  sent_at?: string;
  notes?: string;
  created_at: string;
};

export type OutreachProspect = {
  id: string;
  campaign: string;
  campaign_name?: string;
  campaign_module?: string;
  first_name: string;
  last_name: string;
  company_name: string;
  title: string;
  email: string;
  phone: string;
  linkedin_url?: string;
  fit_score: number;
  fit_reasons: string[];
  status: "uncontacted" | "contacted" | "replied" | "demo_booked" | "unresponsive" | "unqualified";
  current_step: number;
  custom_variables: Record<string, string>;
  notes?: string;
  last_contacted_at?: string;
  activities?: OutreachActivity[];
  created_at: string;
  updated_at: string;
};

export type OutreachSummary = {
  total_campaigns: number;
  total_prospects: number;
  contacted: number;
  replies: number;
  demos_booked: number;
  reply_rate: number;
  conversion_rate: number;
};

export type ArticleCategory =
  | "buyer_guide"
  | "neighborhood_guide"
  | "investment_analysis"
  | "project_update"
  | "promotion"
  | "faq";

export type SalesContentArticle = {
  id: string;
  project?: string | null;
  project_name?: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  category_display?: string;
  summary: string;
  body: string;
  cover_image_url?: string;
  author_name?: string;
  status: "draft" | "published" | "archived";
  status_display?: string;
  is_featured: boolean;
  read_time_minutes: number;
  published_at?: string | null;
  views_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type MarketingAssetKind =
  | "brochure"
  | "pricelist"
  | "floorplan"
  | "masterplan"
  | "video_tour"
  | "virtual_tour"
  | "image_still"
  | "legal_pack";

export type SalesMarketingAsset = {
  id: string;
  project?: string | null;
  project_name?: string;
  title: string;
  asset_kind: MarketingAssetKind;
  asset_kind_display?: string;
  file_url?: string;
  external_url?: string;
  share_url?: string;
  file_size: number;
  mime_type: string;
  is_public: boolean;
  downloads_count: number;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMarketingProfile = {
  id?: string;
  project: string;
  project_name?: string;
  project_code?: string;
  headline: string;
  marketing_pitch: string;
  amenities: string[];
  virtual_tour_url?: string;
  video_tour_url?: string;
  brochure_url?: string;
  is_featured: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SalesCmsSummary = {
  total_articles: number;
  published_articles: number;
  draft_articles: number;
  featured_articles: number;
  total_views: number;
  total_assets: number;
  total_downloads: number;
  configured_profiles: number;
};

export type Dashboard = {
  kpis?: Record<string, unknown>;
  recentSales?: Row[];
  pendingPayments?: Row[];
  inventoryByStatus?: Row[];
  salesByProject?: Row[];
  agentPerformance?: Row[];
  reports?: Row[];
  installmentExposure?: Record<string, unknown>;
};

export type Tone = "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray";

export const salesTabLabels: Record<SalesTab, string> = {
  overview: "Dashboard",
  clerk: "Sales Clerk",
  inventory: "Projects & Units",
  buyers: "Buyers Registry",
  leads: "Leads & Prospects",
  outreach: "⚡ AI Outreach & GTM",
  cms: "🎨 Content & Marketing CMS",
  sales: "Sales Pipeline",
  installments: "Installment Schedules",
  payments: "Payments & Verification",
  "site-visits": "Site Visits (Sales Clerk)",
  commissions: "Agent Commissions",
  handover: "Unit Handover",
  performance: "Agent Performance",
  reports: "Sales Reports",
  documents: "Legal Documents",
  "audit-events": "Audit Trail",
  tickets: "Tickets & Issues",
  calendar: "Calendar",
  "bank-reconciliation": "Bank Reconciliation",
};

export const BUYER_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  lead: [{ value: "qualified", label: "Qualify" }, { value: "cancelled", label: "Cancel" }],
  qualified: [{ value: "active", label: "Activate" }, { value: "cancelled", label: "Cancel" }],
  active: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};

export const SALE_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  draft: [{ value: "reserved", label: "Reserve unit" }, { value: "cancelled", label: "Cancel" }],
  reserved: [{ value: "contracted", label: "Contract" }, { value: "cancelled", label: "Cancel" }],
  contracted: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};
