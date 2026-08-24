import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('facilities', '0011_workorderattachment_uploaded_file'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FacilityIncidentAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('file', models.FileField(upload_to='facility/incidents/%Y/%m/')),
                ('name', models.CharField(max_length=180)),
                ('content_type', models.CharField(blank=True, max_length=100)),
                ('incident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='facilities.facilityincident')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='organizations.organization')),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='facility_incident_attachments', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ('-created_at',)},
        ),
    ]
