from __future__ import annotations

import hashlib
import json
import uuid
from datetime import timedelta

from django.contrib.gis.geos import LineString
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from activities.models import Activity
from core.rls import global_owner_context
from users.departments import Department, UserDepartment
from users.models import AuditLog, Tenant, User

TENANT_A_ID = uuid.UUID("5a7cba35-33d2-4f89-9ca8-621fdd06a001")
TENANT_B_ID = uuid.UUID("5a7cba35-33d2-4f89-9ca8-621fdd06b002")
FIXTURE_PREFIX = "p3-recovery-"


def _fingerprint(value: object) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _parse_anchor(raw: str | None):
    if raw is None:
        return timezone.now().replace(microsecond=0)
    parsed = parse_datetime(raw)
    if parsed is None or not timezone.is_aware(parsed):
        raise CommandError("--anchor must be an ISO-8601 timezone-aware timestamp")
    return parsed.replace(microsecond=0)


def _upsert_user(*, username: str, role: str, tenant: Tenant, email: str) -> User:
    user, created = User.objects.get_or_create(username=username)
    user.role = role
    user.tenant = tenant
    user.email = email
    user.is_active = True
    if created or user.has_usable_password():
        user.set_unusable_password()
    user.save()
    return user


def _upsert_activity(
    *,
    user: User,
    tenant: Tenant,
    external_id: str,
    start_time,
    end_time,
    coordinates: tuple[tuple[float, float], ...],
) -> Activity:
    route = LineString(*coordinates, srid=4326)
    fingerprint = _fingerprint(coordinates)
    activity, _ = Activity.objects.update_or_create(
        user=user,
        external_source="GARMIN",
        external_id=external_id,
        defaults={
            "tenant": tenant,
            "type": "BIKE",
            "start_time": start_time,
            "end_time": end_time,
            "distance": 2500.0,
            "duration": end_time - start_time,
            "is_verified": True,
            "verification_score": 0.99,
            "route_path": route,
            "route_fingerprint": fingerprint,
            "gpx_forensics_flags": [],
        },
    )
    return activity


