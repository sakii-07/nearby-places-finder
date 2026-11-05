"""Add roles, ownership, and favorites support."""

from alembic import op
import sqlalchemy as sa

revision = "20261104_0002"
down_revision = "20261104_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="user"))
    op.add_column("places", sa.Column("owner_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_places_owner_id"), "places", ["owner_id"], unique=False)
    op.create_foreign_key(
        "fk_places_owner_id_users",
        "places",
        "users",
        ["owner_id"],
        ["id"],
    )

    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("place_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["place_id"], ["places.id"]),
        sa.UniqueConstraint("user_id", "place_id", name="uq_favorites_user_place"),
    )
    op.create_index("ix_favorites_id", "favorites", ["id"], unique=False)
    op.create_index("ix_favorites_user_id", "favorites", ["user_id"], unique=False)
    op.create_index("ix_favorites_place_id", "favorites", ["place_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_favorites_place_id", table_name="favorites")
    op.drop_index("ix_favorites_user_id", table_name="favorites")
    op.drop_index("ix_favorites_id", table_name="favorites")
    op.drop_table("favorites")
    op.drop_constraint("fk_places_owner_id_users", "places", type_="foreignkey")
    op.drop_index("ix_places_owner_id", table_name="places")
    op.drop_column("places", "owner_id")
    op.drop_column("users", "role")
