import uuid
from io import BytesIO

import boto3
from botocore.config import Config
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from PIL import Image

from app.deps import get_current_user
from app.config import (
    UPLOADTYPE,
    CLOUDFLARE_ACCESS_KEY,
    CLOUDFLARE_SECRET_KEY,
    CLOUDFLARE_BUCKET,
    CLOUDFLARE_ENDPOINT,
    CLOUDFLARE_PUBLIC_BASE_URL,
    CLOUDFLARE_REGION,
    UPLOAD_PREFIX,
    PHOTOWALL_PREFIX,
)

router = APIRouter(prefix="/api/upload", tags=["上传"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


def _normalize_prefix(prefix: str) -> str:
    p = (prefix or "").strip().lstrip("/")
    if not p:
        return ""
    return p if p.endswith("/") else p + "/"


def _public_url(key: str) -> str:
    base = CLOUDFLARE_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/{key.lstrip('/')}"


def _get_s3_client():
    if UPLOADTYPE not in {"cf", "r2", "cloudflare"}:
        raise HTTPException(
            500,
            f"Unsupported UPLOADTYPE={UPLOADTYPE!r}; expected cf (Cloudflare R2)",
        )
    if not CLOUDFLARE_ACCESS_KEY or not CLOUDFLARE_SECRET_KEY:
        raise HTTPException(
            500,
            "Missing Cloudflare R2 credentials "
            "(CLOUDFLARE_ACCESS_KEY / CLOUDFLARE_SECRET_KEY, "
            "or R2_* / OSS_* fallbacks)",
        )
    return boto3.client(
        "s3",
        endpoint_url=CLOUDFLARE_ENDPOINT,
        aws_access_key_id=CLOUDFLARE_ACCESS_KEY,
        aws_secret_access_key=CLOUDFLARE_SECRET_KEY,
        region_name=CLOUDFLARE_REGION or "auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def upload_object(content: bytes, *, key: str, content_type: str | None = None) -> str:
    """Upload bytes to R2; shared by image upload and article extract image migration."""
    return _upload_bytes(content, key=key, content_type=content_type)


def make_object_key(prefix: str, filename: str | None = None) -> str:
    return _make_key(prefix, filename)


def _upload_bytes(content: bytes, *, key: str, content_type: str | None) -> str:
    client = _get_s3_client()
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    client.put_object(Bucket=CLOUDFLARE_BUCKET, Key=key, Body=content, **extra)
    return _public_url(key)


async def _read_and_validate(file: UploadFile):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "文件大小不能超过 10MB")

    orientation = "landscape"
    try:
        img = Image.open(BytesIO(content))
        w, h = img.size
        orientation = "landscape" if w >= h else "portrait"
    except Exception:
        pass
    return content, orientation


def _make_key(prefix: str, filename: str | None) -> str:
    ext = "webp"
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower() or "webp"
    # Keep historical OSS/ objects untouched; new uploads use kirameku/ or photowall/
    return f"{_normalize_prefix(prefix)}{uuid.uuid4().hex}.{ext}"


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
    scope: str = Query(
        "kirameku",
        description="kirameku (default UPLOAD_PREFIX) | photowall",
    ),
):
    content, orientation = await _read_and_validate(file)

    if scope == "photowall":
        prefix = PHOTOWALL_PREFIX
    else:
        prefix = UPLOAD_PREFIX

    key = _make_key(prefix, file.filename)
    url = _upload_bytes(content, key=key, content_type=file.content_type)
    return {"url": url, "orientation": orientation, "key": key}


@router.post("/photowall")
async def upload_photowall(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
):
    """Batch / photo-wall uploads under photowall/ prefix."""
    content, orientation = await _read_and_validate(file)
    key = _make_key(PHOTOWALL_PREFIX, file.filename)
    url = _upload_bytes(content, key=key, content_type=file.content_type)
    return {"url": url, "orientation": orientation, "key": key}
