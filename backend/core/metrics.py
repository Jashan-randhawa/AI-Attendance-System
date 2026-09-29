"""
core/metrics.py

Biometric inference performance & attendance observability metrics.
Supports prometheus_client if installed, falling back to a thread-safe
in-memory aggregator to ensure zero-dependency operational compatibility.
"""

import time
import logging
import threading
from typing import Dict, Any

logger = logging.getLogger(__name__)

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    _HAS_PROMETHEUS = True
except ImportError:
    _HAS_PROMETHEUS = False

if _HAS_PROMETHEUS:
    INFERENCE_DURATION = Histogram(
        "attendance_face_inference_duration_seconds",
        "Biometric feature extraction and dot-product matching duration in seconds",
        buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
    )
    ATTENDANCE_MARKS_TOTAL = Counter(
        "attendance_marks_total",
        "Total attendance mark evaluations partitioned by result status",
        ["status"],
    )
    ENROLLED_SUBJECTS_GAUGE = Gauge(
        "attendance_enrolled_subjects_count",
        "Total active enrolled biometric subjects in local memory cache",
    )
else:
    # In-memory thread-safe fallback aggregator
    class _InMemoryMetrics:
        def __init__(self):
            self._lock = threading.Lock()
            self.marks_counts: Dict[str, int] = {"new": 0, "duplicate": 0, "rejected": 0}
            self.enrolled_count = 0
            self.inference_durations = []

        def inc_mark(self, status: str):
            with self._lock:
                self.marks_counts[status] = self.marks_counts.get(status, 0) + 1

        def set_enrolled(self, count: int):
            with self._lock:
                self.enrolled_count = count

        def record_duration(self, duration: float):
            with self._lock:
                self.inference_durations.append(duration)
                if len(self.inference_durations) > 500:
                    self.inference_durations = self.inference_durations[-500:]

        def render_prometheus_text(self) -> str:
            with self._lock:
                lines = [
                    "# HELP attendance_face_inference_duration_seconds Biometric matching duration in seconds",
                    "# TYPE attendance_face_inference_duration_seconds summary",
                ]
                if self.inference_durations:
                    avg_dur = sum(self.inference_durations) / len(self.inference_durations)
                    lines.append(f'attendance_face_inference_duration_seconds_avg {avg_dur:.4f}')
                    lines.append(f'attendance_face_inference_duration_seconds_count {len(self.inference_durations)}')
                else:
                    lines.append('attendance_face_inference_duration_seconds_count 0')

                lines.extend([
                    "# HELP attendance_marks_total Total attendance mark attempts",
                    "# TYPE attendance_marks_total counter",
                ])
                for status, val in self.marks_counts.items():
                    lines.append(f'attendance_marks_total{{status="{status}"}} {val}')

                lines.extend([
                    "# HELP attendance_enrolled_subjects_count Total active enrolled biometric subjects",
                    "# TYPE attendance_enrolled_subjects_count gauge",
                    f'attendance_enrolled_subjects_count {self.enrolled_count}',
                ])
                return "\n".join(lines) + "\n"

    _FALLBACK_METRICS = _InMemoryMetrics()


def record_inference_duration(duration_seconds: float):
    """Record duration of face detection + vectorized embedding comparison."""
    if _HAS_PROMETHEUS:
        INFERENCE_DURATION.observe(duration_seconds)
    else:
        _FALLBACK_METRICS.record_duration(duration_seconds)


def record_attendance_mark(status: str):
    """Increment attendance mark counter with status ('new', 'duplicate', 'rejected')."""
    if _HAS_PROMETHEUS:
        ATTENDANCE_MARKS_TOTAL.labels(status=status).inc()
    else:
        _FALLBACK_METRICS.inc_mark(status)


def set_enrolled_subjects(count: int):
    """Update active enrolled subjects gauge."""
    if _HAS_PROMETHEUS:
        ENROLLED_SUBJECTS_GAUGE.set(count)
    else:
        _FALLBACK_METRICS.set_enrolled(count)


def get_prometheus_metrics() -> tuple[bytes, str]:
    """Return serialized Prometheus metrics payload and content-type."""
    if _HAS_PROMETHEUS:
        return generate_latest(), CONTENT_TYPE_LATEST
    text = _FALLBACK_METRICS.render_prometheus_text()
    return text.encode("utf-8"), "text/plain; version=0.0.4; charset=utf-8"
