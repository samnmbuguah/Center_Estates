from django.conf import settings
from datetime import datetime
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import JsonResponse
from django.db import connection
from django.db.models import F, Q
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt, csrf_protect
import logging
import re
import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiTypes

from core.serializers import MembershipSerializer, serialize_modules
from core.models import ClientErrorEvent, CITestResult, FeatureTestProgress, Module
from core.tenancy import get_active_membership, get_active_organization
from core.property_scope import get_active_property, scope_model_queryset
from organizations.models import Membership

IMPERSONATOR_COOKIE = getattr(settings, 'JWT_IMPERSONATOR_COOKIE', 'ce_impersonator')
VISIBLE_DEMO_IDENTITIES = {
    'admin',
    'role-portfolio-manager',
    'role-finance-officer',
    'role-operations-staff',
    'role-read-only',
}

logger = logging.getLogger(__name__)


# Comprehensive acceptance catalogue covering all 36 core system features across 10 functional modules.
TEST_CHECKLIST = (
    # 1. Property Management & Assets
    ('property.onboarding', 'Property Management', 'Create, configure and onboard a property with title & mandate', '/property-onboarding'),
    ('property.units', 'Property Management', 'Manage units register, floor layouts and CSV bulk import', '/property?tab=units'),
    ('property.tenancy', 'Property Management', 'Create tenants, active leases, offer details and rent escalation', '/property?tab=tenancy'),
    ('property.owners', 'Property Management', 'Manage Sectional Title Scheme, landlord registry and mandates', '/property?tab=owners'),
    ('property.critical_dates', 'Property Management', 'Track lease expiry, rent escalation and critical date alerts', '/property?tab=critical-dates'),

    # 2. Invoicing & Billing Operations
    ('invoicing.billing_candidates', 'Invoicing & Billing', 'Scan monthly billing candidates and verify readiness', '/property?tab=billing'),
    ('invoicing.rent_schedules', 'Invoicing & Billing', 'Generate rent roll schedules and recurring charge rules', '/property?tab=rent-schedules'),
    ('invoicing.invoices', 'Invoicing & Billing', 'Dispatch institutional invoices, reminders and VAT lines', '/property?tab=invoices'),
    ('invoicing.credit_notes', 'Invoicing & Billing', 'Issue credit notes, invoice adjustments and balance reversals', '/property?tab=credit-notes'),
    ('invoicing.management_fees', 'Invoicing & Billing', 'Raise landlord management fee invoices from collected rent', '/property?tab=fees'),

    # 3. Finance, Receipts & Banking
    ('finance.receipting', 'Finance & Banking', 'Record payment receipts, multi-invoice auto-allocation and wallets', '/property?tab=receipts'),
    ('finance.bank_reconciliation', 'Finance & Banking', 'Import bank/M-Pesa statements and match against posted receipts', '/property?tab=bank-reconciliation'),
    ('finance.expenses', 'Finance & Banking', 'Record property operating expenses, budgets and approvals', '/property?tab=expenses'),
    ('finance.payment_gateways', 'Finance & Banking', 'Configure and test M-Pesa STK push & bank gateways', '/administration?tab=mpesa'),
    ('finance.arrears_recovery', 'Finance & Banking', 'Analyze arrears aging brackets and dispatch recovery notices', '/property?tab=arrears-recovery'),

    # 4. Service Charge Management
    ('service_charge.budgets', 'Service Charge', 'Prepare annual operational service charge budget and line estimates', '/property?tab=service-charge-budget'),
    ('service_charge.allocations', 'Service Charge', 'Apportion service charge across units by rateable area share', '/property?tab=service-charge-allocations'),
    ('service_charge.reconciliation', 'Service Charge', 'Conduct financial year-end service charge audit & balance reconciliation', '/property?tab=service-charge-reconciliation'),

    # 5. Facility Operations & Helpdesk
    ('facility.assets', 'Facility Operations', 'Register plant & equipment with lifecycle warranty and QR codes', '/facility?tab=assets'),
    ('facility.meters', 'Facility Operations', 'Record water & power meter readings with tariff billing', '/facility?tab=meter-readings'),
    ('facility.service_requests', 'Facility Operations', 'Raise occupant service requests, track SLA and resolve tickets', '/facility?tab=service-requests'),
    ('facility.work_orders', 'Facility Operations', 'Issue work orders, job cards and capture contractor sign-off', '/facility?tab=work-orders'),
    ('facility.ppm', 'Facility Operations', 'Schedule planned preventive maintenance routines and inspections', '/facility?tab=planned-maintenance'),
    ('facility.procurement', 'Facility Operations', 'Process purchase requisitions, RFQs and issue Local Purchase Orders (LPO)', '/facility?tab=procurement'),
    ('facility.contractors', 'Facility Operations', 'Onboard facility contractors, track SLAs and compliance scorecards', '/facility?tab=contractors'),
    ('facility.incidents', 'Facility Operations', 'Log safety incidents, conduct investigation and corrective action', '/facility?tab=incident-reporting'),
    ('facility.caretaker_portal', 'Facility Operations', 'Mobile caretaker portal for daily rounds, meter logs and inspections', '/caretaker-portal'),

    # 5b. Construction & Project Monitoring
    ('construction.projects', 'Construction & Projects', 'Register projects, lifecycle stages and per-property module entitlement', '/monitoring'),
    ('construction.progress_verification', 'Construction & Projects', 'Verify submitted milestone progress with recorded decisions', '/monitoring?tab=milestone-verifications'),
    ('construction.suppliers', 'Construction & Projects', 'Maintain the approved supplier register for site procurement', '/monitoring?tab=store-suppliers'),
    ('construction.material_requisitions', 'Construction & Projects', 'Raise, approve and fulfil site material requisitions', '/monitoring?tab=material-requisitions'),
    ('construction.purchase_orders', 'Construction & Projects', 'Issue purchase orders to suppliers and receive goods', '/monitoring?tab=purchase-orders'),
    ('construction.stock_ledger', 'Construction & Projects', 'Track store stock movements, receipts and site issues', '/monitoring?tab=stock-movements'),

    # 6. Commercial, Sales & Valuations
    ('sales.pipeline', 'Sales & Valuations', 'Manage buyer leads, property inquiries and unit reservations', '/sales?tab=pipeline'),
    ('sales.deals', 'Sales & Valuations', 'Contract sale transactions, payment milestones and commissions', '/sales?tab=deals'),
    ('valuations.instructions', 'Sales & Valuations', 'Execute valuation instructions, site inspection notes and reports', '/valuations'),
    ('tenders.procurement', 'Sales & Valuations', 'Publish tender packages, evaluate vendor bids and award contracts', '/tenders'),

    # 7. AI Copilot & Companion
    ('companion.qm', 'AI Companion', 'Engage Quartermaster AI copilot for portfolio insights and tool execution', '/companion?tab=quartermaster'),
    ('companion.tasks', 'AI Companion', 'Create, assign, collaborate and track operational team tasks', '/companion?tab=my-tasks'),
    ('companion.dialogue', 'AI Companion', 'Dispatch team operational broadcasts and property channel messages', '/companion?tab=team'),

    # 8. Tenant & Client Portals
    ('portals.tenant', 'Client Portals', 'Tenant portal self-service for statements, payments and requests', '/tenant-portal'),
    ('portals.landlord', 'Client Portals', 'Landlord executive portal for monthly remittance & portfolio health', '/property?tab=owner-portal'),
    ('portals.buyer', 'Client Portals', 'Buyer self-service portal for agreements, installments and payments', '/buyer-portal'),
    ('portals.agent', 'Client Portals', 'Sales agent portal for leads, deals, visits and commissions', '/agent-portal'),

    # 9. Reports & Compliance
    ('reports.tenancy', 'Reports & Compliance', 'Generate occupancy, vacancy and tenancy register reports', '/property?tab=tenancy-reports'),
    ('reports.financial', 'Reports & Compliance', 'Generate receipts & expenditure, tax and revenue schedule reports', '/property?tab=financial-reports'),
    ('reports.analytics', 'Reports & Compliance', 'Run and export grouped sales & portfolio analytics with audit trail', '/sales?tab=reports'),
    ('reports.dossier', 'Reports & Compliance', 'Export bank-grade institutional property audit report PDF', '/overview'),

    # 10. Administration & Governance
    ('admin.organization', 'Administration', 'Manage organization profile, multi-branch entities and module licenses', '/administration?tab=orgs'),
    ('admin.security_audit', 'Administration', 'Inspect immutable security audit trail and system event logs', '/administration?tab=audit'),
)


