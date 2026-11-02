"""Validate and extract Cubism2 Live2D zip packages (separate from demo zips)."""

from __future__ import annotations

import json
import os
import zipfile
from io import BytesIO

from fastapi import HTTPException

from app.config import (
    LIVE2D_MAX_FILE_BYTES,
    LIVE2D_MAX_FILES,
    LIVE2D_MAX_ZIP_BYTES,
)

ALLOWED_EXTENSIONS = {
    ".json",
    ".moc",
    ".mtn",
    ".png",
    ".jpg",
    ".jpeg",
    ".mp3",
    ".wav",
    ".ogg",
}

FORBIDDEN_EXTENSIONS = {
    ".html",
    ".htm",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".jsx",
    ".tsx",
    ".php",
    ".wasm",
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".ps1",
    ".py",
    ".rb",
    ".pl",
    ".cgi",
    ".asp",
    ".aspx",
    ".jar",
    ".dll",
    ".so",
}


def _normalize_zip_path(name: str) -> str:
    name = name.replace("\\", "/").lstrip("/")
    if not name or name.endswith("/"):
        return ""
    parts: list[str] = []
    for part in name.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise HTTPException(400, f"压缩包包含非法路径: {name}")
        parts.append(part)
    return "/".join(parts)


def extract_live2d_zip(zip_bytes: bytes) -> list[tuple[str, bytes]]:
    if len(zip_bytes) > LIVE2D_MAX_ZIP_BYTES:
        mb = LIVE2D_MAX_ZIP_BYTES // (1024 * 1024)
        raise HTTPException(400, f"压缩包不能超过 {mb}MB")

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
                if ext in FORBIDDEN_EXTENSIONS:
                    raise HTTPException(400, f"不允许的文件类型: {rel}")
                if ext not in ALLOWED_EXTENSIONS:
                    raise HTTPException(400, f"不允许的文件类型: {rel}")
                if info.file_size > LIVE2D_MAX_FILE_BYTES:
                    raise HTTPException(400, f"单文件过大: {rel}")
                data = zf.read(info)
                if len(data) > LIVE2D_MAX_FILE_BYTES:
                    raise HTTPException(400, f"单文件过大: {rel}")
                files.append((rel, data))
    except zipfile.BadZipFile as e:
        raise HTTPException(400, "无效的 zip 文件") from e

    if not files:
        raise HTTPException(400, "压缩包为空")
    if len(files) > LIVE2D_MAX_FILES:
        raise HTTPException(400, f"文件数量不能超过 {LIVE2D_MAX_FILES}")

    return files


def _dirname(path: str) -> str:
    idx = path.rfind("/")
    return path[:idx] if idx >= 0 else ""


def discover_cubism2_packages(files: list[tuple[str, bytes]]) -> list[dict]:
    """Find Cubism2 packages (dirs containing index.json with model+.moc and textures)."""
    by_path = {rel: data for rel, data in files}
    packages: list[dict] = []

    for rel, data in files:
        if not rel.lower().endswith("/index.json") and rel.lower() != "index.json":
            if os.path.basename(rel).lower() != "index.json":
                continue
        # only exact index.json basename
        if os.path.basename(rel).lower() != "index.json":
            continue
        pkg_dir = _dirname(rel)
        try:
            meta = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise HTTPException(400, f"无效的 index.json: {rel}") from e

        model_file = meta.get("model")
        textures = meta.get("textures")
        if not isinstance(model_file, str) or not model_file.lower().endswith(".moc"):
            raise HTTPException(400, f"{rel} 缺少 Cubism2 model(.moc) 字段")
        if not isinstance(textures, list) or not textures:
            raise HTTPException(400, f"{rel} 的 textures 必须为非空数组")

        # referenced files must exist in zip (relative to package dir)
        needed = [model_file] + [t for t in textures if isinstance(t, str)]
        # motions / expressions optional
        for motion_group in (meta.get("motions") or {}).values():
            if not isinstance(motion_group, list):
                continue
            for item in motion_group:
                if isinstance(item, dict) and isinstance(item.get("file"), str):
                    needed.append(item["file"])
        physics = meta.get("physics")
        if isinstance(physics, str):
            needed.append(physics)
        pose = meta.get("pose")
        if isinstance(pose, str):
            needed.append(pose)

        for ref in needed:
            ref_norm = ref.replace("\\", "/").lstrip("./")
            full = f"{pkg_dir}/{ref_norm}" if pkg_dir else ref_norm
            if full not in by_path:
                raise HTTPException(400, f"{rel} 引用的文件不存在: {ref}")

        label = pkg_dir.split("/")[-1] if pkg_dir else "default"
        packages.append(
            {
                "pkg_dir": pkg_dir,
                "label": label,
                "index_rel": rel,
            }
        )

    if not packages:
        raise HTTPException(400, "压缩包中未找到合法的 Cubism2 index.json（需含 .moc 与 textures）")

    # stable order by path
    packages.sort(key=lambda p: p["pkg_dir"])
    return packages
