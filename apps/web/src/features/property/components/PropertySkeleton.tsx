"use client";

import { Box, Skeleton, Grid, Card, CardContent } from "@mui/material";

export function PropertySkeleton() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
      {/* KPI strip skeleton */}
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Skeleton variant="text" width="40%" height={20} />
              <Skeleton variant="text" width="70%" height={36} sx={{ my: 1 }} />
              <Skeleton variant="text" width="50%" height={16} />
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Toolbar skeleton */}
      <Card variant="outlined" sx={{ p: 2, borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton variant="rectangular" width={200} height={36} sx={{ borderRadius: 1 }} />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
        </Box>
      </Card>

      {/* Table rows skeleton */}
      <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Skeleton variant="rectangular" width="100%" height={48} sx={{ mb: 1, borderRadius: 1 }} />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} variant="rectangular" width="100%" height={40} sx={{ mb: 1, borderRadius: 1 }} />
        ))}
      </Card>
    </Box>
  );
}
