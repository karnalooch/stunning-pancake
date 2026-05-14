"""
Django Admin registration for Rewards & Voucher Marketplace.
"""
from django.contrib import admin

from rewards.models import PointsLedger, Sponsor, Voucher, VoucherPool


@admin.register(Sponsor)
class SponsorAdmin(admin.ModelAdmin):
    list_display = ["name", "tenant_id", "is_active", "created_at"]
    list_filter = ["is_active", "tenant_id"]
    search_fields = ["name"]


class VoucherInline(admin.TabularInline):
    model = Voucher
    extra = 0
    fields = ["code", "user", "redeemed_at", "is_used"]
    readonly_fields = ["redeemed_at"]
    show_change_link = True


@admin.register(VoucherPool)
class VoucherPoolAdmin(admin.ModelAdmin):
    list_display = ["title", "sponsor", "points_required", "available_count", "valid_from", "valid_until"]
    list_filter = ["sponsor"]
    search_fields = ["title", "sponsor__name"]
    inlines = [VoucherInline]

    def available_count(self, obj):
        return obj.available_count
    available_count.short_description = "Available"


@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ["code", "pool", "user", "redeemed_at", "is_used"]
    list_filter = ["is_used", "pool__sponsor"]
    search_fields = ["code", "user__username"]
    readonly_fields = ["redeemed_at"]


@admin.register(PointsLedger)
class PointsLedgerAdmin(admin.ModelAdmin):
    list_display = ["user", "delta", "reason", "reference_id", "created_at"]
    list_filter = ["reason"]
    search_fields = ["user__username", "reference_id"]
    readonly_fields = ["user", "delta", "reason", "reference_id", "created_at"]

    def has_add_permission(self, request):
        return False  # Append-only: never add via admin

    def has_delete_permission(self, request, obj=None):
        return False  # Ledger integrity: never delete rows