def auto_detect_organization_activity(organization, user=None):
    """Scan live operational database records to automatically verify workflows exercised by the team."""
    detected = {}
    
    try:
        from properties.models import Property, Unit, Tenant, Lease, Owner, Invoice, CreditNote, Receipt, BankTransaction, Expense, Budget, ServiceChargeAllocation, ServiceChargeReconciliation, RentSchedule, BillingCandidate, LandlordInvoice, ReportExecution
        from construction.models import Project, StoreSupplier, MaterialRequisition, PurchaseOrder, StockMovement, MilestoneVerification
        from facilities.models import (
            Contractor,
            FacilityAsset,
            FacilityIncident,
            MeterReading,
            PreventiveSchedule,
            RepairRequisition,
            ServiceRequest,
            WorkOrder,
        )
        from companion.models import Task, QmConversation, CompanionAnnouncement
        from audit.models import AuditEvent

        # 1. Property Management
        prop_count = Property.objects.filter(organization=organization).count()
        if prop_count > 0:
            detected['property.onboarding'] = f"Auto-verified: {prop_count} property asset(s) active in organization."
        
        unit_count = Unit.objects.filter(organization=organization).count()
        if unit_count > 0:
            detected['property.units'] = f"Auto-verified: {unit_count} unit(s) registered with specifications."

        lease_count = Lease.objects.filter(organization=organization).count()
        tenant_count = Tenant.objects.filter(organization=organization).count()
        if lease_count > 0 or tenant_count > 0:
            detected['property.tenancy'] = f"Auto-verified: {tenant_count} tenant(s) and {lease_count} active lease agreement(s)."

        owner_count = Owner.objects.filter(organization=organization).count()
        if owner_count > 0:
            detected['property.owners'] = f"Auto-verified: {owner_count} landlord / owner profile(s) mapped."

        if Lease.objects.filter(organization=organization, ends_on__isnull=False).exists():
            detected['property.critical_dates'] = "Auto-verified: Lease maturity schedules and alerts active."

        # 2. Invoicing & Billing
        cand_count = BillingCandidate.objects.filter(organization=organization).count()
        if cand_count > 0:
            detected['invoicing.billing_candidates'] = f"Auto-verified: {cand_count} billing candidates evaluated."
        
        sched_count = RentSchedule.objects.filter(organization=organization).count()
        if sched_count > 0:
            detected['invoicing.rent_schedules'] = f"Auto-verified: {sched_count} rent roll schedule lines defined."

        inv_count = Invoice.objects.filter(organization=organization).count()
        if inv_count > 0:
            detected['invoicing.invoices'] = f"Auto-verified: {inv_count} invoice(s) generated and tracked."

        cn_count = CreditNote.objects.filter(organization=organization).count()
        if cn_count > 0:
            detected['invoicing.credit_notes'] = f"Auto-verified: {cn_count} credit adjustment(s) posted."

        li_count = LandlordInvoice.objects.filter(organization=organization).count()
        if li_count > 0:
            detected['invoicing.management_fees'] = f"Auto-verified: {li_count} landlord management fee invoice(s) raised."

        # 3. Finance & Banking
        rct_count = Receipt.objects.filter(organization=organization).count()
        if rct_count > 0:
            detected['finance.receipting'] = f"Auto-verified: {rct_count} payment receipt(s) issued & allocated."

        bt_count = BankTransaction.objects.filter(organization=organization).count()
        if bt_count > 0:
            detected['finance.bank_reconciliation'] = f"Auto-verified: {bt_count} bank / M-Pesa statement transactions imported."

        exp_count = Expense.objects.filter(organization=organization).count()
        if exp_count > 0:
            detected['finance.expenses'] = f"Auto-verified: {exp_count} operating expense item(s) logged."

        # 4. Service Charge
        bud_count = Budget.objects.filter(organization=organization).count()
        if bud_count > 0:
            detected['service_charge.budgets'] = f"Auto-verified: {bud_count} operational budget line(s) defined."

        sca_count = ServiceChargeAllocation.objects.filter(organization=organization).count()
        if sca_count > 0:
            detected['service_charge.allocations'] = f"Auto-verified: {sca_count} unit service charge apportionment(s) mapped."

        scr_count = ServiceChargeReconciliation.objects.filter(organization=organization).count()
        if scr_count > 0:
            detected['service_charge.reconciliation'] = f"Auto-verified: {scr_count} service charge audit reconciliation(s) executed."

        # 5. Facility Operations
        asset_count = FacilityAsset.objects.filter(organization=organization).count()
        if asset_count > 0:
            detected['facility.assets'] = f"Auto-verified: {asset_count} equipment asset(s) tagged in registry."

        meter_count = MeterReading.objects.filter(organization=organization).count()
        if meter_count > 0:
            detected['facility.meters'] = f"Auto-verified: {meter_count} utility meter reading(s) submitted."

        sr_count = ServiceRequest.objects.filter(organization=organization).count()
        if sr_count > 0:
            detected['facility.service_requests'] = f"Auto-verified: {sr_count} occupant service request ticket(s) raised."

        wo_count = WorkOrder.objects.filter(organization=organization).count()
        if wo_count > 0:
            detected['facility.work_orders'] = f"Auto-verified: {wo_count} maintenance work order job card(s) dispatched."

        ppm_count = PreventiveSchedule.objects.filter(organization=organization).count()
        if ppm_count > 0:
            detected['facility.ppm'] = f"Auto-verified: {ppm_count} planned preventive maintenance schedule(s) active."

        req_count = RepairRequisition.objects.filter(organization=organization).count()
        if req_count > 0:
            detected['facility.procurement'] = f"Auto-verified: {req_count} purchase requisition(s) / LPO(s) generated."

        sp_count = Contractor.objects.filter(organization=organization).count()
        if sp_count > 0:
            detected['facility.contractors'] = f"Auto-verified: {sp_count} approved contractor profile(s) engaged."

        inc_count = FacilityIncident.objects.filter(organization=organization).count()
        if inc_count > 0:
            detected['facility.incidents'] = f"Auto-verified: {inc_count} safety incident report(s) documented."

        # 5b. Construction & Project Monitoring
        proj_count = Project.objects.filter(organization=organization).count()
        if proj_count > 0:
            detected['construction.projects'] = f"Auto-verified: {proj_count} project(s) registered with lifecycle stages."

        mv_count = MilestoneVerification.objects.filter(milestone_entry__organization=organization).count()
        if mv_count > 0:
            detected['construction.progress_verification'] = f"Auto-verified: {mv_count} milestone progress verification(s) recorded."

        sup_count = StoreSupplier.objects.filter(organization=organization).count()
        if sup_count > 0:
            detected['construction.suppliers'] = f"Auto-verified: {sup_count} approved supplier profile(s) on the register."

        mr_count = MaterialRequisition.objects.filter(organization=organization).count()
        if mr_count > 0:
            detected['construction.material_requisitions'] = f"Auto-verified: {mr_count} material requisition(s) raised on site."

        po_count = PurchaseOrder.objects.filter(organization=organization).count()
        if po_count > 0:
            detected['construction.purchase_orders'] = f"Auto-verified: {po_count} purchase order(s) issued to suppliers."

        sm_count = StockMovement.objects.filter(organization=organization).count()
        if sm_count > 0:
            detected['construction.stock_ledger'] = f"Auto-verified: {sm_count} store stock movement(s) recorded."

        # 6. AI Companion & Dialogue
        conv_count = QmConversation.objects.filter(organization=organization).count()
        if conv_count > 0:
            detected['companion.qm'] = f"Auto-verified: {conv_count} AI Quartermaster conversation(s) held."

        task_count = Task.objects.filter(organization=organization).count()
        if task_count > 0:
            detected['companion.tasks'] = f"Auto-verified: {task_count} team task(s) assigned & tracked."

        ann_count = CompanionAnnouncement.objects.filter(organization=organization).count()
        if ann_count > 0:
            detected['companion.dialogue'] = f"Auto-verified: {ann_count} team broadcast announcement(s) published."

        # 7. Reports & Compliance
        report_count = ReportExecution.objects.filter(organization=organization).count()
        if report_count > 0:
            detected['reports.analytics'] = f"Auto-verified: {report_count} report execution(s) logged in the audit trail."

        # 8. Administration & Governance
        detected['admin.organization'] = f"Auto-verified: Active organization entity '{organization.name}' verified."
        
        audit_count = AuditEvent.objects.filter(organization=organization).count()
        if audit_count > 0:
            detected['admin.security_audit'] = f"Auto-verified: {audit_count} immutable security audit events recorded."

    except Exception:
        logger.exception(
            "System usage auto-scan failed for organization %s",
            organization.pk,
        )
        raise

    return detected


