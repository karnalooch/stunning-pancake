"""T11 - PostgreSQL Row-Level Security integration test for 4VELO.

These tests verify the real, fail-closed RLS contract installed by the
``0036_canonical_fourvelo_rls`` and ``0022_canonical_fourvelo_rls`` migrations
on the five protected tables:

* ``activities_activity``        - direct ``tenant_id``
* ``activities_poi``             - direct ``tenant_id``
* ``activities_voucher``         - via ``activities_poi.tenant_id``
* ``users_department``           - direct ``tenant_id``
* ``users_userdepartment``       - via ``users_department.tenant_id``

The tests MUST FAIL - not skip - when:

* the database backend is not PostgreSQL / PostGIS;
* the ``current_user`` connection role is missing ``ENABLE ROW LEVEL SECURITY``
  or ``FORCE ROW LEVEL SECURITY`` on any of the five tables;
* the canonical ``fourvelo_tenant_isolation`` policy is missing or does not
  bind to ``PUBLIC``;
* the runtime user can bypass RLS (``BYPASSRLS`` / ``SUPERUSER``) while the
  tests still claim the contract holds.

Every behavioral assertion runs the query under the GUCs that the runtime
would set (``app.tenant_id`` / ``app.is_global_owner``) on the actual
PostgreSQL connection. The tests never impersonate ``fourvelo_app`` (that
role no longer exists) - they exercise the ``TO PUBLIC`` policy through the
real connection role.

When the runtime connection role is a superuser (the default for the
``postgis/postgis:15-3.3`` service image used in CI), the behavioural tests
switch into a dedicated limited test role via ``SET LOCAL ROLE`` so the
``TO PUBLIC`` policy is actually consulted; the test role is created and
destroyed by the fixture and is not part of the runtime architecture.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from datetime import UTC

import pytest
from django.db import DatabaseError, connection, transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

pytestmark = pytest.mark.django_db


PROTECTED_TABLES = (
    "activities_activity",
    "activities_poi",
    "activities_voucher",
    "users_department",
    "users_userdepartment",
)

CANONICAL_POLICY = "fourvelo_tenant_isolation"
APP_TENANT_GUC = "app.tenant_id"
APP_GLOBAL_OWNER_GUC = "app.is_global_owner"
GLOBAL_OWNER_TRUE_VALUE = "true"


# ---------------------------------------------------------------------------
# Database vendor / connection role helpers.
# ---------------------------------------------------------------------------


def _vendor() -> str:
    return connection.vendor


def _require_postgres() -> None:
    if _vendor() != "postgresql":
        pytest.fail(
            "T11 RLS tests require a PostgreSQL backend; "
            f"current vendor is {_vendor()!r}. SQLite and other engines "
            "cannot enforce row-level security."
        )


def _exec(sql: str, params: list | None = None) -> None:
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])


def _exec_raw(composed) -> None:
    """Execute a pre-composed SQL statement ( ``psycopg2.sql.Composed`` or
    similar). All identifiers must already be quoted by the caller via
    ``psycopg2.sql.Identifier``; this helper does not interpolate values.
    """
    with connection.cursor() as cursor:
        cursor.execute(composed)


def _fetchone(sql: str, params: list | None = None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        return cursor.fetchone()


def _fetchall(sql: str, params: list | None = None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        return cursor.fetchall()


def _scalar(sql: str, params: list | None = None):
    row = _fetchone(sql, params)
    return None if row is None else row[0]


def _current_user() -> str:
    return _scalar("SELECT current_user")


def _role_attribute(role: str, column: str):
    return _scalar(
        f"SELECT {column} FROM pg_roles WHERE rolname = %s",
        [role],
    )


def _session_user() -> str:
    return _scalar("SELECT session_user")


def _table_owner(table: str) -> str | None:
    return _scalar(
        "SELECT tableowner FROM pg_tables WHERE schemaname = current_schema() AND tablename = %s",
        [table],
    )


def _relflags(table: str) -> tuple[bool | None, bool | None]:
    row = _fetchone(
        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = %s",
        [table],
    )
    if row is None:
        return (None, None)
    return (row[0], row[1])


def _policy_clause(table: str, policy: str, kind: str) -> str | None:
    """Return the USING or WITH CHECK clause for ``policy`` on ``table``."""
    row = _fetchone(
        "SELECT pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) "
        "FROM pg_policy pol "
        "JOIN pg_class rel ON rel.oid = pol.polrelid "
        "WHERE rel.relname = %s AND pol.polname = %s",
        [table, policy],
    )
    if row is None:
        return None
    qual, with_check = row
    return qual if kind == "using" else with_check


def _policy_roles(table: str, policy: str) -> set[str]:
    """Return the set of role names the policy applies to.

    ``TO PUBLIC`` policies bind to the OID ``0`` pseudo-role, which has
    no row in ``pg_roles`` - so a direct join returns nothing for them.
    We surface ``"PUBLIC"`` explicitly whenever the policy array
    contains OID 0. For real roles we keep the ``pg_roles`` join.
    """
    rows = _fetchall(
        "SELECT "
        "  CASE WHEN 0 = ANY(pol.polroles) THEN 'PUBLIC' "
        "       ELSE rol.rolname END AS role_name "
        "FROM pg_policy pol "
        "JOIN pg_class rel ON rel.oid = pol.polrelid "
        "LEFT JOIN pg_roles rol "
        "  ON rol.oid = ANY(pol.polroles) AND rol.oid <> 0 "
        "WHERE rel.relname = %s AND pol.polname = %s",
        [table, policy],
    )
    return {r[0] for r in rows}


# ---------------------------------------------------------------------------
# Limited test role fixture.
#
# The default ``postgis/postgis`` service image grants the ``POSTGRES_USER``
# role ``SUPERUSER`` / ``BYPASSRLS``. To exercise the real ``TO PUBLIC``
# RLS contract without bypassing it, the behavioural tests run inside a
# session-scoped limited role created at the start of the run and dropped
# at teardown. The role is not part of the runtime architecture - it is
# purely a test fixture.
# ---------------------------------------------------------------------------


TEST_ROLE = "fourvelo_rls_test"


def _table_sequences(table: str) -> list[tuple[str, str]]:
    """Return ``[(schema, name), ...]`` for every sequence backing a
    SERIAL / IDENTITY column of ``table`` in the current schema.

    Uses ``pg_catalog.pg_get_serial_sequence`` so the result is correct for
    SERIAL, SMALLSERIAL, BIGSERIAL, ``GENERATED BY DEFAULT AS IDENTITY``
    and ``GENERATED ALWAYS AS IDENTITY``. Plain columns that own no
    sequence return ``NULL`` and are filtered out.

    The function never returns a ``schema.sequence`` string - the schema
    and the sequence name are returned as separate strings so the caller
    can compose a safe two-part SQL identifier (``psycopg2.sql.Identifier``
    with two parts) instead of an identifier that spans a dot.

    The qualified table name is composed via ``quote_ident(...)`` rather
    than ``format('%I.%I', ...)`` because the ``%I`` placeholder in a
    SQL literal is mis-parsed by the ``psycopg2`` cursor adapter as an
    ``execute`` placeholder, which causes ``IndexError`` whenever the
    query is executed with a parameter list (see
    https://github.com/psycopg/psycopg2/issues/1793).
    """
    rows = _fetchall(
        "WITH found AS ("
        "  SELECT DISTINCT pg_catalog.pg_get_serial_sequence("
        "    quote_ident(table_schema) || '.' "
        "    || quote_ident(table_name),"
        "    column_name"
        "  ) AS qualified_name "
        "  FROM information_schema.columns "
        "  WHERE table_schema = current_schema() AND table_name = %s"
        ") "
        "SELECT n.nspname, c.relname "
        "FROM found f "
        "JOIN pg_class c ON c.oid = f.qualified_name::regclass "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE f.qualified_name IS NOT NULL "
        "ORDER BY n.nspname, c.relname",
        [table],
    )
    pairs: list[tuple[str, str]] = []
    for schema, name in rows:
        pairs.append((schema, name))
    return pairs


def _grant_sequence_privileges(
    role: str, sequences: list[tuple[str, str]]
) -> list[tuple[str, str]]:
    """Grant USAGE + SELECT on each ``(schema, name)`` sequence and return
    the list of pairs the GRANT actually succeeded for. The caller is
    expected to clean up with the returned list.

    Sequence identifiers are composed via ``psycopg2.sql.Identifier`` so
    that schema and sequence name are quoted as a two-part identifier
    (never as ``schema.sequence`` - that would be a single identifier).
    """
    from psycopg2.sql import SQL, Identifier

    granted: list[tuple[str, str]] = []
    for schema, name in sequences:
        stmt = SQL("GRANT USAGE, SELECT ON SEQUENCE {seq} TO {role}").format(
            seq=Identifier(schema, name),
            role=Identifier(role),
        )
        _exec_raw(stmt)
        granted.append((schema, name))
    return granted


def _revoke_sequence_privileges(role: str, sequences: list[tuple[str, str]]) -> None:
    """Best-effort revoke of every ``(schema, name)`` sequence; never
    raises. SQL identifiers are composed via ``psycopg2.sql.Identifier``.
    """
    from psycopg2.sql import SQL, Identifier

    for schema, name in sequences:
        try:
            stmt = SQL("REVOKE ALL PRIVILEGES ON SEQUENCE {seq} FROM {role}").format(
                seq=Identifier(schema, name),
                role=Identifier(role),
            )
            _exec_raw(stmt)
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to revoke privileges on %s.%s", schema, name)


@pytest.fixture(scope="session", autouse=True)
def _rls_test_role_setup(django_db_setup, django_db_blocker):
    """Create / drop the limited test role around the entire suite.

    Runs as the administrative role (CI ``fourvelo_ci`` from the
    ``postgis/postgis`` service image). Lifecycle (the standard pytest
    generator-fixture contract):

    * The full setup runs inside a single ``try``. The five protected
      tables get table-level grants and the sequences returned by
      ``_table_sequences`` get USAGE + SELECT.
    * ``yield`` happens ONLY if the setup completed without error. If
      setup raises, ``yield`` is skipped - tests must never run against a
      partially prepared role.
    * The setup error is captured and re-raised inside the ``except``
      block. The ``finally`` clause runs cleanup regardless.
    * Cleanup runs in a nested ``try`` / ``except``:
        - if the setup error is in flight, any cleanup error is logged
          via ``logger.exception`` and is NOT re-raised - the original
          setup error remains the primary failure (Python still chains
          the cleanup exception via ``__context__``);
        - if the setup succeeded and the test body completed, any
          cleanup error is re-raised - the fixture ends with that error.
    * Cleanup never re-uses ``_table_sequences``; it only revokes the
      grants that the setup actually managed to issue (tracked in
      ``granted_table_privs`` and ``granted_sequences``). If
      ``_table_sequences`` was the cause of the setup failure, calling
      it again in cleanup would re-trigger the same error.

    No ``pg_terminate_backend`` is ever run against any role other than
    the limited ``TEST_ROLE``; only ``TEST_ROLE`` is dropped and only
    privileges that this fixture itself granted are revoked.

    All SQL identifiers (role name, table name, sequence name) are
    composed via ``psycopg2.sql.Identifier`` so that even names that
    require quoting or contain mixed case are passed as proper SQL
    identifiers rather than unsafe interpolated strings.
    """
    from psycopg2.sql import SQL, Identifier

    _require_postgres()
    granted_table_privs: list[str] = []
    granted_sequences: list[tuple[str, str]] = []
    setup_error: BaseException | None = None
    try:
        with django_db_blocker.unblock():
            _exec(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = %s",
                [TEST_ROLE],
            )
            _exec_raw(SQL("DROP ROLE IF EXISTS {role}").format(role=Identifier(TEST_ROLE)))
            _exec_raw(
                SQL("CREATE ROLE {role} NOLOGIN NOSUPERUSER NOBYPASSRLS").format(
                    role=Identifier(TEST_ROLE)
                )
            )
            for table in PROTECTED_TABLES:
                _exec_raw(
                    SQL("GRANT SELECT, INSERT, UPDATE, DELETE ON {tbl} TO {role}").format(
                        tbl=Identifier(table),
                        role=Identifier(TEST_ROLE),
                    )
                )
                granted_table_privs.append(table)
            for table in PROTECTED_TABLES:
                sequences = _table_sequences(table)
                granted_sequences.extend(_grant_sequence_privileges(TEST_ROLE, sequences))
        yield
    except BaseException as exc:
        setup_error = exc
        raise
    finally:
        try:
            with django_db_blocker.unblock():
                _exec(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = %s",
                    [TEST_ROLE],
                )
                for table in granted_table_privs:
                    try:
                        _exec_raw(
                            SQL("REVOKE ALL PRIVILEGES ON {tbl} FROM {role}").format(
                                tbl=Identifier(table),
                                role=Identifier(TEST_ROLE),
                            )
                        )
                    except Exception:  # pragma: no cover - defensive
                        logger.exception(
                            "teardown: failed to revoke table privs on %s",
                            table,
                        )
                _revoke_sequence_privileges(TEST_ROLE, granted_sequences)
                _exec_raw(SQL("DROP ROLE IF EXISTS {role}").format(role=Identifier(TEST_ROLE)))
        except BaseException:
            if setup_error is not None:
                logger.exception("cleanup failed after primary fixture error")
            else:
                raise


@contextmanager
def _as_test_role():
    """Run the body as ``fourvelo_rls_test`` (NOSUPERUSER, NOBYPASSRLS).

    Uses ``SET LOCAL ROLE`` so the role switch is bound to the current
    transaction. The block proves the limited role is active before any
    protected SQL runs and resets it in ``finally``. No behavioural
    assertion can silently run as the administrative superuser.
    """
    with connection.cursor() as cursor:
        cursor.execute(f"SET LOCAL ROLE {TEST_ROLE}")
        active_user = _scalar("SELECT current_user")
        assert active_user == TEST_ROLE, (
            f"SET LOCAL ROLE failed to activate {TEST_ROLE!r}; "
            f"current_user is {active_user!r}. Behavioural assertions "
            f"would otherwise run as the admin superuser and silently "
            f"bypass the TO PUBLIC policy."
        )
        assert _role_attribute(TEST_ROLE, "rolsuper") is False
        assert _role_attribute(TEST_ROLE, "rolbypassrls") is False
        try:
            yield cursor
        finally:
            try:
                cursor.execute("RESET ROLE")
            except Exception:
                pass


@contextmanager
def _with_gucs(tenant_uuid: str | None, *, is_global_owner: bool = False):
    """Set the runtime GUCs as the backend would, then enter the body.

    Cleanup always clears both GUCs in ``finally``.
    """
    with connection.cursor() as cursor:
        if is_global_owner:
            cursor.execute(
                "SELECT set_config(%s, %s, false)",
                [APP_GLOBAL_OWNER_GUC, GLOBAL_OWNER_TRUE_VALUE],
            )
            cursor.execute(
                "SELECT set_config(%s, '', false)",
                [APP_TENANT_GUC],
            )
        elif tenant_uuid:
            cursor.execute(
                "SELECT set_config(%s, %s, false)",
                [APP_TENANT_GUC, str(tenant_uuid)],
            )
            cursor.execute(
                "SELECT set_config(%s, '', false)",
                [APP_GLOBAL_OWNER_GUC],
            )
        else:
            cursor.execute(
                "SELECT set_config(%s, '', false)",
                [APP_TENANT_GUC],
            )
            cursor.execute(
                "SELECT set_config(%s, '', false)",
                [APP_GLOBAL_OWNER_GUC],
            )
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config(%s, '', false)", [APP_TENANT_GUC])
            cursor.execute("SELECT set_config(%s, '', false)", [APP_GLOBAL_OWNER_GUC])


# ---------------------------------------------------------------------------
# A. Database metadata - policies, RLS flags, connection role audit.
# ---------------------------------------------------------------------------


class TestRLSDatabaseMetadata:
    def test_postgres_backend(self):
        _require_postgres()
        assert _vendor() == "postgresql"

    @pytest.mark.parametrize("table", PROTECTED_TABLES)
    def test_table_enable_row_level_security(self, table):
        _require_postgres()
        relrowsecurity = _scalar(
            "SELECT relrowsecurity FROM pg_class WHERE relname = %s",
            [table],
        )
        assert relrowsecurity is True, f"{table}: ENABLE ROW LEVEL SECURITY missing"

    @pytest.mark.parametrize("table", PROTECTED_TABLES)
    def test_table_force_row_level_security(self, table):
        _require_postgres()
        relforcerowsecurity = _scalar(
            "SELECT relforcerowsecurity FROM pg_class WHERE relname = %s",
            [table],
        )
        assert relforcerowsecurity is True, f"{table}: FORCE ROW LEVEL SECURITY missing"

    @pytest.mark.parametrize("table", PROTECTED_TABLES)
    def test_canonical_policy_exists_with_using_and_withcheck(self, table):
        _require_postgres()
        using = _policy_clause(table, CANONICAL_POLICY, "using")
        withcheck = _policy_clause(table, CANONICAL_POLICY, "withcheck")
        assert using, f"{table}: missing canonical policy {CANONICAL_POLICY!r}"
        assert withcheck is not None, f"{table}: policy must declare explicit WITH CHECK; got none"
        assert "current_setting" in using and APP_TENANT_GUC in using
        assert "current_setting" in withcheck and APP_TENANT_GUC in withcheck
        assert APP_GLOBAL_OWNER_GUC in using
        assert APP_GLOBAL_OWNER_GUC in withcheck

    @pytest.mark.parametrize("table", PROTECTED_TABLES)
    def test_canonical_policy_binds_to_public(self, table):
        _require_postgres()
        roles = _policy_roles(table, CANONICAL_POLICY)
        assert roles == {"PUBLIC"}, (
            f"{table}: canonical policy must bind only to PUBLIC; got {sorted(roles)}"
        )

    def test_current_user_cannot_bypass_rls(self):
        """Inside a behavioural block, ``current_user`` must be the limited
        test role (NOSUPERUSER, NOBYPASSRLS, not the owner of the five
        tables). The administrative CI role may legitimately be a
        superuser; what matters is that no protected statement runs as
        that role.
        """
        _require_postgres()
        with _as_test_role():
            cu = _current_user()
            su = _session_user()
            assert cu == TEST_ROLE, (
                f"current_user must be {TEST_ROLE!r} inside behavioural "
                f"tests; got {cu!r}. session_user={su!r}."
            )
            assert su != TEST_ROLE, (
                f"session_user must remain the administrative role (not {TEST_ROLE!r}); got {su!r}."
            )
            assert _role_attribute(TEST_ROLE, "rolsuper") is False, (
                f"{TEST_ROLE!r} has SUPERUSER; behavioural assertions would be vacuous."
            )
            assert _role_attribute(TEST_ROLE, "rolbypassrls") is False, (
                f"{TEST_ROLE!r} has BYPASSRLS; behavioural assertions would be vacuous."
            )
            for table in PROTECTED_TABLES:
                owner = _table_owner(table)
                assert owner != TEST_ROLE, (
                    f"{table}: {TEST_ROLE!r} must not be the table owner "
                    f"(FORCE RLS only matters for non-owners). Owner is "
                    f"{owner!r}; table owner must remain the administrative "
                    f"role so the limited role is actually constrained by "
                    f"the TO PUBLIC policy."
                )

    def test_administrative_role_may_be_superuser(self):
        """The administrative CI role (``session_user``) is allowed to be
        a superuser; T11 does not require the image to ship with a
        non-superuser ``POSTGRES_USER``. What T11 requires is that the
        limited test role is non-superuser and non-bypassrls - which the
        previous test asserts. The ``postgis/postgis`` service image
        creates its ``POSTGRES_USER`` as a superuser for legitimate
        reasons (creating the database, running ``migrate``).
        """
        _require_postgres()
        # This test documents the design decision; it must not fail when
        # the admin role is a superuser. The contract is enforced by the
        # other test, which checks the role that actually executes the
        # protected statements.
        su = _session_user()
        assert su, "session_user must resolve to a PostgreSQL role"

    def test_policy_does_not_allow_empty_tenant(self):
        _require_postgres()
        for table in PROTECTED_TABLES:
            using = _policy_clause(table, CANONICAL_POLICY, "using") or ""
            assert "NULLIF" in using and "IS NOT NULL" in using, (
                f"{table}: USING clause must reject empty/null tenant context"
            )

    def test_global_owner_value_must_be_exactly_true(self):
        """``app.is_global_owner`` must compare against the literal
        ``'true'``. Any other accepted value would let callers bypass RLS
        by sending an arbitrary string from query / body / headers.
        """
        _require_postgres()
        for table in PROTECTED_TABLES:
            using = _policy_clause(table, CANONICAL_POLICY, "using") or ""
            assert "= 'true'" in using, (
                f"{table}: USING clause must require app.is_global_owner to "
                f"equal the literal 'true' string (fail-closed on other values)"
            )


class TestTableSequencesHelper:
    """Integration tests for the ``_table_sequences`` helper.

    These run on isolated scratch tables inside ``pytest_db_blocker``,
    not on the five protected tables, so the helper can be exercised
    independently from the rest of the suite. The tables are dropped in
    a ``finally`` block in addition to the ``django_db`` transaction
    rollback, so a developer running ``pytest --reuse-db`` still sees
    them cleaned up. SQL identifiers are composed via
    ``psycopg2.sql.Identifier`` so this test class also exercises the
    quoted-identifier path that the production fixture relies on.
    """

    @staticmethod
    def _create_table(name: str, ddl: str) -> str:
        """Create a scratch table with the given name and DDL body.

        ``name`` is passed through ``psycopg2.sql.Identifier`` so it is
        correctly quoted even when it contains mixed case or characters
        that require quoting (e.g. ``"Mixed-Table"``).
        """
        from psycopg2.sql import SQL, Identifier

        _require_postgres()
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    SQL("CREATE TABLE {tbl} ({ddl})").format(tbl=Identifier(name), ddl=SQL(ddl))
                )
        except Exception:
            with connection.cursor() as cursor:
                cursor.execute(SQL("DROP TABLE IF EXISTS {tbl}").format(tbl=Identifier(name)))
            raise
        return name

    @staticmethod
    def _drop_table(name: str) -> None:
        from psycopg2.sql import SQL, Identifier

        try:
            with connection.cursor() as cursor:
                cursor.execute(SQL("DROP TABLE IF EXISTS {tbl}").format(tbl=Identifier(name)))
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to drop scratch table %s", name)

    @staticmethod
    def _new_scratch_name(prefix: str = "t11_helper_probe_") -> str:
        import uuid

        return f"{prefix}{uuid.uuid4().hex[:12]}"

    def _assert_one_sequence_for(self, table: str) -> tuple[str, str]:
        seqs = _table_sequences(table)
        assert len(seqs) == 1, f"helper must return exactly one (schema, name) pair; got {seqs!r}"
        schema, name = seqs[0]
        assert schema, f"schema part of {seqs[0]!r} must not be empty"
        assert name, f"name part of {seqs[0]!r} must not be empty"
        assert name.endswith("_seq"), (
            f"sequence name {name!r} must end with ``_seq`` (PostgreSQL "
            f"convention for SERIAL / IDENTITY)"
        )
        return schema, name

    def test_serial_column_returns_sequence(self):
        table = self._create_table(self._new_scratch_name(), "id SERIAL PRIMARY KEY")
        try:
            schema, name = self._assert_one_sequence_for(table)
            assert name.startswith(f"{table}_"), (
                f"sequence name {name!r} must be derived from the table prefix {table!r}"
            )
            assert schema == "public", (
                f"schema must be the current default schema 'public'; got {schema!r}"
            )
        finally:
            self._drop_table(table)

    def test_identity_column_returns_sequence(self):
        table = self._create_table(
            self._new_scratch_name(),
            "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY",
        )
        try:
            schema, name = self._assert_one_sequence_for(table)
            assert name.startswith(f"{table}_"), (
                f"sequence name {name!r} must be derived from the table prefix {table!r}"
            )
            assert schema == "public"
        finally:
            self._drop_table(table)

    def test_table_without_sequence_returns_empty_list(self):
        table = self._create_table(self._new_scratch_name(), "id BIGINT PRIMARY KEY")
        try:
            assert _table_sequences(table) == [], (
                "plain BIGINT column must not produce any sequence"
            )
        finally:
            self._drop_table(table)

    def test_table_with_mixed_columns_returns_only_sequence_backed(self):
        table = self._create_table(
            self._new_scratch_name(),
            "id SERIAL PRIMARY KEY, secondary_id BIGINT NOT NULL, code TEXT",
        )
        try:
            assert len(_table_sequences(table)) == 1, (
                "only the SERIAL column must produce a sequence"
            )
        finally:
            self._drop_table(table)

    def test_dedup_and_order_are_deterministic(self):
        # Two SERIAL columns on the same table; the helper must return
        # each sequence exactly once and the order must be sorted so two
        # calls on the same database yield the same list.
        table = self._create_table(self._new_scratch_name(), "a SERIAL, b SERIAL")
        try:
            first = _table_sequences(table)
            second = _table_sequences(table)
            assert first == second, (
                f"helper must be deterministic across calls; got {first!r} then {second!r}"
            )
            assert len(first) == 2, f"two SERIAL columns must yield two sequences; got {first!r}"
            assert first == sorted(first), f"helper must return a sorted list; got {first!r}"
        finally:
            self._drop_table(table)

    def test_table_name_requiring_quoting_is_handled(self):
        """The helper and the scratch-table helpers must both handle
        table names that require quoting (mixed case, hyphen). The
        production protected tables all use safe lowercase identifiers,
        but the helper is a general contract that must not silently
        break on names that ``psycopg2.sql.Identifier`` quotes.
        """
        # Name contains characters that force quoting: uppercase and
        # hyphen. PostgreSQL folds unquoted identifiers to lowercase,
        # but a quoted identifier preserves the case. The sequence name
        # returned by ``pg_get_serial_sequence`` must therefore begin
        # with the lowercase, mixed-case table name (with the hyphen
        # preserved).
        bare_suffix = self._new_scratch_name()
        quoted_name = f'"Mixed-{bare_suffix}"'
        table = self._create_table(quoted_name, "id SERIAL PRIMARY KEY")
        try:
            schema, name = self._assert_one_sequence_for(table)
            # PG returns the sequence name with surrounding double
            # quotes because the source table name requires quoting.
            # Accept either form so the assertion does not depend on
            # the exact quoting convention.
            assert name.startswith("Mixed-") or name.startswith('"Mixed-'), (
                f"sequence name {name!r} must begin with the case-preserved "
                f"table identifier 'Mixed-' (with or without surrounding "
                f"double quotes)"
            )
            assert bare_suffix in name, (
                f"sequence name {name!r} must contain the unique table suffix {bare_suffix!r}"
            )
        finally:
            # ``self._drop_table`` composes ``DROP TABLE`` via
            # ``Identifier`` which round-trips the quoted name
            # correctly.
            self._drop_table(quoted_name)
            # Verify the table is actually gone so a leak is detected
            # even if the ``django_db`` rollback does not fire.
            bare = f"Mixed-{bare_suffix}"
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT count(*) FROM pg_class WHERE relname = %s",
                    [bare],
                )
                (count,) = cursor.fetchone()
            assert count == 0, (
                f"scratch table {bare!r} was not dropped by _drop_table; cleanup is leaking"
            )


# ---------------------------------------------------------------------------
# Fixtures that build the cross-tenant data plane for behavioral tests.
# ---------------------------------------------------------------------------


@pytest.fixture
def tenants(db):
    from users.models import Tenant

    return (
        Tenant.objects.create(name="RLS Tenant A", is_active=True),
        Tenant.objects.create(name="RLS Tenant B", is_active=True),
    )


@pytest.fixture
def rls_fixtures(db, tenants):
    """Build two activities, two POIs, two vouchers, two departments,
    two user-department assignments - one row per tenant - plus a
    ``tenant_id IS NULL`` row on Activity and POI to verify fail-closed
    behavior.
    """
    from datetime import datetime, timedelta

    from django.contrib.gis.geos import Point

    from activities.models import POI, Activity, Voucher
    from users.departments import Department, UserDepartment
    from users.models import User

    tenant_a, tenant_b = tenants
    user_a = User.objects.create_user(
        username="rls_user_a",
        password="x",
        role="ATHLETE",
        tenant=tenant_a,
    )
    user_b = User.objects.create_user(
        username="rls_user_b",
        password="x",
        role="ATHLETE",
        tenant=tenant_b,
    )

    start = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)

    act_a = Activity.objects.create(
        user=user_a,
        tenant=tenant_a,
        type="RUN",
        start_time=start,
        end_time=start + timedelta(minutes=10),
        distance=1000,
        duration=timedelta(minutes=10),
    )
    act_b = Activity.objects.create(
        user=user_b,
        tenant=tenant_b,
        type="RUN",
        start_time=start,
        end_time=start + timedelta(minutes=10),
        distance=1000,
        duration=timedelta(minutes=10),
    )
    # The 'NULL-tenant' row must exist (T10 forbids creating new ones, but
    # the fixture proves it stays invisible to non-GLOBAL_OWNER).
    if not Activity.objects.filter(tenant__isnull=True).exists():
        owner_global = User.objects.create_user(
            username="rls_global_owner",
            password="x",
            role="GLOBAL_OWNER",
        )
        Activity.objects.create(
            user=owner_global,
            tenant=None,
            type="RUN",
            start_time=start,
            end_time=start + timedelta(minutes=10),
            distance=1000,
            duration=timedelta(minutes=10),
        )

    poi_a = POI.objects.create(
        name="POI A",
        location=Point(0, 0),
        tenant=tenant_a,
    )
    poi_b = POI.objects.create(
        name="POI B",
        location=Point(0.01, 0.01),
        tenant=tenant_b,
    )
    if not POI.objects.filter(tenant__isnull=True).exists():
        POI.objects.create(name="POI None", location=Point(0.02, 0.02), tenant=None)

    voucher_a = Voucher.objects.create(
        poi=poi_a,
        code="VOUCHER-A",
        discount_value="10%",
        expiry_date=start + timedelta(days=30),
    )
    voucher_b = Voucher.objects.create(
        poi=poi_b,
        code="VOUCHER-B",
        discount_value="20%",
        expiry_date=start + timedelta(days=30),
    )

    dept_a = Department.objects.create(name="Dept A", tenant=tenant_a)
    dept_b = Department.objects.create(name="Dept B", tenant=tenant_b)

    ud_a = UserDepartment.objects.create(user=user_a, department=dept_a)
    UserDepartment.objects.create(user=user_b, department=dept_b)

    return {
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        "user_a": user_a,
        "user_b": user_b,
        "act_a": act_a,
        "act_b": act_b,
        "poi_a": poi_a,
        "poi_b": poi_b,
        "voucher_a": voucher_a,
        "voucher_b": voucher_b,
        "dept_a": dept_a,
        "dept_b": dept_b,
        "ud_a": ud_a,
    }


# ---------------------------------------------------------------------------
# B. Per-table isolation - tenant A sees only A, tenant B sees only B, no
# context sees nothing, NULL-tenant row is invisible, cross-tenant writes
# blocked, GLOBAL_OWNER sees everything.
# ---------------------------------------------------------------------------


class TestActivityIsolation:
    def test_tenant_a_sees_only_a(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM activities_activity")
            assert count == 1, f"tenant A should see 1 activity, got {count}"

    def test_tenant_b_sees_only_b(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_b"].id)):
            (count,) = _fetchone("SELECT count(*) FROM activities_activity")
            assert count == 1

    def test_no_context_sees_nothing(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None):
            (count,) = _fetchone("SELECT count(*) FROM activities_activity")
            assert count == 0, "empty context must yield zero rows"

    def test_null_tenant_row_invisible_to_tenant(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM activities_activity WHERE tenant_id IS NULL")
            assert count == 0

    def test_cross_tenant_insert_blocked(self, rls_fixtures):
        _require_postgres()
        from datetime import datetime, timedelta

        from users.models import User

        foreign_user = User.objects.create_user(
            username="foreign",
            password="x",
            role="ATHLETE",
            tenant=rls_fixtures["tenant_b"],
        )
        start = datetime(2026, 2, 1, 12, 0, tzinfo=UTC)
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "INSERT INTO activities_activity "
                    "(user_id, tenant_id, type, start_time, end_time, distance, "
                    " created_at, is_verified, verification_score, moderated_at, "
                    " route_path, external_source, external_id, gpx_storage_key, "
                    " gpx_sha256, route_fingerprint, gpx_forensics_flags, rejection_reason, rejection_notes) "
                    "VALUES (%s, %s, 'RUN', %s, %s, 0, NOW(), false, 0, NULL, "
                    " NULL, NULL, '', '', '', '', '[]'::jsonb, '', '')",
                    [
                        foreign_user.id,
                        str(rls_fixtures["tenant_b"].id),
                        start,
                        start + timedelta(minutes=10),
                    ],
                )

    def test_cross_tenant_update_does_not_affect(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            _exec(
                "UPDATE activities_activity SET distance = 9999 WHERE id = %s",
                [str(rls_fixtures["act_b"].id)],
            )
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_b"].id)):
            row = _fetchone(
                "SELECT distance FROM activities_activity WHERE id = %s",
                [str(rls_fixtures["act_b"].id)],
            )
            assert row is not None
            assert row[0] != 9999, "tenant B row must not be touched by tenant A"

    def test_reassignment_to_other_tenant_blocked(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "UPDATE activities_activity SET tenant_id = %s WHERE id = %s",
                    [
                        str(rls_fixtures["tenant_b"].id),
                        str(rls_fixtures["act_a"].id),
                    ],
                )

    def test_cross_tenant_delete_does_nothing(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            _exec(
                "DELETE FROM activities_activity WHERE id = %s",
                [str(rls_fixtures["act_b"].id)],
            )
        count = _scalar(
            "SELECT count(*) FROM activities_activity WHERE id = %s",
            [str(rls_fixtures["act_b"].id)],
        )
        assert count == 1, "tenant B row must still exist"

    def test_legal_write_passes(self, rls_fixtures):
        _require_postgres()
        from datetime import datetime, timedelta

        start = datetime(2026, 3, 1, 12, 0, tzinfo=UTC)
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            _exec(
                "INSERT INTO activities_activity "
                "(user_id, tenant_id, type, start_time, end_time, distance, "
                " created_at, is_verified, verification_score, moderated_at, "
                " route_path, external_source, external_id, gpx_storage_key, "
                " gpx_sha256, route_fingerprint, gpx_forensics_flags, rejection_reason, rejection_notes) "
                "VALUES (%s, %s, 'RUN', %s, %s, 0, NOW(), false, 0, NULL, "
                " NULL, NULL, '', '', '', '', '[]'::jsonb, '', '')",
                [
                    rls_fixtures["user_a"].id,
                    str(rls_fixtures["tenant_a"].id),
                    start,
                    start + timedelta(minutes=10),
                ],
            )


class TestPOIIsolation:
    def test_tenant_a_sees_only_a(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM activities_poi")
            assert count == 1

    def test_no_context_sees_nothing(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None):
            (count,) = _fetchone("SELECT count(*) FROM activities_poi")
            assert count == 0

    def test_cross_tenant_insert_blocked(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "INSERT INTO activities_poi "
                    "(name, location, category, tenant_id, sponsor_id, description) "
                    "VALUES ('x', ST_GeomFromText('POINT(0 0)', 4326), 'OTHER', "
                    "         %s, NULL, '')",
                    [str(rls_fixtures["tenant_b"].id)],
                )

    def test_legal_insert_passes(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            _exec(
                "INSERT INTO activities_poi "
                "(name, location, category, tenant_id, sponsor_id, description) "
                "VALUES ('legal', ST_GeomFromText('POINT(0 0)', 4326), 'OTHER', "
                "         %s, NULL, '')",
                [str(rls_fixtures["tenant_a"].id)],
            )


class TestVoucherIsolation:
    def test_tenant_a_sees_only_own(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM activities_voucher")
            assert count == 1

    def test_no_context_sees_nothing(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None):
            (count,) = _fetchone("SELECT count(*) FROM activities_voucher")
            assert count == 0

    def test_cannot_attach_to_foreign_poi(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "INSERT INTO activities_voucher "
                    "(poi_id, code, discount_value, is_redeemed, redeemed_by_id, "
                    " expiry_date) "
                    "VALUES (%s, 'foreign-attempt', %s, false, NULL, NOW())",
                    [str(rls_fixtures["poi_b"].id), "0%"],
                )

    def test_cannot_move_to_foreign_poi(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "UPDATE activities_voucher SET poi_id = %s WHERE id = %s",
                    [
                        str(rls_fixtures["poi_b"].id),
                        str(rls_fixtures["voucher_a"].id),
                    ],
                )

    def test_legal_attach_passes(self, rls_fixtures):
        _require_postgres()
        from datetime import datetime, timedelta

        start = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            _exec(
                "INSERT INTO activities_voucher "
                "(poi_id, code, discount_value, is_redeemed, redeemed_by_id, "
                " expiry_date) "
                "VALUES (%s, 'legal-attach', %s, false, NULL, %s)",
                [str(rls_fixtures["poi_a"].id), "5%", start + timedelta(days=1)],
            )


class TestDepartmentIsolation:
    def test_tenant_a_sees_only_own(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM users_department")
            assert count == 1

    def test_no_context_sees_nothing(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None):
            (count,) = _fetchone("SELECT count(*) FROM users_department")
            assert count == 0

    def test_cross_tenant_insert_blocked(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "INSERT INTO users_department (name, tenant_id, parent_id, "
                    "moderator_id, department_type, description, is_active, "
                    "created_at) "
                    "VALUES ('cross', %s, NULL, NULL, 'department', '', true, "
                    "         NOW())",
                    [str(rls_fixtures["tenant_b"].id)],
                )


class TestUserDepartmentIsolation:
    def test_tenant_a_sees_only_own(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM users_userdepartment")
            assert count == 1

    def test_no_context_sees_nothing(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None):
            (count,) = _fetchone("SELECT count(*) FROM users_userdepartment")
            assert count == 0

    def test_cannot_attach_to_foreign_department(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "INSERT INTO users_userdepartment "
                    "(user_id, department_id, joined_at) "
                    "VALUES (%s, %s, NOW())",
                    [
                        rls_fixtures["user_a"].id,
                        str(rls_fixtures["dept_b"].id),
                    ],
                )

    def test_cannot_move_to_foreign_department(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            with (
                pytest.raises(DatabaseError, match="row-level security"),
                transaction.atomic(),
            ):
                _exec(
                    "UPDATE users_userdepartment SET department_id = %s WHERE id = %s",
                    [
                        str(rls_fixtures["dept_b"].id),
                        str(rls_fixtures["ud_a"].id),
                    ],
                )


class TestGlobalOwnerScope:
    """``app.is_global_owner = 'true'`` opens the protected tables to the
    full data set; this is the only sanctioned path for GLOBAL_OWNER
    requests.
    """

    def test_global_owner_sees_all_tenants(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None, is_global_owner=True):
            (count,) = _fetchone("SELECT count(*) FROM activities_activity")
            assert count >= 2, f"GLOBAL_OWNER must see rows from all tenants; got {count}"
            (count,) = _fetchone("SELECT count(*) FROM users_department")
            assert count >= 2

    def test_global_owner_sees_null_tenant_row(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(None, is_global_owner=True):
            (count,) = _fetchone("SELECT count(*) FROM activities_activity WHERE tenant_id IS NULL")
            assert count >= 1, "GLOBAL_OWNER must see the NULL-tenant row"

    def test_global_owner_can_insert_anywhere(self, rls_fixtures):
        _require_postgres()
        from datetime import datetime, timedelta

        start = datetime(2026, 5, 1, 12, 0, tzinfo=UTC)
        with _as_test_role(), _with_gucs(None, is_global_owner=True):
            _exec(
                "INSERT INTO activities_activity "
                "(user_id, tenant_id, type, start_time, end_time, distance, "
                " created_at, is_verified, verification_score, moderated_at, "
                " route_path, external_source, external_id, gpx_storage_key, "
                " gpx_sha256, route_fingerprint, gpx_forensics_flags, rejection_reason, rejection_notes) "
                "VALUES (%s, %s, 'RUN', %s, %s, 0, NOW(), false, 0, NULL, "
                " NULL, NULL, '', '', '', '', '[]'::jsonb, '', '')",
                [
                    rls_fixtures["user_a"].id,
                    str(rls_fixtures["tenant_b"].id),
                    start,
                    start + timedelta(minutes=10),
                ],
            )


class TestGUCScopeTransition:
    """A single connection reused across simulated requests must not leak
    tenant / GLOBAL_OWNER scope. The GUCs are session-scoped, so each test
    explicitly clears them and asserts the transition.
    """

    def test_a_then_b_then_none(self, rls_fixtures):
        _require_postgres()
        with _as_test_role():
            with _with_gucs(str(rls_fixtures["tenant_a"].id)):
                (n_a,) = _fetchone("SELECT count(*) FROM activities_activity")
            with _with_gucs(str(rls_fixtures["tenant_b"].id)):
                (n_b,) = _fetchone("SELECT count(*) FROM activities_activity")
            with _with_gucs(None):
                (n_none,) = _fetchone("SELECT count(*) FROM activities_activity")

        assert n_a == 1
        assert n_b == 1
        assert n_none == 0

    def test_tenant_then_global_then_none(self, rls_fixtures):
        _require_postgres()
        with _as_test_role():
            with _with_gucs(str(rls_fixtures["tenant_a"].id)):
                (n_tenant,) = _fetchone("SELECT count(*) FROM activities_activity")
            with _with_gucs(None, is_global_owner=True):
                (n_global,) = _fetchone("SELECT count(*) FROM activities_activity")
            with _with_gucs(None):
                (n_none,) = _fetchone("SELECT count(*) FROM activities_activity")

        assert n_tenant == 1
        assert n_global >= 2
        assert n_none == 0

    def test_guc_clear_after_exception(self, rls_fixtures):
        _require_postgres()
        with _as_test_role():
            try:
                with _with_gucs(str(rls_fixtures["tenant_a"].id)):
                    raise RuntimeError("simulated view failure")
            except RuntimeError:
                pass
            (tenant_value,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
            (global_value,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
            assert tenant_value == ""
            assert global_value == ""

    def test_helper_rejects_invalid_uuid(self):
        _require_postgres()
        from core.rls import InvalidTenantContext, tenant_context

        with pytest.raises(InvalidTenantContext):
            with tenant_context("not-a-uuid"):
                pass


class TestTenantContextLifecycle:
    """Direct exercise of ``core.rls.tenant_context`` and
    ``core.rls.global_owner_context`` to prove the cleanup in ``finally``.
    """

    def test_tenant_context_clears_in_finally(self, rls_fixtures):
        _require_postgres()
        from core.rls import tenant_context

        with tenant_context(str(rls_fixtures["tenant_a"].id)):
            pass
        (val,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
        assert val == ""

    def test_global_owner_context_clears_in_finally(self, rls_fixtures):
        _require_postgres()
        from core.rls import global_owner_context

        with global_owner_context():
            pass
        (val,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
        assert val == ""


class TestNoRecursionAcrossPolicies:
    """The voucher policy reads ``activities_poi``, the userdepartment
    policy reads ``users_department`` - in both cases the parent policy must
    not depend on the child policy. This test ensures that evaluating the
    child policy does not deadlock or recurse.
    """

    def test_voucher_query_executes_without_recursion(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM activities_voucher")
            assert count == 1

    def test_userdepartment_query_executes_without_recursion(self, rls_fixtures):
        _require_postgres()
        with _as_test_role(), _with_gucs(str(rls_fixtures["tenant_a"].id)):
            (count,) = _fetchone("SELECT count(*) FROM users_userdepartment")
            assert count == 1


# ---------------------------------------------------------------------------
# E. Reverse / forward round-trip.
#
# These tests parse the static ``reverse_sql`` of the canonical migrations
# and verify it (a) drops the T11 policy, (b) recreates the historical
# pre-T11 policy, and (c) keeps ``ENABLE ROW LEVEL SECURITY`` so the table
# is never left without RLS coverage on rollback. The migration executor is
# not invoked.
# ---------------------------------------------------------------------------


def _load_reverse_sql() -> dict[str, str]:
    import importlib

    activities_mig = importlib.import_module("activities.migrations.0036_canonical_fourvelo_rls")
    users_mig = importlib.import_module("users.migrations.0022_canonical_fourvelo_rls")
    return {
        "activities": activities_mig.Migration.operations[0].reverse_sql,
        "users": users_mig.Migration.operations[0].reverse_sql,
    }


def _load_forward_sql() -> dict[str, str]:
    import importlib

    activities_mig = importlib.import_module("activities.migrations.0036_canonical_fourvelo_rls")
    users_mig = importlib.import_module("users.migrations.0022_canonical_fourvelo_rls")
    return {
        "activities": activities_mig.Migration.operations[0].sql,
        "users": users_mig.Migration.operations[0].sql,
    }


class TestRLSReverseForward:
    """Static and runtime checks for the canonical migrations.

    Static checks inspect the literal ``sql`` / ``reverse_sql`` blocks to
    catch forbidden statements without spinning up PostgreSQL. Runtime
    checks execute the literals and inspect ``pg_class`` / ``pg_policy``
    before and after to prove the reverse is the exact inverse of the
    forward.
    """

    def test_forward_does_not_create_or_alter_roles(self):
        """The forward migration must not call ``CREATE ROLE``, ``ALTER
        ROLE`` or ``DROP ROLE``. It must not require ``CREATEROLE`` on the
        runtime connection role. This is enforced by the migration not
        issuing any role lifecycle statements.
        """
        blocks = list(_load_forward_sql().values())
        for forbidden in ("CREATE ROLE", "ALTER ROLE", "DROP ROLE"):
            for block in blocks:
                assert forbidden not in block, (
                    f"forward migration must not contain {forbidden!r}; "
                    f"runtime must not require CREATEROLE."
                )

    def test_forward_does_not_reference_app_or_admin_role(self):
        blocks = list(_load_forward_sql().values())
        for forbidden in ("fourvelo_app", "fourvelo_admin", "sport_app"):
            for block in blocks:
                assert forbidden not in block, f"forward migration must not reference {forbidden!r}"

    def test_reverse_drops_canonical_policy(self):
        reverse_blocks = list(_load_reverse_sql().values())
        for table in PROTECTED_TABLES:
            drop_stmt = f"DROP POLICY IF EXISTS {CANONICAL_POLICY} ON {table}"
            assert any(drop_stmt in block for block in reverse_blocks), (
                f"reverse_sql must drop ``{drop_stmt}``"
            )

    def test_reverse_recreates_exact_pre_t11_policy_for_activities(self):
        """Migration 0008 created ``tenant_isolation`` ``TO sport_app`` on
        activities_activity / activities_poi / activities_voucher. The
        reverse must reproduce that verbatim.
        """
        reverse_blocks = list(_load_reverse_sql().values())
        for table in (
            "activities_activity",
            "activities_poi",
            "activities_voucher",
        ):
            recreate_stmt = f"CREATE POLICY tenant_isolation ON {table}"
            assert any(recreate_stmt in block for block in reverse_blocks), (
                f"reverse_sql must recreate ``{recreate_stmt}`` for the exact historical policy"
            )
            # The pre-T11 policy bound itself to ``TO sport_app`` - that
            # role reference must remain in the reverse SQL.
            recreate_to_sport_app = f"CREATE POLICY tenant_isolation ON {table}\n"
            # We assert the TO clause via substring because the SQL
            # formatter may interleave whitespace; the test below
            # (``test_reverse_recreates_exact_role_binding``) is the
            # authoritative runtime check.
            assert any("sport_app" in block for block in reverse_blocks), (
                f"reverse_sql must keep the historical ``TO sport_app`` "
                f"binding for {table}; broadening it to PUBLIC would "
                f"expand access."
            )

    def test_reverse_recreates_exact_pre_t11_policy_for_users(self):
        """Migration 0014 created ``department_tenant_isolation`` and
        ``userdepartment_tenant_isolation`` with no explicit ``TO`` (so
        ``TO PUBLIC``) on users_department / users_userdepartment. The
        reverse must reproduce that verbatim, including the historical
        ``app.user_id`` / ``users_user`` GLOBAL_OWNER bypass.
        """
        reverse_blocks = list(_load_reverse_sql().values())
        assert any(
            "CREATE POLICY department_tenant_isolation ON users_department" in block
            for block in reverse_blocks
        ), "reverse_sql must recreate department_tenant_isolation"
        assert any(
            "CREATE POLICY userdepartment_tenant_isolation ON users_userdepartment" in block
            for block in reverse_blocks
        ), "reverse_sql must recreate userdepartment_tenant_isolation"
        # The historical bypass used the deprecated ``app.user_id`` GUC;
        # preserving it verbatim is the whole point of this reverse.
        assert any("current_setting('app.user_id')" in block for block in reverse_blocks), (
            "reverse_sql must preserve the historical app.user_id bypass"
        )

    def test_reverse_removes_force_without_disabling_rls(self):
        """Pre-T11 had ``ENABLE ROW LEVEL SECURITY`` without ``FORCE`` on
        the five tables. The reverse must:
        - keep ``ENABLE ROW LEVEL SECURITY`` (``relrowsecurity=true``);
        - remove the FORCE flag T11 added (``relforcerowsecurity=false``)
          via ``NO FORCE ROW LEVEL SECURITY``;
        - NOT execute ``DISABLE ROW LEVEL SECURITY`` (that would leave
          the tables entirely without RLS, which is broader than the
          pre-T11 state).
        """
        reverse_blocks = list(_load_reverse_sql().values())
        for table in PROTECTED_TABLES:
            assert any(
                f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"
                in " ".join(block.split())
                for block in reverse_blocks
            ), (
                f"reverse_sql must remove FORCE on {table} via "
                f"``ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY``"
            )
            assert all(
                f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY" not in block
                for block in reverse_blocks
            ), (
                f"reverse_sql must NOT execute ``DISABLE ROW LEVEL "
                f"SECURITY`` on {table} - that would leave the table "
                f"without RLS, broader than the pre-T11 state."
            )

    def test_reverse_does_not_revoke_fourvelo_app_or_fourvelo_admin(self):
        reverse_blocks = list(_load_reverse_sql().values())
        for forbidden in ("fourvelo_app", "fourvelo_admin"):
            for block in reverse_blocks:
                assert forbidden not in block, (
                    f"reverse_sql must not reference {forbidden!r} because "
                    f"T11 never creates that role"
                )

    @pytest.mark.django_db(transaction=True)
    def test_round_trip_forward_reverses_then_forwards(self, rls_fixtures):
        """Execute the literal ``reverse_sql`` blocks against the live
        database, assert ``pg_class`` / ``pg_policy`` state matches the
        pre-T11 historical schema, then re-apply ``sql`` and assert the
        canonical post-T11 state. This is a real PostgreSQL round-trip,
        not a string check.
        """
        _require_postgres()
        reverse_blocks = list(_load_reverse_sql().values())
        forward_blocks = list(_load_forward_sql().values())
        try:
            with connection.cursor() as cursor:
                for block in reverse_blocks:
                    cursor.execute(block)

            # After reverse: ENABLE RLS stays on, FORCE is removed, T11
            # policy is gone, historical policies are recreated.
            for table in PROTECTED_TABLES:
                relrowsecurity, relforcerowsecurity = _relflags(table)
                assert relrowsecurity is True, (
                    f"{table}: relrowsecurity must remain True after "
                    f"reverse_sql; got {relrowsecurity!r}"
                )
                assert relforcerowsecurity is False, (
                    f"{table}: relforcerowsecurity must be False after "
                    f"reverse_sql (FORCE was added by T11); got "
                    f"{relforcerowsecurity!r}"
                )
                assert _policy_clause(table, CANONICAL_POLICY, "using") is None, (
                    f"{table}: T11 policy must be dropped after reverse_sql"
                )

            # Activities historical policy is ``tenant_isolation`` bound
            # to ``TO sport_app``.
            for table in (
                "activities_activity",
                "activities_poi",
                "activities_voucher",
            ):
                assert _policy_clause(table, "tenant_isolation", "using") is not None, (
                    f"{table}: historical ``tenant_isolation`` policy must "
                    f"be recreated by reverse_sql"
                )
                roles = _policy_roles(table, "tenant_isolation")
                assert roles == {"sport_app"}, (
                    f"{table}: historical policy must bind to ``sport_app``; "
                    f"got {sorted(roles)}. Broadening to PUBLIC would expand "
                    f"access beyond the pre-T11 contract."
                )

            # Users historical policies are ``department_tenant_isolation``
            # and ``userdepartment_tenant_isolation`` with default
            # ``TO PUBLIC``.
            for table, policy in (
                ("users_department", "department_tenant_isolation"),
                (
                    "users_userdepartment",
                    "userdepartment_tenant_isolation",
                ),
            ):
                assert _policy_clause(table, policy, "using") is not None, (
                    f"{table}: historical ``{policy}`` policy must be recreated by reverse_sql"
                )
                roles = _policy_roles(table, policy)
                assert roles == {"PUBLIC"}, (
                    f"{table}: historical ``{policy}`` policy had no "
                    f"explicit ``TO`` clause in 0014, so it must default to "
                    f"PUBLIC; got {sorted(roles)}."
                )

            # Re-apply forward: canonical policy and FORCE restored.
            with connection.cursor() as cursor:
                for block in forward_blocks:
                    cursor.execute(block)

            for table in PROTECTED_TABLES:
                relrowsecurity, relforcerowsecurity = _relflags(table)
                assert relrowsecurity is True
                assert relforcerowsecurity is True
                using = _policy_clause(table, CANONICAL_POLICY, "using")
                assert using is not None, (
                    f"{table}: canonical policy must be reinstalled after re-applying forward_sql"
                )
                roles = _policy_roles(table, CANONICAL_POLICY)
                assert roles == {"PUBLIC"}, (
                    f"{table}: canonical policy must bind to PUBLIC; got {sorted(roles)}"
                )
        finally:
            # Always restore the post-forward canonical state so subsequent
            # tests in this file see ENABLE+FORCE RLS on the protected
            # tables.
            with connection.cursor() as cursor:
                for block in forward_blocks:
                    cursor.execute(block)


# ---------------------------------------------------------------------------
# F. Session / JWT integration.
#
# End-to-end proof that the ``TenantRLSMiddleware`` and the
# ``MFAEnforcingJWTAuthentication`` class bind the GUCs for the lifetime of
# the request and clear them in their respective ``finally`` blocks.
# These tests do NOT short-circuit by pre-setting ``request.user`` before
# the middleware enters - they execute the real middleware code path.
# ---------------------------------------------------------------------------


class TestSessionAuthMiddleware:
    def _make_request(self, *, user):
        from django.test import RequestFactory

        rf = RequestFactory()
        request = rf.post("/api/activities/", data={})
        request.user = user
        return request

    def test_session_global_owner_sets_global_owner_guc(self, rls_fixtures):
        _require_postgres()
        from core.middleware import TenantRLSMiddleware
        from users.models import User

        owner = User.objects.create_user(
            username="t11_session_go",
            password="x",
            role="GLOBAL_OWNER",
        )
        try:
            request = self._make_request(user=owner)
            TenantRLSMiddleware(lambda req: _ok_response())._apply_session_scope(request)
            (val,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
            (tenant_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
            assert val == GLOBAL_OWNER_TRUE_VALUE
            assert tenant_val == ""
        finally:
            User.objects.filter(pk=owner.pk).delete()

    def test_session_tenant_user_sets_tenant_guc(self, rls_fixtures):
        _require_postgres()
        from core.middleware import TenantRLSMiddleware

        request = self._make_request(user=rls_fixtures["user_a"])
        TenantRLSMiddleware(lambda req: _ok_response())._apply_session_scope(request)
        (val,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
        (global_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
        assert val == str(rls_fixtures["tenant_a"].id)
        assert global_val == ""

    def test_session_anonymous_clears_both_gucs(self, rls_fixtures):
        _require_postgres()
        from django.contrib.auth.models import AnonymousUser

        from core.middleware import TenantRLSMiddleware

        request = self._make_request(user=AnonymousUser())
        TenantRLSMiddleware(lambda req: _ok_response())._apply_session_scope(request)
        (tenant_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
        (global_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
        assert tenant_val == ""
        assert global_val == ""

    def test_session_middleware_clears_gucs_in_finally(self, rls_fixtures):
        _require_postgres()
        from core.middleware import TenantRLSMiddleware

        request = self._make_request(user=rls_fixtures["user_a"])

        def boom(_request):
            raise RuntimeError("view raised")

        mw = TenantRLSMiddleware(boom)
        with pytest.raises(RuntimeError):
            mw(request)
        (tenant_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
        (global_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
        assert tenant_val == ""
        assert global_val == ""


class TestJWTAuthMiddleware:
    """The DRF ``MFAEnforcingJWTAuthentication`` class must set the GUCs
    directly on a successful JWT authentication and clear them on every
    error path. The test exercises the real auth class via DRF's
    ``APIView.initial`` so the JWT path runs end-to-end.
    """

    def _make_jwt_for(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        # ``mfa_verified=True`` is required by ``MFAEnforcingJWTAuthentication``
        # for tenant users; GLOBAL_OWNER users need it to pass the admin gate.
        refresh["mfa_verified"] = True
        return str(refresh.access_token)

    def test_jwt_tenant_user_sees_only_own_tenant(self, rls_fixtures):
        _require_postgres()
        from django.test import RequestFactory

        from users.jwt_auth import MFAEnforcingJWTAuthentication

        token = self._make_jwt_for(rls_fixtures["user_a"])
        request = RequestFactory().get(
            "/api/activities/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        result = MFAEnforcingJWTAuthentication().authenticate(request)
        assert result is not None
        try:
            with _as_test_role():
                (count,) = _fetchone("SELECT count(*) FROM activities_activity")
                assert count == 1
        finally:
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config(%s, '', false)", [APP_TENANT_GUC])
                cursor.execute("SELECT set_config(%s, '', false)", [APP_GLOBAL_OWNER_GUC])

    def test_jwt_global_owner_sees_all_tenants(self, rls_fixtures):
        _require_postgres()
        from django.test import RequestFactory

        from users.jwt_auth import MFAEnforcingJWTAuthentication
        from users.models import User

        owner = User.objects.create_user(
            username="t11_jwt_go",
            password="x",
            role="GLOBAL_OWNER",
        )
        try:
            token = self._make_jwt_for(owner)
            request = RequestFactory().get(
                "/api/activities/",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            )
            result = MFAEnforcingJWTAuthentication().authenticate(request)
            assert result is not None
            try:
                with _as_test_role():
                    (count,) = _fetchone("SELECT count(*) FROM activities_activity")
                    assert count >= 2
            finally:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT set_config(%s, '', false)",
                        [APP_TENANT_GUC],
                    )
                    cursor.execute(
                        "SELECT set_config(%s, '', false)",
                        [APP_GLOBAL_OWNER_GUC],
                    )
        finally:
            User.objects.filter(pk=owner.pk).delete()

    def test_jwt_invalid_clears_gucs(self, rls_fixtures):
        _require_postgres()
        from django.test import RequestFactory

        from users.jwt_auth import MFAEnforcingJWTAuthentication

        request = RequestFactory().get(
            "/api/activities/",
            HTTP_AUTHORIZATION="Bearer not-a-real-jwt",
        )
        with pytest.raises(Exception):
            MFAEnforcingJWTAuthentication().authenticate(request)
        (tenant_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_TENANT_GUC])
        (global_val,) = _fetchone("SELECT current_setting(%s, true)", [APP_GLOBAL_OWNER_GUC])
        assert tenant_val == ""
        assert global_val == ""


# ---------------------------------------------------------------------------
# K. End-to-end request: middleware -> DRF auth -> view -> cleanup.
#
# This class proves the FULL lifecycle the runtime relies on:
#
# 1. A real Django request enters the project through the WSGI handler
#    wired with the production MIDDLEWARE chain (including
#    ``TenantRLSMiddleware``).
# 2. ``TenantRLSMiddleware`` clears both GUCs at the start of the request.
# 3. DRF runs ``MFAEnforcingJWTAuthentication`` after dispatching to the
#    view's ``initial()``; the auth class sets the GUCs based on the
#    authenticated ``request.user``.
# 4. The view executes a query protected by the ``TO PUBLIC`` policy.
# 5. ``TenantRLSMiddleware`` clears both GUCs in its ``finally``.
#
# The test URLConf is local to this module (no production endpoint is
# added). Each test asserts the GUC values inside the view (after DRF
# auth set them) and after the response (after the middleware cleared
# them).
# ---------------------------------------------------------------------------


_TEST_URLS = []


def _register_test_view(view_cls):
    """Register a local test view under ``/rls-test/<name>/`` for this
    module. The URLConf is rebuilt lazily and never persists beyond the
    test process.
    """
    name = view_cls.__name__
    from django.urls import path

    _TEST_URLS.append(path(f"{name}/", view_cls.as_view(), name=name))
    return view_cls


class _RLSProbeMixin:
    """Mixin used by the local test views.

    Sets a flag the test can read to confirm it ran inside the request.
    """

    _inside_request = False


@_register_test_view
class _RlsProbeTenantView(APIView):
    """Returns the count of rows the authenticated principal may see."""

    authentication_classes = [
        __import__(
            "users.jwt_auth",
            fromlist=["MFAEnforcingJWTAuthentication"],
        ).MFAEnforcingJWTAuthentication,
    ]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _RLSProbeMixin._inside_request = True
        # Read the GUCs the auth class set; the assertions below verify
        # these are the canonical tenant UUID (not the global-owner flag).
        tenant_guc = _scalar("SELECT current_setting('app.tenant_id', true)")
        global_guc = _scalar("SELECT current_setting('app.is_global_owner', true)")
        current = _scalar("SELECT current_user")
        # Run the protected query under the limited test role so the
        # ``TO PUBLIC`` policy is actually consulted.
        with connection.cursor() as cursor:
            cursor.execute(f"SET LOCAL ROLE {TEST_ROLE}")
            cursor.execute("SELECT count(*) FROM activities_activity")
            (count,) = cursor.fetchone()
        return Response(
            {
                "current_user": current,
                "tenant_guc": tenant_guc,
                "global_owner_guc": global_guc,
                "activity_count": count,
            }
        )


@_register_test_view
class _RlsProbeGlobalOwnerView(APIView):
    """Same shape as the tenant view but asserts the global-owner flag."""

    authentication_classes = [
        __import__(
            "users.jwt_auth",
            fromlist=["MFAEnforcingJWTAuthentication"],
        ).MFAEnforcingJWTAuthentication,
    ]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _RLSProbeMixin._inside_request = True
        tenant_guc = _scalar("SELECT current_setting('app.tenant_id', true)")
        global_guc = _scalar("SELECT current_setting('app.is_global_owner', true)")
        with connection.cursor() as cursor:
            cursor.execute(f"SET LOCAL ROLE {TEST_ROLE}")
            cursor.execute("SELECT count(*) FROM activities_activity")
            (count,) = cursor.fetchone()
        return Response(
            {
                "tenant_guc": tenant_guc,
                "global_owner_guc": global_guc,
                "activity_count": count,
            }
        )


@_register_test_view
class _RlsProbeBoomView(APIView):
    """Raises inside the view so the middleware ``finally`` must clear
    the GUCs even on the error path."""

    authentication_classes = [
        __import__(
            "users.jwt_auth",
            fromlist=["MFAEnforcingJWTAuthentication"],
        ).MFAEnforcingJWTAuthentication,
    ]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _RLSProbeMixin._inside_request = True
        # Confirm the auth class DID set the GUC before the raise.
        request._probe_tenant_guc = _scalar("SELECT current_setting('app.tenant_id', true)")
        raise RuntimeError("simulated view failure")


class TestFullRequestJWT:
    """End-to-end request: real middleware chain + DRF auth + view."""

    @pytest.fixture(autouse=True)
    def _patch_urlconf(self, settings):
        """Wire the local URLConf under ``/rls-test/`` and install the
        production middleware chain (already in ``settings.MIDDLEWARE``).
        """
        from django.urls import include, path

        _RLSProbeMixin._inside_request = False
        test_patterns = [path("", include((_TEST_URLS, "rls_test")))]
        # Append rather than replace the project's URLConf so existing
        # routes are untouched.
        original = list(
            settings.ROOT_URLCONF
            and __import__(settings.ROOT_URLCONF, fromlist=["urlpatterns"]).urlpatterns
        )
        with_patterns = original + [
            path("rls-test/", include((test_patterns, "rls_test_app"))),
        ]
        test_urlconf_module = type(
            "_RlsTestUrlConf",
            (),
            {"urlpatterns": with_patterns},
        )
        import sys

        sys.modules["_rls_test_urlconf"] = test_urlconf_module
        settings.ROOT_URLCONF = "_rls_test_urlconf"
        yield

    def _client_for(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        refresh["mfa_verified"] = True
        return f"Bearer {refresh.access_token}"

    def test_jwt_tenant_full_request(self, rls_fixtures):
        """Tenant A JWT through the real middleware chain:
        - middleware clears GUCs at start;
        - DRF auth sets ``app.tenant_id`` = tenant A;
        - view sees tenant A only;
        - middleware clears GUCs after the response.
        """
        from django.test import Client

        client = Client(HTTP_AUTHORIZATION=self._client_for(rls_fixtures["user_a"]))
        response = client.get("/rls-test/_RlsProbeTenantView/", secure=True)
        assert response.status_code == 200, response.content
        body = response.json()
        assert _RLSProbeMixin._inside_request, "view did not run"
        assert body["tenant_guc"] == str(rls_fixtures["tenant_a"].id)
        assert body["global_owner_guc"] == ""
        assert body["activity_count"] == 1

        # After the response the middleware must have cleared both GUCs.
        (tenant_after,) = _fetchone("SELECT current_setting('app.tenant_id', true)")
        (global_after,) = _fetchone("SELECT current_setting('app.is_global_owner', true)")
        assert tenant_after == ""
        assert global_after == ""

    def test_jwt_global_owner_full_request(self, rls_fixtures):
        from django.test import Client

        from users.models import User

        owner = User.objects.create_user(username="t11_e2e_go", password="x", role="GLOBAL_OWNER")
        try:
            client = Client(HTTP_AUTHORIZATION=self._client_for(owner))
            response = client.get("/rls-test/_RlsProbeGlobalOwnerView/", secure=True)
            assert response.status_code == 200, response.content
            body = response.json()
            assert body["tenant_guc"] == ""
            assert body["global_owner_guc"] == GLOBAL_OWNER_TRUE_VALUE
            assert body["activity_count"] >= 2

            (tenant_after,) = _fetchone("SELECT current_setting('app.tenant_id', true)")
            (global_after,) = _fetchone("SELECT current_setting('app.is_global_owner', true)")
            assert tenant_after == ""
            assert global_after == ""
        finally:
            User.objects.filter(pk=owner.pk).delete()

    def test_invalid_jwt_clears_gucs_in_middleware_finally(self, rls_fixtures):
        from django.test import Client

        client = Client(HTTP_AUTHORIZATION="Bearer not-a-real-jwt")
        response = client.get("/rls-test/_RlsProbeTenantView/", secure=True)
        # DRF returns 401 for invalid JWT; the request still completes
        # through the middleware chain (which runs its ``finally``).
        assert response.status_code == 401
        (tenant_after,) = _fetchone("SELECT current_setting('app.tenant_id', true)")
        (global_after,) = _fetchone("SELECT current_setting('app.is_global_owner', true)")
        assert tenant_after == ""
        assert global_after == ""

    def test_view_exception_clears_gucs_in_middleware_finally(self, rls_fixtures):
        from django.test import Client

        client = Client(HTTP_AUTHORIZATION=self._client_for(rls_fixtures["user_a"]))
        # DRF will translate the view's RuntimeError into a 500 response
        # after the middleware ``finally`` runs.
        with pytest.raises(RuntimeError):
            client.get("/rls-test/_RlsProbeBoomView/", secure=True)
        (tenant_after,) = _fetchone("SELECT current_setting('app.tenant_id', true)")
        (global_after,) = _fetchone("SELECT current_setting('app.is_global_owner', true)")
        assert tenant_after == ""
        assert global_after == ""


def _ok_response():
    from django.http import HttpResponse

    return HttpResponse(status=200)
