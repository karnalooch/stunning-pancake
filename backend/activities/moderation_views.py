"""Moderation queue API — SSOT for TENANT_MODERATOR / TENANT_ADMIN inbox."""

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdminOrModerator

from .models import Activity

MODERATION_TENANT_ROLES = ("TENANT_ADMIN", "TENANT_MODERATOR")
MODERATION_ALLOWED_ASSIGNEE_ROLES = MODERATION_TENANT_ROLES + ("GLOBAL_OWNER",)


def _user_tenant_id(user):
    return getattr(user, "tenant_id", None)


def scope_moderation_queryset(user, qs=None):
    """Return a moderation queryset scoped to the effective tenant of ``user``.

    ``GLOBAL_OWNER`` keeps the full queryset; ``TENANT_ADMIN`` / ``TENANT_MODERATOR``
    see only their own tenant; every other role (or a tenant role without a
    tenant) gets an empty queryset — there is no implicit global fallback.
    The filter always operates on the canonical ``Activity.tenant_id`` column.
    """
    if qs is None:
        qs = Activity.objects.all()
    role = getattr(user, "role", None)
    if role == "GLOBAL_OWNER":
        return qs
    if role in MODERATION_TENANT_ROLES:
        tenant_id = _user_tenant_id(user)
        if tenant_id:
            return qs.filter(tenant_id=tenant_id)
    return qs.none()


def _get_moderatable_activity(request, activity_id: int) -> Activity:
    """Load an activity through the approved moderation scope.

    Preserves the documented 403 contract for explicit cross-tenant attempts
    while routing tenant roles without a tenant and other disallowed roles
    through the same ``PermissionDenied`` path (fail-closed).
    """
    user = request.user
    role = getattr(user, "role", None)
    if role == "GLOBAL_OWNER" or role in MODERATION_TENANT_ROLES:
        activity = Activity.objects.select_related("user", "tenant").get(pk=activity_id)
        if not scope_moderation_queryset(user, Activity.objects.filter(pk=activity.id)).exists():
            raise PermissionDenied("Cross-tenant moderation is not allowed.")
        return activity
    raise PermissionDenied("Moderation is not permitted for this role.")


def _queue_row(activity: Activity) -> dict:
    assignee = activity.moderation_assignee
    return {
        "id": activity.id,
        "activity_id": activity.id,
        "user": activity.user.username if activity.user_id else "Unknown",
        "username": activity.user.username if activity.user_id else "Unknown",
        "type": activity.type,
        "distance": activity.distance,
        "score": float(activity.verification_score or 0),
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
        "tenant_id": str(activity.tenant_id) if activity.tenant_id else None,
        "assignee_id": assignee.id if assignee else None,
        "assignee_username": assignee.username if assignee else None,
    }


class ModerationQueueView(APIView):
    """
    GET /api/activities/admin/moderation/queue/
    Paginated pending queue with tenant scope and optional filters.
    """

    permission_classes = (permissions.IsAuthenticated, IsAdminOrModerator)

    def get(self, request):
        score_lt = request.query_params.get("score_lt")
        assigned_to = request.query_params.get("assigned_to")
        queue_type = request.query_params.get("type", "activities")

        if queue_type != "activities":
            return Response({"results": [], "count": 0, "type": queue_type})

        qs = scope_moderation_queryset(
            request.user,
            Activity.objects.filter(is_verified=False)
            .select_related("user", "moderation_assignee")
            .order_by("-created_at"),
        )

        if score_lt is not None:
            try:
                qs = qs.filter(verification_score__lt=float(score_lt))
            except (TypeError, ValueError):
                pass

        if assigned_to == "me":
            qs = qs.filter(moderation_assignee=request.user)

        user_tenant = _user_tenant_id(request.user)
        limit = min(int(request.query_params.get("limit", 50)), 200)
        rows = [_queue_row(a) for a in qs[:limit]]
        return Response(
            {
                "results": rows,
                "count": qs.count(),
                "scoped_tenant_id": str(user_tenant) if user_tenant else None,
            }
        )


def record_moderation_audit(request, activity: Activity, action: str, details: dict | None = None):
    from users.models import AuditLog

    AuditLog.objects.create(
        action=action,
        status_code=200,
        ip_address=request.META.get("REMOTE_ADDR"),
        tenant_id=str(activity.tenant_id) if activity.tenant_id else None,
        target_user=activity.user,
        details=details or {"activity_id": activity.id},
    )