class TestingChecklistView(APIView):
    """Collaborative acceptance testing hub with persistent evidence and automated usage detection."""

    permission_classes = (IsAuthenticated,)

    def _get_organization(self, request):
        organization = get_active_organization(request, required=False)
        if not organization:
            return None
        if request.user.is_superuser:
            return organization
        membership = get_active_membership(request, organization)
        if not membership:
            return None
        return organization

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        organization = self._get_organization(request)
        if not organization:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        
        progress_by_key = {
            row.feature_key: row for row in FeatureTestProgress.objects.filter(organization=organization).select_related('tested_by')
        }
        items = []
        counts = {status: 0 for status in FeatureTestProgress.Status.values}
        verified_by_testing = 0
        verified_by_activity = 0
        for key, module, title, url in TEST_CHECKLIST:
            progress = progress_by_key.get(key)
            status = progress.status if progress else FeatureTestProgress.Status.NOT_STARTED
            counts[status] += 1
            is_auto_verified = 'Auto-verified' in (progress.notes if progress else '')
            if status == FeatureTestProgress.Status.PASSED:
                # Distinguish a workflow a human explicitly verified from one
                # inferred purely from the presence of operational records.
                if is_auto_verified:
                    verified_by_activity += 1
                else:
                    verified_by_testing += 1
            items.append({
                'key': key, 'module': module, 'title': title, 'url': url, 'status': status,
                'notes': progress.notes if progress else '', 'evidence_url': progress.evidence_url if progress else '',
                'tested_at': progress.tested_at if progress else None,
                'tested_by': progress.tested_by.get_full_name() or progress.tested_by.get_username() if progress and progress.tested_by else '',
                'is_auto_verified': is_auto_verified,
            })
        total = len(items)
        passed = counts[FeatureTestProgress.Status.PASSED]
        return Response({
            'results': items,
            'summary': counts,
            'total': total,
            'organization_name': organization.name,
            'auto_detected_count': 0,
            # Two distinct signals: workflows a person verified against the
            # running release, versus workflows inferred from record activity.
            'verified_by_testing': verified_by_testing,
            'verified_by_activity': verified_by_activity,
            'readiness_index': round((verified_by_testing / max(total, 1)) * 100),
            'usage_index': round((passed / max(total, 1)) * 100),
        })

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def patch(self, request, feature_key):
        organization = self._get_organization(request)
        if not organization:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        if feature_key not in {item[0] for item in TEST_CHECKLIST}:
            return Response({'detail': 'Unknown checklist item.'}, status=404)
        status = request.data.get('status')
        if status not in FeatureTestProgress.Status.values:
            return Response({'detail': 'Choose a valid checklist status.'}, status=400)
        notes = str(request.data.get('notes', ''))[:4000]
        evidence_url = str(request.data.get('evidence_url', ''))[:500]
        progress, _ = FeatureTestProgress.objects.get_or_create(organization=organization, feature_key=feature_key)
        progress.status = status
        progress.notes = notes
        progress.evidence_url = evidence_url
        progress.tested_by = request.user
        progress.tested_at = timezone.now() if status != FeatureTestProgress.Status.NOT_STARTED else None
        progress.save()
        return Response({'key': feature_key, 'status': progress.status, 'tested_at': progress.tested_at})


class TestingAutoScanView(APIView):
    """Trigger an automated system usage scan to auto-verify active workflows."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        organization = get_active_organization(request)
        if not organization:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        
        detected = auto_detect_organization_activity(organization, request.user)
        updated_count = 0
        for key, evidence in detected.items():
            progress, _ = FeatureTestProgress.objects.get_or_create(organization=organization, feature_key=key)
            if progress.status != FeatureTestProgress.Status.PASSED:
                progress.status = FeatureTestProgress.Status.PASSED
                progress.notes = evidence
                progress.tested_by = request.user
                progress.tested_at = timezone.now()
                progress.save()
                updated_count += 1
            elif not progress.notes:
                progress.notes = evidence
                progress.save(update_fields=('notes',))

        return Response({
            'status': 'success',
            'detected_features': len(detected),
            'newly_verified': updated_count,
            'message': f"Scan complete: {len(detected)} live feature workflows auto-verified across database entities.",
        })


class TestingAIAuditView(APIView):
    """AI Quartermaster Quality Assurance & Release Readiness Audit."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        organization = get_active_organization(request)
        if not organization:
            return Response({'detail': 'An active organization membership is required.'}, status=403)

        progress_qs = FeatureTestProgress.objects.filter(organization=organization)
        passed_count = progress_qs.filter(status=FeatureTestProgress.Status.PASSED).count()
        failed_count = progress_qs.filter(status=FeatureTestProgress.Status.FAILED).count()
        blocked_count = progress_qs.filter(status=FeatureTestProgress.Status.BLOCKED).count()
        total_features = len(TEST_CHECKLIST)
        untested_count = total_features - (passed_count + failed_count + blocked_count)
        auto_verified_count = progress_qs.filter(
            status=FeatureTestProgress.Status.PASSED, notes__contains='Auto-verified',
        ).count()
        verified_by_testing = passed_count - auto_verified_count
        score = round((passed_count / max(total_features, 1)) * 100)
        readiness_index = round((verified_by_testing / max(total_features, 1)) * 100)

        # Build prompt for AI Quartermaster
        try:
            from companion.qm_agent import QMAgentOrchestrator
            qm = QMAgentOrchestrator(organization_name=organization.name)
            if qm.configured:
                system_prompt = (
                    f"You are Quartermaster, the institutional AI Quality Assurance & ERP Auditor for {organization.name}. "
                    "Analyze the release readiness checklist and give an executive QA evaluation with recommendations."
                )
                user_content = (
                    f"Organization: {organization.name}\n"
                    f"Testing Readiness Score: {score}%\n"
                    f"Verified against the release by a tester: {verified_by_testing}/{total_features} ({readiness_index}%)\n"
                    f"Auto-detected from record activity only: {auto_verified_count}\n"
                    f"Passed Features: {passed_count}/{total_features}\n"
                    f"Failed Features: {failed_count}\n"
                    f"Blocked Features: {blocked_count}\n"
                    f"Untested Features: {untested_count}\n\n"
                    "Provide a crisp 3-section institutional audit briefing:\n"
                    "1. Executive Release Readiness Verdict (Production Ready, Conditional Staging, or Gaps Detected)\n"
                    "2. Key Operational Strengths (exercised workflows with live database verification)\n"
                    "3. Recommended Next Testing Steps before sign-off."
                )
                ai_response = qm.chat(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ]
                )
                assessment_text = ai_response.get("content") or "AI QA analysis generated successfully."
            else:
                assessment_text = f"Automated Readiness Score is {score}%. {passed_count} of {total_features} features verified with operational data."
        except Exception as exc:
            assessment_text = f"Readiness Index: {score}%. {passed_count} workflows verified across property, billing, banking, and facility modules."

        return Response({
            'score': score,
            'readiness_index': readiness_index,
            'verified_by_testing': verified_by_testing,
            'auto_verified_count': auto_verified_count,
            'passed_count': passed_count,
            'total_features': total_features,
            # The verdict is driven by evidence a tester produced against the
            # running release, not by activity inferred from stored records.
            'verdict': 'PRODUCTION_READY' if readiness_index >= 85 else 'STAGING_VERIFIED' if readiness_index >= 50 else 'IN_PROGRESS',
            'assessment': assessment_text,
            'evaluated_at': timezone.now().isoformat(),
        })


class TestingCIStatusView(APIView):
    """Return the latest CI acceptance-run status stored in the database.

    Results are pushed by the CI pipeline via POST /testing/ci-results/.
    """

    permission_classes = (IsAuthenticated,)

    @staticmethod
    def _check_admin(request):
        organization = get_active_organization(request, required=False)
        if not organization:
            return None
        if request.user.is_superuser:
            return organization
        membership = get_active_membership(request, organization)
        if not membership:
            return None
        return organization

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        if not self._check_admin(request):
            return Response({'detail': 'An active organization membership is required.'}, status=403)

        result = CITestResult.objects.first()
        if not result:
            return Response({'status': 'unavailable', 'detail': 'No CI results recorded yet.'})
        return Response({
            'status': 'fetched',
            'run_id': result.run_number,
            'run_number': result.run_number,
            'conclusion': result.conclusion,
            'total_specs': result.total_specs,
            'passed_specs': result.passed_specs,
            'failed_specs': result.failed_specs,
            'head_sha': result.head_sha,
            'run_url': result.run_url,
            'created_at': result.created_at.isoformat(),
            'branch': result.branch,
        })


class TestingCIResultsView(APIView):
    """Receive a CI acceptance-run result pushed by the CI pipeline."""

    permission_classes = (IsAuthenticated,)

    @staticmethod
    def _check_admin(request):
        organization = get_active_organization(request, required=False)
        if not organization:
            return None
        if request.user.is_superuser:
            return organization
        membership = get_active_membership(request, organization)
        if not membership:
            return None
        return organization

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        if not self._check_admin(request):
            return Response({'detail': 'An active organization membership is required.'}, status=403)

        run_number = request.data.get('run_number')
        conclusion = request.data.get('conclusion', '')
        if not run_number or not conclusion:
            return Response({'detail': 'run_number and conclusion are required.'}, status=400)

        result = CITestResult.objects.create(
            run_number=int(run_number),
            conclusion=str(conclusion)[:20],
            total_specs=int(request.data.get('total_specs', 0)),
            passed_specs=int(request.data.get('passed_specs', 0)),
            failed_specs=int(request.data.get('failed_specs', 0)),
            head_sha=str(request.data.get('head_sha', ''))[:40],
            run_url=str(request.data.get('run_url', ''))[:500],
            branch=str(request.data.get('branch', ''))[:100],
        )
        return Response({'status': 'ok', 'id': result.id})


