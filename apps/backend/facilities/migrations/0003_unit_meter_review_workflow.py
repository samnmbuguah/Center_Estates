from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def approve_existing_readings(apps, schema_editor):
    MeterReading = apps.get_model('facilities', 'MeterReading')
    MeterReading.objects.filter(status='pending').update(status='approved')


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('facilities', '0002_workorderattachment_workordercostitem_workorderevent'),
        ('properties', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='utilitymeter',
            name='property_unit',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='utility_meters', to='properties.unit'),
        ),
        migrations.AddField(
            model_name='meterreading',
            name='previous_value',
            field=models.DecimalField(decimal_places=3, default=0, max_digits=16),
        ),
        migrations.AddField(
            model_name='meterreading',
            name='review_notes',
            field=models.CharField(blank=True, max_length=250),
        ),
        migrations.AddField(
            model_name='meterreading',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='meterreading',
            name='reviewed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_meter_readings', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='meterreading',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending review'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=16),
        ),
        migrations.RunPython(approve_existing_readings, migrations.RunPython.noop),
    ]
