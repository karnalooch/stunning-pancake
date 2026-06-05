"""Live Map RBAC — tenant / department scope enforcement."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from users.departments import Department


@dataclass(frozen=True)
class LiveMapScope:
    tenant_id: str | None
    department_id: int | None


def _parse_tenant_id(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _parse_department_id(raw: Any) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def resolve_live_map_scope(user, query_params) -> LiveMapScope:
    role = getattr(user, "role", None) or ""
    q_tenant = _parse_tenant_id(query_params.get("tenant_id") or query_params.get("tenant"))
    q_dept = _parse_department_id(
        query_params.get("department_id") or query_params.get("department")
    )
    user_tenant = _parse_tenant_id(getattr(user, "tenant_id", None))

    if role == "GLOBAL_OWNER":
        tenant_id = q_tenant
        department_id = q_dept
        if department_id is not None and tenant_id:
            if not Department.objects.filter(
                id=department_id, tenant_id=tenant_id, is_active=True
            ).exists():
                department_id = None
        elif department_id is not None and not tenant_id:
            dept = Department.objects.filter(id=department_id, is_active=True).first()
            tenant_id = str(dept.tenant_id) if dept else None
        return LiveMapScope(tenant_id=tenant_id, department_id=department_id)

    if role in ("TENANT_ADMIN", "TENANT_MODERATOR"):
        tenant_id = user_tenant
        department_id = q_dept
        if department_id is not None and tenant_id:
            if not Department.objects.filter(
                id=department_id, tenant_id=tenant_id, is_active=True
            ).exists():
                department_id = None
        return LiveMapScope(tenant_id=tenant_id, department_id=department_id)

    if user_tenant:
        return LiveMapScope(tenant_id=user_tenant, department_id=q_dept)

    return LiveMapScope(tenant_id=None, department_id=None)


def position_matches_scope(
    tenant_id: str | None,
    department_id: int | None,
    pos_tenant: str | None,
    pos_department: int | None,
    *,
    department_ids: frozenset[int] | None = None,
) -> bool:
    if tenant_id and pos_tenant and str(pos_tenant) != str(tenant_id):
        return False
    if tenant_id and not pos_tenant:
        return False
    if department_ids is not None:
        if pos_department is None:
            return False
        return int(pos_department) in department_ids
    if department_id is not None and pos_department is not None:
        if int(pos_department) != int(department_id):
            return False
    if department_id is not None and pos_department is None:
        return False
    return True