class CalendarFeedView(APIView):
    """Role-aware portfolio/property calendar assembled from source records."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def get(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not membership:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        membership = Membership.objects.prefetch_related('roles__permissions').get(pk=membership.pk)
        subscribed = set(organization.subscriptions.available().values_list('module', flat=True))
        permission_keys = {
            permission.key for role in membership.roles.all() for permission in role.permissions.all()
        }
        is_admin = membership.is_organization_admin or request.user.is_superuser

        def can(module):
            return module in subscribed and (is_admin or any(key.startswith(f'{module}.') for key in permission_keys))

        today = timezone.localdate()
        starts_on = parse_date(request.query_params.get('start', '')) or today - timezone.timedelta(days=90)
        ends_on = parse_date(request.query_params.get('end', '')) or today + timezone.timedelta(days=365)
        if ends_on < starts_on or (ends_on - starts_on).days > 1095:
            return Response({'detail': 'Choose a valid calendar range of no more than three years.'}, status=400)
        active_property = get_active_property(request, organization)
        events = []

        def add(*, key, title, start, event_type, module, source_url, property_record=None,
                end=None, status='scheduled', priority='normal', subtitle='', all_day=True):
            if not start:
                return
            event_date = start.date() if isinstance(start, datetime) else start
            if event_date < starts_on or event_date > ends_on:
                return
            property_id = str(property_record.id) if property_record else None
            if active_property and property_id != str(active_property.id):
                return
            events.append({
                'id': key, 'title': title, 'starts_at': start.isoformat(),
                'ends_at': (end or start).isoformat(), 'all_day': all_day,
                'event_type': event_type, 'module': module, 'status': status,
                'priority': priority, 'subtitle': subtitle, 'source_url': source_url,
                'property': property_id, 'property_name': property_record.name if property_record else '',
            })

        if can(Module.PROPERTY):
            from properties.models import Invoice, Lease, RentSchedule, TenantDocument
            from documents.models import Document
            from properties.models import Property
            for lease in scope_model_queryset(Lease, request, organization).select_related('tenant', 'unit__property'):
                prop = lease.unit.property
                add(key=f'lease-start:{lease.pk}', title=f'Lease starts · {lease.tenant.name}', start=lease.starts_on,
                    event_type='lease_start', module='property', property_record=prop, status=lease.status,
                    subtitle=f'{lease.reference} · Unit {lease.unit.code}', source_url='/property?tab=leases')
                add(key=f'lease-expiry:{lease.pk}', title=f'Lease expires · {lease.tenant.name}', start=lease.ends_on,
                    event_type='lease_expiry', module='property', property_record=prop,
                    status='overdue' if lease.ends_on < today and lease.status not in (Lease.Status.EXPIRED, Lease.Status.TERMINATED) else lease.status,
                    priority='high', subtitle=f'{lease.reference} · Unit {lease.unit.code}', source_url='/property?tab=critical-dates')
            for invoice in scope_model_queryset(Invoice, request, organization).select_related(
                'lease__tenant', 'lease__unit__property', 'unit__property', 'owner',
            ).exclude(status=Invoice.Status.VOID):
                # Invoices may be raised against a lease (tenant rent) or directly
                # against a unit/owner (sectional service charge), so the lease can
                # legitimately be null.
                if invoice.lease_id:
                    prop = invoice.lease.unit.property
                    party_name = invoice.lease.tenant.name
                else:
                    prop = invoice.unit.property if invoice.unit_id else None
                    party_name = invoice.owner.name if invoice.owner_id else 'Owner'
                add(key=f'invoice-due:{invoice.pk}', title=f'Invoice due · {party_name}', start=invoice.due_on,
                    event_type='invoice_due', module='property', property_record=prop,
                    status='overdue' if invoice.due_on < today and invoice.balance > 0 else invoice.status,
                    priority='high' if invoice.balance > 0 else 'normal', subtitle=f'{invoice.number} · KES {invoice.balance:,.2f}', source_url='/property?tab=rent')
            for schedule in scope_model_queryset(RentSchedule, request, organization).select_related('lease__tenant', 'lease__unit__property').exclude(status=RentSchedule.Status.WAIVED):
                add(key=f'rent-due:{schedule.pk}', title=f'Rent due · {schedule.lease.tenant.name}', start=schedule.due_on,
                    event_type='rent_due', module='property', property_record=schedule.lease.unit.property,
                    status=schedule.status, subtitle=f'Unit {schedule.lease.unit.code}', source_url='/property?tab=rent-schedules')
            for document in scope_model_queryset(TenantDocument, request, organization).filter(expires_on__isnull=False).select_related('tenant__property'):
                add(key=f'tenant-document:{document.pk}', title=f'{document.document_type} expires · {document.tenant.name}', start=document.expires_on,
                    event_type='document_expiry', module='property', property_record=document.tenant.property,
                    status='overdue' if document.expires_on < today and document.status != TenantDocument.Status.EXPIRED else document.status,
                    priority='high', subtitle=document.document_number, source_url='/property?tab=tenant-documents')
            properties_by_id = {str(prop.pk): prop for prop in Property.objects.for_organization(organization)}
            for document in Document.objects.for_organization(organization).filter(expires_on__isnull=False, category__startswith='property_'):
                prop = properties_by_id.get(str(document.metadata.get('property_id', '')))
                if prop:
                    add(key=f'property-document:{document.pk}', title=f'Document expires · {document.title}', start=document.expires_on,
                        event_type='document_expiry', module='property', property_record=prop,
                        status='overdue' if document.expires_on < today else document.status, priority='high',
                        subtitle=document.original_filename, source_url='/property?tab=properties')

        if can(Module.FACILITY):
            from facilities.models import Inspection, PreventiveSchedule, ServiceRequest, WorkOrder
            for inspection in scope_model_queryset(Inspection, request, organization).select_related('property', 'inspector'):
                inspector_name = inspection.inspector.get_username() if inspection.inspector else 'Unassigned'
                add(key=f'inspection:{inspection.pk}', title=inspection.title, start=inspection.scheduled_on,
                    event_type='inspection', module='facility', property_record=inspection.property, status=inspection.status,
                    subtitle=f'{inspection.reference} · {inspector_name}', source_url='/facility?tab=inspections')
            for schedule in scope_model_queryset(PreventiveSchedule, request, organization).select_related('asset__property').filter(is_active=True):
                add(key=f'ppm:{schedule.pk}', title=f'Preventive maintenance · {schedule.name}', start=schedule.next_due_on,
                    event_type='maintenance', module='facility', property_record=schedule.asset.property,
                    status='overdue' if schedule.next_due_on < today else 'scheduled', subtitle=schedule.code,
                    priority='high' if schedule.next_due_on < today else 'normal', source_url='/facility?tab=planned-maintenance')
            orders = scope_model_queryset(WorkOrder, request, organization).select_related('property')
            for order in orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)):
                due = order.scheduled_for or order.resolution_due_at or order.response_due_at
                if due:
                    add(key=f'work-order:{order.pk}', title=f'Work order · {order.title}', start=due,
                        event_type='work_order', module='facility', property_record=order.property, status=order.status,
                        priority=order.priority, subtitle=order.number, source_url='/facility?tab=work-orders', all_day=False)
            requests = scope_model_queryset(ServiceRequest, request, organization).select_related('property').exclude(status__in=(ServiceRequest.Status.RESOLVED, ServiceRequest.Status.CLOSED, ServiceRequest.Status.REJECTED))
            for service_request in requests.filter(response_due_at__isnull=False):
                add(key=f'service-request:{service_request.pk}', title=f'Service response due · {service_request.subject}', start=service_request.response_due_at,
                    event_type='service_sla', module='facility', property_record=service_request.property,
                    status='overdue' if service_request.response_due_at < timezone.now() else service_request.status,
                    priority=service_request.priority, subtitle=service_request.reference, source_url='/facility?tab=service-requests', all_day=False)

        if can(Module.COMPANION):
            from companion.models import Task
            tasks = scope_model_queryset(Task, request, organization).filter(due_at__isnull=False)
            if not is_admin:
                tasks = tasks.filter(Q(assignee=request.user) | Q(assigned_by=request.user))
            for task in tasks.select_related('property', 'assignee'):
                assignee_name = task.assignee.get_username() if task.assignee else 'Unassigned'
                add(key=f'task:{task.pk}', title=task.title, start=task.due_at,
                    event_type='task', module='companion', property_record=task.property, status=task.status,
                    priority=task.priority, subtitle=f'{task.reference} · {assignee_name}', source_url='/companion', all_day=False)

        events.sort(key=lambda event: (event['starts_at'], event['title']))
        return Response({'results': events, 'count': len(events), 'start': starts_on, 'end': ends_on})


class TicketsFeedView(APIView):
    """Role-aware, cross-cutting tickets and operational issues feed assembled from active modules.
    
    Tickets are a cross-cutting feature available to all authenticated organization members,
    not a module-specific feature. Users will see tickets from modules they have access to.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def get(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        is_admin = getattr(request.user, 'is_superuser', False) or (membership and membership.is_organization_admin)
        if not membership and not is_admin:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        if membership:
            membership = Membership.objects.prefetch_related('roles__permissions').get(pk=membership.pk)
            permission_keys = {
                permission.key for role in membership.roles.all() for permission in role.permissions.all()
            }
        else:
            permission_keys = set()
        subscribed = set(organization.subscriptions.available().values_list('module', flat=True)) if organization else set()

        def can(module):
            return is_admin or (module in subscribed and any(key.startswith(f'{module}.') for key in permission_keys))

        active_property = get_active_property(request, organization)
        module_filter = str(request.query_params.get('module', '')).strip().lower()
        tickets = []

        def add(*, id, reference, title, description, priority, status, module, source_url,
                property_record=None, assigned_to=None, raised_by=None, created_at=None, updated_at=None):
            property_id = str(property_record.id) if property_record else None
            if active_property and property_id and property_id != str(active_property.id):
                return
            if active_property and not property_id:
                return
            tickets.append({
                'id': str(id),
                'reference': reference or f'TICKET-{id}',
                'title': title or 'Untitled Ticket',
                'description': description or '',
                'priority': priority or 'normal',
                'status': status or 'open',
                'module': module,
                'source_url': source_url,
                'property': property_id,
                'property_name': property_record.name if property_record else '',
                'assigned_to': str(assigned_to) if assigned_to else '',
                'raised_by': str(raised_by) if raised_by else '',
                'created_at': created_at.isoformat() if created_at else None,
                'updated_at': updated_at.isoformat() if updated_at else None,
            })

        # Include companion tasks for all organization members (core feature, not module-gated)
        if organization:
            try:
                from companion.models import Task
                companion_tasks = scope_model_queryset(Task, request, organization).select_related('property', 'assignee', 'assigned_by').order_by('-updated_at')[:50]
                if not is_admin:
                    companion_tasks = companion_tasks.filter(Q(assignee=request.user) | Q(assigned_by=request.user))
                for task in companion_tasks:
                    add(
                        id=f'task:{task.pk}',
                        reference=task.reference,
                        title=task.title,
                        description=task.description,
                        priority=task.priority,
                        status=task.status,
                        module='companion',
                        source_url='/companion',
                        property_record=task.property,
                        assigned_to=task.assignee.get_username() if task.assignee else None,
                        raised_by=task.assigned_by.get_username() if task.assigned_by else None,
                        created_at=task.created_at,
                        updated_at=task.updated_at,
                    )
            except Exception:
                pass

        # Include module-specific tickets only if user has module access
        if can(Module.FACILITY) or can(Module.PROPERTY):
            from facilities.models import FacilityIncident, WorkOrder, ServiceRequest
            from companion.models import TeamFeedbackThread
            # Respect actual thread.module verbatim — don't hard-code 'facility'
            feedback_threads = scope_model_queryset(TeamFeedbackThread, request, organization).select_related(
                'property', 'assigned_to', 'created_by'
            ).order_by('-updated_at')
            is_dev_team = is_admin or (membership and membership.roles.filter(slug__in=['engineering', 'developer', 'platform-admin']).exists())
            if not is_dev_team:
                feedback_threads = feedback_threads.exclude(
                    Q(category=TeamFeedbackThread.FeedbackType.BUG)
                    & ~Q(created_by=request.user)
                    & ~Q(assigned_to=request.user)
                )
            feedback_threads = feedback_threads[:100]
            for thread in feedback_threads:
                first_message = thread.messages.order_by('created_at').values_list('message', flat=True).first()
                thread_module = thread.module or 'facility'
                add(
                    id=f'feedback:{thread.pk}',
                    reference=thread.ticket_no or thread.reference,
                    title=thread.title,
                    description=first_message or '',
                    priority=thread.priority,
                    status=thread.status,
                    module=thread_module,
                    source_url=f'/companion?tab=feedback&thread={thread.pk}',
                    property_record=thread.property,
                    assigned_to=thread.assigned_to.get_username() if thread.assigned_to else thread.assigned_team,
                    raised_by=thread.requester_name or (thread.created_by.get_username() if thread.created_by else None),
                    created_at=thread.created_at,
                    updated_at=thread.updated_at,
                )
            for order in scope_model_queryset(WorkOrder, request, organization).select_related('property', 'assigned_to', 'reported_by').order_by('-reported_at')[:50]:
                add(
                    id=f'work-order:{order.pk}',
                    reference=order.number,
                    title=order.title,
                    description=order.description,
                    priority=order.priority,
                    status=order.status,
                    module='facility',
                    source_url='/facility?tab=work-orders',
                    property_record=order.property,
                    assigned_to=order.assigned_to.get_username() if order.assigned_to else None,
                    raised_by=order.reported_by.get_username() if order.reported_by else None,
                    created_at=order.reported_at,
                    updated_at=getattr(order, 'updated_at', order.reported_at),
                )
            for req in scope_model_queryset(ServiceRequest, request, organization).select_related('property', 'tenant', 'work_order__assigned_to').order_by('-submitted_at')[:50]:
                add(
                    id=f'service-request:{req.pk}',
                    reference=req.reference,
                    title=req.subject,
                    description=req.description,
                    priority=req.priority,
                    status=req.status,
                    module='facility',
                    source_url='/facility?tab=service-requests',
                    property_record=req.property,
                    assigned_to=req.work_order.assigned_to.get_username() if req.work_order and req.work_order.assigned_to else None,
                    raised_by=req.tenant.name if req.tenant else None,
                    created_at=req.submitted_at,
                    updated_at=getattr(req, 'updated_at', req.submitted_at),
                )
            for incident in scope_model_queryset(FacilityIncident, request, organization).select_related('property', 'reported_by', 'reviewed_by').exclude(status__in=(FacilityIncident.Status.RESOLVED, FacilityIncident.Status.CLOSED)).order_by('-occurred_at')[:30]:
                add(
                    id=f'incident:{incident.pk}',
                    reference=incident.reference,
                    title=f'{incident.category} — {incident.location}',
                    description=incident.narrative[:200] if incident.narrative else '',
                    priority=incident.severity,
                    status=incident.status,
                    module='facility',
                    source_url='/facility?tab=incidents',
                    property_record=incident.property,
                    assigned_to=incident.reviewed_by.get_username() if incident.reviewed_by else None,
                    raised_by=incident.reported_by.get_username() if incident.reported_by else None,
                    created_at=incident.occurred_at,
                    updated_at=getattr(incident, 'updated_at', incident.occurred_at),
                )

        if can(Module.MONITORING):
            try:
                from construction.models import Ticket as ConstructionTicket
                for ticket in scope_model_queryset(ConstructionTicket, request, organization).select_related('project__property', 'assigned_to', 'raised_by').order_by('-updated_at')[:50]:
                    add(
                        id=f'site-ticket:{ticket.pk}',
                        reference=ticket.reference,
                        title=ticket.title,
                        description=ticket.body,
                        priority=ticket.priority,
                        status=ticket.status,
                        module='monitoring',
                        source_url='/monitoring?tab=tickets',
                        property_record=getattr(ticket.project, 'property', None),
                        assigned_to=ticket.assigned_to.get_username() if ticket.assigned_to else None,
                        raised_by=ticket.raised_by.get_username() if ticket.raised_by else None,
                        created_at=ticket.created_at,
                        updated_at=ticket.updated_at,
                    )
            except Exception:
                pass

        # Apply module filter if requested
        if module_filter:
            # Map construction → monitoring alias
            if module_filter == 'construction':
                module_filter = 'monitoring'
            tickets = [t for t in tickets if t.get('module') == module_filter]

        tickets.sort(key=lambda t: t.get('updated_at') or t.get('created_at') or '', reverse=True)
        return Response({'results': tickets, 'count': len(tickets)})


def _set_token_cookie(response, name, value, max_age, path):
    response.set_cookie(
        name, value, max_age=max_age, httponly=True, secure=not settings.DEBUG,
        samesite='Lax', path=path, domain=settings.JWT_COOKIE_DOMAIN,
    )


def _issue_session_cookies(response, user):
    refresh = RefreshToken.for_user(user)
    _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, str(refresh.access_token), 15 * 60, '/api/v1/')
    _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, str(refresh), 7 * 24 * 60 * 60, '/api/v1/auth/')
    return response


