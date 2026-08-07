# UI/UX Role-Based Audit

## Executive Summary
This document audits the UI/UX across all modules by role to ensure navigation, permissions, and user experience make sense for each user type.

## Permission System

### Permission Categories

**Property Module:**
- `property.operations` - Can manage properties, buildings, units
- `property.leasing` - Can manage tenants and leases
- `property.finance` - Can manage rent, invoices, receipts, financials

**Facility Module:**
- `facility.work` - Can create and manage work orders
- `facility.inspect` - Can perform inspections
- `facility.administer` - Full admin access
- `facility.manage` - Management-level access

**Sales Module:**
- `sales.selling` - Can manage sales process
- `sales.visits` - Can manage site visits

**Valuation Module:**
- `valuation.coordinate` - Can coordinate valuations
- `valuation.finance` - Can manage valuation finances
- `valuation.review` - Can review valuations

**Companion Module:**
- `companion.assign` - Can assign tasks
- `companion.performance.view` - Can view performance dashboards

**Monitoring/Construction Module:**
- `projects.edit` - Can edit projects
- `finance.admin` - Finance admin access
- `communication.post` - Can post notices
- `drone.view` - Can view drone datasets
- `site.reporting.view` - Can view site reports

## Active Modules
- **Property** - Property Management
- **Facility** - Facility Management
- **Valuation** - Valuation Services
- **Companion** - Task Management

**Disabled Modules** (hidden unless explicitly enabled):
- **Sales** - Sales Pipeline
- **Tender** - Tender Management
- **Monitoring** - Construction Monitoring

## Role-Based UI/UX Audit

### Property Module

#### Property Manager (property.operations + property.leasing + property.finance)
**Navigation Access:** All property sections
- Overview, Properties, Buildings, Units
- Occupancy
- Tenancy, Tenants, Leases
- Financials, Rent Collection
- Service Charge
- Income & Expenses
- Reports
- Insights (Owner Portal, 5-Year Forecast, Critical Dates)

**Actions Available:**
- + Add Property
- + Add Tenant
- + Record Receipt
- Generate invoices
- Manage leases
- View financial reports

**UI/UX Assessment:**
- ✅ Full access to all navigation sections
- ✅ All action buttons visible
- ✅ Comprehensive dashboard with KPIs
- ⚠️ Navigation may be overwhelming - consider role-specific dashboards

#### Property Operations Staff (property.operations only)
**Navigation Access:**
- Overview, Properties, Buildings, Units
- Occupancy
- Tenancy, Tenants (view only)

**Actions Available:**
- + Add Property
- View property details
- Manage units

**UI/UX Assessment:**
- ✅ Focused on property management
- ⚠️ Financial sections hidden (good)
- ⚠️ Lease management hidden (may need access for operations)

#### Property Leasing Agent (property.leasing only)
**Navigation Access:**
- Tenancy, Tenants, Leases
- Overview (limited)

**Actions Available:**
- + Add Tenant
- Manage leases
- Upload tenant documents

**UI/UX Assessment:**
- ✅ Focused on tenant/lease management
- ⚠️ Property management hidden (may need to view available units)
- ⚠️ Financial sections hidden (good)

#### Property Finance Staff (property.finance only)
**Navigation Access:**
- Financials, Rent Collection
- Service Charge
- Income & Expenses
- Reports

**Actions Available:**
- + Record Receipt
- Generate invoices
- View financial reports
- Bank reconciliation

**UI/UX Assessment:**
- ✅ Focused on financial operations
- ⚠️ Property/tenant sections hidden (may need context for invoices)
- ✅ Comprehensive financial tools

### Facility Module

#### Facility Manager (facility.manage)
**Navigation Access:** All facility sections
- Dashboard, Buildings & Locations, Assets & Inventory
- Maintenance, Work History, Labor & Parts, Work Media
- Planned Maintenance, Service Requests, Inspections
- Energy & Utilities, Vendors & Contracts
- Reports & BI

**Actions Available:**
- Create work orders
- Manage assets
- Schedule maintenance
- View reports

**UI/UX Assessment:**
- ✅ Full access to all navigation sections
- ✅ Comprehensive facility management
- ⚠️ Navigation may be overwhelming

#### Facility Technician (facility.work)
**Navigation Access:**
- Maintenance (work orders assigned to them)
- Work History
- Service Requests

**Actions Available:**
- View assigned work orders
- Update work order status
- Add work media/photos

**UI/UX Assessment:**
- ✅ Focused on assigned work
- ⚠️ Asset management hidden (may need to view asset details)
- ⚠️ Planning sections hidden (good)

#### Facility Inspector (facility.inspect)
**Navigation Access:**
- Inspections
- Work History
- Assets & Inventory

**Actions Available:**
- Perform inspections
- View inspection history
- View asset details

