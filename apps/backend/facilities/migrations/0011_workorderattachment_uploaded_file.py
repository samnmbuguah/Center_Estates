from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('facilities', '0010_facilityincident_facilityincidentevent_and_more')]

    operations = [
        migrations.AlterField(
            model_name='workorderattachment',
            name='file_url',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='workorderattachment',
            name='uploaded_file',
            field=models.FileField(blank=True, null=True, upload_to='facility/work-orders/%Y/%m/'),
        ),
    ]
