"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-05-23 20:06:28.880372

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "log_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("total_lines", sa.Integer(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_log_sessions_user_id"
        ),
    )
    op.create_index("ix_log_sessions_id", "log_sessions", ["id"])

    op.create_table(
        "log_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=50), nullable=False),
        sa.Column("raw", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["log_sessions.id"], ondelete="CASCADE", name="fk_log_entries_session_id"
        ),
    )
    op.create_index("ix_log_entries_id", "log_entries", ["id"])
    op.create_index("ix_log_entries_level", "log_entries", ["level"])


def downgrade() -> None:
    op.drop_index("ix_log_entries_level", table_name="log_entries")
    op.drop_index("ix_log_entries_id", table_name="log_entries")
    op.drop_table("log_entries")
    op.drop_index("ix_log_sessions_id", table_name="log_sessions")
    op.drop_table("log_sessions")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
