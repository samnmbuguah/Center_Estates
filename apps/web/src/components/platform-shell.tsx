"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { modules, ACTIVE_MODULES, activeModules } from "@/lib/modules";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie, type DemoIdentityGroup } from "@/lib/api";
import { useCallback } from "react";

import { HardHat, Search, Moon, Sun, ChevronDown, Building2, Settings, LogOut, HelpCircle, ClipboardCheck, FileSpreadsheet } from "lucide-react";
import AppSidebar from "@/components/app-sidebar";
import { TelemetryProvider } from "@/components/telemetry-provider";
import { isPublicRoute } from "@/lib/public-routes";
import { usePropertyContext } from "@/lib/property-context";
import { PropertyContextBar } from "@/components/property-context-bar";
import { TourLauncher } from "@/components/tour-launcher";
import { BrandLogo } from "@/components/brand-logo";
import { useTheme } from "@/theme/theme-provider";
import {
  AppBar,
  Toolbar,
  TextField,
  IconButton,
  Box,
  Menu,
  MenuItem,
  MenuList,
  ListSubheader,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Chip,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Typography,
} from "@mui/material";

const QUICK_JUMP_ROUTES: Array<{ name: string; href: string; module: string; icon: string; detail: string }> = [
  // Removed - duplicates sidebar navigation
];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeProperty, properties, propertyContextReady } = usePropertyContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);

  // Listen for custom event to open mobile menu
  useEffect(() => {
    const handleOpenMobileMenu = () => setMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMobileMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMobileMenu);
  }, []);

  const [identityGroups, setIdentityGroups] = useState<DemoIdentityGroup[]>([]);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [subscriptionsList, setSubscriptionsList] = useState<Array<{ id: string; module: string; is_active: boolean }>>([]);
  const [updatingSub, setUpdatingSub] = useState<string | null>(null);

  const profileRef = useRef<HTMLDivElement | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await apiFetch("/subscriptions/");
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ id: string; module: string; is_active: boolean }> };
        setSubscriptionsList(data.results || (data as unknown as Array<{ id: string; module: string; is_active: boolean }>));
      }
    } catch (err) {
      console.error("Failed to fetch subscriptions", err);
    }
  }, []);

  const toggleModuleSubscription = async (moduleSlug: string, currentActive: boolean) => {
    setUpdatingSub(moduleSlug);
    try {
      const existing = subscriptionsList.find((s) => s.module === moduleSlug);
      if (existing) {
        await apiFetch(`/subscriptions/${existing.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({ is_active: !currentActive }),
        });
      }
      await fetchSubscriptions();
      window.location.reload();
    } catch (err) {
      console.error("Failed to update module subscription", err);
    } finally {
      setUpdatingSub(null);
    }
  };

  const {
    session,
    loading,
    logout,
    selectOrganization,
    switchIdentity,
    stopImpersonate,
    loadDemoIdentities,
  } = useAuth();
  const { mode, toggleTheme } = useTheme();

  const allowedSlugs = useMemo(
    () => (session?.modules.map((module) => module.slug) ?? []).filter((slug) => ACTIVE_MODULES.includes(slug)),
    [session?.modules],
  );

  const filteredModules = useMemo(() => {
    const term = query.trim().toLowerCase();
    const allowedSet = new Set(allowedSlugs);
    const base = modules.filter((module) => allowedSet.has(module.slug));
    if (!term) return base;
    return base.filter((module) =>
      [module.name, module.description, ...module.features].join(" ").toLowerCase().includes(term),
    );
  }, [allowedSlugs, query]);

  const filteredQuickJumps = useMemo(() => {
    const allowedSet = new Set(allowedSlugs);
    const term = query.trim().toLowerCase();
    const base = QUICK_JUMP_ROUTES.filter((r) => allowedSet.has(r.module));
    if (!term) return base;
    return base.filter((r) => `${r.name} ${r.detail}`.toLowerCase().includes(term));
  }, [allowedSlugs, query]);

  useEffect(() => {
    // Theme is now managed by useTheme hook
  }, []);

  const toggleThemeHandler = () => {
    toggleTheme();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!profileOpen || !session?.canSwitchIdentity) return;
    let cancelled = false;
    loadDemoIdentities().then((groups) => {
      if (!cancelled) setIdentityGroups(groups);
    });
    return () => {
      cancelled = true;
    };
  }, [profileOpen, session?.canSwitchIdentity, loadDemoIdentities]);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [profileOpen]);

  if (isPublicRoute(pathname)) {
    if (session?.user && (pathname === "/login" || pathname === "/sign-up")) {
      if (typeof window !== "undefined") window.location.href = "/workspaces";
      return <div className="full-loading">Redirecting to your workspace…</div>;
    }
    return <>{children}</>;
  }
  if (loading || !session) return <div className="full-loading">Loading your workspace…</div>;

  const allowed = new Set(allowedSlugs);
  const requestedModule = pathname.split("/")[1];
  const isKnownModule = modules.some((module) => module.slug === requestedModule);
  const activeOrganization = session.organizations.find((item) => item.id === session.activeOrganizationId);
  const activeModule = modules.find((module) => pathname.startsWith(`/${module.slug}`));
  const moduleWorkspaceActive = Boolean(activeModule) || pathname.startsWith("/tenant-portal") || pathname.startsWith("/facility-portal");
  if (moduleWorkspaceActive && (!propertyContextReady || (properties.length > 0 && !activeProperty))) {
    return <div className="full-loading">Loading your property workspace…</div>;
  }
  const displayName = session.user.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session.user.username;
  const displayRole = session.user.isSuperuser
    ? "Super Administrator"
    : session.roleNames?.[0] || session.roles[0] || "Organization member";
  const initials = (session.user.firstName || session.user.username).slice(0, 2).toUpperCase();

  async function onSwitchIdentity(username: string) {
    setSwitching(true);
    setSwitchError("");
    try {
      await switchIdentity(username);
      setProfileOpen(false);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Unable to switch identity.");
    } finally {
      setSwitching(false);
    }
  }

  async function onReturnAdmin() {
    setSwitching(true);
    setSwitchError("");
    try {
      await stopImpersonate();
      setProfileOpen(false);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Unable to return to admin.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <TelemetryProvider>
      <div className="platform" style={{ display: "flex", minHeight: "100vh", width: "100vw", overflowX: "hidden" }}>
      {/* UNIFIED PERSISTENT APP SIDEBAR FOR ALL PAGES */}
      <AppSidebar
        menuOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
      />

      {menuOpen && (
        <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}

      <div className="workspace" style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: 0, paddingBottom: "60px" }}>
        {/* MUI AppBar Header */}
        <AppBar position="sticky" elevation={1} color="inherit" sx={{ height: 60, display: "flex", alignItems: "center" }}>
          <Toolbar variant="dense" sx={{ width: "100%", height: "100%", gap: 2 }}>
            <BrandLogo size="sm" href="/" showWordmark={false} />

            <Box sx={{ flex: 1, position: "relative" }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search modules and workflows… (Ctrl+K)"
                type="search"
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box sx={{ color: "text.secondary", mr: 1, display: "flex", alignItems: "center" }}>
                        <Search size={16} />
                      </Box>
                    ),
                  },
                  htmlInput: { "aria-label": "Search modules and workflows" },
                }}
                inputRef={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                    e.preventDefault();
                    searchInputRef.current?.focus();
                  }
                }}
              />
              {query && (
                <Paper
                  role="presentation"
                  elevation={3}
                  sx={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    mt: 1,
                    maxHeight: 420,
                    overflow: "auto",
                    zIndex: 100,
                  }}
                >
                  <MenuList dense aria-label="Search results">
                    {filteredModules.length > 0 && (
                      <>
                      <ListSubheader sx={{ lineHeight: "32px", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Modules</ListSubheader>
                      {filteredModules.map((module) => (
                        <MenuItem
                          key={module.slug}
                          component={Link}
                          href={`/${module.slug}`}
                          onClick={() => { setQuery(""); setMenuOpen(false); }}
                        >
                          <Box sx={{ mr: 2, fontSize: 16, color: module.accent }}>{module.icon}</Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{module.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{module.description}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                      </>
                    )}
                    {filteredQuickJumps.length > 0 && (
                      <>
                      <ListSubheader sx={{ lineHeight: "32px", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Quick jumps</ListSubheader>
                      {filteredQuickJumps.map((r) => (
                        <MenuItem
                          key={r.href}
                          component={Link}
                          href={r.href}
                          onClick={() => { setQuery(""); setMenuOpen(false); }}
                        >
                          <Box sx={{ mr: 2, fontSize: 16 }}>{r.icon}</Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.detail}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                      </>
                    )}
                    {filteredModules.length === 0 && filteredQuickJumps.length === 0 && (
                      <li><Typography variant="body2" sx={{ px: 2, py: 2, textAlign: "center", color: "text.secondary" }}>No results for &quot;{query}&quot;</Typography></li>
                    )}
                  </MenuList>
                </Paper>
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TourLauncher />

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={activeOrganization?.id ?? ""}
                  label="Organization"
                  onChange={(e) => selectOrganization(e.target.value)}
                >
                  {session.organizations.map((organization) => (
                    <MenuItem value={organization.id} key={organization.id}>
                      {organization.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <IconButton onClick={toggleThemeHandler} title={`Switch to ${mode === "dark" ? "Light" : "Dark"} Mode`}>
                {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>

              <Box ref={profileRef} sx={{ position: "relative" }}>
                <IconButton onClick={() => setProfileOpen((open) => !open)} aria-haspopup="menu">
                  <Avatar sx={{ width: 36, height: 36, background: "linear-gradient(145deg, #1d2b44, #0f1a2c)", fontWeight: 800 }}>
                    {initials}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={profileRef.current}
                  open={profileOpen}
                  onClose={() => setProfileOpen(false)}
                  slotProps={{
                    paper: {
                      sx: { width: 280, borderRadius: 3 }
                    }
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                      <Avatar sx={{ width: 40, height: 40, background: "linear-gradient(145deg, #1d2b44, #0f1a2c)", fontWeight: 800 }}>
                        {initials}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{displayName}</Typography>
                        <Typography variant="caption" color="text.secondary">{session.user.email || session.user.username}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Chip size="small" label={displayRole} sx={{ fontSize: 10, height: 24 }} />
                      {session.organizations.length > 1 && (
                        <Chip size="small" label={activeOrganization?.name} variant="outlined" sx={{ fontSize: 10, height: 24 }} />
                      )}
                    </Box>
                  </Box>
                  <Divider />
                  {session?.canSwitchIdentity && identityGroups.length > 0 && (
                    <>
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="overline" sx={{ fontSize: 10, color: "text.secondary" }}>Switch Identity</Typography>
                      </Box>
                      {identityGroups.map((group) => (
                        <Box key={group.label} sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ px: 2, fontSize: 10, color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                            {group.label}
                          </Typography>
                          {group.identities.map((identity) => (
                            <MenuItem
                              key={identity.username}
                              onClick={() => onSwitchIdentity(identity.username)}
                              disabled={switching}
                              dense
                            >
                              <ListItemIcon>
                                <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                                  {identity.username.slice(0, 2).toUpperCase()}
                                </Avatar>
                              </ListItemIcon>
                              <ListItemText
                                primary={identity.label || identity.username}
                              />
                            </MenuItem>
                          ))}
                        </Box>
                      ))}
                      {switchError && (
                        <Typography variant="caption" color="error" sx={{ px: 2, py: 1 }}>
                          {switchError}
                        </Typography>
                      )}
                      <Divider />
                    </>
                  )}
                  {session?.impersonating && (
                    <>
                      <MenuItem onClick={onReturnAdmin} disabled={switching}>
                        <ListItemIcon><LogOut size={18} /></ListItemIcon>
                        <ListItemText>Return to Administrator</ListItemText>
                      </MenuItem>
                      <Divider />
                    </>
                  )}
                  <MenuItem onClick={logout}>
                    <ListItemIcon><LogOut size={18} /></ListItemIcon>
                    <ListItemText>Sign Out</ListItemText>
                  </MenuItem>
                </Menu>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        {moduleWorkspaceActive ? <PropertyContextBar /> : null}
        <div className="property-scoped-route">
          {children}
        </div>
      </div>
    </div>

    {subModalOpen && (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>⚙️ Module Access & Subscriptions</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>Enable or disable active platform modules for organization {session?.activeOrganizationId}.</p>
            </div>
            <button type="button" onClick={() => setSubModalOpen(false)} style={{ background: "none", border: 0, fontSize: 18, color: "var(--muted)", cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {[
              { slug: "property", name: "🏢 Property Management", desc: "Leases, rent roll & tenant accounts" },
              { slug: "facility", name: "🔧 Facility Management", desc: "Work orders & maintenance schedules" },
              { slug: "sales", name: "💳 Sales & Leasing", desc: "Listings, buyers & CRM pipelines" },
              { slug: "tender", name: "📝 Tender Engine", desc: "RFP invitations & contractor bids" },
              { slug: "valuation", name: "📈 Valuation Services", desc: "Site inspections & RICS reports" },
              { slug: "construction", name: "🏗️ Construction Control", desc: "Projects, IPCs & site monitoring" },
              { slug: "companion", name: "📱 Companion Tasks", desc: "Field staff task management" },
            ].map((mod) => {
              const sub = subscriptionsList.find((s) => s.module === mod.slug);
              const isActive = sub ? sub.is_active : true;
              const isPending = updatingSub === mod.slug;
              return (
                <div key={mod.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 13, color: "var(--text)" }}>{mod.name}</strong>
                    <small style={{ fontSize: 11, color: "var(--muted)" }}>{mod.desc}</small>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void toggleModuleSubscription(mod.slug, isActive)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      border: 0,
                      cursor: isPending ? "wait" : "pointer",
                      background: isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(220, 38, 38, 0.15)",
                      color: isActive ? "var(--success)" : "#dc2626",
                    }}
                  >
                    {isPending ? "Updating…" : isActive ? "✓ Active" : "✕ Disabled"}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button type="button" onClick={() => setSubModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: 0, fontWeight: 700, cursor: "pointer" }}>Done</button>
          </div>
        </div>
      </div>
    )}
  </TelemetryProvider>
  );
}
