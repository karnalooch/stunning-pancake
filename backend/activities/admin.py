from django.contrib import admin

from activities.models import DiskAuditEvent


@admin.register(DiskAuditEvent)
class DiskAuditEventAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'event_type', 'pct', 'used_gb', 'budget_gb', 'source', 'action_taken')
    list_filter = ('event_type', 'source')
    readonly_fields = (
        'created_at', 'event_type', 'used_gb', 'budget_gb', 'pct', 'action_taken', 'source',
    )
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
