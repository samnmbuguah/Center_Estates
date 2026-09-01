import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('organizations', '0005_seed_embedded_default_roles'),
    ]

    operations = [
        migrations.CreateModel(
            name='ClientErrorEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('fingerprint', models.CharField(db_index=True, max_length=64)),
                ('message', models.CharField(max_length=500)),
                ('stack', models.TextField(blank=True)),
                ('component_stack', models.TextField(blank=True)),
                ('url', models.CharField(blank=True, max_length=500)),
                ('release', models.CharField(blank=True, max_length=50)),
                ('extra', models.JSONField(blank=True, default=dict)),
                ('occurrences', models.PositiveIntegerField(default=1)),
                ('first_seen_at', models.DateTimeField()),
                ('last_seen_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('open', 'Open'), ('resolved', 'Resolved'), ('ignored', 'Ignored')], default='open', max_length=16)),
                ('organization', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='client_error_events', to='organizations.organization')),
            ],
            options={'ordering': ('-last_seen_at',)},
        ),
        migrations.AddConstraint(
            model_name='clienterrorevent',
            constraint=models.UniqueConstraint(fields=('organization', 'fingerprint'), name='unique_client_error_event_per_organization_fingerprint'),
        ),
    ]
