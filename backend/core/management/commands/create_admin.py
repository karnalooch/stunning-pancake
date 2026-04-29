import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = 'Creates a default superuser if it does not exist'

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin@sport.com')
        email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@sport.com')
        password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'Sport2026!')

        if not User.objects.filter(username=username).exists():
            user = User.objects.create_superuser(username=username, email=email, password=password)
            user.role = 'GLOBAL_OWNER'
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully created superuser: {username}'))
        else:
            user = User.objects.get(username=username)
            user.role = 'GLOBAL_OWNER'
            user.save()
            self.stdout.write(self.style.WARNING(f'Superuser {username} already exists, role elevated to GLOBAL_OWNER'))