def apply_moderation_approve(request, activity: Activity) -> dict:
    activity.is_verified = True
    activity.verification_score = 1.0
    activity.moderated_at = timezone.now()
    activity.moderated_by = request.user
    activity.rejection_reason = ""
    activity.rejection_notes = ""
    activity.save(
        update_fields=[
            "is_verified",
            "verification_score",
            "moderated_at",
            "moderated_by",
            "rejection_reason",
            "rejection_notes",
        ]
    )

    from activities.leaderboard_credit import credit_verified_activity

    credited = credit_verified_activity(activity)

    record_moderation_audit(request, activity, "MODERATION_APPROVE")
    from activities.admin_stats import invalidate_dashboard_stats_cache

    invalidate_dashboard_stats_cache(str(activity.tenant_id) if activity.tenant_id else None)

    gpx_archived = False
    if activity.route_path_id and activity.route_path and activity.route_path.num_coords >= 2:
        from activities.tasks import generate_gpx_task

        generate_gpx_task.delay(activity.id)
        gpx_archived = True

    return {
        "status": "approved",
        "activity_id": activity.id,
        "user": activity.user.username,
        "verification_score": activity.verification_score,
        "leaderboard_credited": credited,
        "gpx_archive_queued": gpx_archived,
    }


def apply_moderation_reject(request, activity: Activity, reason: str = "", notes: str = "") -> dict:
    valid_reasons = {c[0] for c in Activity.REJECTION_REASONS}
    if reason and reason not in valid_reasons:
        reason = "OTHER"

    activity.is_verified = False
    activity.verification_score = 0.0
    activity.moderated_at = timezone.now()
    activity.moderated_by = request.user
    activity.rejection_reason = reason or "OTHER"
    activity.rejection_notes = notes or ""
    activity.save(
        update_fields=[
            "is_verified",
            "verification_score",
            "moderated_at",
            "moderated_by",
            "rejection_reason",
            "rejection_notes",
        ]
    )

    record_moderation_audit(
        request,
        activity,
        "MODERATION_REJECT",
        {"activity_id": activity.id, "reason": activity.rejection_reason, "notes": notes},
    )
    from activities.admin_stats import invalidate_dashboard_stats_cache

    invalidate_dashboard_stats_cache(str(activity.tenant_id) if activity.tenant_id else None)

    return {
        "status": "rejected",
        "activity_id": activity.id,
        "user": activity.user.username,
        "verification_score": activity.verification_score,
        "rejection_reason": activity.rejection_reason,
        "rejection_notes": activity.rejection_notes,
    }


class ModerationAssignView(APIView):
    """PATCH assignee for a pending activity."""

    permission_classes = (permissions.IsAuthenticated, IsAdminOrModerator)

    def patch(self, request, activity_id: int):
        try:
            activity = _get_moderatable_activity(request, activity_id)
        except Activity.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionDenied as exc:
            return Response({"detail": str(exc.detail)}, status=status.HTTP_403_FORBIDDEN)

        assignee_id = request.data.get("assignee_id")
        if assignee_id is None:
            activity.moderation_assignee = None
        else:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            try:
                assignee = User.objects.get(pk=assignee_id)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Assignee not found"}, status=status.HTTP_400_BAD_REQUEST
                )
            if getattr(assignee, "role", None) not in MODERATION_ALLOWED_ASSIGNEE_ROLES:
                return Response(
                    {"detail": "Assignee role is not allowed for moderation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if activity.tenant_id and str(getattr(assignee, "tenant_id", None)) != str(
                activity.tenant_id
            ):
                return Response(
                    {"detail": "Assignee must belong to the activity tenant."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            activity.moderation_assignee = assignee
        activity.save(update_fields=["moderation_assignee"])
        return Response(_queue_row(activity))


class ModerationHistoryView(APIView):
    """GET moderated activities for current user, restricted to their tenant scope."""

    permission_classes = (permissions.IsAuthenticated, IsAdminOrModerator)

    def get(self, request):
        base = (
            Activity.objects.filter(moderated_by=request.user, moderated_at__isnull=False)
            .select_related("user")
            .order_by("-moderated_at")
        )
        # Route tenant roles through the approved moderation scope so the
        # history can never surface an activity outside the requester's tenant,
        # even when an inconsistent historical row exists.
        qs = scope_moderation_queryset(request.user, base)[:100]
        rows = [
            {
                "activity_id": a.id,
                "user": a.user.username if a.user_id else "Unknown",
                "type": a.type,
                "is_verified": a.is_verified,
                "rejection_reason": a.rejection_reason or None,
                "moderated_at": a.moderated_at.isoformat() if a.moderated_at else None,
            }
            for a in qs
        ]
        return Response({"results": rows, "count": len(rows)})
