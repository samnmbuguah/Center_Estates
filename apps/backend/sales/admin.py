from django.contrib import admin

from .models import AgentCommission, Buyer, Installment, PropertySale, SaleDocument, SaleListing, SalePayment, SiteVisit

admin.site.register((SaleListing, Buyer, PropertySale, Installment, SalePayment, SiteVisit, AgentCommission, SaleDocument))
