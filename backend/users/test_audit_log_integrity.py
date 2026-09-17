from types import SimpleNamespace

import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.utils import timezone

from users.admin import AuditLogAdmin
from users.models import AuditLog, User


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="audit-owner",
        email="audit-owner@example.invalid",
        password="password123",
        role="GLOBAL_OWNER",
    )


@pytest.fixture
def audit_log(owner_user):
    return AuditLog.objects.create(
        impersonator=owner_user,
        target_user=owner_user,
        action="T70_TEST_EVENT",
        details={"source": "test"},
        status_code=200,
    )


@pytest.mark.django_db
class TestAuditLogImmutability:
    def test_instance_save_cannot_modify_existing_row(self, audit_log):
        audit_log.action = "tampered"

        with pytest.raises(ValidationError, match="append-only"):
            audit_log.save()

        audit_log.refresh_from_db()
        assert audit_log.action == "T70_TEST_EVENT"

    def test_instance_delete_is_blocked(self, audit_log):
        with pytest.raises(ValidationError, match="append-only"):
            audit_log.delete()

        assert AuditLog.objects.filter(pk=audit_log.pk).exists()

    def test_queryset_update_is_blocked(self, audit_log):
        with pytest.raises(ValidationError, match="append-only"):
            AuditLog.objects.filter(pk=audit_log.pk).update(action="tampered")

        audit_log.refresh_from_db()
        assert audit_log.action == "T70_TEST_EVENT"

    def test_queryset_delete_is_blocked(self, audit_log):
        with pytest.raises(ValidationError, match="append-only"):
            AuditLog.objects.filter(pk=audit_log.pk).delete()

        assert AuditLog.objects.filter(pk=audit_log.pk).exists()

    def test_bulk_update_is_blocked(self, audit_log):
        audit_log.status_code = 500

        with pytest.raises(ValidationError, match="append-only"):
            AuditLog.objects.bulk_update([audit_log], ["status_code"])

        audit_log.refresh_from_db()
        assert audit_log.status_code == 200


@pytest.mark.django_db
class TestAuditLogMaintenanceScope:
    def test_recovery_fixture_timestamp_override_is_prefix_scoped(self, audit_log):
        with pytest.raises(ValidationError, match="limited to P3 recovery fixtures"):
            AuditLog.objects.set_recovery_fixture_timestamp(
                pk=audit_log.pk,
                timestamp=timezone.now(),
            )

    def test_recovery_fixture_helpers_only_touch_synthetic_rows(self, owner_user, audit_log):
        synthetic = AuditLog.objects.create(
            impersonator=owner_user,
            target_user=owner_user,
            action="P3_RECOVERY_FIXTURE_T70",
            status_code=200,
        )
        anchor = timezone.now().replace(microsecond=0)

        changed = AuditLog.objects.set_recovery_fixture_timestamp(
            pk=synthetic.pk,
            timestamp=anchor,
        )
        assert changed == 1
        synthetic.refresh_from_db()
        assert synthetic.timestamp == anchor

        deleted_count, _ = AuditLog.objects.purge_recovery_fixture()
        assert deleted_count == 1
        assert not AuditLog.objects.filter(pk=synthetic.pk).exists()
        assert AuditLog.objects.filter(pk=audit_log.pk).exists()


class TestAuditLogAdminSurface:
    def test_django_admin_is_read_only(self):
        model_admin = AuditLogAdmin(AuditLog, admin.site)
        request = SimpleNamespace(user=None)

        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request) is False
        assert model_admin.has_delete_permission(request) is False
        assert model_admin.actions is None
