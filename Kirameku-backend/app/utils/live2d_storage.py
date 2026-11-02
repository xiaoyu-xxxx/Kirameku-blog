"""Local disk storage for Live2D packages (never DEMO_* / demos/ R2)."""

from __future__ import annotations

import shutil
from pathlib import Path

from app.config import LIVE2D_LOCAL_ROOT


def model_version_root(slug: str, version: str) -> Path:
    root = LIVE2D_LOCAL_ROOT / "model" / slug.strip("/") / version.strip("/")
    root.mkdir(parents=True, exist_ok=True)
    return root


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
            # keep files outside prefix as-is (shared assets at zip root)
        if not rel_n:
            continue
        dest = dest_root / rel_n
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        total += len(data)
    return total, dest_root


def delete_model_files(slug: str) -> None:
    root = LIVE2D_LOCAL_ROOT / "model" / slug.strip("/")
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)


def delete_version_files(slug: str, version: str) -> None:
    root = LIVE2D_LOCAL_ROOT / "model" / slug.strip("/") / version.strip("/")
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
