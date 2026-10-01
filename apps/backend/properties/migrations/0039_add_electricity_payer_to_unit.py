from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0038_lease_offer_letter_signed_on'),
    ]

    operations = [
        migrations.AddField(
            model_name='unit',
            name='electricity_payer',
            field=models.CharField(
                choices=[('owner', 'Unit Owner / Landlord'), ('tenant', 'Tenant')],
                default='tenant',
                max_length=20,
            ),
        ),
    ]
