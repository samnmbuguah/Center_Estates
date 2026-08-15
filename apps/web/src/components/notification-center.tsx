"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Badge, Box, IconButton, Menu, MenuItem, Typography, Chip,
  Divider, Paper, List, ListItem, ListItemText, ListItemIcon,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Tooltip, TextField, Select, MenuItem as SelectMenuItem
} from "@mui/material";
import { 
  Bell, Check, X, Settings, Archive, Trash2, Eye, BellRing,
  Clock, AlertTriangle, Info, CheckCircle, XCircle, Filter, MarkEmailRead,
  MoreVertical
} from "lucide-react";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionable?: boolean;
  actions?: Array<{
    label: string;
    icon: React.ReactNode;
    action: () => void;
    color?: "primary" | "secondary" | "error" | "success";
  }>;
}

export interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onAction?: (id: string, actionIndex: number) => void;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onArchive,
  onAction,
  onNotificationClick
}: NotificationCenterProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "info" | "success" | "warning" | "error">("all");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick?.(notification);
    if (!notification.read) {
      onMarkAsRead?.(notification.id);
    }
    handleClose();
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle size={18} style={{ color: "#22c55e" }} />;
      case "warning": return <AlertTriangle size={18} style={{ color: "#f59e0b" }} />;
      case "error": return <XCircle size={18} style={{ color: "#ef4444" }} />;
      case "info": default: return <Info size={18} style={{ color: "#3b82f6" }} />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={handleClick} color="inherit">
          <Badge badgeContent={unreadCount} color="error">
            {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            borderRadius: 2,
            boxShadow: 3
          }
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: "1px solid #f1f5f9" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Notifications
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Notification settings">
                <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                  <Settings size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Filter */}
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Select
              size="small"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              sx={{ flex: 1 }}
            >
              <SelectMenuItem value="all">All</SelectMenuItem>
              <SelectMenuItem value="unread">Unread ({unreadCount})</SelectMenuItem>
              <SelectMenuItem value="info">Info</SelectMenuItem>
              <SelectMenuItem value="success">Success</SelectMenuItem>
              <SelectMenuItem value="warning">Warning</SelectMenuItem>
              <SelectMenuItem value="error">Error</SelectMenuItem>
            </Select>
            {unreadCount > 0 && (
              <Button
                size="small"
                variant="text"
                startIcon={<MarkEmailRead size={14} />}
                onClick={() => {
                  onMarkAllAsRead?.();
                }}
              >
                Mark all read
              </Button>
            )}
          </Box>
        </Box>

        {/* Notifications List */}
        <Box sx={{ maxHeight: 350, overflow: "auto" }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Bell size={32} style={{ color: "#cbd5e1", marginBottom: 8 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            <List>
              {filteredNotifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    bgcolor: notification.read ? "transparent" : "rgba(79, 70, 229, 0.05)",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "rgba(79, 70, 229, 0.08)" },
                    py: 1.5
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: notification.read ? 400 : 600,
                          color: notification.read ? "inherit" : "#0f172a"
                        }}
                      >
                        {notification.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            display: "block", 
                            mb: 0.5,
                            color: notification.read ? "#64748b" : "#475569"
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Clock size={12} style={{ color: "#94a3b8" }} />
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                            {formatTime(notification.timestamp)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-end" }}>
                    {!notification.read && (
                      <Tooltip title="Mark as read">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead?.(notification.id);
                          }}
                        >
                          <Eye size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNotification(notification);
                      }}
                    >
                      <MoreVertical size={14} />
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <Box sx={{ p: 2, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "center" }}>
          <Button
            size="small"
            variant="text"
            onClick={handleClose}
          >
            View all notifications
          </Button>
        </Box>
        )}
      </Menu>

      {/* Notification Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm">
        <DialogTitle>Notification Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Notification Preferences
            </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2">Email notifications</Typography>
              <Chip label="Enabled" size="small" color="primary" />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2">Push notifications</Typography>
              <Chip label="Enabled" size="small" color="primary" />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2">Sound alerts</Typography>
              <Chip label="Disabled" size="small" color="default" />
            </Box>
          </Box>
        </Box>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => setSettingsOpen(false)}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Action Menu */}
      <Menu
        anchorEl={selectedNotification ? { current: selectedNotification } as any : null}
        open={Boolean(selectedNotification)}
        onClose={() => setSelectedNotification(null)}
      >
        {selectedNotification?.actionUrl && (
          <MenuItem onClick={() => {
            window.open(selectedNotification.actionUrl, "_blank");
            setSelectedNotification(null);
          }}>
            <Eye size={16} style={{ marginRight: 8 }} />
            View Details
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          onMarkAsRead?.(selectedNotification!.id);
          setSelectedNotification(null);
        }}>
          <Check size={16} style={{ marginRight: 8 }} />
          Mark as Read
        </MenuItem>
        <MenuItem onClick={() => {
          onArchive?.(selectedNotification!.id);
          setSelectedNotification(null);
        }}>
          <Archive size={16} style={{ marginRight: 8 }} />
          Archive
        </MenuItem>
        <MenuItem onClick={() => {
          onDelete?.(selectedNotification!.id);
          setSelectedNotification(null);
        }} sx={{ color: "#ef4444" }}>
          <Trash2 size={16} style={{ marginRight: 8 }} />
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}