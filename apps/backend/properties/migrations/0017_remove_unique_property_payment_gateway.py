from django.db import migrations


class Migration(migrations.Migration):
    """
    Remove the unique_property_payment_gateway constraint so that a property
    can have multiple M-Pesa/bank gateway configurations (e.g. Coop Paybill,
    KCB Paybill, Equity Till, etc.).
    """

    dependencies = [
        ('properties', '0016_paymentintent_metadata'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='paymentgatewayconfiguration',
            name='unique_property_payment_gateway',
        ),
    ]