**UI/UX Assessment:**
- ✅ Focused on inspections
- ⚠️ Work order management hidden (may need to create work orders from inspections)
- ✅ Asset access for context

### Valuation Module

#### Valuation Coordinator (valuation.coordinate)
**Navigation Access:** All valuation sections
- Overview
- Instructions, Site Inspections, Comparable Evidence
- Draft Reports, Final Reports
- Client Invoicing, Payments, Clients
- Analytics, Reports, Audit Trail

**Actions Available:**
- Create valuation instructions
- Assign valuers
- Review reports
- Manage clients

**UI/UX Assessment:**
- ✅ Full access to all navigation sections
- ✅ End-to-end valuation management
- ⚠️ Navigation may be overwhelming

#### Valuer (valuation.review)
**Navigation Access:**
- Instructions (assigned to them)
- Site Inspections
- Comparable Evidence
- Draft Reports

**Actions Available:**
- View assigned instructions
- Perform site inspections
- Add comparable evidence
- Draft reports

**UI/UX Assessment:**
- ✅ Focused on assigned work
- ⚠️ Client management hidden (good)
- ⚠️ Final reports hidden (until approved)

#### Valuation Finance (valuation.finance)
**Navigation Access:**
- Client Invoicing, Payments, Clients
- Reports

**Actions Available:**
- Generate invoices
- Record payments
- View client details

**UI/UX Assessment:**
- ✅ Focused on financial operations
- ⚠️ Valuation work hidden (may need context for invoices)
- ✅ Client management access

### Companion Module

#### Manager (companion.assign + companion.performance.view)
**Navigation Access:** All companion sections
- My Companion
- All Tasks, My Tasks, Templates, Delegations
- Performance Dashboard, Staff History, Audit Trail

**Actions Available:**
- Assign tasks
- View performance dashboards
- Create task templates
- Delegate tasks

**UI/UX Assessment:**
- ✅ Full access to all navigation sections
- ✅ Comprehensive task management
- ✅ Performance analytics

#### Staff Member (no special permissions)
**Navigation Access:**
- My Companion
- My Tasks

**Actions Available:**
- View assigned tasks
- Update task status
- Add task comments

**UI/UX Assessment:**
- ✅ Focused on personal tasks
- ⚠️ Team view hidden (good)
- ✅ Simple, focused interface

## Recommendations

### 1. Role-Specific Dashboards
Create role-specific dashboard views that show relevant KPIs and quick actions for each role type.

**Property Manager Dashboard:**
- Occupancy rate
- Rent collection rate
- Active leases expiring soon
- Outstanding arrears
- Quick actions: Add Property, Add Tenant, Record Receipt

**Property Finance Dashboard:**
- Monthly rent collected
- Outstanding invoices
- Arrears by aging
- Service charge status
- Quick actions: Record Receipt, Generate Report

**Facility Manager Dashboard:**
- Open work orders
- Pending inspections
- Asset utilization
- Maintenance costs
- Quick actions: Create Work Order, Schedule Inspection

**Facility Technician Dashboard:**
- My assigned work orders
- Work orders due today
- Work orders overdue
- Quick actions: Update Status, Add Photo

### 2. Navigation Optimization
Consider hiding navigation sections that are not relevant to the user's role, rather than just disabling actions.

**Current:** All sections visible, actions disabled based on permissions
**Recommended:** Hide sections entirely if user lacks permissions for all items in that section

### 3. Contextual Help
Add role-specific help text and tooltips to guide users based on their permissions.

### 4. Permission Hierarchy
Review permission hierarchy to ensure logical groupings:
- `property.manage` should imply `property.operations`, `property.leasing`, `property.finance`
- `facility.manage` should imply `facility.work`, `facility.inspect`, `facility.administer`

### 5. Mobile Experience
Audit mobile experience for each role, especially field workers (technicians, inspectors).

## Issues Identified

### High Priority
1. **Property Module:** Navigation shows all sections to all users with property access, regardless of specific permissions. This can be confusing.
2. **Facility Module:** Technicians may need access to asset details when working on work orders, but asset management is hidden.
3. **Valuation Module:** Valuers may need to see final reports after approval for learning purposes.

### Medium Priority
1. **No Role-Specific Dashboards:** All users see the same dashboard regardless of role.
2. **Permission Hierarchy:** No clear permission hierarchy - each permission is checked independently.
3. **Disabled Modules:** Sales, Tender, and Monitoring modules are hidden but code exists, which may cause confusion.

### Low Priority
1. **Mobile Experience:** Not audited in this review.
2. **Accessibility:** Not audited in this review.
3. **Performance:** Not audited in this review.

## Next Steps
1. Implement role-specific dashboards
2. Optimize navigation based on permissions
3. Add contextual help
4. Review and implement permission hierarchy
5. Audit mobile experience by role
6. Audit accessibility by role
