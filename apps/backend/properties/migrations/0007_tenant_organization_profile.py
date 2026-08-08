import django.db.models.deletion
from django.db import migrations, models


def backfill_onboarding_property(apps, schema_editor):
    Tenant = apps.get_model('properties', 'Tenant')
    for tenant in Tenant.objects.filter(property__isnull=True).iterator():
        lease = tenant.leases.select_related('unit__property').order_by('-created_at').first()
        if lease:
            tenant.property_id = lease.unit.property_id
            tenant.save(update_fields=('property',))


class Migration(migrations.Migration):
    dependencies = [('properties', '0006_lease_renewed_from_invoicereminder_banktransaction')]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='directors',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='tenant',
            name='property',
            field=models.ForeignKey(blank=True, help_text='Property where this tenant or prospect was onboarded.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='onboarded_tenants', to='properties.property'),
        ),
        migrations.AddField(
            model_name='tenant',
            name='registration_number',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.RunPython(backfill_onboarding_property, migrations.RunPython.noop),
    ]
