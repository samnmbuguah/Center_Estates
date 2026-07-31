from django.contrib import admin

from .models import Building, Project, Property, Unit

admin.site.register((Property, Building, Unit, Project))

# Register your models here.
