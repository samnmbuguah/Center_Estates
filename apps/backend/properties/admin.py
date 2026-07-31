from django.contrib import admin

from .models import Building, Budget, Expense, Invoice, Lease, Project, Property, Receipt, ServiceCharge, Tenant, Unit

admin.site.register((Property, Building, Unit, Project, Tenant, Lease, Invoice, Receipt, Expense, Budget, ServiceCharge))

# Register your models here.
