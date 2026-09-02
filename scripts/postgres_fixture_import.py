"""Import a Django JSON fixture without generating new audit events.

Run through ``manage.py shell -c`` after Django has been configured for the
target database.  This is intentionally a small cutover utility: it preserves
historical AuditEvent rows rather than creating migration-time audit noise.
"""

import os

from audit.signals import auto_audit_post_delete, auto_audit_post_save
from django.core import serializers
from django.db import transaction
from django.db.models.signals import post_delete, post_save


fixture = os.environ["POSTGRES_FIXTURE"]
post_save.disconnect(auto_audit_post_save)
post_delete.disconnect(auto_audit_post_delete)

count = 0
with transaction.atomic():
    with open(fixture, encoding="utf-8") as stream:
        for obj in serializers.deserialize("json", stream, ignorenonexistent=False):
            obj.save(using="default")
            count += 1

print(f"Imported {count} objects")
