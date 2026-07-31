# Shared data model

This is the authoritative platform foundation for every ERP module. Module tables must reference these records rather than creating duplicate tenants, properties, units, users or projects.

## Relationships

```text
User ──< Membership >── Organization ──< Subscription
              │                │
              └──< Role >──< Permission
                               │
Organization ──< Property ──< Building ──< Unit
       │              └───────────────< Unit
       ├──< Project >── optional Property
       ├──< Document >── generic organization-owned target
       ├──< Notification >── recipient User
       └──< AuditEvent >── optional actor User
```

## Tenant invariants

- Tenant-owned models carry a mandatory `organization_id` and UUID primary key.
- `OrganizationOwnedModel.objects.for_organization(...)` returns no records when organization context is absent.
- `X-Organization-ID` is only a selection hint. `get_active_organization()` verifies membership before returning it.
- Missing organization context falls back only to an active default/first membership, never to all rows.
- Buildings, units, projects, documents, notifications and role assignments validate that related records belong to the same organization.
- Application validation runs during `save()` for organization-owned records. Imports using `bulk_create` must validate rows in their service before writing because Django deliberately bypasses `save()` for bulk operations.
- Database uniqueness is scoped appropriately: property/project code per organization, building/unit code per parent, role slug per organization and module subscription per organization.

## Authorization concepts

- `Subscription`: whether an organization may use a module now.
- `Membership`: whether a user belongs to an organization.
- `Role`: an organization-defined permission group.
- `Permission`: a stable domain action key such as `property.lease.approve`.
- Organization administrators bypass role checks inside their organization, not tenant isolation.

## MonitoringERP compatibility

Monitoring's `Tenant` maps to `Organization`, `TenantMembership` maps to `Membership`, and its string permission catalogue maps directly to `Permission.key`. Legacy role assignments require an organization during migration. Existing Monitoring project identifiers should be retained in metadata or an explicit legacy-ID mapping table so mobile sync references remain stable.