def _can_switch_demo_identity(user, organization=None):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if organization is None:
        return False
    membership = Membership.objects.active().filter(user=user, organization=organization).first()
    return bool(membership and membership.is_organization_admin)


def _is_demo_identity(user):
    if not user:
        return False
    if user.is_superuser or user.username == 'admin':
        return True
    return user.username.startswith('role-')


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        return JsonResponse({'status': 'unavailable', 'service': 'center-estates-erp', 'database': 'down'}, status=503)
    return JsonResponse({'status': 'ok', 'service': 'center-estates-erp', 'database': 'ok'})


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """Cookie-based JWT login. CSRF-exempt: protected by CORS + rate-limiting.
    Authenticated endpoints are still CSRF-protected via CookieJWTAuthentication."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    @extend_schema(
        request=TokenObtainPairSerializer,
        responses={200: {'type': 'object'}, 401: {'type': 'object'}},
    )
    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        try:
            valid = serializer.is_valid()
        except Exception:
            # simplejwt's TokenObtainPairSerializer raises AuthenticationFailed
            # on bad credentials inside is_valid(); map it to a clean 401.
            return Response({'detail': 'Incorrect username or password.'}, status=401)
        if not valid:
            return Response({'detail': 'Unable to sign in. Please check your credentials.'}, status=401)
        response = Response({'detail': 'Signed in.'})
        _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, serializer.validated_data['access'], 15 * 60, '/api/v1/')
        _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, serializer.validated_data['refresh'], 7 * 24 * 60 * 60, '/api/v1/auth/')
        return response


class MobileTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["client_kind"] = "mobile"
        return token


class MobileTokenView(APIView):
    """Bearer-token login for the offline Expo construction client."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    @extend_schema(
        request=MobileTokenSerializer,
        responses={200: MobileTokenSerializer},
    )
    def post(self, request):
        serializer = MobileTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({
            "access": serializer.validated_data["access"],
            "refresh": serializer.validated_data["refresh"],
            "client_kind": "mobile",
        })


@method_decorator(csrf_protect, name='dispatch')
class RefreshView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'token_refresh'

    @extend_schema(
        request=TokenRefreshSerializer,
        responses={200: {'type': 'object'}},
    )
    def post(self, request):
        serializer = TokenRefreshSerializer(data={'refresh': request.COOKIES.get(settings.JWT_REFRESH_COOKIE)})
        serializer.is_valid(raise_exception=True)
        response = Response({'detail': 'Token refreshed.'})
        _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, serializer.validated_data['access'], 15 * 60, '/api/v1/')
        if 'refresh' in serializer.validated_data:
            _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, serializer.validated_data['refresh'], 7 * 24 * 60 * 60, '/api/v1/auth/')
        return response


