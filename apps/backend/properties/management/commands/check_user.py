from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from organizations.models import Membership

class Command(BaseCommand):
    help = 'Inspects a user'

    def add_arguments(self, parser):
        parser.add_argument('--name', type=str, default='sharon')

    def handle(self, *args, **options):
        query = options['name']
        User = get_user_model()
        users = User.objects.filter(username__icontains=query) | User.objects.filter(email__icontains=query) | User.objects.filter(first_name__icontains=query)
        self.stdout.write(f'Found {users.count()} user(s) matching {query}:')
        for u in users:
            self.stdout.write(f'User: id={u.id}, username={u.username}, email={u.email}, is_active={u.is_active}, role={getattr(u, "role", "N/A")}, is_staff={u.is_staff}')
            for m in Membership.objects.filter(user=u):
                roles_str = ', '.join([r.name for r in m.roles.all()])
                self.stdout.write(f'  Organization: {m.organization.name} (id={m.organization.id}), Admin: {m.is_organization_admin}, Status: {m.status}, Roles: {roles_str}')
