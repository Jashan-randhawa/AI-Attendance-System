"""
core/audit.py
Immutable audit trail logger for compliance and security events.
"""
import logging
from datetime import datetime, UTC
from typing import Optional, Any
from core.database import get_database

logger = logging.getLogger("attendance.audit")


async def record_audit_event(
    action: str,
    actor_id: str,
    actor_role: str,
    ip_address: str = "unknown",
    target_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """
    Persists an immutable audit log entry to MongoDB.
    Non-blocking / failsafe: will not fail the primary user request if logging encounters a fault.
    """
    try:
        db = get_database()
        event_doc = {
            "action": action,
            "actor_id": actor_id,
            "actor_role": actor_role,
            "ip_address": ip_address,
            "target_id": target_id,
            "metadata": metadata or {},
            "timestamp": datetime.now(UTC),
        }
        await db.audit_logs.insert_one(event_doc)
        logger.info("AUDIT: action=%s actor=%s(%s) target=%s", action, actor_id, actor_role, target_id)
    except Exception as e:
        logger.warning("Failed to record audit event '%s': %s", action, e)