class LogoutView(APIView):
    # An invalid access cookie must never prevent the endpoint from removing
    # that same broken browser session.
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        response = Response(status=204)
        cookie_names = (
            getattr(settings, 'JWT_ACCESS_COOKIE', 'ce_access'),
            getattr(settings, 'JWT_REFRESH_COOKIE', 'ce_refresh'),
            IMPERSONATOR_COOKIE,
            'sessionid',
            'csrftoken',
        )
        # Django's cookie jar retains only one Set-Cookie value per name. A
        # caller can therefore request one path/domain variant per response and
        # sweep legacy host-only cookies without variants overwriting each other.
        path_key = request.query_params.get('path')
        domain_key = request.query_params.get('domain')
        if path_key is not None or domain_key is not None:
            paths = {'access': '/api/v1/', 'refresh': '/api/v1/auth/', 'root': '/'}
            domains = {'host': None, 'parent': '.centerestates.com'}
            if path_key not in paths or domain_key not in domains:
                return Response({'detail': 'Invalid cookie cleanup scope.'}, status=400)
            for name in cookie_names:
                response.delete_cookie(name, path=paths[path_key], domain=domains[domain_key])
            return response

        jwt_domain = getattr(settings, 'JWT_COOKIE_DOMAIN', None)
        response.delete_cookie(settings.JWT_ACCESS_COOKIE, path='/api/v1/', domain=jwt_domain)
        response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/api/v1/auth/', domain=jwt_domain)
        response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain=jwt_domain)
        response.delete_cookie('sessionid', path='/', domain=getattr(settings, 'SESSION_COOKIE_DOMAIN', None))
        response.delete_cookie('csrftoken', path='/', domain=getattr(settings, 'CSRF_COOKIE_DOMAIN', None))
        return response


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        memberships = Membership.objects.active().filter(user=request.user).select_related('organization')
        organization = get_active_organization(request, required=False)
        membership = memberships.filter(organization=organization).prefetch_related('roles__permissions').first() if organization else None
        permissions = [] if not membership else (
            ['*'] if membership.is_organization_admin or request.user.is_superuser else list(
                membership.roles.values_list('permissions__key', flat=True).distinct().order_by('permissions__key')
            )
        )
        if request.user.is_superuser and '*' not in permissions:
            permissions = ['*']
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        impersonating = bool(impersonator_id and str(impersonator_id) != str(request.user.pk))
        role_names = [] if not membership else list(membership.roles.values_list('name', flat=True).order_by('name'))
        return Response({
            'user': {
                'id': request.user.pk,
                'username': request.user.get_username(),
                'email': request.user.email,
                'firstName': request.user.first_name,
                'lastName': request.user.last_name,
                'isSuperuser': request.user.is_superuser,
            },
            'organizations': MembershipSerializer(memberships, many=True).data,
            'activeOrganizationId': str(organization.id) if organization else None,
            'modules': serialize_modules(organization, membership) if organization else [],
            'roles': [] if not membership else list(membership.roles.values_list('slug', flat=True).order_by('slug')),
            'roleNames': role_names,
            'permissions': permissions,
            'impersonating': impersonating,
            'canSwitchIdentity': _can_switch_demo_identity(request.user, organization) or impersonating,
        })

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: {'type': 'object'}})
    def patch(self, request):
        user = request.user
        first_name = request.data.get('firstName')
        last_name = request.data.get('lastName')
        email = request.data.get('email')

        updated_fields = []
        if first_name is not None:
            user.first_name = str(first_name).strip()
            updated_fields.append('first_name')
        if last_name is not None:
            user.last_name = str(last_name).strip()
            updated_fields.append('last_name')
        if email is not None:
            clean_email = str(email).strip().lower()
            if clean_email and get_user_model().objects.filter(email=clean_email).exclude(pk=user.pk).exists():
                return Response({'email': 'This email address is already in use by another user.'}, status=400)
            user.email = clean_email
            updated_fields.append('email')

        if updated_fields:
            user.save(update_fields=updated_fields)
        return self.get(request)


@method_decorator(csrf_protect, name='dispatch')
class DemoIdentitiesView(APIView):
    """List seeded demo users for in-demo role switching (superuser / org admin only)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'identities': [], 'groups': []})
        # While impersonating, still allow the original admin to list identities.
        actor = request.user
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        if impersonator_id:
            actor = get_user_model().objects.filter(pk=impersonator_id).first() or request.user
        if not _can_switch_demo_identity(actor, organization) and not actor.is_superuser:
            return Response({'detail': 'Demo identity switching is limited to platform administrators.'}, status=403)

        memberships = (
            Membership.objects.active()
            .filter(organization=organization)
            .select_related('user')
            .prefetch_related('roles')
            .order_by('user__username')
        )
        identities = []
        for membership in memberships:
            user = membership.user
            if not _is_demo_identity(user) and not membership.is_organization_admin:
                continue
            # Keep the client-facing identity switcher concise. Specialist
            # seeded users remain valid for automated acceptance tests and
            # existing bookmarks, but are configured as permission presets
            # rather than presented as separate day-to-day roles.
            if user.username not in VISIBLE_DEMO_IDENTITIES and not membership.is_organization_admin and not user.is_superuser:
                continue
            roles = list(membership.roles.all())
            primary = roles[0] if roles else None
            module = primary.permissions.first().module if primary and primary.permissions.exists() else 'platform'
            if membership.is_organization_admin or user.is_superuser:
                module = 'platform'
            identities.append({
                'id': user.pk,
                'username': user.username,
                'label': (
                    f'{user.first_name} {user.last_name}'.strip()
                    or (primary.name if primary else user.username)
                ),
                'roleSlug': primary.slug if primary else ('platform-admin' if membership.is_organization_admin else ''),
                'roleName': (
                    'Super Administrator' if user.is_superuser
                    else (primary.name if primary else 'Organization administrator')
                ),
                'module': module,
                'isAdmin': bool(membership.is_organization_admin or user.is_superuser),
                'isCurrent': user.pk == request.user.pk,
            })
        module_order = ['platform', 'property', 'facility', 'companion', 'sales', 'tender', 'valuation', 'monitoring']
        groups = []
        for module in module_order:
            items = [item for item in identities if item['module'] == module]
            if items:
                groups.append({'module': module, 'label': module.replace('-', ' ').title(), 'identities': items})
        extras = [item for item in identities if item['module'] not in module_order]
        if extras:
            groups.append({'module': 'other', 'label': 'Other', 'identities': extras})
        return Response({'identities': identities, 'groups': groups})


@method_decorator(csrf_protect, name='dispatch')
class ImpersonateView(APIView):
    """Switch the browser session to a seeded demo identity for product demos."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        organization = get_active_organization(request, required=False)
        username = str(request.data.get('username') or '').strip()
        if not username:
            return Response({'detail': 'username is required.'}, status=400)

        # Resolve the acting admin (original user if already impersonating).
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        actor = request.user
        if impersonator_id:
            actor = get_user_model().objects.filter(pk=impersonator_id).first() or request.user
        if not _can_switch_demo_identity(actor, organization) and not actor.is_superuser:
            return Response({'detail': 'Only platform or organization administrators can switch demo identities.'}, status=403)

        target = get_user_model().objects.filter(username=username).first()
        if not target or not target.is_active:
            return Response({'detail': 'Demo identity not found.'}, status=404)
        if not Membership.objects.active().filter(user=target, organization=organization).exists() and not target.is_superuser:
            return Response({'detail': 'Demo identity is not a member of the active organization.'}, status=400)
        if not _is_demo_identity(target) and not target.is_superuser:
            return Response({'detail': 'Only seeded demo identities can be selected.'}, status=400)

        response = Response({
            'detail': f'Switched to {target.username}.',
            'username': target.username,
        })
        _issue_session_cookies(response, target)
        # Preserve the original admin so demos can return without re-entering the password.
        original_id = impersonator_id or str(actor.pk)
        if str(target.pk) == str(original_id):
            response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain='.centerestates.com')
        else:
            _set_token_cookie(response, IMPERSONATOR_COOKIE, str(original_id), 7 * 24 * 60 * 60, '/api/v1/')
        return response


