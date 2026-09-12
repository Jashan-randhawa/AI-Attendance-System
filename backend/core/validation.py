"""
core/validation.py
Shared upload validation for image files (Remediation Plan item #7).

Previously, every upload endpoint only checked `UploadFile.content_type`,
which is a client-supplied header and trivially spoofed — a request could
claim "image/jpeg" while sending arbitrary bytes. The actual image decode
inside core/azure_face.py (_bytes_to_bgr) would then throw deep inside the
InsightFace pipeline, surfacing as an opaque 503 "enrollment failed" error
instead of a clear, immediate 400.

This module does two things before any bytes reach the face-recognition
pipeline:
  1. Enforces a maximum upload size (FastAPI/Starlette impose no default
     limit — an unbounded upload is a memory-exhaustion vector).
  2. Actually decodes the bytes as an image (Pillow) to confirm they are a
     real image, not just correctly-labeled garbage.
"""

import io
import logging

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB per photo — generous for a phone/webcam frame
MAX_IMAGE_DIMENSION = 6000  # pixels per side — generous headroom for any real camera frame


async def read_and_validate_image(photo: UploadFile) -> bytes:
    """
    Read an UploadFile's bytes and validate it is actually a decodable image
    within the size limit. Raises HTTPException(400) on any failure so
    callers get a clean, immediate error instead of a downstream 503.
    """
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(400, f"File '{photo.filename}' is not an image.")

    data = await photo.read()

    if not data:
        raise HTTPException(400, f"File '{photo.filename}' is empty.")

    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            400,
            f"File '{photo.filename}' is {len(data) / 1_048_576:.1f} MB, "
            f"which exceeds the {MAX_UPLOAD_BYTES / 1_048_576:.0f} MB limit per photo.",
        )

    try:
        # verify() checks the file is a structurally valid image without
        # fully decoding pixel data (cheap). It closes the file object
        # afterward, hence the immediate re-open pattern used elsewhere.
        Image.open(io.BytesIO(data)).verify()
    except (UnidentifiedImageError, OSError, ValueError) as e:
        logger.warning("Rejected upload '%s': not a valid image (%s)", photo.filename, e)
        raise HTTPException(
            400,
            f"File '{photo.filename}' could not be read as an image. "
            "It may be corrupted or is not actually an image file.",
        )

    # Byte size and pixel count are not the same thing: a highly compressible
    # image can be well under MAX_UPLOAD_BYTES on disk while decompressing
    # into a pixel buffer many times larger. Downstream processing (InsightFace)
    # scales with pixel count, not file size, so this closes that separate
    # memory-exhaustion vector. verify() above already closed the file object,
    # so this needs its own fresh open on the same bytes.
    img = Image.open(io.BytesIO(data))
    if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
        raise HTTPException(
            400,
            f"File '{photo.filename}' has dimensions {img.width}x{img.height}, "
            f"which exceeds the maximum allowed ({MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}).",
        )

    return data
