# Generated for Center Estates Native Sales Content Management System (CMS)

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('properties', '0001_initial'),
        ('sales', '0009_outreachcampaign_outreachprospect_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesContentArticle',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=220)),
                ('slug', models.SlugField(blank=True, max_length=255)),
                ('category', models.CharField(choices=[('buyer_guide', 'Homebuyer & Investor Guide'), ('neighborhood_guide', 'Neighborhood & Area Guide'), ('investment_analysis', 'ROI & Market Analysis'), ('project_update', 'Project Update & Progress'), ('promotion', 'Special Offer / Launch Promo'), ('faq', 'Sales & Legal FAQ')], default='buyer_guide', max_length=40)),
                ('summary', models.TextField(blank=True, help_text='Short excerpt for preview cards, social shares, and SEO metadata.')),
                ('body', models.TextField(help_text='Full article content formatted in Markdown or structured HTML.')),
                ('cover_image_url', models.URLField(blank=True, max_length=512)),
                ('author_name', models.CharField(blank=True, default='Center Estates Sales Team', max_length=120)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft', max_length=20)),
                ('is_featured', models.BooleanField(default=False, help_text='Pinned to the top of public guides and storefront.')),
                ('read_time_minutes', models.PositiveSmallIntegerField(default=3)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('views_count', models.PositiveIntegerField(default=0)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='organizations.organization')),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='marketing_articles', to='properties.project')),
            ],
            options={
                'ordering': ('-is_featured', '-published_at', '-created_at'),
            },
        ),
        migrations.CreateModel(
            name='SalesMarketingAsset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=200)),
                ('asset_kind', models.CharField(choices=[('brochure', 'Project Brochure (PDF)'), ('pricelist', 'Payment Plan & Price List'), ('floorplan', 'Architectural Floor Plan'), ('masterplan', 'Master Site Plan'), ('video_tour', 'Video Walkthrough'), ('virtual_tour', '3D / Virtual Tour'), ('image_still', 'High-Res Hero Rendering'), ('legal_pack', 'Letter of Offer & Legal Pack')], default='brochure', max_length=40)),
                ('file', models.FileField(blank=True, upload_to='sales/marketing_assets/%Y/%m/')),
                ('external_url', models.URLField(blank=True, help_text='External URL e.g. Cloud CDN, YouTube, Matterport', max_length=512)),
                ('file_size', models.PositiveIntegerField(default=0)),
                ('mime_type', models.CharField(blank=True, max_length=80)),
                ('is_public', models.BooleanField(default=True, help_text='Whether this asset is shareable with prospective buyers.')),
                ('downloads_count', models.PositiveIntegerField(default=0)),
                ('description', models.TextField(blank=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='organizations.organization')),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='marketing_assets', to='properties.project')),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.CreateModel(
            name='ProjectMarketingProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('headline', models.CharField(blank=True, help_text='Catchy sales tagline', max_length=220)),
                ('marketing_pitch', models.TextField(blank=True, help_text='Comprehensive sales narrative and lifestyle description')),
                ('amenities', models.JSONField(blank=True, default=list, help_text='Amenities and features e.g. ["Infinity Pool", "Borehole", "Gym"]')),
                ('virtual_tour_url', models.URLField(blank=True, max_length=512)),
                ('video_tour_url', models.URLField(blank=True, max_length=512)),
                ('brochure_url', models.URLField(blank=True, max_length=512)),
                ('is_featured', models.BooleanField(default=False)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='organizations.organization')),
                ('project', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='marketing_profile', to='properties.project')),
            ],
            options={
                'ordering': ('project__name',),
            },
        ),
        migrations.AddConstraint(
            model_name='salescontentarticle',
            constraint=models.UniqueConstraint(fields=('organization', 'slug'), name='unique_org_article_slug'),
        ),
    ]
