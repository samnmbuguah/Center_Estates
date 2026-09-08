from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('notifications', '0003_alter_emailconfiguration_from_name')]

    operations = [
        migrations.AddField(
            model_name='emailconfiguration', name='delivery_mode',
            field=models.CharField(
                choices=[('test', 'Test inbox only'), ('live', 'Live recipients')],
                default='test', max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='emailconfiguration', name='test_recipient',
            field=models.EmailField(default='albin.sigei@gmail.com', max_length=254),
        ),
    ]
