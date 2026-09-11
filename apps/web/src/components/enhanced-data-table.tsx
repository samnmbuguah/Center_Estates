"use client";

import { useState, useMemo, ReactNode } from "react";
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Checkbox, IconButton, Tooltip, Chip, Menu, MenuItem, TextField,
  InputAdornment, Collapse, Button, Typography, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Pagination, CircularProgress
} from "@mui/material";
import { 
  Search, Filter, Download, ChevronDown, ChevronUp,
  Eye, Edit, Trash2, Columns
} from "lucide-react";

export interface Column<T> {
  id: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  visible?: boolean;
}

export interface FilterState {
  [key: string]: string | string[] | undefined;
}

export interface EnhancedDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onView?: (row: T) => void;
  onExport?: (selectedRows: T[]) => void;
  bulkActions?: Array<{
    label: string;
    icon: ReactNode;
    action: (selectedRows: T[]) => void;
    color?: "primary" | "secondary" | "error" | "success";
  }>;
  selectable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  rowActions?: Array<{
    label: string;
    icon: ReactNode;
    action: (row: T) => void;
    color?: "primary" | "secondary" | "error" | "success";
  }>;
  onFilterChange?: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export function EnhancedDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  emptyTitle = "No data available",
  emptyDescription = "There are no items to display",
  onRowClick,
  onEdit,
  onDelete,
  onView,
  onExport,
  bulkActions = [],
  selectable = true,
  pagination = true,
  pageSize = 25,
  rowActions = [],
  onFilterChange,
  initialFilters = {}
}: EnhancedDataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<Set<string>>(
    new Set(columns.filter(c => c.visible !== false).map(c => String(c.id)))
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(pageSize);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: ((rows: T[]) => void) | null;
  }>({ open: false, action: null });

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row => 
        columns.some(col => {
          const value = row[col.id as keyof T];
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && (typeof value === 'string' ? value.trim() : value.length > 0)) {
        if (Array.isArray(value)) {
          result = result.filter(row => value.includes(String(row[key as keyof T])));
        } else {
          result = result.filter(row => 
            String(row[key as keyof T]).toLowerCase().includes(String(value).toLowerCase())
          );
        }
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = String(a[sortConfig.key as keyof T] ?? "");
        const bValue = String(b[sortConfig.key as keyof T] ?? "");
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, filters, sortConfig, columns]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!pagination) return filteredAndSortedData;
    
    const startIndex = page * rowsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredAndSortedData, page, rowsPerPage, pagination]);

  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage);

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map((_, index) => String(index))));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (index: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedRows(newSelected);
  };

  // Handle sorting
  const handleSort = (columnId: string) => {
    const column = columns.find(c => String(c.id) === columnId);
    if (!column?.sortable) return;

    setSortConfig(prev => {
      if (!prev || prev.key !== columnId) {
        return { key: columnId, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key: columnId, direction: 'desc' };
      }
      return null;
    });
  };

  // Handle filtering
  const handleFilterChange = (columnId: string, value: string | string[]) => {
    const newFilters = { ...filters, [columnId]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  // Handle bulk actions
  const handleBulkAction = (action: (rows: T[]) => void) => {
    const selectedData = paginatedData.filter((_, index) => 
      selectedRows.has(String(index))
    );
    action(selectedData);
    setSelectedRows(new Set());
    setBulkActionDialog({ open: false, action: null });
  };

  // Handle export
  const handleExport = () => {
    const selectedData = selectedRows.size > 0 
      ? paginatedData.filter((_, index) => selectedRows.has(String(index)))
      : paginatedData;
    onExport?.(selectedData);
  };

  // Toggle column visibility
  const toggleColumnVisibility = (columnId: string) => {
    const newVisibility = new Set(columnVisibility);
    if (newVisibility.has(columnId)) {
      newVisibility.delete(columnId);
    } else {
      newVisibility.add(columnId);
    }
    setColumnVisibility(newVisibility);
  };

  const visibleColumns = columns.filter(col => columnVisibility.has(String(col.id)));

  const isSelectedAll = paginatedData.length > 0 && selectedRows.size === paginatedData.length;
  const selectedCount = selectedRows.size;

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        mb: 2, 
        flexWrap: "wrap", 
        gap: 2 
      }}>
        <Box sx={{ display: "flex", gap: 1, flex: 1, minWidth: 300 }}>
          <TextField
            placeholder="Search..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} style={{ color: "var(--text-faint)" }} />
                  </InputAdornment>
                ),
              }
            }}
            sx={{ flex: 1 }}
          />
          <Tooltip title="Column filters">
            <IconButton onClick={(e) => setFilterMenuAnchor(e.currentTarget)}>
              <Filter size={18} style={{ color: "var(--text-faint)" }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Column visibility">
            <IconButton onClick={(e) => setColumnMenuAnchor(e.currentTarget)}>
              <Columns size={18} style={{ color: "var(--text-faint)" }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          {selectedCount > 0 && (
            <Chip 
              label={`${selectedCount} selected`}
              color="primary"
              onDelete={() => setSelectedRows(new Set())}
              sx={{ height: 32 }}
            />
          )}
          
          {bulkActions.length > 0 && selectedCount > 0 && (
            bulkActions.map((action, index) => (
              <Button
                key={index}
                size="small"
                variant="outlined"
                startIcon={action.icon}
                onClick={() => setBulkActionDialog({ open: true, action: action.action })}
                color={action.color}
              >
                {action.label}
              </Button>
            ))
          )}

          {onExport && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={handleExport}
            >
              {selectedCount > 0 ? "Export selected" : "Export"}
            </Button>
          )}
        </Box>
      </Box>

      {/* Selected rows bulk actions bar */}
      <Collapse in={selectedCount > 0}>
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setSelectedRows(new Set())}>
              Clear selection
            </Button>
          }
        >
          {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected. Choose a bulk action from the toolbar.
        </Alert>
      </Collapse>

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: "1px solid var(--border)" }}>
        <Table>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isSelectedAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
              )}
              {visibleColumns.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.align || "left"}
                  sx={{ 
                    fontWeight: 700, 
                    fontSize: 13,
                    width: column.width,
                    cursor: column.sortable ? "pointer" : "default",
                    userSelect: "none"
                  }}
                  onClick={() => column.sortable && handleSort(String(column.id))}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {column.label}
                    {column.sortable && (
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <ChevronUp 
                          size={12} 
                          style={{ 
                            color: sortConfig?.key === String(column.id) && sortConfig.direction === 'asc' 
                              ? "var(--color-indigo)" : "var(--color-slate-300)",
                            marginTop: 2
                          }} 
                        />
                        <ChevronDown 
                          size={12} 
                          style={{ 
                            color: sortConfig?.key === String(column.id) && sortConfig.direction === 'desc' 
                              ? "var(--color-indigo)" : "var(--color-slate-300)",
                            marginTop: -2
                          }} 
                        />
                      </Box>
                    )}
                  </Box>
                </TableCell>
              ))}
              {(rowActions.length > 0 || onEdit || onDelete || onView) && (
                <TableCell align="center" sx={{ width: 80 }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions.length > 0 || onEdit || onDelete || onView ? 1 : 0)} align="center">
                  <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <CircularProgress size={40} />
                    <Typography color="text.secondary">Loading data...</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions.length > 0 || onEdit || onDelete || onView ? 1 : 0)} align="center">
                  <Box sx={{ py: 8, textAlign: "center" }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {emptyTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {emptyDescription}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow
                  key={index}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? "pointer" : "default" }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows.has(String(index))}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(String(index), e.target.checked);
                        }}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={String(column.id)}
                      align={column.align || "left"}
                      sx={{ fontSize: 13 }}
                    >
                      {column.render 
                        ? column.render(row[column.id as keyof T], row)
                        : String(row[column.id as keyof T] ?? "")
                      }
                    </TableCell>
                  ))}
                  {(rowActions.length > 0 || onEdit || onDelete || onView) && (
                    <TableCell align="center">
                      <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                        {onView && (
                          <Tooltip title="View">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onView(row);
                              }}
                            >
                              <Eye size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onEdit && (
                          <Tooltip title="Edit">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(row);
                              }}
                            >
                              <Edit size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onDelete && (
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(row);
                              }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {rowActions.map((action, actionIndex) => (
                          <Tooltip key={actionIndex} title={action.label}>
                            <IconButton 
                              size="small"
                              color={action.color === "error" ? "error" : action.color === "success" ? "success" : "primary"}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.action(row);
                              }}
                            >
                              {action.icon}
                            </IconButton>
                          </Tooltip>
                        ))}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
          </Typography>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(e, newPage) => setPage(newPage - 1)}
            color="primary"
            size="small"
          />
        </Box>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        slotProps={{ paper: { sx: { width: 300, maxHeight: 400 } } }}
      >
        <MenuItem disabled>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            FILTER BY COLUMN
          </Typography>
        </MenuItem>
        {columns.filter(col => col.filterable).map((column) => (
          <MenuItem 
            key={String(column.id)}
            onClick={() => {
              setActiveFilterColumn(String(column.id));
              setFilterMenuAnchor(null);
            }}
          >
            {column.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Column Visibility Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
        slotProps={{ paper: { sx: { width: 250 } } }}
      >
        <MenuItem disabled>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            SHOW COLUMNS
          </Typography>
        </MenuItem>
        {columns.map((column) => (
          <MenuItem 
            key={String(column.id)}
            onClick={() => toggleColumnVisibility(String(column.id))}
          >
            <Checkbox 
              size="small" 
              checked={columnVisibility.has(String(column.id))} 
            />
            {column.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkActionDialog.open} onClose={() => setBulkActionDialog({ open: false, action: null })}>
        <DialogTitle>Confirm Bulk Action</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to perform this action on {selectedCount} selected row{selectedCount !== 1 ? 's' : ''}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkActionDialog({ open: false, action: null })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => bulkActionDialog.action && handleBulkAction(bulkActionDialog.action)}
            disabled={!bulkActionDialog.action}
            color="error"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeFilterColumn)} onClose={() => setActiveFilterColumn(null)}>
        <DialogTitle>
          Filter {columns.find((column) => String(column.id) === activeFilterColumn)?.label ?? "column"}
        </DialogTitle>
        <DialogContent sx={{ minWidth: { xs: 280, sm: 380 }, pt: "12px !important" }}>
          <TextField
            autoFocus
            fullWidth
            label="Contains"
            value={activeFilterColumn ? String(filters[activeFilterColumn] ?? "") : ""}
            onChange={(event) => activeFilterColumn && handleFilterChange(activeFilterColumn, event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (activeFilterColumn) handleFilterChange(activeFilterColumn, "");
              setActiveFilterColumn(null);
            }}
          >
            Clear
          </Button>
          <Button variant="contained" onClick={() => setActiveFilterColumn(null)}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
