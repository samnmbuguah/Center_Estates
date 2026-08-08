import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('properties', '0001_initial'),
        ('tenders', '0002_tenderauditevent'),
    ]

    operations = [
        migrations.AddField(
            model_name='tender',
            name='property',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='tenders', to='properties.property'),
        ),
    ]
