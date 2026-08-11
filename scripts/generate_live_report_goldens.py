#!/usr/bin/env python3
"""Generate golden report PDFs/XLSX from the live property reporting stack for client review."""
from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from organizations.models import Organization
from properties.models import Property
from properties.views import PropertyAnalyticsViewSet

OUT = ROOT / "docs" / "quality" / "golden-reports"
OUT.mkdir(parents=True, exist_ok=True)

REPORTS = [
    "tenant-payment-status",
    "income-expense",
    "aging",
    "tenancy-schedule",
    "vacancy",
    "vat-schedule",
    "billing-schedule",
    "budget-actual",
]


def main():
    organization = Organization.objects.filter(slug="center-estates-demo").first() or Organization.objects.first()
    if not organization:
        raise SystemExit("No organization available for golden report generation.")
    property_record = Property.objects.filter(organization=organization, code="CE-NRB-001").first() \
        or Property.objects.filter(organization=organization).first()
    user = get_user_model().objects.filter(is_superuser=True).first() or get_user_model().objects.first()
    if not user:
        raise SystemExit("No user available for golden report generation.")
    factory = APIRequestFactory()
    view = PropertyAnalyticsViewSet.as_view({"get": "export"})
    start = date(date.today().year, 1, 1).isoformat()
    end = date.today().isoformat()
    generated = []
    for report_kind in REPORTS:
        for output in ("pdf", "xlsx"):
            request = factory.get(
                f"/api/v1/property/analytics/exports/{report_kind}/",
                {"start": start, "end": end, "output": output},
                HTTP_X_ORGANIZATION_ID=str(organization.id),
                **({"HTTP_X_PROPERTY_ID": str(property_record.id)} if property_record else {}),
            )
            force_authenticate(request, user=user)
            response = view(request, report_kind=report_kind)
            if response.status_code >= 400:
                print(f"SKIP {report_kind}.{output}: {getattr(response, 'data', response.status_code)}")
                continue
            path = OUT / f"{report_kind}-{output}.{output}"
            path.write_bytes(response.content)
            generated.append(path.name)
            print(f"wrote {path.relative_to(ROOT)} ({len(response.content)} bytes)")
    print(f"Generated {len(generated)} golden artifacts in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
