import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Creates default admin accounts (global_owner + admin@sport.com) if they do not exist"

    def handle(self, *args, **options):
        User = get_user_model()

        # 1. Primary superuser: admin@sport.com
        username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin@sport.com")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@sport.com")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "Sport2026!")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )
        if created:
            user.set_password(password)
            user.role = "GLOBAL_OWNER"
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created superuser: {username}"))
        else:
            user.role = "GLOBAL_OWNER"
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(
                self.style.WARNING(f"Superuser already exists, role sync: {username}")
            )

        # 2. Global Owner (seed_data.py convention): global_owner / admin123
        owner_username = os.getenv("GLOBAL_OWNER_USERNAME", "global_owner")
        owner_email = os.getenv("GLOBAL_OWNER_EMAIL", "owner@sport-platform.com")
        owner_password = os.getenv("GLOBAL_OWNER_PASSWORD", "admin123")

        owner, created = User.objects.get_or_create(
            username=owner_username,
            defaults={"email": owner_email},
        )
        owner.set_password(owner_password)
        owner.role = "GLOBAL_OWNER"
        owner.is_staff = True
        owner.is_superuser = True
        owner.save()
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created global owner: {owner_username}"))
        else:
            self.stdout.write(
                self.style.WARNING(f"Global owner already exists, password reset: {owner_username}")
            )

        # 3. Set up Google Social App for allauth (if env vars are present)
        google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        google_secret = os.getenv("GOOGLE_SECRET", "")
        if google_client_id and google_secret:
            from django.contrib.sites.models import Site
            from allauth.socialaccount.models import SocialApp

            site, _ = Site.objects.get_or_create(
                id=1, defaults={"domain": "4velo.app", "name": "4VELO"}
            )
            site.domain = "4velo.app"
            site.name = "4VELO"
            site.save()

            app, created = SocialApp.objects.update_or_create(
                provider="google",
                defaults={
                    "name": "Google",
                    "client_id": google_client_id,
                    "secret": google_secret,
                },
            )
            app.sites.add(site)
            self.stdout.write(self.style.SUCCESS("Google Social App configured"))
