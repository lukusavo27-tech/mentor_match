#!/usr/bin/env python3
"""Preflight, back up, and explicitly adopt a PostgreSQL MentorMatch database.

The target is supplied only through MENTORMATCH_TARGET_DATABASE_URL. This tool
never loads .env, prints credentials, seeds rows, or changes a database during
the preflight/backup commands.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.engine import Engine, URL, make_url
from sqlalchemy.inspection import inspect


BACKEND = Path(__file__).resolve().parents[1]
BASELINE_REVISION = "legacy_baseline"
CURRENT_REVISION = "admin_flags_v1"
KNOWN_PREEXISTING_USER_COLUMNS = {"is_admin", "is_active"}
KNOWN_ADDITIVE_TABLES = {"profile_skills", "recommendations"}
KNOWN_ADDITIVE_COLUMNS = {
    "profiles": {"resume_text"},
    "mentee_goals": {"shared_with_mentor"},
}

CHECK_EQUIVALENTS = {
    ("users", "ck_users_role"): {
        "role=anyarray['graduate','mentor']": "rolein'graduate','mentor'",
    },
    ("mentee_goals", "ck_mentee_goals_status"): {
        "status=anyarray['active','paused','completed']": "statusin'active','paused','completed'",
    },
    ("mentee_goals", "ck_mentee_goals_progress"): {
        "progress_percent>=0andprogress_percent<=100": "progress_percentbetween0and100",
    },
    ("mentorship_sessions", "ck_mentorship_sessions_status"): {
        "status=anyarray['pending','accepted','declined','cancelled','completed']":
            "statusin'pending','accepted','declined','cancelled','completed'",
    },
}


class SafetyError(RuntimeError):
    """Raised when a required safety condition is not met."""


def target_url() -> URL:
    raw = os.environ.get("MENTORMATCH_TARGET_DATABASE_URL", "").strip()
    if not raw:
        raise SafetyError(
            "Set MENTORMATCH_TARGET_DATABASE_URL explicitly. This script does not read .env."
        )
    url = make_url(raw)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if url.drivername != "postgresql+psycopg":
        raise SafetyError("The target must be a PostgreSQL URL using psycopg.")
    if not url.host or not url.database or not url.username:
        raise SafetyError("The target URL must include a host, database name, and username.")
    return url


def connect(url: URL) -> Engine:
    safe_url = url.update_query_dict({"connect_timeout": "10"})
    return sa.create_engine(safe_url, pool_pre_ping=True)


def baseline_engine() -> Engine:
    """Build an in-memory reference schema by executing the frozen baseline."""
    path = BACKEND / "migrations/versions/legacy_baseline_legacy_schema_baseline.py"
    spec = importlib.util.spec_from_file_location("mentor_match_legacy_baseline", path)
    if spec is None or spec.loader is None:
        raise SafetyError("Could not load the legacy baseline migration.")
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
    return engine


def normalize_type(column_type: Any) -> tuple[str, int | None, bool | None]:
    name = type(column_type).__name__.lower()
    if name == "uuid" or (name == "char" and getattr(column_type, "length", None) == 32):
        return ("uuid", None, None)
    if isinstance(column_type, sa.Boolean):
        return ("boolean", None, None)
    if isinstance(column_type, sa.DateTime):
        return ("datetime", None, bool(column_type.timezone))
    if isinstance(column_type, sa.Date):
        return ("date", None, None)
    if isinstance(column_type, sa.Integer):
        return ("integer", None, None)
    if isinstance(column_type, sa.Float):
        return ("float", None, None)
    if isinstance(column_type, sa.JSON):
        return ("json", None, None)
    if type(column_type) is sa.Text or name in {"text", "clob"}:
        return ("text", None, None)
    if isinstance(column_type, sa.String):
        return ("string", column_type.length, None)
    return (name, getattr(column_type, "length", None), None)


def normalize_sql(value: str | None) -> str:
    if not value:
        return ""
    value = value.lower().replace('"', "")
    value = re.sub(r"::[a-z_][a-z0-9_ ]*(\[\])?", "", value)
    normalized = re.sub(r"[\s()]+", "", value)
    return normalized.replace("now", "current_timestamp") if normalized == "now" else normalized


def normalize_check(table: str, name: str, expression: str | None) -> tuple[str, str]:
    normalized = normalize_sql(expression)
    equivalent = CHECK_EQUIVALENTS.get((table, name), {}).get(normalized, normalized)
    return name, equivalent


def table_signature(inspector: Any, table: str) -> dict[str, Any]:
    schema = "public" if inspector.bind.dialect.name == "postgresql" else None
    columns = {}
    for column in inspector.get_columns(table, schema=schema):
        columns[column["name"]] = {
            "type": normalize_type(column["type"]),
            "nullable": bool(column["nullable"]),
            "default": normalize_sql(str(column["default"])) if column.get("default") is not None else "",
        }

    primary_key = tuple(sorted(inspector.get_pk_constraint(table, schema=schema).get("constrained_columns") or []))
    unique_constraints = {
        tuple(sorted(item.get("column_names") or []))
        for item in inspector.get_unique_constraints(table, schema=schema)
    }
    indexes = {
        (tuple(item.get("column_names") or []), bool(item.get("unique")))
        for item in inspector.get_indexes(table, schema=schema)
        if item.get("column_names") and not item.get("duplicates_constraint")
    }
    foreign_keys = {
        (
            tuple(item.get("constrained_columns") or []),
            item.get("referred_table"),
            tuple(item.get("referred_columns") or []),
            (item.get("options") or {}).get("ondelete", "").upper(),
        )
        for item in inspector.get_foreign_keys(table, schema=schema)
    }
    checks = set()
    for item in inspector.get_check_constraints(table, schema=schema):
        name = item.get("name") or ""
        checks.add(normalize_check(table, name, item.get("sqltext")))
    return {
        "columns": columns,
        "primary_key": primary_key,
        "unique_constraints": sorted(unique_constraints),
        "indexes": sorted(indexes),
        "foreign_keys": sorted(foreign_keys),
        "checks": sorted(checks),
    }


def schema_snapshot(engine: Engine) -> tuple[dict[str, Any], str | None]:
    inspector = inspect(engine)
    schema = "public" if engine.dialect.name == "postgresql" else None
    tables = set(inspector.get_table_names(schema=schema))
    revision = None
    if "alembic_version" in tables:
        with engine.connect() as connection:
            revision = connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
        if revision is None:
            revision = "<empty alembic_version table>"
        tables.remove("alembic_version")
    signatures = {name: table_signature(inspector, name) for name in sorted(tables)}
    return signatures, revision


def expected_schema() -> dict[str, Any]:
    engine = baseline_engine()
    try:
        inspector = inspect(engine)
        expected = {
            table: table_signature(inspector, table)
            for table in sorted(inspector.get_table_names())
        }
        # SQLite reflection drops the timezone=True detail declared in the
        # PostgreSQL baseline migration; all its DateTime columns are timezone-aware.
        for table in expected.values():
            for column in table["columns"].values():
                if column["type"][0] == "datetime":
                    column["type"] = ("datetime", None, True)
        return expected
    finally:
        engine.dispose()


def pending_additive_changes(actual: dict[str, Any]) -> list[str]:
    expected = expected_schema()
    changes = [
        f"create table {table}"
        for table in sorted((set(expected) - set(actual)) & KNOWN_ADDITIVE_TABLES)
    ]
    for table, allowed_columns in KNOWN_ADDITIVE_COLUMNS.items():
        if table not in actual:
            continue
        missing = (set(expected[table]["columns"]) - set(actual[table]["columns"])) & allowed_columns
        changes.extend(f"add {table}.{column}" for column in sorted(missing))
    return changes


def compare_schema(actual: dict[str, Any], revision: str | None) -> list[str]:
    if revision not in {None, BASELINE_REVISION, CURRENT_REVISION}:
        return [f"Database has unknown Alembic revision {revision}; review migrations before proceeding."]

    expected = expected_schema()
    errors: list[str] = []
    extra_tables = sorted(set(actual) - set(expected))
    missing_tables = sorted((set(expected) - set(actual)) - KNOWN_ADDITIVE_TABLES)
    if missing_tables:
        errors.append("Missing baseline tables: " + ", ".join(missing_tables))
    if extra_tables:
        errors.append("Unexpected tables requiring review: " + ", ".join(extra_tables))

    if revision == CURRENT_REVISION:
        found_user_columns = set(actual.get("users", {}).get("columns", {}))
        missing_flags = sorted(KNOWN_PREEXISTING_USER_COLUMNS - found_user_columns)
        if missing_flags:
            errors.append("users: current migration flags are missing: " + ", ".join(missing_flags))

    for table in sorted(set(actual) & set(expected)):
        found = actual[table]
        wanted = expected[table]
        found_columns = dict(found["columns"])
        allowed = KNOWN_PREEXISTING_USER_COLUMNS if table == "users" else set()
        extra_columns = sorted(set(found_columns) - set(wanted["columns"]) - allowed)
        permitted_missing = KNOWN_ADDITIVE_COLUMNS.get(table, set())
        missing_columns = sorted(set(wanted["columns"]) - set(found_columns) - permitted_missing)
        if missing_columns:
            errors.append(f"{table}: missing columns: {', '.join(missing_columns)}")
        if extra_columns:
            errors.append(f"{table}: unexpected columns: {', '.join(extra_columns)}")
        for column in sorted(set(wanted["columns"]) & set(found_columns)):
            if wanted["columns"][column] != found_columns[column]:
                errors.append(
                    f"{table}.{column}: expected {wanted['columns'][column]}, "
                    f"found {found_columns[column]}"
                )
        if table == "users":
            expected_flags = {
                "is_admin": {
                    "type": ("boolean", None, None),
                    "nullable": False,
                    "default": "false",
                },
                "is_active": {
                    "type": ("boolean", None, None),
                    "nullable": False,
                    "default": "true",
                },
            }
            for column in sorted(KNOWN_PREEXISTING_USER_COLUMNS & set(found_columns)):
                if found_columns[column] != expected_flags[column]:
                    errors.append(
                        f"users.{column}: pre-existing admin flag differs from its "
                        "migration definition"
                    )
        for key in ("primary_key", "unique_constraints", "indexes", "foreign_keys", "checks"):
            if wanted[key] != found[key]:
                errors.append(
                    f"{table}: {key.replace('_', ' ')} differ from the legacy baseline; "
                    f"expected={wanted[key]!r}; found={found[key]!r}"
                )
    return errors


def database_identity(url: URL) -> str:
    return f"{url.host}:{url.port or 5432}/{url.database}"


def preflight(url: URL) -> tuple[Engine, dict[str, Any], str | None, list[str]]:
    engine = connect(url)
    try:
        with engine.connect() as connection:
            connection.execute(sa.text("SELECT 1"))
        actual, revision = schema_snapshot(engine)
        issues = compare_schema(actual, revision)
        return engine, actual, revision, issues
    except Exception:
        engine.dispose()
        raise


def print_preflight(identity: str, actual: dict[str, Any], revision: str | None, issues: list[str]) -> None:
    print(f"Target: {identity}")
    if revision is not None:
        print(f"Alembic revision: {revision}")
    if not issues and revision == CURRENT_REVISION:
        print("Schema: matches the current migration head")
    elif not issues and revision == BASELINE_REVISION:
        print("Schema: matches the legacy baseline")
    elif not issues and pending_additive_changes(actual):
        print("Schema: recognized older schema; only known additive changes are needed")
        for change in pending_additive_changes(actual):
            print(f"- Planned alignment: {change}")
    elif not issues:
        print("Schema: matches the frozen legacy_baseline")
    else:
        print("Schema: does not match legacy_baseline; adoption is blocked")
    for issue in issues:
        print(f"- {issue}")
    if not issues and revision is None:
        print(f"Tables checked: {len(actual)}")


def require_pg_tools() -> tuple[str, str]:
    pg_dump = shutil.which("pg_dump")
    pg_restore = shutil.which("pg_restore")
    if not pg_dump or not pg_restore:
        raise SafetyError("Install PostgreSQL client tools (pg_dump and pg_restore) first.")
    return pg_dump, pg_restore


def pgpass_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:")


def pg_environment(url: URL) -> tuple[dict[str, str], str | None]:
    """Create a short-lived permission-restricted pgpass file for libpq tools."""
    env = os.environ.copy()
    for key in list(env):
        if key.startswith("PG"):
            env.pop(key, None)
    password_file = None
    if url.password is not None:
        if "\n" in url.password or "\r" in url.password:
            raise SafetyError("Database passwords containing newlines cannot be used for backup.")
        fd, password_file = tempfile.mkstemp(prefix="mentor-match-pgpass-")
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            fields = [url.host or "*", str(url.port or "*"), url.database or "*", url.username or "*", url.password]
            handle.write(":".join(pgpass_escape(str(field)) for field in fields) + "\n")
        env["PGPASSFILE"] = password_file
    query_to_env = {
        "sslmode": "PGSSLMODE",
        "sslrootcert": "PGSSLROOTCERT",
        "sslcert": "PGSSLCERT",
        "sslkey": "PGSSLKEY",
        "application_name": "PGAPPNAME",
        "connect_timeout": "PGCONNECT_TIMEOUT",
    }
    for key, env_key in query_to_env.items():
        value = url.query.get(key)
        if isinstance(value, tuple):
            value = value[-1]
        if value is not None:
            env[env_key] = str(value)
    return env, password_file


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def schema_fingerprint() -> str:
    canonical = json.dumps(expected_schema(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def backup_database(url: URL, directory: Path, actual: dict[str, Any], revision: str | None, issues: list[str]) -> Path:
    pg_dump, pg_restore = require_pg_tools()
    directory = directory.expanduser().resolve()
    project_root = BACKEND.parent
    if directory == project_root or project_root in directory.parents:
        raise SafetyError("Store database backups outside the project directory.")
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stem = f"mentor_match_{stamp}"
    archive = directory / f"{stem}.dump"
    manifest = directory / f"{stem}.manifest.json"
    if archive.exists() or manifest.exists():
        raise SafetyError(f"Backup path already exists: {archive}")

    env, password_file = pg_environment(url)
    temporary = directory / f".{stem}.dump.partial"
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(descriptor)
        command_line = [
            pg_dump, "--no-password", "--format=custom", "--compress=6",
            "--no-owner", "--no-privileges", "--host", url.host or "",
            "--port", str(url.port or 5432), "--username", url.username or "",
            "--dbname", url.database or "", "--file", str(temporary),
        ]
        subprocess.run(command_line, env=env, check=True, stdin=subprocess.DEVNULL)
        subprocess.run(
            [pg_restore, "--list", str(temporary)], env=env, check=True,
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        )
        os.replace(temporary, archive)
        manifest_data = {
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "target": database_identity(url),
            "archive": archive.name,
            "archive_size_bytes": archive.stat().st_size,
            "archive_sha256": file_sha256(archive),
            "baseline_fingerprint_sha256": schema_fingerprint(),
            "alembic_revision": revision,
            "preflight_passed": not issues,
            "preflight_issues": issues,
            "known_additive_changes": pending_additive_changes(actual),
            "table_names": sorted(actual),
        }
        temp_manifest = manifest.with_suffix(".json.partial")
        temp_manifest.write_text(json.dumps(manifest_data, indent=2) + "\n", encoding="utf-8")
        os.chmod(temp_manifest, 0o600)
        os.replace(temp_manifest, manifest)
        os.chmod(archive, 0o600)
        return archive
    finally:
        if temporary.exists():
            temporary.unlink()
        if password_file and Path(password_file).exists():
            Path(password_file).unlink()


def verify_backup(url: URL, archive: Path) -> dict[str, Any]:
    _, pg_restore = require_pg_tools()
    archive = archive.expanduser().resolve()
    manifest_path = archive.with_suffix(".manifest.json")
    if not archive.is_file() or not manifest_path.is_file():
        raise SafetyError("Backup archive or its manifest is missing.")
    try:
        metadata = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SafetyError("Backup manifest cannot be read.") from error
    if metadata.get("target") != database_identity(url):
        raise SafetyError("Backup belongs to a different database target.")
    if metadata.get("archive") != archive.name:
        raise SafetyError("Backup manifest names a different archive.")
    if metadata.get("archive_size_bytes") != archive.stat().st_size:
        raise SafetyError("Backup archive size does not match its manifest.")
    if metadata.get("archive_sha256") != file_sha256(archive):
        raise SafetyError("Backup archive checksum does not match its manifest.")
    if metadata.get("baseline_fingerprint_sha256") != schema_fingerprint():
        raise SafetyError("Backup was created against a different baseline revision.")
    if not metadata.get("preflight_passed"):
        raise SafetyError("Backup manifest records a failed schema preflight.")
    subprocess.run(
        [pg_restore, "--list", str(archive)], check=True,
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
    )
    return metadata


def align_known_legacy_schema(url: URL) -> None:
    """Apply only the reviewed, additive gaps from the known older release."""
    engine = connect(url)
    try:
        with engine.begin() as connection:
            inspector = inspect(connection)
            tables = set(inspector.get_table_names(schema="public"))
            operations = Operations(MigrationContext.configure(connection))

            if "profiles" in tables:
                profile_columns = {column["name"] for column in inspector.get_columns("profiles", schema="public")}
                if "resume_text" not in profile_columns:
                    operations.add_column(
                        "profiles",
                        sa.Column(
                            "resume_text",
                            sa.Text(),
                            server_default=sa.text("('')"),
                            nullable=False,
                        ),
                        schema="public",
                    )
            if "mentee_goals" in tables:
                goal_columns = {column["name"] for column in inspector.get_columns("mentee_goals", schema="public")}
                if "shared_with_mentor" not in goal_columns:
                    operations.add_column(
                        "mentee_goals",
                        sa.Column(
                            "shared_with_mentor",
                            sa.Boolean(),
                            server_default=sa.text("false"),
                            nullable=False,
                        ),
                        schema="public",
                    )

            if "profile_skills" not in tables:
                operations.create_table(
                    "profile_skills",
                    sa.Column("id", sa.Uuid(), nullable=False),
                    sa.Column("profile_id", sa.Uuid(), nullable=False),
                    sa.Column("skill", sa.String(length=120), nullable=False),
                    sa.Column(
                        "created_at",
                        sa.DateTime(timezone=True),
                        server_default=sa.text("(CURRENT_TIMESTAMP)"),
                        nullable=False,
                    ),
                    sa.ForeignKeyConstraint(
                        ["profile_id"], ["public.profiles.id"], ondelete="CASCADE"
                    ),
                    sa.PrimaryKeyConstraint("id"),
                    sa.UniqueConstraint("profile_id", "skill", name="uq_profile_skill"),
                    schema="public",
                )
                operations.create_index(
                    "ix_profile_skills_profile_id",
                    "profile_skills",
                    ["profile_id"],
                    schema="public",
                )
                operations.create_index(
                    "ix_profile_skills_skill",
                    "profile_skills",
                    ["skill"],
                    schema="public",
                )

            if "recommendations" not in tables:
                operations.create_table(
                    "recommendations",
                    sa.Column("id", sa.Uuid(), nullable=False),
                    sa.Column("graduate_id", sa.Uuid(), nullable=False),
                    sa.Column("mentor_id", sa.Uuid(), nullable=False),
                    sa.Column("score", sa.Float(), nullable=False),
                    sa.Column("rank", sa.Integer(), nullable=False),
                    sa.Column("shared_skills", sa.JSON(), nullable=False),
                    sa.Column(
                        "generated_at",
                        sa.DateTime(timezone=True),
                        server_default=sa.text("(CURRENT_TIMESTAMP)"),
                        nullable=False,
                    ),
                    sa.ForeignKeyConstraint(
                        ["graduate_id"], ["public.users.id"], ondelete="CASCADE"
                    ),
                    sa.ForeignKeyConstraint(
                        ["mentor_id"], ["public.users.id"], ondelete="CASCADE"
                    ),
                    sa.PrimaryKeyConstraint("id"),
                    schema="public",
                )
                operations.create_index(
                    "ix_recommendations_graduate_id",
                    "recommendations",
                    ["graduate_id"],
                    schema="public",
                )
                operations.create_index(
                    "ix_recommendations_mentor_id",
                    "recommendations",
                    ["mentor_id"],
                    schema="public",
                )
    finally:
        engine.dispose()


def apply_adoption(url: URL, expected_identity: str, additive_changes: list[str]) -> None:
    if not sys.stdin.isatty():
        raise SafetyError("Adoption requires an interactive terminal confirmation.")
    print("\nThis will write Alembic history and apply migrations to the target.")
    print("It will not seed demo or production data.")
    confirmation = input(f"Type {expected_identity!r} to continue: ").strip()
    if confirmation != expected_identity:
        raise SafetyError("Target confirmation did not match; no migration was run.")

    if additive_changes:
        print("Applying reviewed add-only schema alignment:")
        for change in additive_changes:
            print(f"- {change}")
        align_known_legacy_schema(url)

    check_engine, actual, revision, issues = preflight(url)
    try:
        remaining_additions = pending_additive_changes(actual)
        if revision is not None or issues or remaining_additions:
            detail = issues + remaining_additions
            raise SafetyError(
                "Schema alignment did not produce the expected baseline; refusing to stamp. "
                + "; ".join(detail)
            )
    finally:
        check_engine.dispose()

    os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    config = Config(str(BACKEND / "alembic.ini"))
    command.stamp(config, BASELINE_REVISION)
    command.upgrade(config, "head")
    command.check(config)
    print("Adoption completed and Alembic metadata check passed.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("preflight", help="Read-only schema check")
    backup_parser = subparsers.add_parser("backup", help="Preflight, dump, and verify a backup")
    backup_parser.add_argument("--directory", required=True, type=Path, help="Backup directory outside the project")
    adopt_parser = subparsers.add_parser("adopt", help="Preflight, back up, confirm, then migrate")
    adopt_parser.add_argument("--directory", required=True, type=Path, help="Backup directory outside the project")
    args = parser.parse_args()

    try:
        url = target_url()
        identity = database_identity(url)
        engine, actual, revision, issues = preflight(url)
        try:
            print_preflight(identity, actual, revision, issues)
            if args.action == "preflight":
                return 1 if issues else 0
            if args.action == "backup":
                if issues:
                    print("Creating a verified backup despite preflight differences; adoption remains blocked.")
                archive = backup_database(url, args.directory, actual, revision, issues)
                print(f"Verified backup: {archive}")
                print(f"Manifest: {archive.with_suffix('.manifest.json')}")
                return 0
            if issues:
                raise SafetyError("Adoption stopped because preflight did not pass.")
            if revision is not None:
                raise SafetyError("This database is already versioned; do not stamp it.")
            archive = backup_database(url, args.directory, actual, revision, issues)
            verify_backup(url, archive)
            print(f"Verified backup created: {archive}")
            apply_adoption(url, identity, pending_additive_changes(actual))
            return 0
        finally:
            engine.dispose()
    except (SafetyError, sa.exc.SQLAlchemyError, OSError, subprocess.CalledProcessError) as error:
        print(f"Preflight stopped: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
