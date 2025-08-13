"""
Dashboard Service API

FastAPI endpoints for dashboard and widget management
"""

from .dashboards import router as dashboards_router
from .charts import router as charts_router
from .embed import router as embed_router

__all__ = ['dashboards_router', 'charts_router', 'embed_router']