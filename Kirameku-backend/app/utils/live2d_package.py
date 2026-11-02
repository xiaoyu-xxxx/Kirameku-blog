"""Validate and extract Cubism2/3/4 Live2D zip packages (separate from demo zips)."""

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

# Cubism2 + Cubism3/4 common assets. Compound names like *.motion3.json end in .json.
ALLOWED_EXTENSIONS = {
    ".json",
    ".moc",
    ".moc3",
    ".cdi3",
    ".mtn",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
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


def _join_pkg(pkg_dir: str, ref: str) -> str:
    ref_norm = ref.replace("\\", "/").lstrip("./")
    return f"{pkg_dir}/{ref_norm}" if pkg_dir else ref_norm


def _load_json(rel: str, data: bytes) -> dict:
    try:
        meta = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(400, f"无效的 JSON: {rel}") from e
    if not isinstance(meta, dict):
        raise HTTPException(400, f"无效的 JSON 对象: {rel}")
    return meta


def _ensure_refs(by_path: dict[str, bytes], entry_rel: str, pkg_dir: str, needed: list[str]) -> None:
    for ref in needed:
        if not isinstance(ref, str) or not ref.strip():
            continue
        full = _join_pkg(pkg_dir, ref)
        if full not in by_path:
            raise HTTPException(400, f"{entry_rel} 引用的文件不存在: {ref}")


def _discover_cubism2_entry(
    rel: str,
    data: bytes,
    by_path: dict[str, bytes],
) -> dict:
    pkg_dir = _dirname(rel)
    meta = _load_json(rel, data)
    model_file = meta.get("model")
    textures = meta.get("textures")
    if not isinstance(model_file, str) or not model_file.lower().endswith(".moc"):
        raise HTTPException(400, f"{rel} 缺少 Cubism2 model(.moc) 字段")
    if not isinstance(textures, list) or not textures:
        raise HTTPException(400, f"{rel} 的 textures 必须为非空数组")

    needed: list[str] = [model_file] + [t for t in textures if isinstance(t, str)]
    for motion_group in (meta.get("motions") or {}).values():
        if not isinstance(motion_group, list):
            continue
        for item in motion_group:
            if isinstance(item, dict) and isinstance(item.get("file"), str):
                needed.append(item["file"])
    for key in ("physics", "pose"):
        val = meta.get(key)
        if isinstance(val, str):
            needed.append(val)
    _ensure_refs(by_path, rel, pkg_dir, needed)

    label = pkg_dir.split("/")[-1] if pkg_dir else "default"
    entry_json = os.path.basename(rel)
    return {
        "pkg_dir": pkg_dir,
        "rel_dir": pkg_dir,
        "label": label,
        "index_rel": rel,
        "entry_json": entry_json,
        "cubism_family": "cubism2",
    }


def _discover_cubism4_entry(
    rel: str,
    data: bytes,
    by_path: dict[str, bytes],
) -> dict:
    pkg_dir = _dirname(rel)
    meta = _load_json(rel, data)
    file_refs = meta.get("FileReferences")
    if not isinstance(file_refs, dict):
        raise HTTPException(400, f"{rel} 缺少 FileReferences（Cubism3/4）")

    moc = file_refs.get("Moc")
    if not isinstance(moc, str) or not moc.lower().endswith(".moc3"):
        raise HTTPException(400, f"{rel} 缺少 Cubism3/4 Moc(.moc3) 字段")

    textures = file_refs.get("Textures")
    if not isinstance(textures, list) or not textures:
        raise HTTPException(400, f"{rel} 的 FileReferences.Textures 必须为非空数组")

    needed: list[str] = [moc]
    for tex in textures:
        if isinstance(tex, str):
            needed.append(tex)
        elif isinstance(tex, dict) and isinstance(tex.get("File"), str):
            needed.append(tex["File"])
        else:
            raise HTTPException(400, f"{rel} 的 Textures 项格式无效")

    for key in ("Physics", "Pose", "DisplayInfo"):
        val = file_refs.get(key)
        if isinstance(val, str):
            needed.append(val)

    expressions = file_refs.get("Expressions")
    if isinstance(expressions, list):
        for item in expressions:
            if isinstance(item, dict) and isinstance(item.get("File"), str):
                needed.append(item["File"])

    motions = file_refs.get("Motions")
    if isinstance(motions, dict):
        for group in motions.values():
            if not isinstance(group, list):
                continue
            for item in group:
                if isinstance(item, dict) and isinstance(item.get("File"), str):
                    needed.append(item["File"])

    _ensure_refs(by_path, rel, pkg_dir, needed)

    label = pkg_dir.split("/")[-1] if pkg_dir else "default"
    entry_json = os.path.basename(rel)
    return {
        "pkg_dir": pkg_dir,
        "rel_dir": pkg_dir,
        "label": label,
        "index_rel": rel,
        "entry_json": entry_json,
        "cubism_family": "cubism4",
    }


def discover_live2d_packages(files: list[tuple[str, bytes]]) -> list[dict]:
    """Find Cubism2 (index.json / *.model.json) and Cubism3/4 (*.model3.json) packages."""
    by_path = {rel: data for rel, data in files}
    packages: list[dict] = []
    seen_dirs: set[tuple[str, str]] = set()

    for rel, data in files:
        base = os.path.basename(rel).lower()
        pkg_dir = _dirname(rel)

        if base == "index.json" or base.endswith(".model.json"):
            pkg = _discover_cubism2_entry(rel, data, by_path)
            key = (pkg["pkg_dir"], pkg["entry_json"])
            if key in seen_dirs:
                continue
            seen_dirs.add(key)
            packages.append(pkg)
            continue

        if base.endswith(".model3.json"):
            pkg = _discover_cubism4_entry(rel, data, by_path)
            key = (pkg["pkg_dir"], pkg["entry_json"])
            if key in seen_dirs:
                continue
            seen_dirs.add(key)
            packages.append(pkg)

    if not packages:
        raise HTTPException(
            400,
            "压缩包中未找到合法的 Live2D 入口"
            "（Cubism2: index.json/*.model.json + .moc + textures；"
            "Cubism3/4: *.model3.json + .moc3 + FileReferences.Textures）",
        )

    packages.sort(key=lambda p: (p["pkg_dir"], p["entry_json"]))
    return packages


def discover_cubism2_packages(files: list[tuple[str, bytes]]) -> list[dict]:
    """Backward-compatible thin wrapper; Cubism2-only filter over discover_live2d_packages."""
    packages = [p for p in discover_live2d_packages(files) if p.get("cubism_family") == "cubism2"]
    if not packages:
        raise HTTPException(400, "压缩包中未找到合法的 Cubism2 index.json（需含 .moc 与 textures）")
    return packages
