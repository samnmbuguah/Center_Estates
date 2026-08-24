from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('properties', '0022_parkingassignment')]

    operations = [
        migrations.AddField(
            model_name='invoicereminder',
            name='notice_type',
            field=models.CharField(
                choices=[
                    ('payment_reminder', 'Payment reminder'),
                    ('formal_demand', 'Formal demand'),
                    ('notice_to_vacate', 'Notice to vacate'),
                ],
                default='payment_reminder', max_length=24,
            ),
        ),
    ]
