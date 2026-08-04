# Construction Management development plan

The module is already integrated as a domain port from MonitoringERP. Remaining work is parity, hardening and spec alignment rather than greenfield build.

1. Keep the MonitoringERP shell/navigation parity in the Center Estates `ModuleShell` (left rail + horizontal tabs) — already aligned.
2. Maintain per-page implementations under `apps/web/src/components/monitoring/pages/*` mapped via `monitoring-workspace.tsx`.
3. Harden every page against undefined API fields (defensive optional chaining + safe fallbacks) — audit-log, dashboard, cost, risk and project workspace already hardened; continue across remaining pages.
4. Wire any remaining decorative controls (export, filters) to real endpoints or client-side CSV export.
5. Role-based dashboards: expose the role dashboards (`specification-by-role.pdf`) via the existing `RoleDashboard` component keyed on the signed-in user's role.
6. Ensure mobile/offline parity for site evidence workflows is preserved (do not rewrite without a parity test).
7. End-to-end acceptance: all monitoring tabs render with zero console pageerrors against seeded demo data.
