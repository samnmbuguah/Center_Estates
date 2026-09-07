from django.db import migrations, models


def claim_historical_references(apps, schema_editor):
    Receipt = apps.get_model('properties', 'Receipt')
    claimed = set()
    for receipt in Receipt.objects.exclude(external_reference='').order_by('created_at', 'pk').iterator():
        key = (receipt.external_reference or '').strip().upper()
        if not key:
            continue
        claim = (receipt.organization_id, key)
        # Keep every historical receipt for audit purposes. The earliest row
        # claims the reference; any historical duplicates remain visible but
        # cannot cause the new database constraint to fail.
        if claim not in claimed:
            Receipt.objects.filter(pk=receipt.pk).update(external_reference_key=key)
            claimed.add(claim)


class Migration(migrations.Migration):
    dependencies = [('properties', '0033_property_created_by')]

    operations = [
        migrations.AddField(
            model_name='receipt',
            name='external_reference_key',
            field=models.CharField(blank=True, editable=False, max_length=120, null=True),
        ),
        migrations.RunPython(claim_historical_references, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='receipt',
            constraint=models.UniqueConstraint(
                condition=models.Q(external_reference_key__isnull=False),
                fields=('organization', 'external_reference_key'),
                name='unique_organization_receipt_external_ref',
            ),
        ),
    ]
