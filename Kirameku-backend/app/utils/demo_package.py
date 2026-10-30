import os
import zipfile
from io import BytesIO

from fastapi import HTTPException

from app.config import DEMO_MAX_FILE_BYTES, DEMO_MAX_FILES, DEMO_MAX_ZIP_BYTES

ALLOWED_EXTENSIONS = {
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".json",
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp3",
    ".mp4",
    ".webm",
    ".wasm",
    ".txt",
    ".md",
    ".xml",
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
}


def _normalize_zip_path(name: str) -> str:
    name = name.replace("\\", "/").lstrip("/")
    if not name or name.endswith("/"):
        return ""
    parts = []
    for part in name.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise HTTPException(400, f"压缩包包含非法路径: {name}")
        parts.append(part)
    return "/".join(parts)


def extract_demo_zip(zip_bytes: bytes) -> list[tuple[str, bytes]]:
    if len(zip_bytes) > DEMO_MAX_ZIP_BYTES:
        raise HTTPException(400, f"压缩包不能超过 {DEMO_MAX_ZIP_BYTES // (1024 * 1024)}MB")

    files: list[tuple[str, bytes]] = []
    try:
        with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                rel = _normalize_zip_path(info.filename)
                if not rel:
                    continue
                ext = os.path.splitext(rel)[1].lower()
                if ext not in ALLOWED_EXTENSIONS:
                    raise HTTPException(400, f"不允许的文件类型: {rel}")
                if info.file_size > DEMO_MAX_FILE_BYTES:
                    raise HTTPException(400, f"单文件过大: {rel}")
                data = zf.read(info)
                if len(data) > DEMO_MAX_FILE_BYTES:
                    raise HTTPException(400, f"单文件过大: {rel}")
                files.append((rel, data))
    except zipfile.BadZipFile:
        raise HTTPException(400, "无效的 zip 文件")

    if not files:
        raise HTTPException(400, "压缩包为空")
    if len(files) > DEMO_MAX_FILES:
        raise HTTPException(400, f"文件数量不能超过 {DEMO_MAX_FILES}")

    return files


def guess_content_type(path: str) -> str | None:
    ext = os.path.splitext(path)[1].lower()
    return CONTENT_TYPES.get(ext)
