from django.db import migrations, models


def backfill_frequency(apps, schema_editor):
    BillingRun = apps.get_model('properties', 'BillingRun')
    for run in BillingRun.objects.all().iterator():
        months = max(
            1,
            (run.period_end.year - run.period_start.year) * 12
            + run.period_end.month
            - run.period_start.month
            + 1,
        )
        if months % 12 == 0:
            frequency = 'annual'
        elif months % 6 == 0:
            frequency = 'biannual'
        elif months % 3 == 0:
            frequency = 'quarterly'
        else:
            frequency = 'monthly'
        BillingRun.objects.filter(pk=run.pk).update(frequency=frequency)


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0039_add_electricity_payer_to_unit'),
    ]

    operations = [
        migrations.AddField(
            model_name='billingrun',
            name='charge_scope',
            field=models.CharField(
                choices=[
                    ('all', 'All charges'),
                    ('rent', 'Rent'),
                    ('service_charge', 'Service charge'),
                    ('utility', 'Utilities'),
                    ('other', 'Other charges'),
                ],
                default='all',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='billingrun',
            name='frequency',
            field=models.CharField(
                choices=[
                    ('monthly', 'Monthly'),
                    ('quarterly', 'Quarterly'),
                    ('biannual', 'Biannual'),
                    ('annual', 'Annual'),
                ],
                default='monthly',
                max_length=16,
            ),
        ),
        migrations.RemoveConstraint(
            model_name='billingrun',
            name='unique_property_billing_run_period',
        ),
        migrations.AddConstraint(
            model_name='billingrun',
            constraint=models.UniqueConstraint(
                fields=('organization', 'property', 'period_start', 'charge_scope'),
                name='unique_property_billing_run_scope_period',
            ),
        ),
        migrations.RunPython(backfill_frequency, migrations.RunPython.noop),
    ]
