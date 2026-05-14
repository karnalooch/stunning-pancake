import os
import random

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import User  # noqa: E402


def seed_athletes():
    first_names = ["Adam", "Ewa", "Piotr", "Anna", "Marek", "Katarzyna", "Tomasz", "Magdalena", "Krzysztof", "Zofia"]
    last_names = ["Kowalski", "Nowak", "Wisniewski", "Wojcik", "Kaminski", "Lewandowski", "Zielinski", "Szymanski", "Wozniak", "Dabrowski"]

    for i in range(10):
        username = f"athlete_{i+1:03d}"
        if not User.objects.filter(username=username).exists():
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            email = f"{username}@example.com"

            user = User.objects.create_user(
                username=username,
                email=email,
                password="athlete_password_2026",
                first_name=first_name,
                last_name=last_name,
                role='ATHLETE',
                tenant_id='Siedlce'
            )
            print(f"Created user: {user.username} ({user.first_name} {user.last_name})")
        else:
            print(f"User {username} already exists.")

if __name__ == "__main__":
    seed_athletes()
