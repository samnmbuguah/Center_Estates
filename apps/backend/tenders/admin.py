from django.contrib import admin
from .models import BidDecision,CompanyDocument,FinancialItem,ProposalSection,Tender,TenderOutcome,TenderRequirement,TenderReview,TenderSubmission,TenderTask
admin.site.register((Tender,TenderRequirement,BidDecision,TenderTask,CompanyDocument,ProposalSection,FinancialItem,TenderReview,TenderSubmission,TenderOutcome))

# Register your models here.
