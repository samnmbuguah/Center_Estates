"""Unauthenticated storefront API for the public sales site.

Only AVAILABLE listings of the organization configured via
PUBLIC_LISTINGS_ORG_SLUG are exposed, with a minimal safe field set.
Enquiries create Buyer leads (status=lead) for the sales team.
"""
from django.conf import settings
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from organizations.models import Organization

from .models import Buyer, SaleListing


class EnquiryThrottle(AnonRateThrottle):
    rate = '20/hour'


def _public_org():
    slug = (getattr(settings, 'PUBLIC_LISTINGS_ORG_SLUG', '') or '').strip()
    if not slug:
        return None
    return Organization.objects.filter(slug=slug).first()


def _render_url(render):
    if render.file_url:
        return render.file_url
    try:
        return render.file.url if render.file else ''
    except Exception:
        return ''


def serialize_listing(listing, *, detail=False):
    unit = listing.unit
    project = listing.project
    prop = getattr(project, 'property', None)
    renders = list(listing.renders.all())
    images = [
        {'url': _render_url(r), 'kind': r.render_kind, 'title': r.title, 'primary': r.is_primary}
        for r in renders if _render_url(r)
    ]
    payload = {
        'id': str(listing.id),
        'project': {
            'name': project.name,
            'location': ' '.join(str(v) for v in [
                getattr(prop, 'town', '') or '', getattr(prop, 'county', '') or '',
            ]).strip(),
        },
        'unit': {
            'code': unit.code,
            'type': unit.unit_type,
            'floor': unit.floor,
            'area': str(unit.area) if unit.area is not None else None,
            'bedrooms': None,
        },
        'price': str(listing.list_price),
        'minimum_deposit_percent': str(listing.minimum_deposit_percent),
        'construction_progress': str(listing.construction_progress),
        'status': listing.status,
        'images': images,
    }
    if detail:
        payload['project']['description'] = getattr(project, 'description', '')
    return payload


def _no_storefront():
    return Response({'detail': 'Public listings are not enabled.'}, status=404)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_listings(request):
    organization = _public_org()
    if organization is None:
        return _no_storefront()
    queryset = SaleListing.objects.filter(
        organization=organization, status=SaleListing.Status.AVAILABLE,
    ).select_related('unit', 'project', 'project__property').prefetch_related('renders').order_by('list_price')
    query = (request.query_params.get('search') or '').strip()
    if query:
        queryset = queryset.filter(
            Q(unit__code__icontains=query) | Q(project__name__icontains=query)
            | Q(unit__unit_type__icontains=query),
        )
    max_price = (request.query_params.get('max_price') or '').strip()
    if max_price:
        try:
            queryset = queryset.filter(list_price__lte=max_price)
        except Exception:
            pass
    return Response({'results': [serialize_listing(item) for item in queryset[:100]]})


@api_view(['GET'])
@permission_classes([AllowAny])
def public_listing_detail(request, pk):
    organization = _public_org()
    if organization is None:
        return _no_storefront()
    try:
        listing = SaleListing.objects.select_related(
            'unit', 'project', 'project__property',
        ).prefetch_related('renders').get(
            pk=pk, organization=organization, status=SaleListing.Status.AVAILABLE,
        )
    except (SaleListing.DoesNotExist, ValueError):
        return Response({'detail': 'Listing not found.'}, status=404)
    return Response(serialize_listing(listing, detail=True))


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([EnquiryThrottle])
def public_enquiry(request):
    organization = _public_org()
    if organization is None:
        return _no_storefront()
    data = request.data if isinstance(request.data, dict) else {}
    name = str(data.get('name') or '').strip()
    phone = str(data.get('phone') or '').strip()
    email = str(data.get('email') or '').strip()
    message = str(data.get('message') or '').strip()
    listing_id = data.get('listing')
    errors = {}
    if not name:
        errors['name'] = 'Your name is required.'
    if not phone and not email:
        errors['contact'] = 'A phone number or email is required.'
    if email and '@' not in email:
        errors['email'] = 'Enter a valid email address.'
    listing = None
    if listing_id:
        try:
            listing = SaleListing.objects.get(
                pk=listing_id, organization=organization, status=SaleListing.Status.AVAILABLE,
            )
        except (SaleListing.DoesNotExist, ValueError):
            errors['listing'] = 'Listing is no longer available.'
    if errors:
        return Response({'errors': errors}, status=400)
    identity = Q()
    if phone:
        identity |= Q(phone__iexact=phone)
    if email:
        identity |= Q(email__iexact=email)
    existing = Buyer.objects.filter(organization=organization).filter(identity).first() if identity else None
    notes = message
    if listing:
        notes = f'Interested in {listing.project.name} unit {listing.unit.code} ({listing.list_price}).\n{message}'.strip()
    if existing:
        if notes and notes not in (existing.notes or ''):
            existing.notes = f'{(existing.notes or "").strip()}\n{notes}'.strip()
            existing.save(update_fields=('notes', 'updated_at'))
        return Response({'status': 'ok', 'reference': existing.reference}, status=200)
    count = Buyer.objects.filter(organization=organization, reference__startswith='BUY-').count()
    buyer = Buyer.objects.create(
        organization=organization, reference=f'BUY-{(count + 1):04d}',
        full_name=name[:180], email=email[:254], phone=phone[:40],
        id_number='', status=Buyer.Status.LEAD, notes=notes,
    )
    return Response({'status': 'ok', 'reference': buyer.reference}, status=201)
