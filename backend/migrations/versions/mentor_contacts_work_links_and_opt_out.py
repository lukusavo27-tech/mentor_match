"""Add participant contacts, goal review links, and mentor opt-outs."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "mentor_contacts_work_opt_out"
down_revision: Union[str, Sequence[str], None] = "admin_flags_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "phone_number" not in user_columns:
        op.add_column(
            "users",
            sa.Column("phone_number", sa.String(length=32), nullable=False, server_default=""),
        )
    goal_columns = {column["name"] for column in inspector.get_columns("mentee_goals")}
    if "work_url" not in goal_columns:
        op.add_column(
            "mentee_goals",
            sa.Column("work_url", sa.String(length=2048), nullable=False, server_default=""),
        )
    if "mentor_opt_outs" not in inspector.get_table_names():
        op.create_table(
            "mentor_opt_outs",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("mentor_id", sa.Uuid(), nullable=False),
            sa.Column("mentee_id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["mentee_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("mentor_id", "mentee_id", name="uq_mentor_opt_out_pair"),
        )
        op.create_index("ix_mentor_opt_outs_mentor_id", "mentor_opt_outs", ["mentor_id"])
        op.create_index("ix_mentor_opt_outs_mentee_id", "mentor_opt_outs", ["mentee_id"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "mentor_opt_outs" in tables:
        op.drop_index("ix_mentor_opt_outs_mentee_id", table_name="mentor_opt_outs")
        op.drop_index("ix_mentor_opt_outs_mentor_id", table_name="mentor_opt_outs")
        op.drop_table("mentor_opt_outs")
    for table, column in (("mentee_goals", "work_url"), ("users", "phone_number")):
        if column in {item["name"] for item in sa.inspect(bind).get_columns(table)}:
            op.drop_column(table, column)
