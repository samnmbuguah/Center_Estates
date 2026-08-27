from rest_framework.routers import DefaultRouter

from .views import (
    AssetConditionAssessmentViewSet, AssetViewSet, ComplianceObligationViewSet,
    ContractorContractViewSet, ContractorViewSet, FacilityAnalyticsViewSet,
    FacilityDashboardViewSet, FacilityFlagViewSet, FacilityPortalViewSet,
    ContractInvoiceAppraisalViewSet, FacilityIncidentViewSet, FacilityJobCardViewSet,
    FacilityPaymentRecordViewSet, FacilityRiskViewSet, FinancePaymentRequestViewSet,
    FloorPlanViewSet, FMBudgetViewSet, FacilityExpenseViewSet, InspectionViewSet, LocalPurchaseOrderViewSet,
    MeterReadingViewSet, MeterReconciliationViewSet, MeterResetEventViewSet, PettyCashVoucherViewSet,
    PreventiveScheduleViewSet, ProcurementRecordViewSet, RepairRequisitionViewSet, ServiceProfileAllocationViewSet, ServiceProfileViewSet, ServiceRequestViewSet, StrategicFMPlanViewSet,
    SupplierInvoiceViewSet, UtilityMeterViewSet, WorkOrderAttachmentViewSet, WorkOrderCostItemViewSet,
    WorkOrderEventViewSet, WorkOrderViewSet,
)

router = DefaultRouter()
router.register('dashboard', FacilityDashboardViewSet, basename='facility-dashboard')
router.register('analytics', FacilityAnalyticsViewSet, basename='facility-analytics')
router.register('assets', AssetViewSet)
router.register('condition-assessments', AssetConditionAssessmentViewSet)
router.register('floor-plans', FloorPlanViewSet)
router.register('strategic-plans', StrategicFMPlanViewSet)
router.register('work-orders', WorkOrderViewSet)
router.register('planned-maintenance', PreventiveScheduleViewSet)
router.register('requisitions', RepairRequisitionViewSet)
router.register('procurements', ProcurementRecordViewSet)
router.register('lpos', LocalPurchaseOrderViewSet)
router.register('job-cards', FacilityJobCardViewSet)
router.register('supplier-invoices', SupplierInvoiceViewSet)
router.register('contract-invoice-appraisals', ContractInvoiceAppraisalViewSet)
router.register('payment-requests', FinancePaymentRequestViewSet)
router.register('payments', FacilityPaymentRecordViewSet)
router.register('petty-cash-vouchers', PettyCashVoucherViewSet)
router.register('inspections', InspectionViewSet)
router.register('service-requests', ServiceRequestViewSet)
router.register('service-profiles', ServiceProfileViewSet)
router.register('service-profile-allocations', ServiceProfileAllocationViewSet)
router.register('incidents', FacilityIncidentViewSet)
router.register('portal', FacilityPortalViewSet, basename='facility-portal')
router.register('meters', UtilityMeterViewSet)
router.register('meter-readings', MeterReadingViewSet)
router.register('meter-reset-events', MeterResetEventViewSet)
router.register('meter-reconciliations', MeterReconciliationViewSet)
router.register('contractors', ContractorViewSet)
router.register('contracts', ContractorContractViewSet)
router.register('budgets', FMBudgetViewSet)
router.register('expenses', FacilityExpenseViewSet)
router.register('compliance', ComplianceObligationViewSet)
router.register('risks', FacilityRiskViewSet)
router.register('flags', FacilityFlagViewSet)
router.register('work-order-events', WorkOrderEventViewSet)
router.register('work-order-cost-items', WorkOrderCostItemViewSet)
router.register('work-order-attachments', WorkOrderAttachmentViewSet)

urlpatterns = router.urls
