from django.contrib import admin

from .models import Membership, MembershipRole, Organization, Permission, Role

admin.site.register((Organization, Membership, MembershipRole, Permission, Role))

# Register your models here.
