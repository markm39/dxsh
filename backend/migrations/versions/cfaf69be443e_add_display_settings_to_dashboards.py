"""add_display_settings_to_dashboards

Revision ID: cfaf69be443e
Revises: 2542aaa2426b
Create Date: 2025-08-02 22:45:22.754932

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cfaf69be443e'
down_revision = '2542aaa2426b'
branch_labels = None
depends_on = None


def upgrade():
    # Add display_settings column to dashboards table
    op.add_column('dashboards', sa.Column(
        'display_settings', 
        sa.JSON(), 
        server_default='{"showWidgetHeaders": true, "showWidgetFooters": true, "compactMode": false, "theme": "default"}',
        nullable=True
    ))


def downgrade():
    # Remove display_settings column from dashboards table
    op.drop_column('dashboards', 'display_settings')