@method_decorator(csrf_protect, name='dispatch')
class StopImpersonateView(APIView):
    """Return from a demo identity to the original administrator session."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        if not impersonator_id:
            return Response({'detail': 'Not currently impersonating a demo identity.'}, status=400)
        actor = get_user_model().objects.filter(pk=impersonator_id).first()
        if not actor or not actor.is_active:
            response = Response({'detail': 'Original administrator session expired. Sign in again.'}, status=400)
            response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain='.centerestates.com')
            return response
        response = Response({'detail': f'Returned to {actor.username}.', 'username': actor.username})
        _issue_session_cookies(response, actor)
        response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain='.centerestates.com')
        return response


class WorkspaceInboxView(APIView):
    """Cross-module attention queue for the command center."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        from decimal import Decimal

        from django.db.models import Sum

        from construction.models import Risk, Ticket
        from core.models import Module
        from facilities.models import WorkOrder
        from properties.models import Invoice
        from sales.models import SalePayment
        from tenders.models import Tender
        from valuations.models import ValuationInstruction

        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'alerts': [], 'tasks': [], 'summary': {}})

        membership = (
            Membership.objects.active()
            .filter(user=request.user, organization=organization)
            .prefetch_related('roles__permissions')
            .first()
        )
        modules = {item['slug'] for item in serialize_modules(organization, membership)}
        alerts = []
        tasks = []

        is_restricted = is_property_manager_restricted(request.user, organization)

        if Module.PROPERTY in modules:
            invoices_qs = scope_model_queryset(Invoice, request, organization) if is_restricted else Invoice.objects.for_organization(organization)
            outstanding = (
                invoices_qs
                .exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID))
                .aggregate(total=Sum('balance'))['total']
                or Decimal('0')
            )
            overdue = invoices_qs.filter(status=Invoice.Status.OVERDUE).count()
            if outstanding > 0:
                alerts.append({
                    'module': 'property',
                    'severity': 'high',
                    'title': f'Outstanding rent {outstanding}',
                    'detail': f'{overdue} overdue invoices',
                    'href': '/property',
                })
            tasks.append({
                'module': 'property',
                'title': 'Review rent collection & arrears',
                'href': '/property',
                'priority': 2 if outstanding else 5,
            })

        if Module.FACILITY in modules:
            work_orders_qs = scope_model_queryset(WorkOrder, request, organization) if is_restricted else WorkOrder.objects.for_organization(organization)
            open_orders = work_orders_qs.exclude(
                status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED),
            ).count()
            if open_orders:
                alerts.append({
                    'module': 'facility',
                    'severity': 'medium',
                    'title': f'{open_orders} open work orders',
                    'detail': 'Facility maintenance queue',
                    'href': '/facility',
                })
            tasks.append({
                'module': 'facility',
                'title': 'Check open work orders & PM due',
                'href': '/facility',
                'priority': 2 if open_orders else 5,
            })

        if Module.MONITORING in modules:
            open_tickets = Ticket.objects.filter(organization=organization).exclude(
                status__in=('resolved', 'closed'),
            ).count()
            high_risks = Risk.objects.filter(
                organization=organization, likelihood__gte=4, impact__gte=4,
            ).exclude(status='closed').count()
            if open_tickets or high_risks:
                alerts.append({
                    'module': 'monitoring',
                    'severity': 'high',
                    'title': f'{open_tickets} issues · {high_risks} high risks',
                    'detail': 'Construction monitoring',
                    'href': '/monitoring',
                })
            tasks.append({
                'module': 'monitoring',
                'title': 'Monitor site risks and drawdowns',
                'href': '/monitoring',
                'priority': 1 if high_risks else 3,
            })

        if Module.SALES in modules:
            pending = SalePayment.objects.for_organization(organization).filter(
                status=SalePayment.Status.PENDING,
            ).count()
            if pending:
                alerts.append({
                    'module': 'sales',
                    'severity': 'medium',
                    'title': f'{pending} payments awaiting verification',
                    'detail': 'Sales collections',
                    'href': '/sales',
                })
            tasks.append({
                'module': 'sales',
                'title': 'Verify buyer payments',
                'href': '/sales',
                'priority': 2 if pending else 5,
            })

        if Module.TENDER in modules:
            active = Tender.objects.for_organization(organization).exclude(
                stage__in=(Tender.Stage.AWARDED, Tender.Stage.REGRETTED, Tender.Stage.SUBMITTED),
            ).count()
            if active:
                alerts.append({
                    'module': 'tender',
                    'severity': 'low',
                    'title': f'{active} active tenders in pipeline',
                    'detail': 'Tender management',
                    'href': '/tender',
                })
            tasks.append({
                'module': 'tender',
                'title': 'Review tender pipeline',
                'href': '/tender',
                'priority': 3,
            })

        if Module.VALUATION in modules:
            active_jobs = ValuationInstruction.objects.for_organization(organization).exclude(
                status__in=(
                    ValuationInstruction.Status.DELIVERED,
                    ValuationInstruction.Status.CANCELLED,
                    ValuationInstruction.Status.FINAL,
                ),
            ).count()
            tasks.append({
                'module': 'valuation',
                'title': f'Review {active_jobs} open valuation instruction(s)',
                'href': '/valuation',
                'priority': 3 if active_jobs else 6,
            })

        tasks = sorted(tasks, key=lambda item: item['priority'])[:8]
        return Response({
            'alerts': alerts,
            'tasks': tasks,
            'summary': {
                'alertCount': len(alerts),
                'taskCount': len(tasks),
                'modules': sorted(modules),
            },
        })


