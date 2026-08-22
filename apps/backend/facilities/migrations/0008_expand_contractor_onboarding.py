from django.db import migrations, models


def assign_existing_provider_properties(apps, schema_editor):
    Contractor = apps.get_model('facilities', 'Contractor')
    WorkOrder = apps.get_model('facilities', 'WorkOrder')
    ContractorContract = apps.get_model('facilities', 'ContractorContract')
    for contractor in Contractor.objects.all().iterator():
        property_ids = set(WorkOrder.objects.filter(contractor_id=contractor.id).values_list('property_id', flat=True))
        property_ids.update(ContractorContract.objects.filter(contractor_id=contractor.id).values_list('property_id', flat=True))
        if property_ids:
            contractor.assigned_properties.add(*property_ids)


class Migration(migrations.Migration):
    dependencies = [
        ('facilities', '0007_contractor_coverage_areas_contractor_emergency_phone_and_more'),
        ('properties', '0016_paymentintent_metadata'),
    ]

    operations = [
        migrations.AddField(
            model_name='contractor',
            name='approval_status',
            field=models.CharField(choices=[('draft', 'Draft'), ('pending', 'Pending approval'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=16),
        ),
        migrations.AddField(
            model_name='contractor',
            name='assigned_properties',
            field=models.ManyToManyField(blank=True, related_name='facility_contractors', to='properties.property'),
        ),
        migrations.AddField(
            model_name='contractor',
            name='is_blacklisted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='contractor',
            name='is_preferred',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='contractor',
            name='metadata',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(assign_existing_provider_properties, migrations.RunPython.noop),
    ]
