from django.db import migrations, models


def classify_existing_inventory(apps, schema_editor):
    asset_model = apps.get_model('facilities', 'FacilityAsset')
    for asset in asset_model.objects.all().only('id', 'category', 'name'):
        searchable = f'{asset.category} {asset.name}'.lower()
        inventory_type = 'asset'
        if 'consum' in searchable or 'supply' in searchable:
            inventory_type = 'consumable'
        elif 'spare' in searchable or 'replacement part' in searchable:
            inventory_type = 'spare_part'
        if inventory_type != 'asset':
            asset_model.objects.filter(pk=asset.pk).update(inventory_type=inventory_type)


class Migration(migrations.Migration):
    dependencies = [('facilities', '0020_add_qm_performance_indexes')]

    operations = [
        migrations.AddField(
            model_name='facilityasset',
            name='inventory_type',
            field=models.CharField(
                choices=[('asset', 'Asset / equipment'), ('spare_part', 'Spare part'), ('consumable', 'Consumable')],
                default='asset',
                max_length=20,
            ),
        ),
        migrations.RunPython(classify_existing_inventory, migrations.RunPython.noop),
    ]
