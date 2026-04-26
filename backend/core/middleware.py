import json
from django.db import connection
from users.models import AuditLog

class TenantRLSMiddleware:
    """
    Extracts the tenant ID from the authenticated user and sets the PostgreSQL
    session variable 'sport.current_tenant_id' so that Row-Level Security (RLS)
    policies can enforce data isolation at the database level.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and hasattr(request.user, 'tenant_id') and request.user.tenant_id:
            # Set the Postgres session variable for RLS
            with connection.cursor() as cursor:
                # UUIDs must be cast to text for set_config
                cursor.execute(f"SELECT set_config('app.tenant_id', '{str(request.user.tenant_id)}', false);")
        else:
            # Clear it out if unauthenticated or no tenant (e.g. GLOBAL_OWNER)
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config('app.tenant_id', '', false);")

        response = self.get_response(request)
        return response


class ImpersonationAuditMiddleware:
    """
    Detects if the incoming request is performed via an impersonated token
    and logs mutating requests (POST, PUT, PATCH, DELETE) to the AuditLog table.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # We process the request first, then log if successful (or log attempts)
        response = self.get_response(request)

        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Assume JWT Auth adds token payload to request.auth
            if hasattr(request, 'auth') and hasattr(request.auth, 'get'):
                is_impersonated = request.auth.get('impersonated', False)
                if is_impersonated:
                    impersonator_id = request.auth.get('impersonator_id')
                    target_user_id = request.user.id
                    action = f"{request.method} {request.path}"
                    
                    AuditLog.objects.create(
                        impersonator_id=impersonator_id,
                        target_user_id=target_user_id,
                        action=action,
                        ip_address=self.get_client_ip(request),
                        status_code=response.status_code
                    )

        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')
