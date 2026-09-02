from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('properties', '0029_receipting_payer_wallet')]

    operations = [
        migrations.AlterField(
            model_name='receipt',
            name='paying_for',
            field=models.CharField(
                choices=[
                    ('automatic', 'Automatic priority allocation'),
                    ('rent', 'Rent'), ('service_charge', 'Service charge'),
                    ('utilities', 'Water / electricity'), ('management_fee', 'Management fee'),
                    ('letting_fee', 'Letting fee'), ('facility_management_fee', 'Facility management fee'),
                    ('other', 'Other'),
                ],
                default='automatic', max_length=32,
            ),
        ),
    ]
