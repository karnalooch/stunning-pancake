from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import AuditLog, Tenant, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'tenant', 'is_active')
    list_filter = ('role', 'tenant', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email')

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'email')}),
        (_('SPORT Role & Tenant'), {'fields': ('role', 'tenant', 'is_premium')}),
        (_('Permissions'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Stripe'), {'fields': ('stripe_customer_id', 'stripe_connect_id')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'role', 'tenant'),
        }),
    )


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
