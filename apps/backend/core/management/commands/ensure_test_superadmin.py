import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create or rotate a dedicated super-admin account used by production smoke tests.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='ceest-test-admin')
        parser.add_argument('--email', default='ceest-test-admin@centerestates.com')

    def handle(self, *args, **options):
        password = os.environ.get('CEEST_TEST_ADMIN_PASSWORD', '')
        if len(password) < 16:
            raise CommandError('CEEST_TEST_ADMIN_PASSWORD must contain at least 16 characters.')
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=options['username'],
            defaults={'email': options['email'], 'is_staff': True, 'is_superuser': True, 'is_active': True},
        )
        user.email = options['email']
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save(update_fields=('email', 'is_staff', 'is_superuser', 'is_active', 'password'))
        self.stdout.write(self.style.SUCCESS(f'{"Created" if created else "Updated"} test super-admin {user.username}.'))
