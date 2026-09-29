"""
core/vision_engine.py
Canonical vision engine interface and provider protocol for SmartAttend.
Decouples neural model execution from legacy naming artifacts.
"""
from typing import Protocol, List, Optional, Dict, Any

from core.azure_face import (
    identify_faces,
    check_duplicate_face,
    enroll_person,
    delete_person,
    ensure_person_group,
    upload_photo_to_blob,
    _cosine_similarity,
    _check_face_quality,
    _check_liveness,
    _bytes_to_bgr,
    _build_normalized_matrix,
    invalidate_cache,
)


class VisionEngine(Protocol):
    """Abstract interface defining the facial recognition and biometric vision pipeline."""

    async def ensure_ready(self) -> None:
        """Initializes and pre-warms the face analysis model."""
        ...

    async def enroll(self, name: str, image_bytes_list: List[bytes]) -> str:
        """Enrolls face images with quality gates, persisting normalized embeddings."""
        ...

    async def delete(self, person_id: str) -> None:
        """Removes all enrolled embeddings associated with the specified person."""
        ...

    async def identify(
        self, image_bytes: bytes, confidence_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Identifies all detected faces in a single frame against enrolled vectors."""
        ...

    async def check_duplicate(
        self, image_bytes_list: List[bytes], similarity_threshold: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """Verifies candidate photos against existing gallery to prevent duplicate enrollments."""
        ...


class InsightFaceEngine:
    """Production VisionEngine implementation backed by InsightFace ONNX and MongoDB."""

    async def ensure_ready(self) -> None:
        await ensure_person_group()

    async def enroll(self, name: str, image_bytes_list: List[bytes]) -> str:
        return await enroll_person(name, image_bytes_list)

    async def delete(self, person_id: str) -> None:
        await delete_person(person_id)

    async def identify(
        self, image_bytes: bytes, confidence_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        return await identify_faces(image_bytes, confidence_threshold)

    async def check_duplicate(
        self, image_bytes_list: List[bytes], similarity_threshold: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        return await check_duplicate_face(image_bytes_list, similarity_threshold)


# Default singleton provider instance
default_vision_engine: VisionEngine = InsightFaceEngine()
