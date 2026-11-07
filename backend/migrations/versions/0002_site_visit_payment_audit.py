"""Persist site visit payment verification details."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0002_site_visit_payment_audit"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("site_visits")}
    if "payment_reference" not in columns:
        op.add_column("site_visits", sa.Column("payment_reference", sa.String(length=100), nullable=True))
    if "payment_verified_by" not in columns:
        op.add_column("site_visits", sa.Column("payment_verified_by", sa.Integer(), nullable=True))
    if "payment_verified_at" not in columns:
        op.add_column("site_visits", sa.Column("payment_verified_at", sa.DateTime(timezone=True), nullable=True))

def downgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("site_visits")}
    for name in ("payment_verified_at", "payment_verified_by", "payment_reference"):
        if name in columns:
            op.drop_column("site_visits", name)
