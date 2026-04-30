from django.contrib import admin
from .models import User, Tenant, AuditLog


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'tenant', 'is_active')
    list_filter = ('role', 'tenant', 'is_active')
    search_fields = ('username', 'email')


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'max_users', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'impersonator', 'target_user', 'tenant_id', 'ip_address', 'status_code', 'timestamp')
    list_filter = ('action', 'status_code', 'timestamp')
    search_fields = ('action', 'impersonator__username', 'target_user__username', 'tenant_id')
    readonly_fields = ('impersonator', 'target_user', 'action', 'ip_address', 'status_code', 'timestamp', 'tenant_id')
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False  # Audit logs are read-only via admin

    def has_change_permission(self, request, obj=None):
        return False  # Audit logs are read-only via admin
