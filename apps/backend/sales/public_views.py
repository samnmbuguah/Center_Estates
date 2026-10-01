"""Unauthenticated storefront API for the public sales site.

Only AVAILABLE listings of the organization configured via
PUBLIC_LISTINGS_ORG_SLUG are exposed, with a minimal safe field set.
Enquiries create Buyer leads (status=lead) for the sales team.
"""
import uuid

from django.conf import settings
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from organizations.models import Organization
from properties.models import Project

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


def _bedrooms(unit_type):
    """Derive a bedroom count from free-text unit types ('2 Bedroom' -> 2).
    Units carry no structured bedroom field, so parse the leading number;
    non-residential types yield None."""
    import re
    match = re.match(r'\s*(\d+)\s*(?:bed(?:room)?s?|br)\b', str(unit_type or ''), re.IGNORECASE)
    if match:
        return int(match.group(1))
    lowered = str(unit_type or '').lower()
    if any(key in lowered for key in ('studio', 'bedsitter')):
        return 0
    return None


def _location(prop):
    """Human location string for a property (city, falling back to address)."""
    return (getattr(prop, 'city', '') or '').strip() or (getattr(prop, 'address', '') or '').strip()


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
            'id': str(project.id),
            'name': project.name,
            'location': _location(prop),
        },
        'unit': {
            'code': unit.code,
            'type': unit.unit_type,
            'floor': unit.floor,
            'area': str(unit.area) if unit.area is not None else None,
            'bedrooms': _bedrooms(unit.unit_type),
        },
        'price': str(listing.list_price),
        'minimum_deposit_percent': str(listing.minimum_deposit_percent),
        'construction_progress': str(listing.construction_progress),
        'status': listing.status,
        'is_featured': bool(listing.is_featured),
        'images': images,
    }
    if detail:
        # properties.Project carries no description of its own; the optional
        # construction profile does (related_name='construction_profile').
        profile = getattr(project, 'construction_profile', None)
        payload['project']['description'] = (getattr(profile, 'description', '') or '').strip()
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
    ).select_related('unit', 'project', 'project__property').prefetch_related('renders').order_by('-is_featured', 'list_price')
    query = (request.query_params.get('search') or '').strip()
    if query:
        queryset = queryset.filter(
            Q(unit__code__icontains=query) | Q(project__name__icontains=query)
            | Q(unit__unit_type__icontains=query),
        )
    location = (request.query_params.get('location') or '').strip()
    if location:
        queryset = queryset.filter(
            Q(project__property__city__icontains=location)
            | Q(project__property__address__icontains=location),
        )
    unit_type = (request.query_params.get('type') or '').strip()
    if unit_type:
        queryset = queryset.filter(unit__unit_type__icontains=unit_type)
    project_id = (request.query_params.get('project') or '').strip()
    if project_id:
        try:
            uuid.UUID(project_id)
        except (ValueError, TypeError):
            return Response({'results': []})
        queryset = queryset.filter(project_id=project_id)
    for key, lookup in (('min_price', 'list_price__gte'), ('max_price', 'list_price__lte')):
        bound = (request.query_params.get(key) or '').strip()
        if bound:
            try:
                queryset = queryset.filter(**{lookup: bound})
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


@api_view(['GET'])
@permission_classes([AllowAny])
def public_projects(request):
    """Projects that currently have available listings, aggregated for the
    public storefront: price range, counts, cover image, progress."""
    organization = _public_org()
    if organization is None:
        return _no_storefront()
    projects = Project.objects.filter(
        organization=organization, sale_listings__status=SaleListing.Status.AVAILABLE,
    ).select_related('property').distinct()
    results = []
    for project in projects:
        available = SaleListing.objects.filter(
            project=project, status=SaleListing.Status.AVAILABLE,
        ).order_by('-is_featured', 'list_price')
        cover = available.first()
        image = ''
        if cover is not None:
            renders = [r for r in cover.renders.all() if _render_url(r)]
            primary = next((r for r in renders if r.is_primary), None)
            image = _render_url(primary or renders[0]) if renders else ''
        prices = [listing.list_price for listing in available]
        progress = [listing.construction_progress for listing in available]
        profile = getattr(project, 'construction_profile', None)
        results.append({
            'id': str(project.id),
            'code': project.code,
            'name': project.name,
            'status': project.status,
            'location': _location(project.property),
            'description': (getattr(profile, 'description', '') or '').strip(),
            'listing_count': len(prices),
            'min_price': str(min(prices)) if prices else None,
            'max_price': str(max(prices)) if prices else None,
            'construction_progress': str(round(sum(progress) / len(progress))) if progress else '0',
            'is_featured': available.filter(is_featured=True).exists(),
            'image': image,
        })
    results.sort(key=lambda item: (not item['is_featured'], item['name']))
    return Response({'results': results})


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
