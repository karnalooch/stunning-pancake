from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Event, Participation, Achievement


@admin.register(Event)
class EventAdmin(GISModelAdmin):
    list_display = ["title", "event_type", "status", "start_date", "end_date", "tenant_id"]
    list_filter = ["status", "event_type", "sport_filter"]
    search_fields = ["title", "tenant_id"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Participation)
class ParticipationAdmin(admin.ModelAdmin):
    list_display = ["user", "event", "total_km", "score", "activity_count", "last_updated"]
    list_filter = ["event"]
    search_fields = ["user__username"]


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ["user", "achievement_type", "title", "event", "awarded_at"]
    list_filter = ["achievement_type"]
    search_fields = ["user__username", "title"]
