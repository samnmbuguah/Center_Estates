# Maestro Mobile E2E Test Suite

Automated black-box end-to-end flows for the **Monitoring ERP Mobile App** (`@monitoring/mobile`).

### Flows Included

1. [`01_login_and_hub.yaml`](file:///root/Dev/MonitoringERP/apps/mobile/.maestro/01_login_and_hub.yaml): Authentication, offline/connectivity banner, project navigation, and hub module availability.
2. [`02_milestone_stage_gate.yaml`](file:///root/Dev/MonitoringERP/apps/mobile/.maestro/02_milestone_stage_gate.yaml): Contractual stage-gate validation, prerequisite blockers, and submission lockouts.
3. [`03_daily_log_boq_delivery.yaml`](file:///root/Dev/MonitoringERP/apps/mobile/.maestro/03_daily_log_boq_delivery.yaml): BoQ line item modal, supplier chips, planned allowance variance shields, and form draft persistence across app restarts.
4. [`04_ticket_creation.yaml`](file:///root/Dev/MonitoringERP/apps/mobile/.maestro/04_ticket_creation.yaml): Field defect / snag ticketing, priority tags, and list updates.

### Running the Flows

To execute against an Android emulator or iOS simulator:

```bash
# Run all flows sequentially
maestro test .maestro/

# Run a single target flow
maestro test .maestro/02_milestone_stage_gate.yaml
```

To run in headless CI (GitHub Actions):
```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
maestro cloud --apiKey <MAESTRO_CLOUD_API_KEY> .maestro/
```
