# Deployment Checklist

- [ ] All tests pass (142 backend, 306 e2e)
- [ ] TypeScript compilation clean
- [ ] Docker build succeeds
- [ ] Backup created before deploy
- [ ] Migrations applied (auto via entrypoint)
- [ ] Smoke test passes (all 8 modules render)
- [ ] Rollback plan ready (previous image tagged)