class WorkspacePulseView(APIView):
    """Small portfolio KPIs for every entitled command-center module.

    Keeping this aggregation behind one authenticated request avoids a burst
    of seven parallel WSGI requests on constrained cPanel runtimes.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        from decimal import Decimal

        from django.db.models import Count, Q, Sum
        from django.utils import timezone

        from companion.models import Task
        from construction.models import Disbursement, Project, Risk, Ticket
        from core.models import Module
        from facilities.models import FacilityAsset, PreventiveSchedule, WorkOrder
        from properties.models import Invoice, Property, Tenant, Unit
        from sales.models import PropertySale, SaleListing, SalePayment
        from tenders.models import Tender
        from valuations.models import ValuationInstruction, ValuationInvoice

        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'pulse': {}})
        membership = get_active_membership(request, organization)
        entitled = {item['slug'] for item in serialize_modules(organization, membership)}
        pulse = {}

        if Module.PROPERTY in entitled:
            unit_totals = Unit.objects.for_organization(organization).aggregate(
                total=Count('id'), occupied=Count('id', filter=Q(status=Unit.Status.OCCUPIED)),
            )
            outstanding = Invoice.objects.for_organization(organization).exclude(
                status__in=(Invoice.Status.PAID, Invoice.Status.VOID),
            ).aggregate(total=Sum('balance'))['total'] or Decimal('0')
            pulse['property'] = {
                'properties': Property.objects.for_organization(organization).count(),
                'outstanding': outstanding,
                'occupancy': round(unit_totals['occupied'] / unit_totals['total'] * 100, 1) if unit_totals['total'] else 0,
                'tenants': Tenant.objects.for_organization(organization).filter(status=Tenant.Status.ACTIVE).count(),
            }

        if Module.FACILITY in entitled:
            now = timezone.localdate()
            work_orders = WorkOrder.objects.for_organization(organization)
            schedules = PreventiveSchedule.objects.for_organization(organization).filter(is_active=True)
            schedule_totals = schedules.aggregate(
                total=Count('id'), overdue=Count('id', filter=Q(next_due_on__lte=now)),
            )
            pulse['facility'] = {
                'openWorkOrders': work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)).count(),
                'compliance': round((schedule_totals['total'] - schedule_totals['overdue']) / schedule_totals['total'] * 100, 1) if schedule_totals['total'] else 100,
                'assets': FacilityAsset.objects.for_organization(organization).filter(is_active=True).count(),
            }

        if Module.SALES in entitled:
            listings = SaleListing.objects.for_organization(organization)
            pulse['sales'] = {
                'availableUnits': listings.filter(status=SaleListing.Status.AVAILABLE).count(),
                'salesValue': PropertySale.objects.for_organization(organization).exclude(
                    status=PropertySale.Status.CANCELLED,
                ).aggregate(total=Sum('agreed_price'))['total'] or Decimal('0'),
                'pendingPayments': SalePayment.objects.for_organization(organization).filter(status=SalePayment.Status.PENDING).count(),
            }

        if Module.MONITORING in entitled:
            projects = Project.objects.filter(organization=organization, archived=False)
            total_budget = projects.aggregate(value=Sum('budget'))['value'] or Decimal('0')
            spent = Disbursement.objects.filter(
                organization=organization, status='paid',
            ).aggregate(value=Sum('amount'))['value'] or Decimal('0')
            pulse['monitoring'] = {
                'activeProjects': projects.filter(stage='active').count(),
                'openTickets': Ticket.objects.filter(organization=organization).exclude(status__in=('closed', 'resolved')).count(),
                'highRisks': Risk.objects.filter(organization=organization, likelihood__gte=4, impact__gte=4).exclude(status='closed').count(),
                'budgetUtilization': round(float(spent / total_budget * 100), 1) if total_budget else 0,
            }

        if Module.TENDER in entitled:
            tenders = Tender.objects.for_organization(organization)
            active = tenders.exclude(stage__in=(Tender.Stage.AWARDED, Tender.Stage.REGRETTED))
            pulse['tender'] = {
                'activeTenders': active.count(),
                'pipelineValue': active.aggregate(value=Sum('estimated_value'))['value'] or Decimal('0'),
            }

        if Module.VALUATION in entitled:
            active = ValuationInstruction.objects.for_organization(organization).exclude(
                status__in=(ValuationInstruction.Status.DELIVERED, ValuationInstruction.Status.CANCELLED),
            )
            outstanding = ValuationInvoice.objects.for_organization(organization).exclude(
                status__in=(ValuationInvoice.Status.PAID, ValuationInvoice.Status.VOID),
            ).aggregate(value=Sum('balance'))['value'] or Decimal('0')
            pulse['valuation'] = {'activeInstructions': active.count(), 'outstanding': outstanding}

        if Module.COMPANION in entitled:
            active = Task.objects.for_organization(organization).filter(assignee=request.user).exclude(
                status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED),
            )
            now = timezone.now()
            totals = active.aggregate(
                dueToday=Count('id', filter=Q(due_at__date=now.date())),
                overdue=Count('id', filter=Q(due_at__lt=now)),
                escalated=Count('id', filter=Q(escalated=True)),
            )
            pulse['companion'] = totals

        return Response({'pulse': pulse})


@extend_schema(request=None, responses={200: {'type': 'object'}})
@api_view(['GET'])
@permission_classes([IsAdminUser])
def security_audit(request):
    return Response({
        'debug': settings.DEBUG,
        'secure_ssl_redirect': getattr(settings, 'SECURE_SSL_REDIRECT', False),
        'session_cookie_secure': settings.SESSION_COOKIE_SECURE,
        'csrf_cookie_secure': settings.CSRF_COOKIE_SECURE,
        'hsts_seconds': getattr(settings, 'SECURE_HSTS_SECONDS', None),
        'cors_origins': getattr(settings, 'CORS_ALLOWED_ORIGINS', []),
        'allowed_hosts': settings.ALLOWED_HOSTS,
        'password_validators': [v['NAME'] for v in settings.AUTH_PASSWORD_VALIDATORS],
    })


@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
    """Self-service account registration. CSRF-exempt: protected by CORS + rate-limiting."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={201: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        User = get_user_model()
        data = request.data
        username = str(data.get('username', '')).strip()
        email = str(data.get('email', '')).strip()
        password = str(data.get('password', ''))
        first_name = str(data.get('first_name', '')).strip()
        last_name = str(data.get('last_name', '')).strip()
        organization_name = str(data.get('organization_name', '')).strip()

        errors = {}
        if not email:
            errors['email'] = ['This field is required.']
        elif User.objects.filter(email=email).exists():
            errors['email'] = ['A user with that email already exists.']
        if not password:
            errors['password'] = ['This field is required.']
        if errors:
            return Response(errors, status=400)

        # The public sign-up form only collects an email address; derive a
        # unique username from it when the client doesn't send one explicitly.
        if not username:
            base = re.sub(r'[^a-zA-Z0-9._-]+', '', email.split('@')[0]).lower()[:60] or 'user'
            candidate = base
            counter = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f'{base}-{counter}'
                counter += 1
            username = candidate
        elif User.objects.filter(username=username).exists():
            errors['username'] = ['A user with that username already exists.']
            return Response(errors, status=400)

        # Validate password strength
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'password': list(exc.messages)}, status=400)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )

        from organizations.models import Membership, Organization, Role

        if organization_name:
            # Registrant explicitly asked for their own organisation: create it
            # and link them as admin.
            try:
                slug = re.sub(r'[^a-z0-9]+', '-', organization_name.lower()).strip('-')[:50]
                base_slug = slug
                counter = 1
                while Organization.objects.filter(slug=slug).exists():
                    slug = f'{base_slug}-{counter}'
                    counter += 1
                org = Organization.objects.create(name=organization_name, slug=slug)
                Membership.objects.create(user=user, organization=org, is_organization_admin=True, is_default=True)
            except Exception:
                pass  # Organisation creation is optional, don't fail registration
        else:
            # Default onboarding: join the Center Estates organisation as a
            # property manager so new users land in a usable workspace.
            try:
                org = Organization.objects.filter(slug='center-estates-demo').first()
                if org is None:
                    org = Organization.objects.filter(name='Center Estates Demo', is_active=True).first()
                if org is None:
                    org = Organization.objects.filter(is_active=True).order_by('created_at').first()
                if org is None:
                    org = Organization.objects.create(name='Center Estates Demo', slug='center-estates-demo', is_active=True)
                membership, membership_created = Membership.objects.get_or_create(
                    user=user,
                    organization=org,
                    defaults={'is_default': True},
                )
                if membership_created and not Membership.objects.filter(user=user, is_default=True).exists():
                    membership.is_default = True
                    membership.save()
                role = Role.objects.filter(organization=org, slug='property-manager').first()
                if role is not None:
                    membership.roles.add(role)
            except Exception:
                pass  # Default organisation assignment is best-effort

        return Response({
            'detail': 'Account created successfully. You can now sign in.',
            'username': user.username,
        }, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetRequestView(APIView):
    """Initiate a password reset. Always returns 200 to prevent email enumeration.
    CSRF-exempt: no authenticated state; protected by CORS + rate-limiting."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def post(self, request):
        email = str(request.data.get('email', '')).strip()
        if email:
            User = get_user_model()
            user = User.objects.filter(email=email, is_active=True).first()
            if user:
                # In production, send a reset email here.
                # For now we log the intent but always return a neutral response.
                import logging
                logging.getLogger(__name__).info('Password reset requested for %s', email)
        return Response({'detail': 'If an account with that email exists, you will receive a reset link shortly.'})


class ChangePasswordView(APIView):
    """
    Allow an authenticated user to change their own password.
    Requires current password verification and validates new password strength.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        user = request.user
        data = request.data
        current_password = str(data.get('current_password', ''))
        new_password = str(data.get('new_password', ''))
        confirm_password = str(data.get('confirm_password', ''))

        errors = {}
        if not current_password:
            errors['current_password'] = ['Current password is required.']
        elif not user.check_password(current_password):
            errors['current_password'] = ['Current password is incorrect.']

        if not new_password:
            errors['new_password'] = ['New password is required.']
        elif len(new_password) < 8:
            errors['new_password'] = ['Password must be at least 8 characters long.']
        elif current_password and new_password == current_password:
            errors['new_password'] = ['New password cannot be identical to current password.']
        elif confirm_password and new_password != confirm_password:
            errors['confirm_password'] = ['New password confirmation does not match.']

        if errors:
            return Response(errors, status=400)

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response({'new_password': list(exc.messages)}, status=400)

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response({'detail': 'Password changed successfully.'}, status=200)


@method_decorator(csrf_exempt, name='dispatch')
class ClientErrorView(APIView):
    """Receive client-side error reports from the frontend.
    CSRF-exempt: called from global error handlers before any session exists."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={202: {'type': 'object'}})
    def post(self, request):
        import hashlib
        import logging
        logger = logging.getLogger('client-errors')
        data = request.data
        message = str(data.get('message', ''))[:500]
        stack = str(data.get('stack', ''))[:2000]
        component_stack = str(data.get('componentStack', ''))[:2000]
        url = str(data.get('url', ''))[:500]
        release = str(data.get('release', ''))[:50]
        extra = data.get('extra', {}) if isinstance(data.get('extra', {}), dict) else {}
        organization = None
        organization_id = str(data.get('organizationId', ''))[:64]
        if organization_id:
            from organizations.models import Organization
            organization = Organization.objects.filter(id=organization_id).first()
        fingerprint = hashlib.sha256(
            f'{release}|{message}|{url}|{component_stack[:500]}'.encode('utf-8')
        ).hexdigest()
        now = timezone.now()
        try:
            event, created = ClientErrorEvent.objects.get_or_create(
                organization=organization,
                fingerprint=fingerprint,
                defaults={
                    'message': message or 'Client error',
                    'stack': stack,
                    'component_stack': component_stack,
                    'url': url,
                    'release': release,
                    'extra': extra,
                    'first_seen_at': now,
                    'last_seen_at': now,
                },
            )
            if not created:
                ClientErrorEvent.objects.filter(pk=event.pk).update(
                    occurrences=F('occurrences') + 1,
                    last_seen_at=now,
                    stack=stack or F('stack'),
                    component_stack=component_stack or F('component_stack'),
                    extra=extra or F('extra'),
                )
        except Exception:
            logger.exception('Unable to persist client error event')
        logger.warning('CLIENT ERROR [%s] %s | url=%s | extra=%s', release, message, url, extra)
        if stack:
            logger.debug('Stack: %s', stack[:500])
        return Response({'detail': 'Error logged.'}, status=202)


class ClientErrorHealthView(APIView):
    """Organisation administrators can triage current browser failures."""

    permission_classes = (IsAuthenticated,)

    def _organization_for_admin(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not (request.user.is_superuser or (membership and membership.is_organization_admin)):
            return None
        return organization

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        organization = self._organization_for_admin(request)
        if not organization:
            return Response({'detail': 'Organisation administrator access is required.'}, status=403)
        all_events = ClientErrorEvent.objects.filter(organization=organization)
        events = all_events
        status_filter = request.query_params.get('status')
        if status_filter in ClientErrorEvent.Status.values:
            events = events.filter(status=status_filter)
        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50
        limit = min(max(limit, 1), 100)
        rows = list(events[:limit])
        return Response({
            # Keep the headline useful even when the table is filtered to a
            # resolved or ignored state.
            'open_count': all_events.filter(status=ClientErrorEvent.Status.OPEN).count(),
            'results': [{
                'id': str(event.id), 'message': event.message, 'url': event.url,
                'release': event.release, 'occurrences': event.occurrences,
                'first_seen_at': event.first_seen_at, 'last_seen_at': event.last_seen_at,
                'status': event.status, 'extra': event.extra,
            } for event in rows],
        })

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def patch(self, request):
        organization = self._organization_for_admin(request)
        if not organization:
            return Response({'detail': 'Organisation administrator access is required.'}, status=403)
        event_id = str(request.data.get('id', ''))
        status = request.data.get('status')
        if status not in (ClientErrorEvent.Status.RESOLVED, ClientErrorEvent.Status.IGNORED):
            return Response({'detail': 'Status must be resolved or ignored.'}, status=400)
        event = ClientErrorEvent.objects.filter(id=event_id, organization=organization).first()
        if not event:
            return Response({'detail': 'Error event was not found.'}, status=404)
        event.status = status
        event.save(update_fields=('status', 'updated_at'))
        return Response({'id': str(event.id), 'status': event.status})
