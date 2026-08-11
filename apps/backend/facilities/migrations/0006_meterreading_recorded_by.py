from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('facilities', '0005_meterreading_method_meterreading_source_reference_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='meterreading',
            name='recorded_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name='recorded_meter_readings', to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
