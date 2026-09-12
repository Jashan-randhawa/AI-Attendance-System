"""
tests/test_validation.py

Covers Phase 4 findings:
  #6 — read_and_validate_image() now also caps pixel dimensions, not just
       byte size, since a highly-compressible image can be small on disk
       but decompress into a huge pixel buffer.
  #5 — HTTPException messages raised from caught exceptions no longer embed
       the raw exception text (which could leak connection strings, file
       paths, or library internals).
"""

import io

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image

from core.validation import MAX_IMAGE_DIMENSION, read_and_validate_image


def _upload_file(data: bytes, filename="photo.jpg", content_type="image/jpeg") -> UploadFile:
    return UploadFile(filename=filename, file=io.BytesIO(data), headers={"content-type": content_type})


def _jpeg_bytes(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color=(120, 120, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_normal_sized_image_passes():
    data = _jpeg_bytes(800, 600)
    result = await read_and_validate_image(_upload_file(data))
    assert result == data


@pytest.mark.asyncio
async def test_oversized_dimensions_are_rejected():
    # One side over the limit is enough to trip the check.
    data = _jpeg_bytes(MAX_IMAGE_DIMENSION + 1, 100)
    with pytest.raises(HTTPException) as exc_info:
        await read_and_validate_image(_upload_file(data))
    assert exc_info.value.status_code == 400
    assert str(MAX_IMAGE_DIMENSION) in exc_info.value.detail


@pytest.mark.asyncio
async def test_image_at_exactly_the_limit_is_allowed():
    data = _jpeg_bytes(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
    result = await read_and_validate_image(_upload_file(data))
    assert result == data


# ─── Regression: Phase 4 finding #5 — raw exception text used to be embedded
# directly in HTTPException.detail via f"...{e}" / str(e). Spot-check a few
# of the fixed call sites to make sure the pattern doesn't creep back in.

def test_no_raw_exception_interpolation_left_in_routers():
    """Regression check for Phase 4 finding #5: no HTTPException(...) call
    in the routers should embed a caught exception's text directly via an
    f-string (f"...{e}"). The one remaining `str(e)` passthrough (in
    persons.py's enroll route) is a deliberate, application-generated
    ValueError message, not a leaked internal exception, so it's exempted
    by name rather than pattern-matched here.
    """
    import pathlib

    router_files = sorted((pathlib.Path(__file__).parent.parent / "routers").glob("*.py"))
    offenders = []
    for path in router_files:
        for lineno, line in enumerate(path.read_text().splitlines(), start=1):
            if "HTTPException(" in line and "{e}" in line:
                offenders.append(f"{path.name}:{lineno}: {line.strip()}")

    assert offenders == [], f"Raw exception text leaked to client in: {offenders}"
