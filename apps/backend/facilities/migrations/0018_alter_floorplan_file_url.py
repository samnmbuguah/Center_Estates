# Generated from the intentional FloorPlan upload contract change.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('facilities', '0017_floorplan_files_and_preview'),
    ]

    operations = [
        migrations.AlterField(
            model_name='floorplan',
            name='file_url',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
