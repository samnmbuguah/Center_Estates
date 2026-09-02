"""Export a consistent SQLite snapshot through Django's serializer.

Run via ``manage.py shell -c`` with ``SOURCE_SQLITE`` and ``FIXTURE_OUT`` set.
It is used for database cutover work so Django reads the immutable snapshot,
not a concurrently changing production file.
"""

import os

from django.conf import settings
from django.core.management import call_command
from django.db import connections


snapshot = os.environ["SOURCE_SQLITE"]
output = os.environ["FIXTURE_OUT"]

settings.DATABASES["default"]["NAME"] = snapshot
connections.databases["default"]["NAME"] = snapshot
connections["default"].close()

with open(output, "w", encoding="utf-8") as stream:
    call_command(
        "dumpdata",
        natural_foreign=True,
        natural_primary=True,
        exclude=["contenttypes", "auth.permission", "sessions"],
        indent=0,
        stdout=stream,
    )
