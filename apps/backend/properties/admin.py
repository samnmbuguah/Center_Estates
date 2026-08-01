from django.contrib import admin

from .models import (
    Building, Budget, Expense, Invoice, Lease, Project, Property, Receipt,
    ServiceCharge, ServiceChargeAllocation, ServiceChargeReconciliation, Tenant,
    TenantPortalAccess, Unit,
)

admin.site.register((
    Property, Building, Unit, Project, Tenant, Lease, Invoice, Receipt, Expense,
    Budget, ServiceCharge, ServiceChargeAllocation, ServiceChargeReconciliation,
    TenantPortalAccess,
))

# Register your models here.