class Command(BaseCommand):
    help = "Seed deterministic synthetic P3 business data for backup/restore integrity drills."

    def add_arguments(self, parser):
        parser.add_argument(
            "--anchor",
            help="ISO-8601 timestamp used as the newest recoverable synthetic GPS point.",
        )

    def handle(self, *args, **options):
        anchor = _parse_anchor(options.get("anchor"))

        with transaction.atomic(), global_owner_context():
            tenant_a, _ = Tenant.objects.update_or_create(
                id=TENANT_A_ID,
                defaults={"name": "P3 Recovery Tenant A", "is_active": True},
            )
            tenant_b, _ = Tenant.objects.update_or_create(
                id=TENANT_B_ID,
                defaults={"name": "P3 Recovery Tenant B", "is_active": True},
            )

            admin_a = _upsert_user(
                username=f"{FIXTURE_PREFIX}admin-a",
                role="TENANT_ADMIN",
                tenant=tenant_a,
                email="p3-recovery-admin-a@example.invalid",
            )
            athlete_a = _upsert_user(
                username=f"{FIXTURE_PREFIX}athlete-a",
                role="ATHLETE",
                tenant=tenant_a,
                email="p3-recovery-athlete-a@example.invalid",
            )
            admin_b = _upsert_user(
                username=f"{FIXTURE_PREFIX}admin-b",
                role="TENANT_ADMIN",
                tenant=tenant_b,
                email="p3-recovery-admin-b@example.invalid",
            )
            athlete_b = _upsert_user(
                username=f"{FIXTURE_PREFIX}athlete-b",
                role="ATHLETE",
                tenant=tenant_b,
                email="p3-recovery-athlete-b@example.invalid",
            )

            department_a, _ = Department.objects.update_or_create(
                tenant=tenant_a,
                name="P3 Recovery Department A",
                defaults={
                    "department_type": "team",
                    "description": "Synthetic P3 recovery fixture",
                    "moderator": admin_a,
                    "is_active": True,
                },
            )
            department_b, _ = Department.objects.update_or_create(
                tenant=tenant_b,
                name="P3 Recovery Department B",
                defaults={
                    "department_type": "team",
                    "description": "Synthetic P3 recovery fixture",
                    "moderator": admin_b,
                    "is_active": True,
                },
            )
            for user, department in (
                (admin_a, department_a),
                (athlete_a, department_a),
                (admin_b, department_b),
                (athlete_b, department_b),
            ):
                UserDepartment.objects.get_or_create(user=user, department=department)

            coordinates_a = (
                (22.2700, 52.1600),
                (22.2800, 52.1650),
                (22.2900, 52.1700),
            )
            coordinates_b = (
                (22.3100, 52.1800),
                (22.3200, 52.1850),
                (22.3300, 52.1900),
            )
            activity_a = _upsert_activity(
                user=athlete_a,
                tenant=tenant_a,
                external_id="P3-RECOVERY-A",
                start_time=anchor - timedelta(minutes=10),
                end_time=anchor,
                coordinates=coordinates_a,
            )
            activity_b = _upsert_activity(
                user=athlete_b,
                tenant=tenant_b,
                external_id="P3-RECOVERY-B",
                start_time=anchor - timedelta(minutes=10),
                end_time=anchor,
                coordinates=coordinates_b,
            )

            # T70 makes audit history append-only.  The recovery fixture therefore
            # reuses its two deterministic synthetic audit rows instead of
            # deleting/re-writing them on every drill.  Their payload is stable;
            # RPO measurement is derived from GPS timestamps, not audit timestamps.
            for admin, athlete, tenant, suffix in (
                (admin_a, athlete_a, tenant_a, "A"),
                (admin_b, athlete_b, tenant_b, "B"),
            ):
                AuditLog.objects.get_or_create(
                    action=f"P3_RECOVERY_FIXTURE_{suffix}",
                    defaults={
                        "impersonator": admin,
                        "target_user": athlete,
                        "tenant_id": str(tenant.id),
                        "details": {"synthetic": True, "tenant": suffix},
                        "ip_address": "127.0.0.1",
                        "status_code": 200,
                    },
                )

            gps_rows = []
            for activity, athlete, suffix, coordinates in (
                (activity_a, athlete_a, "a", coordinates_a),
                (activity_b, athlete_b, "b", coordinates_b),
            ):
                for seq, (lon, lat) in enumerate(coordinates, start=1):
                    gps_rows.append(
                        (
                            anchor - timedelta(minutes=4 - seq),
                            f"p3-recovery-device-{suffix}",
                            athlete.pk,
                            lat,
                            lon,
                            7.5 + seq,
                            3.0,
                            activity.pk,
                            seq,
                        )
                    )

            receipt_rows = (
                (
                    "p3-recovery-batch-a",
                    activity_a.pk,
                    athlete_a.pk,
                    3,
                    3,
                    0,
                    3,
                    _fingerprint({"activity": "P3-RECOVERY-A", "seq": [1, 2, 3]}),
                    anchor,
                ),
                (
                    "p3-recovery-batch-b",
                    activity_b.pk,
                    athlete_b.pk,
                    3,
                    3,
                    0,
                    3,
                    _fingerprint({"activity": "P3-RECOVERY-B", "seq": [1, 2, 3]}),
                    anchor,
                ),
            )

            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM gps_points WHERE device_id IN (%s, %s)",
                    ["p3-recovery-device-a", "p3-recovery-device-b"],
                )
                cursor.executemany(
                    """
                    INSERT INTO gps_points
                        (time, device_id, user_id, lat, lon, speed_ms, accuracy_m, activity_id, seq)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    gps_rows,
                )
                cursor.execute(
                    "DELETE FROM telemetry_ingest_receipts WHERE client_batch_id IN (%s, %s)",
                    ["p3-recovery-batch-a", "p3-recovery-batch-b"],
                )
                cursor.executemany(
                    """
                    INSERT INTO telemetry_ingest_receipts
                        (client_batch_id, activity_id, user_id, point_count, persisted_count,
                         dropped_privacy, max_seq, payload_fingerprint, acked_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    receipt_rows,
                )

        self.stdout.write(
            json.dumps(
                {
                    "fixture": "p3-business-recovery-v1",
                    "anchor": anchor.isoformat(),
                    "tenants": 2,
                    "users": 4,
                    "departments": 2,
                    "memberships": 4,
                    "activities": 2,
                    "gps_points": 6,
                    "audit_logs": 2,
                    "telemetry_receipts": 2,
                },
                sort_keys=True,
            )
        )
