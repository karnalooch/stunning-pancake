import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import User, Tenant  # noqa: E402

def seed_athletes():
    first_names = ["Adam", "Ewa", "Piotr", "Anna", "Marek", "Katarzyna", "Tomasz", "Magdalena", "Krzysztof", "Zofia"]
    last_names = ["Kowalski", "Nowak", "Wisniewski", "Wojcik", "Kaminski", "Lewandowski", "Zielinski", "Szymanski", "Wozniak", "Dabrowski"]
    
    tenant = Tenant.objects.filter(name__icontains='Siedlce').first()
    if not tenant:
        tenant, _ = Tenant.objects.get_or_create(
            name='Siedlce City',
            defaults={
                'primary_color': '#2563EB',
                'secondary_color': '#10B981'
            }
        )
    
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
                tenant=tenant
            )
            print(f"Created user: {user.username} ({user.first_name} {user.last_name})")
        else:
            print(f"User {username} already exists.")

if __name__ == "__main__":
    seed_athletes()
