import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from organizations.models import Organization, Membership, Role, MembershipRole

User = get_user_model()

def setup_user():
    # 1. Locate organization Legend Management
    org = Organization.objects.filter(name__icontains='Legend').first()
    if not org:
        # Fallback to demo org or create
        org = Organization.objects.first()
        print(f"Warning: Legend Management org not found, using {org.name}")
    else:
        print(f"Found organization: {org.name} (ID: {org.id}, Slug: {org.slug})")

    # 2. Locate or create Property Manager role
    role = Role.objects.filter(organization=org, slug='property-manager').first()
    if not role:
        role = Role.objects.filter(slug='property-manager').first()
    if not role:
        role, _ = Role.objects.get_or_create(
            organization=org,
            name='Property Manager',
            slug='property-manager'
        )
    print(f"Property Manager Role: {role.name} (ID: {role.id})")

    DEFAULT_PASSWORD = "Legend@Bryan2026!"

    # 3. Create or update user 'bryan'
    bryan, created = User.objects.get_or_create(
        username='bryan',
        defaults={
            'email': 'bryan@propertylegend.com',
            'first_name': 'Bryan',
            'last_name': '',
            'is_active': True,
        }
    )
    bryan.first_name = 'Bryan'
    bryan.email = 'bryan@propertylegend.com'
    bryan.is_active = True
    bryan.set_password(DEFAULT_PASSWORD)
    bryan.save()
    print(f"{'Created' if created else 'Updated'} user 'bryan' (ID: {bryan.id})")

    # 4. Also update 'brian' if it exists so both spellings work
    brian = User.objects.filter(username='brian').first()
    if brian:
        brian.first_name = 'Bryan'
        brian.set_password(DEFAULT_PASSWORD)
        brian.save()
        print(f"Synchronized user 'brian' (ID: {brian.id}) with same password")

    # 5. Ensure membership for 'bryan' in org
    for u in [bryan, brian] if brian else [bryan]:
        membership, m_created = Membership.objects.get_or_create(
            organization=org,
            user=u,
            defaults={
                'status': Membership.Status.ACTIVE,
                'is_organization_admin': False,
                'is_default': True,
            }
        )
        membership.status = Membership.Status.ACTIVE
        membership.is_organization_admin = False
        membership.is_default = True
        membership.save()

        # Ensure role is attached
        MembershipRole.objects.get_or_create(membership=membership, role=role)

        # Ensure NO access to any properties for now
        membership.assigned_properties.clear()
        print(f"Configured membership for {u.username} in {org.name}:")
        print(f" - Roles: {[r.name for r in membership.roles.all()]}")
        print(f" - Assigned properties count: {membership.assigned_properties.count()}")

    print("\nSUCCESS: User Bryan successfully configured!")
    print(f"Username: bryan (or brian)")
    print(f"Password: {DEFAULT_PASSWORD}")
    print(f"Organization: {org.name}")
    print(f"Role: Property Manager")
    print(f"Assigned Properties: 0 (No property access)")

if __name__ == '__main__':
    setup_user()
