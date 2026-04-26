import os
import django
from django.db import connection

# Temporarily use superuser for applying RLS
os.environ['DATABASE_URL'] = "postgres://sportuser:sportpass@db-service:5432/sport"
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from core.rls import apply_rls_policies

if __name__ == "__main__":
    print("Applying RLS policies as superuser...")
    apply_rls_policies()
    print("Done.")
