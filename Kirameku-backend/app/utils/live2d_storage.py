"""Local disk storage for Live2D packages (never DEMO_* / demos/ R2)."""

from __future__ import annotations

import shutil
from pathlib import Path

from app.config import LIVE2D_LOCAL_ROOT


def model_slug_root(slug: str) -> Path:
    return LIVE2D_LOCAL_ROOT / "model" / slug.strip("/")


def model_version_root(slug: str, version: str) -> Path:
    root = model_slug_root(slug) / version.strip("/")
    root.mkdir(parents=True, exist_ok=True)
    return root


def slug_disk_exists(slug: str) -> bool:
    """True if model/<slug>/ already exists on disk (builtin or prior upload)."""
    root = model_slug_root(slug)
    return root.exists() and any(root.iterdir())


def write_package_files(
    *,
    slug: str,
    version: str,
    files: list[tuple[str, bytes]],
    strip_prefix: str = "",
) -> tuple[int, Path]:
    """Write extracted zip files under model/<slug>/<ver>/...

    If strip_prefix is set, remove that leading path from each relative path
    so a single-package zip rooted at foo/ lands as model/slug/ver/...
    """
    dest_root = model_version_root(slug, version)
    total = 0
    prefix = strip_prefix.strip("/").replace("\\", "/")
    for rel, data in files:
        rel_n = rel.replace("\\", "/")
        if prefix:
            if rel_n == prefix or rel_n.startswith(prefix + "/"):
                rel_n = rel_n[len(prefix) :].lstrip("/")
        if not rel_n:
            continue
        dest = dest_root / rel_n
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        total += len(data)
    return total, dest_root


def delete_version_files(slug: str, version: str) -> None:
    """Delete only model/<slug>/<version>/ (never the whole slug tree)."""
    root = model_slug_root(slug) / version.strip("/")
    if root.exists() and root.is_dir():
        shutil.rmtree(root, ignore_errors=True)
    slug_root = model_slug_root(slug)
    if slug_root.exists() and slug_root.is_dir() and not any(slug_root.iterdir()):
        try:
            slug_root.rmdir()
        except OSError:
            pass


def versions_from_skin_rel_paths(slug: str, rel_paths: list[str]) -> list[str]:
    """Parse upload version segments from skin rel_path (slug/<version>/...)."""
    slug_n = slug.strip("/")
    found: list[str] = []
    seen: set[str] = set()
    for rel in rel_paths:
        parts = rel.replace("\\", "/").strip("/").split("/")
        if len(parts) < 2 or parts[0] != slug_n:
            continue
        ver = parts[1]
        if ver and ver not in seen:
            seen.add(ver)
            found.append(ver)
    return found