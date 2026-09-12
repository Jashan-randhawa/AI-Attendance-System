"""
core/logging_context.py
Request correlation for logs (Remediation Plan item #9).

Previously every log line (`logger.info(...)`, `logger.warning(...)`) in
routers/ and core/azure_face.py was a bare string with no way to tie it back
to a specific HTTP request. During an incident ("this enrollment failed for
a user"), there was no way to grep the logs for just that request's lines —
you'd get every enrollment's logs interleaved.

This module provides:
  - a contextvar holding the current request's short correlation ID
  - a logging.Filter that injects it into every LogRecord as `request_id`
  - ASGI middleware that generates the ID, sets the contextvar, and echoes
    it back as an `X-Request-ID` response header (so a frontend/operator can
    report "request abc123 failed" and it's directly greppable)

Usage (wired in main.py):
    from core.logging_context import RequestIDMiddleware, install_request_id_filter
    install_request_id_filter()
    app.add_middleware(RequestIDMiddleware)

Then any existing `logging.getLogger(__name__)` call anywhere in the codebase
automatically gets `request_id` in its formatted output — no per-call-site
changes needed in routers/persons.py, routers/attendance.py, etc.
"""

import logging
import uuid
from contextvars import ContextVar, copy_context

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIDFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id_ctx.get()
        return True


def install_request_id_filter() -> None:
    """Attach the request-ID filter + formatter to the root logger's handlers."""
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] [req=%(request_id)s] %(name)s: %(message)s"
    )
    root = logging.getLogger()
    if not root.handlers:
        # basicConfig() may not have run yet in some import orders — ensure
        # at least one handler exists before we attach the filter to it.
        logging.basicConfig(level=logging.INFO)
    for handler in root.handlers:
        handler.addFilter(_RequestIDFilter())
        handler.setFormatter(fmt)


async def run_in_executor_ctx(loop, func, *args):
    """
    Drop-in replacement for `loop.run_in_executor(None, func, *args)` that
    preserves the current contextvars (specifically: the request ID) inside
    the worker thread.

    Why this exists: asyncio.AbstractEventLoop.run_in_executor does NOT copy
    the calling context into the executor thread (unlike asyncio.to_thread,
    which does). core/azure_face.py runs almost all of its actual work —
    face encoding, matching, quality checks — inside run_in_executor calls,
    since InsightFace/OpenCV are synchronous, CPU-bound libraries. Without
    this wrapper, request_id would show up correctly in the router's own
    log lines but silently drop to "-" for every log line that matters
    (the ones inside azure_face.py), which defeats the point of Phase 1's
    request-correlation logging.
    """
    ctx = copy_context()
    return await loop.run_in_executor(None, lambda: ctx.run(func, *args))


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Generates a short correlation ID per request, makes it available to every
    logger via the contextvar above, and echoes it back as X-Request-ID so
    operators/clients can reference a specific request when reporting issues.
    """

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("x-request-id")
        req_id = incoming or uuid.uuid4().hex[:12]
        token = _request_id_ctx.set(req_id)
        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)
        response.headers["X-Request-ID"] = req_id
        return response
