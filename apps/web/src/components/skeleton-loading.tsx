"use client";

import { Box, Skeleton, Typography, Paper, Grid, Card } from "@mui/material";

export function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
          <Paper sx={{ p: 2, height: 200 }}>
            <Skeleton variant="rectangular" width={60} height={60} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="80%" sx={{ mb: 1 }} />
            <Skeleton variant="text" width="60%" sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={40} />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Skeleton variant="text" width={200} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </Box>
      <Box sx={{ overflow: "hidden" }}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Box key={rowIndex} sx={{ display: "flex", gap: 2, py: 1, borderBottom: "1px solid #f1f5f9" }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" width="100%" />
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <Paper sx={{ p: 3, maxWidth: 600 }}>
      <Skeleton variant="text" width={200} height={32} sx={{ mb: 3 }} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {Array.from({ length: fields }).map((_, index) => (
          <Box key={index}>
            <Skeleton variant="text" width={120} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={56} />
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Skeleton variant="rectangular" width={120} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </Box>
    </Paper>
  );
}

export function SkeletonDashboard() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={500} height={24} />
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Paper sx={{ p: 3, height: 120 }}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="60%" sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={32} />
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Skeleton variant="text" width={200} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={300} />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Skeleton variant="text" width={150} sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="text" width="60%" />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <Box>
      {Array.from({ length: items }).map((_, index) => (
        <Paper key={index} sx={{ p: 2, mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width="60%" />
          </Box>
          <Skeleton variant="rectangular" width={100} height={32} />
        </Paper>
      ))}
    </Box>
  );
}

export function SkeletonDetail() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Skeleton variant="text" width={300} height={40} sx={{ mb: 1 }} />
          <Skeleton variant="text" width={200} height={24} />
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Skeleton variant="rectangular" width={120} height={36} />
          <Skeleton variant="rectangular" width={120} height={36} />
        </Box>
      </Box>

      {/* Content */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Skeleton variant="text" width={200} sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Box key={index}>
                  <Skeleton variant="text" width={150} sx={{ mb: 0.5 }} />
                  <Skeleton variant="text" width="100%" height={24} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Skeleton variant="text" width={150} sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="text" width="70%" />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}