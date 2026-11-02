from django.contrib import admin

from .models import (
    AgentCommission, Buyer, Installment, OutreachCampaign, OutreachProspect,
    ProjectMarketingProfile, PropertySale, SaleDocument, SaleListing, SalePayment,
    SalesContentArticle, SalesMarketingAsset, SiteVisit
)

admin.site.register((
    SaleListing, Buyer, PropertySale, Installment, SalePayment, SiteVisit,
    AgentCommission, SaleDocument, OutreachCampaign, OutreachProspect,
    SalesContentArticle, SalesMarketingAsset, ProjectMarketingProfile
))
