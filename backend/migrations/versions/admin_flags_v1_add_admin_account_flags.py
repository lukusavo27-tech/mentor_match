"""Add administrator and active-account flags."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "admin_flags_v1"
down_revision: Union[str, Sequence[str], None] = "legacy_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "is_admin" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "is_admin",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
        )
    if "is_active" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "is_active",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    protected_values = []
    if "is_admin" in columns:
        protected_values.append("is_admin = true")
    if "is_active" in columns:
        protected_values.append("is_active = false")
    if protected_values:
        flagged_users = bind.execute(
            sa.text(f"SELECT COUNT(*) FROM users WHERE {' OR '.join(protected_values)}")
        ).scalar_one()
        if flagged_users:
            raise RuntimeError(
                "Cannot remove admin flags while administrator or suspended "
                "accounts exist."
            )
    if "is_active" in columns:
        op.drop_column("users", "is_active")
    if "is_admin" in columns:
        op.drop_column("users", "is_admin")
