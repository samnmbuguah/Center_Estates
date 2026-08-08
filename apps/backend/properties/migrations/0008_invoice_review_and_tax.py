import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_invoice_subtotals(apps, schema_editor):
    Invoice = apps.get_model('properties', 'Invoice')
    Invoice.objects.filter(subtotal=0).update(subtotal=models.F('amount'))


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('properties', '0007_tenant_organization_profile'),
    ]

    operations = [
        migrations.AddField(model_name='invoice', name='issued_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='invoice', name='issued_by', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='issued_property_invoices', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='invoice', name='prepared_by', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prepared_property_invoices', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='invoice', name='reviewed_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='invoice', name='reviewed_by', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_property_invoices', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='invoice', name='subtotal', field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name='invoice', name='tax_amount', field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name='invoice', name='tax_rate', field=models.DecimalField(decimal_places=2, default=0, max_digits=5)),
        migrations.AlterField(model_name='invoice', name='status', field=models.CharField(choices=[('draft', 'Draft'), ('review', 'In review'), ('approved', 'Approved'), ('issued', 'Issued'), ('partial', 'Partially paid'), ('paid', 'Paid'), ('overdue', 'Overdue'), ('void', 'Void')], default='draft', max_length=16)),
        migrations.RunPython(backfill_invoice_subtotals, migrations.RunPython.noop),
    ]
