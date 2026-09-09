from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('facilities', '0021_facilityasset_inventory_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(model_name='localpurchaseorder', name='accepted_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='localpurchaseorder', name='accepted_by', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accepted_facility_lpos', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='localpurchaseorder', name='cancelled_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='localpurchaseorder', name='cancelled_by', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cancelled_facility_lpos', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='localpurchaseorder', name='cancellation_reason', field=models.TextField(blank=True)),
    ]
