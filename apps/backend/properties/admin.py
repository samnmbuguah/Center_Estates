from django.contrib import admin

from .models import (
    BankTransaction, Building, Budget, Expense, Invoice, InvoiceReminder, Lease,
    Project, Property, Receipt,
    ServiceCharge, ServiceChargeAllocation, ServiceChargeReconciliation, Tenant,
    TenantPortalAccess, Unit,
)

admin.site.register((
    Property, Building, Unit, Project, Tenant, Lease, Invoice, InvoiceReminder,
    Receipt, BankTransaction, Expense,
    Budget, ServiceCharge, ServiceChargeAllocation, ServiceChargeReconciliation,
    TenantPortalAccess,
))

# Register your models here.
