"""Sales reporting suite.

Builds tabular datasets, KPIs and a report catalogue for the sales module.
Each report declares a key, human title, category/description and a builder
that receives the request + period and returns the column headers and rows.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum

from .models import (
    AgentCommission, Buyer, Installment, PropertySale,
    SaleDocument, SaleListing, SalePayment, SiteVisit,
)

# Currency / number helpers
KES = Decimal('0')


def money(value):
    return Decimal(value or 0).quantize(Decimal('0.01'))


# Backward-compatible aliases so existing clients that used the previous 5-form
# catalogue keys (sales/payments/commissions/visits) continue to work.
ALIASES = {
    'sales': 'sales-pipeline',
    'payments': 'payment-reconciliation',
    'commissions': 'commission-ledger',
    'visits': 'site-visits',
}


def resolve_report_key(report_key):
    return ALIASES.get(report_key, report_key)


def cell_value(row, header):
    """Case-insensitive lookup of a header label against a row dict."""
    if header in row:
        return row[header]
    lowered = header.lower()
    for key, value in row.items():
        if key.lower() == lowered:
            return value
    return ''


def _period_dates(request, default_days=30):
    from django.utils import timezone
    today = timezone.localdate()
    start_raw = request.query_params.get('start')
    end_raw = request.query_params.get('end')
    try:
        start = date.fromisoformat(start_raw) if start_raw else today - timedelta(days=default_days)
        end = date.fromisoformat(end_raw) if end_raw else today
    except ValueError:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
    if start > end:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'period': 'Start date cannot be after end date.'})
    return start, end


CATALOGUE = [
    {'key': 'inventory', 'name': 'Unit Inventory & Availability', 'category': 'Commercial', 'icon': '🏠', 'description': 'Available, reserved and sold units with list price and construction progress by project.'},
    {'key': 'sales-pipeline', 'name': 'Sales Pipeline & Contracts', 'category': 'Commercial', 'icon': '📋', 'description': 'Sale agreements with buyer, unit, agent, agreed price and current status.'},
    {'key': 'payment-reconciliation', 'name': 'Payment Reconciliation', 'category': 'Financial', 'icon': '💳', 'description': 'Verified, pending and rejected sale payments against installments and reference.'},
    {'key': 'installment-schedule', 'name': 'Installment Schedule & Aging', 'category': 'Financial', 'icon': '🗓️', 'description': 'Payment milestones with amounts collected, balances and overdue exposure.'},
    {'key': 'commission-ledger', 'name': 'Commission Ledger', 'category': 'Financial', 'icon': '🧾', 'description': 'Agent commissions with payment and construction eligibility gates and status.'},
    {'key': 'buyer-register', 'name': 'Buyer & Lead Register', 'category': 'CRM', 'icon': '👥', 'description': 'All buyers and leads with contact, financing type, assigned agent and stage.'},
    {'key': 'site-visits', 'name': 'Site Visit Register', 'category': 'CRM', 'icon': '📍', 'description': 'Visitor arrivals, project interest and attribution to introducing agents.'},
    {'key': 'agent-performance', 'name': 'Agent Performance', 'category': 'People', 'icon': '🧑‍💼', 'description': 'Per-agent pipeline value, deals closed, conversion and commission earned.'},
    {'key': 'financial-summary', 'name': 'Financial Summary', 'category': 'Financial', 'icon': '📈', 'description': 'Period rollup of sales value, verified collections, commission payable and exposure.'},
]


def _inventory_rows(scope, request, start, end):
    rows = []
    for listing in scope.filter(created_at__date__lte=end).select_related('project', 'unit'):
        rows.append({
            'project': listing.project.name,
            'unit': listing.unit.code,
            'type': listing.unit.unit_type,
            'floor': listing.unit.floor,
            'list_price': money(listing.list_price),
            'deposit_pct': Decimal(listing.minimum_deposit_percent or 0),
            'progress_pct': Decimal(listing.construction_progress or 0),
            'status': listing.status,
        })
    return rows


def _sales_rows(scope, request, start, end):
    rows = []
    for sale in scope.filter(created_at__date__range=(start, end)).select_related(
        'buyer', 'listing__unit', 'listing__project', 'agent',
    ).prefetch_related('payments'):
        verified = sum((p.amount for p in sale.payments.all() if p.status == SalePayment.Status.VERIFIED), Decimal(0))
        rows.append({
            'reference': sale.reference,
            'buyer': sale.buyer.full_name,
            'project': sale.listing.project.name if sale.listing else '',
            'unit': sale.listing.unit.code if sale.listing else '',
            'agent': (sale.agent.get_full_name() or sale.agent.username) if sale.agent else '',
            'agreed_price': money(sale.agreed_price),
            'verified': money(verified),
            'balance': money(max(sale.agreed_price - verified, 0)),
            'reservation_fee': money(sale.reservation_fee),
            'contracted_on': sale.contracted_on or '',
            'status': sale.status,
        })
    return rows


def _payment_rows(scope, request, start, end):
    rows = []
    for payment in scope.filter(paid_on__range=(start, end)).select_related(
        'sale__buyer', 'installment',
    ):
        rows.append({
            'reference': payment.reference,
            'sale': payment.sale.reference,
            'buyer': payment.sale.buyer.full_name,
            'paid_on': payment.paid_on,
            'amount': money(payment.amount),
            'method': payment.method,
            'external_reference': payment.external_reference,
            'installment': payment.installment.sequence if payment.installment else '',
            'status': payment.status,
        })
    return rows


def _installment_rows(scope, request, start, end):
    today = date.today()
    rows = []
    for inst in scope.filter(due_on__lte=end).select_related('sale__buyer').order_by('due_on'):
        balance = money(inst.amount - inst.paid_amount)
        overdue = inst.status not in (Installment.Status.PAID,) and inst.due_on < today
        rows.append({
            'sale': inst.sale.reference,
            'buyer': inst.sale.buyer.full_name,
            'sequence': inst.sequence,
            'description': inst.description,
            'due_on': inst.due_on,
            'amount': money(inst.amount),
            'paid': money(inst.paid_amount),
            'balance': balance,
            'days_overdue': (today - inst.due_on).days if overdue else 0,
            'status': inst.status,
        })
    return rows


def _commission_rows(scope, request, start, end):
    rows = []
    for comm in scope.select_related('sale__buyer', 'agent').order_by('-created_at'):
        rows.append({
            'reference': comm.reference,
            'agent': comm.agent.get_full_name() or comm.agent.username,
            'sale': comm.sale.reference,
            'buyer': comm.sale.buyer.full_name,
            'rate': Decimal(comm.rate_percent or 0),
            'amount': money(comm.amount),
            'paid_gate_pct': Decimal(comm.required_paid_percent or 0),
            'construction_gate_pct': Decimal(comm.required_construction_percent or 0),
            'status': comm.status,
        })
    return rows


def _buyer_rows(scope, request, start, end):
    rows = []
    for buyer in scope.select_related('assigned_agent').order_by('full_name'):
        rows.append({
            'reference': buyer.reference,
            'name': buyer.full_name,
            'email': buyer.email,
            'phone': buyer.phone,
            'id_number': buyer.id_number,
            'financing': buyer.financing_type,
            'agent': (buyer.assigned_agent.get_full_name() or buyer.assigned_agent.username) if buyer.assigned_agent else '',
            'status': buyer.status,
        })
    return rows


def _visit_rows(scope, request, start, end):
    rows = []
    for visit in scope.filter(visited_at__date__range=(start, end)).select_related(
        'project', 'introducing_agent', 'converted_buyer',
    ):
        rows.append({
            'reference': visit.reference,
            'visitor': visit.visitor_name,
            'phone': visit.phone,
            'project': visit.project.name,
            'interest': visit.interested_unit_type,
            'agent': (visit.introducing_agent.get_full_name() or visit.introducing_agent.username) if visit.introducing_agent else '',
            'visited_at': visit.visited_at.date(),
            'follow_up': visit.follow_up_on or '',
            'converted_buyer': visit.converted_buyer.full_name if visit.converted_buyer else '',
        })
    return rows


def _agent_performance_rows(scope, request, start, end):
    # scope here is the SalePayment-free aggregate over PropertySale.
    perf = {}
    for sale in scope.filter(created_at__date__range=(start, end)).select_related('agent'):
        name = (sale.agent.get_full_name() or sale.agent.username) if sale.agent else '(Unassigned)'
        entry = perf.setdefault(name, {'deals': 0, 'value': Decimal(0), 'completed': 0, 'cancelled': 0})
        entry['deals'] += 1
        entry['value'] += sale.agreed_price
        if sale.status == PropertySale.Status.COMPLETED:
            entry['completed'] += 1
        if sale.status == PropertySale.Status.CANCELLED:
            entry['cancelled'] += 1
    rows = []
    for name, e in perf.items():
        rows.append({
            'agent': name,
            'deals': e['deals'],
            'value': money(e['value']),
            'completed': e['completed'],
            'cancelled': e['cancelled'],
            'conversion_pct': Decimal(e['completed'] / e['deals'] * 100) if e['deals'] else Decimal(0),
        })
    return rows


def _summary_rows(scope, request, start, end):
    sales = scope.filter(created_at__date__range=(start, end)).select_related('listing__project')
    verified_payments = SalePayment.objects.for_organization(scope.model.organization).filter(
        sale__in=sales, status=SalePayment.Status.VERIFIED, paid_on__range=(start, end),
    )
    total_value = sales.aggregate(total=Sum('agreed_price'))['total'] or Decimal(0)
    verified = verified_payments.aggregate(total=Sum('amount'))['total'] or Decimal(0)
    commissions = AgentCommission.objects.for_organization(scope.model.organization)
    commission_earned = commissions.aggregate(total=Sum('amount'))['total'] or Decimal(0)
    commission_paid = commissions.filter(status=AgentCommission.Status.PAID).aggregate(total=Sum('amount'))['total'] or Decimal(0)
    pipeline = sales.exclude(status__in=(PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED))
    return [{
        'metric': 'Total Sale Value',
        'value': money(total_value).normalize(),
        'note': f'{sales.count()} sales',
    }, {
        'metric': 'Verified Collections',
        'value': money(verified).normalize(),
        'note': f'{verified_payments.count()} payments',
    }, {
        'metric': 'Pipeline Value',
        'value': money(pipeline.aggregate(total=Sum('agreed_price'))['total'] or Decimal(0)).normalize(),
        'note': f'{pipeline.count()} active deals',
    }, {
        'metric': 'Commission Earned',
        'value': money(commission_earned).normalize(),
        'note': f'{commissions.count()} commission records',
    }, {
        'metric': 'Commission Paid',
        'value': money(commission_paid).normalize(),
        'note': 'Disbursed to agents',
    }, {
        'metric': 'Commission Payable',
        'value': money(commission_earned - commission_paid).normalize(),
        'note': 'Eligible but unpaid',
    }]


REPORTS = {
    'inventory': {'title': 'Unit Inventory & Availability', 'category': 'Commercial', 'headers': ('Project', 'Unit', 'Type', 'Floor', 'List Price', 'Deposit %', 'Progress %', 'Status'), 'keys': ('project', 'unit', 'type', 'floor', 'list_price', 'deposit_pct', 'progress_pct', 'status')},
    'sales-pipeline': {'title': 'Sales Pipeline & Contracts', 'category': 'Commercial', 'headers': ('Sale Ref', 'Buyer', 'Project', 'Unit', 'Agent', 'Agreed Price', 'Verified', 'Balance', 'Reservation Fee', 'Contracted On', 'Status'), 'keys': ('reference', 'buyer', 'project', 'unit', 'agent', 'agreed_price', 'verified', 'balance', 'reservation_fee', 'contracted_on', 'status')},
    'payment-reconciliation': {'title': 'Payment Reconciliation', 'category': 'Financial', 'headers': ('Payment Ref', 'Sale', 'Buyer', 'Paid On', 'Amount', 'Method', 'External Ref', 'Installment', 'Status'), 'keys': ('reference', 'sale', 'buyer', 'paid_on', 'amount', 'method', 'external_reference', 'installment', 'status')},
    'installment-schedule': {'title': 'Installment Schedule & Aging', 'category': 'Financial', 'headers': ('Sale', 'Buyer', 'Seq', 'Description', 'Due On', 'Amount', 'Paid', 'Balance', 'Days Overdue', 'Status'), 'keys': ('sale', 'buyer', 'sequence', 'description', 'due_on', 'amount', 'paid', 'balance', 'days_overdue', 'status')},
    'commission-ledger': {'title': 'Commission Ledger', 'category': 'Financial', 'headers': ('Commission Ref', 'Agent', 'Sale', 'Buyer', 'Rate %', 'Amount', 'Paid Gate %', 'Construction Gate %', 'Status'), 'keys': ('reference', 'agent', 'sale', 'buyer', 'rate', 'amount', 'paid_gate_pct', 'construction_gate_pct', 'status')},
    'buyer-register': {'title': 'Buyer & Lead Register', 'category': 'CRM', 'headers': ('Ref', 'Name', 'Email', 'Phone', 'ID Number', 'Financing', 'Agent', 'Status'), 'keys': ('reference', 'name', 'email', 'phone', 'id_number', 'financing', 'agent', 'status')},
    'site-visits': {'title': 'Site Visit Register', 'category': 'CRM', 'headers': ('Visit Ref', 'Visitor', 'Phone', 'Project', 'Interest', 'Agent', 'Visited', 'Follow Up', 'Converted Buyer'), 'keys': ('reference', 'visitor', 'phone', 'project', 'interest', 'agent', 'visited_at', 'follow_up', 'converted_buyer')},
    'agent-performance': {'title': 'Agent Performance', 'category': 'People', 'headers': ('Agent', 'Deals', 'Value', 'Completed', 'Cancelled', 'Conversion %'), 'keys': ('agent', 'deals', 'value', 'completed', 'cancelled', 'conversion_pct')},
    'financial-summary': {'title': 'Financial Summary', 'category': 'Financial', 'headers': ('Metric', 'Value', 'Note'), 'keys': ('metric', 'value', 'note')},
}


def build_report(request, queries, report_key):
    """Return (headers, rows, start, end) for a single report.

    rows are returned as a list of dicts keyed by the header label so callers can
    render columns directly.
    """
    start, end = _period_dates(request)
    builder = {
        'inventory': lambda: _inventory_rows(queries['listings'], request, start, end),
        'sales-pipeline': lambda: _sales_rows(queries['sales'], request, start, end),
        'payment-reconciliation': lambda: _payment_rows(queries['payments'], request, start, end),
        'installment-schedule': lambda: _installment_rows(queries['installments'], request, start, end),
        'commission-ledger': lambda: _commission_rows(queries['commissions'], request, start, end),
        'buyer-register': lambda: _buyer_rows(queries['buyers'], request, start, end),
        'site-visits': lambda: _visit_rows(queries['visits'], request, start, end),
        'agent-performance': lambda: _agent_performance_rows(queries['sales'], request, start, end),
        'financial-summary': lambda: _summary_rows(queries['sales'], request, start, end),
    }
    if report_key not in builder:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'report': 'Unknown sales report.'})
    spec = REPORTS[report_key]
    headers = spec['headers']
    keys = spec['keys']
    raw_rows = builder[report_key]()
    projected = [{header: row.get(key, '') for header, key in zip(headers, keys)} for row in raw_rows]
    return headers, projected, start, end
