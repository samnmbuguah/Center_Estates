from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('notifications', '0002_emailconfiguration_usernotificationpreference')]

    operations = [
        migrations.AlterField(
            model_name='emailconfiguration',
            name='from_name',
            field=models.CharField(default='CeEst ERP', max_length=120),
        ),
    ]
