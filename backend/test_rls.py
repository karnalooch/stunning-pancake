import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from activities.models import Activity
from users.models import Tenant

def test_rls():
    print("Testing PostgreSQL RLS...")
    
    # 1. Fetch tenants
    siedlce = Tenant.objects.get(name='Siedlce City')
    warsaw = Tenant.objects.get(name='Warsaw Runners')
    
    print(f"Total Activities in DB (admin bypass): {Activity.objects.count()}")

    # 2. Test as Siedlce
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT set_config('app.tenant_id', '{siedlce.id}', false);")
    
    siedlce_count = Activity.objects.count()
    print(f"Activities visible to Siedlce: {siedlce_count}")

    # 3. Test as Warsaw
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT set_config('app.tenant_id', '{warsaw.id}', false);")
    
    warsaw_count = Activity.objects.count()
    print(f"Activities visible to Warsaw: {warsaw_count}")

    # 4. Clear context
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.tenant_id', '', false);")

if __name__ == "__main__":
    test_rls()
