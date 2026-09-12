"""
core/rate_limit.py
Shared slowapi Limiter instance (Remediation Plan item #5).

Kept in its own module (rather than defined in main.py) so routers can import
it directly with `from core.rate_limit import limiter` without a circular
import back to main.py.

Per-IP limits are applied to the endpoints that trigger InsightFace inference
(enroll, enroll/analyze, identify, mark) since those are the CPU-heavy,
abusable paths. Cheap read endpoints (list persons, dashboard, reports) are
intentionally left unlimited for now.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
