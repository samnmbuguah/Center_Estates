import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('companion', '0002_alter_taskevent_task'),
        ('properties', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='property',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='companion_tasks', to='properties.property'),
        ),
    ]
