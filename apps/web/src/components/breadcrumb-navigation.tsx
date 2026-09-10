"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumbs, Typography, Chip, Box, IconButton, Tooltip,
  Menu, MenuItem, TextField, InputAdornment, Collapse, Paper
} from "@mui/material";
import { 
  Home, ChevronRight, Search, Keyboard, 
  BookOpen, HelpCircle
} from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  action?: () => void;
}

interface BreadcrumbNavigationProps {
  items?: BreadcrumbItem[];
  showSearch?: boolean;
  showShortcuts?: boolean;
  customActions?: Array<{
    label: string;
    icon: React.ReactNode;
    action: () => void;
  }>;
}

export function BreadcrumbNavigation({
  items: propItems,
  showSearch = true,
  showShortcuts = true,
  customActions = []
}: BreadcrumbNavigationProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shortcutsMenuAnchor, setShortcutsMenuAnchor] = useState<HTMLElement | null>(null);

  // Generate breadcrumbs from pathname if not provided
  const items = propItems || generateBreadcrumbs(pathname);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setShortcutsMenuAnchor(e.currentTarget as HTMLElement);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setShortcutsMenuAnchor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // Implement search functionality
    console.log("Searching for:", query);
  }, []);

  const shortcuts = [
    { key: "Ctrl + K", description: "Open search", action: () => setSearchOpen(true) },
    { key: "Ctrl + /", description: "Show keyboard shortcuts", action: () => {} },
    { key: "Ctrl + B", description: "Go back", action: () => window.history.back() },
    { key: "Ctrl + F", description: "Go forward", action: () => window.history.forward() },
    { key: "Escape", description: "Close modal/dropdown", action: () => {
      setSearchOpen(false);
      setShortcutsMenuAnchor(null);
    }},
  ];

  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs 
        separator={<ChevronRight size={16} style={{ color: "var(--color-slate-400)" }} />}
        sx={{ mb: 2 }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 0.5, textDecoration: "none", color: "var(--color-slate-500)" }}>
          <Home size={16} />
          <Typography variant="body2" sx={{ color: "var(--color-slate-500)" }}>
            Home
          </Typography>
        </Link>
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Box 
              key={index} 
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              {item.href ? (
                <Link 
                  href={item.href}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 0.5, 
                    textDecoration: "none",
                    color: isLast ? "var(--color-slate-900)" : "var(--color-slate-500)",
                    fontWeight: isLast ? 600 : 400
                  }}
                >
                  <Typography variant="body2" sx={{ color: isLast ? "var(--color-slate-900)" : "var(--color-slate-500)", fontWeight: isLast ? 600 : 400 }}>
                    {item.label}
                  </Typography>
                </Link>
              ) : (
                <Box 
                  sx={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 0.5,
                    cursor: item.action ? "pointer" : "default"
                  }}
                  onClick={item.action}
                >
                  <Typography variant="body2" sx={{ color: "var(--color-slate-900)", fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Breadcrumbs>

      {/* Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {showSearch && (
            <Box sx={{ position: "relative" }}>
              <TextField
                placeholder="Search... (Ctrl+K)"
                size="small"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} style={{ color: "var(--color-slate-500)" }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Keyboard size={16} style={{ color: "var(--color-slate-400)" }} />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={{ 
                  width: searchOpen ? 300 : 200,
                  transition: "width 0.2s ease",
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2
                  }
                }}
              />
              
              {/* Search Dropdown */}
              <Collapse in={searchOpen && searchQuery.length > 0}>
                <Paper 
                  sx={{ 
                    position: "absolute", 
                    top: "100%", 
                    left: 0, 
                    right: 0, 
                    mt: 1, 
                    zIndex: 10,
                    borderRadius: 2,
                    boxShadow: 3,
                    maxHeight: 300,
                    overflow: "auto"
                  }}
                >
                  <Box sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--color-slate-500)", mb: 1 }}>
                      SEARCH RESULTS
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {/* Search results would go here */}
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                        No results found for &quot;{searchQuery}&quot;
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Collapse>
            </Box>
          )}

          {showShortcuts && (
            <Tooltip title="Keyboard shortcuts (Ctrl+/)">
              <IconButton 
                size="small" 
                onClick={(e) => setShortcutsMenuAnchor(e.currentTarget as HTMLElement)}
              >
                <Keyboard size={18} style={{ color: "var(--color-slate-500)" }} />
              </IconButton>
            </Tooltip>
          )}

          {customActions.map((action, index) => (
            <Tooltip key={index} title={action.label}>
              <IconButton size="small" onClick={action.action}>
                {action.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Keyboard Shortcuts Menu */}
      <Menu
        anchorEl={shortcutsMenuAnchor}
        open={Boolean(shortcutsMenuAnchor)}
        onClose={() => setShortcutsMenuAnchor(null)}
        slotProps={{
          paper: { sx: { width: 300, maxHeight: 400 } }
        }}
      >
        <MenuItem disabled>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Keyboard size={16} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              KEYBOARD SHORTCUTS
            </Typography>
          </Box>
        </MenuItem>
        {shortcuts.map((shortcut, index) => (
          <MenuItem key={index} onClick={shortcut.action}>
            <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <Typography variant="body2">{shortcut.description}</Typography>
              <Chip 
                label={shortcut.key} 
                size="small" 
                sx={{ 
                  height: 24, 
                  fontSize: 11,
                  bgcolor: "var(--color-slate-100)",
                  color: "var(--color-slate-500)"
                }} 
              />
            </Box>
          </MenuItem>
        ))}
        <MenuItem divider />
        <MenuItem component={Link} href="/docs" target="_blank">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BookOpen size={16} />
            <Typography variant="body2">View Documentation</Typography>
          </Box>
        </MenuItem>
        <MenuItem component={Link} href="/help" target="_blank">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HelpCircle size={16} />
            <Typography variant="body2">Get Help</Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments.length === 0) {
    return [{ label: "Dashboard", href: "/" }];
  }

  const items: BreadcrumbItem[] = [];
  let currentPath = "";

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Format segment for display
    const label = segment
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    items.push({
      label,
      href: currentPath
    });
  });

  return items;
}
