"""Live2D admin catalog, import, defaults, and upload registration."""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException
from sqlmodel import Session, select, func

from app.config import (
    LIVE2D_ASSET_BASE,
    LIVE2D_DEFAULT_MODEL_INDEX,
    LIVE2D_DEFAULT_CLOTHES_INDEX,
    LIVE2D_LOCAL_ROOT,
    LIVE2D_MODEL_LIST_PATH,
)
from app.models.live2d import Live2DModel, Live2DSkin
from app.models.site_setting import SiteSetting
from app.schemas.live2d import (
    Live2DDefaultsUpdate,
    Live2DModelUpdate,
    Live2DSkinUpdate,
)
from app.utils.live2d_storage import (
    delete_model_preview_dir,
    delete_skin_preview_file,
    delete_version_files,
    model_slug_root,
    preview_cache_path,
    slug_disk_exists,
    versions_from_skin_rel_paths,
    write_package_files,
)

SETTING_MODEL_ID = "live2d_default_model_id"
SETTING_SKIN_ID = "live2d_default_skin_id"

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Process-local cache for admin preview resolution.
# key -> (url, kind) where kind is assembled|bundle|atlas|None
_preview_url_cache: dict[str, tuple[str | None, str | None]] = {}

_BUNDLE_PREVIEW_CANDIDATES = (
    "preview.png",
    "preview.jpg",
    "preview.jpeg",
    "preview.webp",
    "thumbnail.png",
    "thumbnail.jpg",
    "thumbnail.jpeg",
    "thumbnail.webp",
    "thumb.png",
    "thumb.jpg",
    "ico.png",
    "ico_00.png",
    "ico_01.png",
)

_PREVIEW_CACHE_MAX_BYTES = 2 * 1024 * 1024


def _safe_rel_key(rel_path: str) -> str:
    return (rel_path or "").replace("\\", "/").strip("/")


def _asset_url(*parts: str, bust: str | int | None = None) -> str:
    cleaned = "/".join(str(p).replace("\\", "/").strip("/") for p in parts if str(p).strip("/"))
    url = f"{LIVE2D_ASSET_BASE}{cleaned}"
    if bust is not None and bust != "":
        url = f"{url}?v={bust}"
    return url


def _invalidate_preview_cache(*prefixes: str) -> None:
    """Drop in-memory preview entries whose keys start with any prefix.

    resolve_skin_preview keys are ``model:skin:rel:entry:family``. Callers pass
    ``f"{model_id}:{skin_id}:"`` so entry/family/rel changes still clear.
    """
    if not prefixes:
        return
    doomed = [
        key
        for key in list(_preview_url_cache)
        if any(key.startswith(prefix) for prefix in prefixes)
    ]
    for key in doomed:
        _preview_url_cache.pop(key, None)


def _resolve_bundle_preview(rel_key: str) -> str | None:
    """B: package-local finished preview / thumbnail / ico_*."""
    root = LIVE2D_LOCAL_ROOT / "model" / rel_key
    if not root.is_dir():
        return None
    for name in _BUNDLE_PREVIEW_CANDIDATES:
        path = root / name
        if path.is_file():
            return _asset_url("model", rel_key, name, bust=int(path.stat().st_mtime))
    try:
        for path in sorted(root.iterdir()):
            if not path.is_file():
                continue
            lower = path.name.lower()
            if lower.startswith("ico_") and lower.endswith((".png", ".jpg", ".jpeg", ".webp")):
                return _asset_url("model", rel_key, path.name, bust=int(path.stat().st_mtime))
            if lower.startswith(("preview", "thumbnail", "thumb.")) and lower.endswith(
                (".png", ".jpg", ".jpeg", ".webp")
            ):
                return _asset_url("model", rel_key, path.name, bust=int(path.stat().st_mtime))
    except OSError:
        return None
    return None


def _skin_entry_json(skin: Live2DSkin | None = None, *, entry_json: str | None = None) -> str:
    raw = entry_json if entry_json is not None else (getattr(skin, "entry_json", None) if skin else None)
    val = (raw or "index.json").replace("\\", "/").strip().lstrip("/")
    if not val or ".." in val.split("/"):
        return "index.json"
    return val

def _skin_cubism_family(skin: Live2DSkin | None = None, *, cubism_family: str | None = None) -> str:
    raw = cubism_family if cubism_family is not None else (getattr(skin, "cubism_family", None) if skin else None)
    val = (raw or "cubism2").strip().lower()
    return val if val in {"cubism2", "cubism4"} else "cubism2"

def skin_catalog_path(skin: Live2DSkin) -> str:
    """Option A: loadable relative path including entry file (under model/)."""
    rel = _safe_rel_key(skin.rel_path)
    entry = _skin_entry_json(skin)
    return f"{rel}/{entry}" if rel else entry

def detect_entry_on_disk(rel_path: str) -> tuple[str, str]:
    """Probe LIVE2D_LOCAL_ROOT/model/<rel> for Cubism2/4 entry. Defaults to cubism2/index.json."""
    rel_key = _safe_rel_key(rel_path)
    root = LIVE2D_LOCAL_ROOT / "model" / rel_key
    if not root.is_dir():
        return "index.json", "cubism2"
    index = root / "index.json"
    if index.is_file():
        return "index.json", "cubism2"
    model_jsons = sorted(p for p in root.glob("*.model.json") if p.is_file())
    if model_jsons:
        return model_jsons[0].name, "cubism2"
    model3 = sorted(p for p in root.glob("*.model3.json") if p.is_file())
    if model3:
        return model3[0].name, "cubism4"
    return "index.json", "cubism2"

def _resolve_atlas_preview(
    rel_key: str,
    *,
    entry_json: str = "index.json",
    cubism_family: str = "cubism2",
) -> str | None:
    """Atlas fallback: Cubism2 textures[0]; Cubism4 FileReferences.Textures[0].File."""
    try:
        entry = _skin_entry_json(entry_json=entry_json)
        family = _skin_cubism_family(cubism_family=cubism_family)
        entry_path = LIVE2D_LOCAL_ROOT / "model" / rel_key / entry
        if not entry_path.is_file():
            return None
        data = json.loads(entry_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return None
        tex: str | None = None
        if family == "cubism4" or entry_path.name.lower().endswith(".model3.json"):
            refs = data.get("FileReferences")
            textures = refs.get("Textures") if isinstance(refs, dict) else None
            if isinstance(textures, list) and textures:
                first = textures[0]
                if isinstance(first, str):
                    tex = first
                elif isinstance(first, dict) and isinstance(first.get("File"), str):
                    tex = first["File"]
        else:
            textures = data.get("textures")
            if isinstance(textures, list) and textures:
                tex = str(textures[0])
        if not tex:
            return None
        tex_n = str(tex).replace("\\", "/").lstrip("/")
        if not tex_n or ".." in tex_n.split("/"):
            return None
        return _asset_url("model", rel_key, tex_n)
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError):
        return None
    return None

def resolve_skin_preview(
    *,
    model_id: int | None,
    skin_id: int | None,
    rel_path: str,
    entry_json: str = "index.json",
    cubism_family: str = "cubism2",
) -> tuple[str | None, str | None]:
    """Admin preview_url priority: assembled cache -> bundle -> atlas -> None.

    Returns (url, kind) where kind is assembled|bundle|atlas|None.
    Public catalog is unchanged (does not call this).
    """
    rel_key = _safe_rel_key(rel_path)
    entry = _skin_entry_json(entry_json=entry_json)
    family = _skin_cubism_family(cubism_family=cubism_family)
    cache_key = f"{model_id}:{skin_id}:{rel_key}:{entry}:{family}"
    if cache_key in _preview_url_cache:
        return _preview_url_cache[cache_key]

    url: str | None = None
    kind: str | None = None

    if model_id is not None and skin_id is not None:
        cache_file = preview_cache_path(model_id, skin_id)
        if cache_file.is_file() and cache_file.stat().st_size > 0:
            url = _asset_url(
                "previews",
                str(model_id),
                f"{skin_id}.png",
                bust=int(cache_file.stat().st_mtime),
            )
            kind = "assembled"

    if url is None and rel_key:
        bundle = _resolve_bundle_preview(rel_key)
        if bundle:
            url, kind = bundle, "bundle"

    if url is None and rel_key:
        atlas = _resolve_atlas_preview(rel_key, entry_json=entry, cubism_family=family)
        if atlas:
            url, kind = atlas, "atlas"

    _preview_url_cache[cache_key] = (url, kind)
    return url, kind

def resolve_skin_preview_url(rel_path: str) -> str | None:
    """Backward-compatible helper without assembled cache (no ids)."""
    url, _ = resolve_skin_preview(model_id=None, skin_id=None, rel_path=rel_path)
    return url


def save_skin_preview_cache(
    session: Session,
    skin_id: int,
    *,
    data: bytes,
    content_type: str,
) -> dict:
    """Write assembled preview under previews/<model_id>/<skin_id>.png (not model/)."""
    row = session.get(Live2DSkin, skin_id)
    if not row:
        raise HTTPException(404, "皮肤不存在")
    ctype = (content_type or "").split(";")[0].strip().lower()
    if ctype not in {"image/png", "image/webp"}:
        raise HTTPException(400, "仅支持 image/png 或 image/webp")
    if not data:
        raise HTTPException(400, "预览文件为空")
    if len(data) > _PREVIEW_CACHE_MAX_BYTES:
        raise HTTPException(400, "预览文件不能超过 2MB")

    dest = preview_cache_path(row.model_id, skin_id)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

    row.updated_at = _now()
    session.add(row)
    session.commit()
    session.refresh(row)
    _invalidate_preview_cache(f"{row.model_id}:{row.id}:")
    return serialize_skin(row)


def delete_skin_preview_cache(session: Session, skin_id: int) -> dict:
    """Drop assembled preview cache file; preview falls back to bundle/atlas."""
    row = session.get(Live2DSkin, skin_id)
    if not row:
        raise HTTPException(404, "皮肤不存在")
    delete_skin_preview_file(row.model_id, skin_id)
    row.updated_at = _now()
    session.add(row)
    session.commit()
    session.refresh(row)
    _invalidate_preview_cache(f"{row.model_id}:{row.id}:")
    return serialize_skin(row)


def _preferred_skin(session: Session, model: Live2DModel) -> Live2DSkin | None:
    skins = list(
        session.exec(
            select(Live2DSkin)
            .where(Live2DSkin.model_id == model.id)
            .order_by(Live2DSkin.sort, Live2DSkin.id)
        ).all()
    )
    if not skins:
        return None
    if model.default_skin_id is not None:
        for s in skins:
            if s.id == model.default_skin_id:
                return s
    for s in skins:
        if s.enabled:
            return s
    return skins[0]


def _now() -> datetime:
    return datetime.now()


def _skin_count(session: Session, model_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(Live2DSkin).where(Live2DSkin.model_id == model_id)
    ).one()


def serialize_model(session: Session, row: Live2DModel) -> dict:
    preferred = _preferred_skin(session, row)
    preview_url = None
    preview_kind = None
    if preferred:
        preview_url, preview_kind = resolve_skin_preview(
            model_id=row.id,
            skin_id=preferred.id,
            rel_path=preferred.rel_path,
            entry_json=_skin_entry_json(preferred),
            cubism_family=_skin_cubism_family(preferred),
        )
    return {
        "id": row.id,
        "slug": row.slug,
        "name": row.name,
        "sort": row.sort,
        "enabled": row.enabled,
        "default_skin_id": row.default_skin_id,
        "package_size": row.package_size,
        "file_count": row.file_count,
        "source": row.source,
        "skin_count": _skin_count(session, row.id or 0),
        "preview_url": preview_url,
        "preview_kind": preview_kind,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_skin(row: Live2DSkin) -> dict:
    entry = _skin_entry_json(row)
    family = _skin_cubism_family(row)
    preview_url, preview_kind = resolve_skin_preview(
        model_id=row.model_id,
        skin_id=row.id,
        rel_path=row.rel_path,
        entry_json=entry,
        cubism_family=family,
    )
    return {
        "id": row.id,
        "model_id": row.model_id,
        "rel_path": row.rel_path,
        "entry_json": entry,
        "cubism_family": family,
        "label": row.label,
        "sort": row.sort,
        "enabled": row.enabled,
        "preview_url": preview_url,
        "preview_kind": preview_kind,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def list_models(session: Session) -> list[dict]:
    rows = list(
        session.exec(select(Live2DModel).order_by(Live2DModel.sort, Live2DModel.id)).all()
    )
    return [serialize_model(session, r) for r in rows]


def get_model(session: Session, model_id: int) -> Live2DModel:
    row = session.get(Live2DModel, model_id)
    if not row:
        raise HTTPException(404, "模型不存在")
    return row


def get_model_detail(session: Session, model_id: int) -> dict:
    row = get_model(session, model_id)
    skins = list(
        session.exec(
            select(Live2DSkin)
            .where(Live2DSkin.model_id == model_id)
            .order_by(Live2DSkin.sort, Live2DSkin.id)
        ).all()
    )
    data = serialize_model(session, row)
    data["skins"] = [serialize_skin(s) for s in skins]
    return data


def update_model(session: Session, model_id: int, data: Live2DModelUpdate) -> dict:
    row = get_model(session, model_id)
    payload = data.model_dump(exclude_unset=True)
    if "default_skin_id" in payload and payload["default_skin_id"] is not None:
        skin = session.get(Live2DSkin, payload["default_skin_id"])
        if not skin or skin.model_id != model_id:
            raise HTTPException(400, "默认皮肤不属于该模型")
    for k, v in payload.items():
        setattr(row, k, v)
    row.updated_at = _now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return serialize_model(session, row)


def update_skin(session: Session, skin_id: int, data: Live2DSkinUpdate) -> dict:
    row = session.get(Live2DSkin, skin_id)
    if not row:
        raise HTTPException(404, "皮肤不存在")
    payload = data.model_dump(exclude_unset=True)
    if "label" in payload:
        label = payload["label"]
        if not isinstance(label, str) or not label.strip():
            raise HTTPException(400, "label 不能为空")
        payload["label"] = label.strip()
    for k, v in payload.items():
        setattr(row, k, v)
    row.updated_at = _now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return serialize_skin(row)


def delete_model(session: Session, model_id: int) -> None:
    row = get_model(session, model_id)
    if row.source != "upload":
        raise HTTPException(400, "内置模型不可物理删除，请改为禁用")
    skins = list(session.exec(select(Live2DSkin).where(Live2DSkin.model_id == model_id)).all())
    versions = versions_from_skin_rel_paths(row.slug, [s.rel_path for s in skins])
    for s in skins:
        session.delete(s)
    # clear site defaults if pointing here
    _clear_defaults_if_model(session, model_id)
    session.delete(row)
    session.commit()
    # Only remove this upload's version dirs — never rmtree model/<slug>/ (may share with builtins).
    for ver in versions:
        delete_version_files(row.slug, ver)
    # Drop assembled preview cache for this model.
    delete_model_preview_dir(model_id)


def _get_or_create_setting(session: Session, key: str, *, label: str, default: str = "") -> SiteSetting:
    row = session.exec(select(SiteSetting).where(SiteSetting.key == key)).first()
    if row:
        return row
    row = SiteSetting(
        key=key,
        value=json.dumps(default) if default != "" else '""',
        label=label,
        group="live2d",
        input_type="number",
        description="看板娘站点默认（管理端二期）",
        sort=900,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def _parse_setting_int(raw: str) -> int | None:
    try:
        val = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        val = raw
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _clear_defaults_if_model(session: Session, model_id: int) -> None:
    m = session.exec(select(SiteSetting).where(SiteSetting.key == SETTING_MODEL_ID)).first()
    if m and _parse_setting_int(m.value) == model_id:
        m.value = json.dumps(None)
        m.updated_at = _now()
        session.add(m)
    s = session.exec(select(SiteSetting).where(SiteSetting.key == SETTING_SKIN_ID)).first()
    if s:
        skin_id = _parse_setting_int(s.value)
        if skin_id:
            skin = session.get(Live2DSkin, skin_id)
            if not skin or skin.model_id == model_id:
                s.value = json.dumps(None)
                s.updated_at = _now()
                session.add(s)


def _enabled_catalog_rows(session: Session) -> list[tuple[Live2DModel, list[Live2DSkin]]]:
    models = list(
        session.exec(
            select(Live2DModel)
            .where(Live2DModel.enabled == True)  # noqa: E712
            .order_by(Live2DModel.sort, Live2DModel.id)
        ).all()
    )
    out: list[tuple[Live2DModel, list[Live2DSkin]]] = []
    for m in models:
        skins = list(
            session.exec(
                select(Live2DSkin)
                .where(Live2DSkin.model_id == m.id, Live2DSkin.enabled == True)  # noqa: E712
                .order_by(Live2DSkin.sort, Live2DSkin.id)
            ).all()
        )
        if not skins:
            continue
        out.append((m, skins))
    return out


def resolve_default_indexes(session: Session) -> tuple[int, int, int | None, int | None]:
    """Return (model_index, clothes_index, model_id, skin_id) against enabled catalog."""
    rows = _enabled_catalog_rows(session)
    if not rows:
        return LIVE2D_DEFAULT_MODEL_INDEX, LIVE2D_DEFAULT_CLOTHES_INDEX, None, None

    m_set = session.exec(select(SiteSetting).where(SiteSetting.key == SETTING_MODEL_ID)).first()
    s_set = session.exec(select(SiteSetting).where(SiteSetting.key == SETTING_SKIN_ID)).first()
    want_model = _parse_setting_int(m_set.value) if m_set else None
    want_skin = _parse_setting_int(s_set.value) if s_set else None

    model_index = 0
    clothes_index = 0
    found = False
    if want_model is not None:
        for i, (m, skins) in enumerate(rows):
            if m.id == want_model:
                model_index = i
                if want_skin is not None:
                    for j, sk in enumerate(skins):
                        if sk.id == want_skin:
                            clothes_index = j
                            break
                elif m.default_skin_id:
                    for j, sk in enumerate(skins):
                        if sk.id == m.default_skin_id:
                            clothes_index = j
                            break
                found = True
                break
    if not found:
        # fall back to code defaults clamped into catalog length
        model_index = LIVE2D_DEFAULT_MODEL_INDEX % len(rows)
        m, skins = rows[model_index]
        if m.default_skin_id:
            for j, sk in enumerate(skins):
                if sk.id == m.default_skin_id:
                    clothes_index = j
                    break
        else:
            clothes_index = min(LIVE2D_DEFAULT_CLOTHES_INDEX, max(0, len(skins) - 1))

    m, skins = rows[model_index]
    skin = skins[clothes_index] if skins else None
    return model_index, clothes_index, m.id, skin.id if skin else None


def get_defaults(session: Session) -> dict:
    model_index, clothes_index, model_id, skin_id = resolve_default_indexes(session)
    return {
        "default_model_id": model_id,
        "default_skin_id": skin_id,
        "default_model_index": model_index,
        "default_clothes_index": clothes_index,
    }


def set_defaults(session: Session, data: Live2DDefaultsUpdate) -> dict:
    model = get_model(session, data.default_model_id)
    if not model.enabled:
        raise HTTPException(400, "默认模型未启用")
    skin_id = data.default_skin_id
    if skin_id is None:
        skin_id = model.default_skin_id
    if skin_id is None:
        first = session.exec(
            select(Live2DSkin)
            .where(Live2DSkin.model_id == model.id, Live2DSkin.enabled == True)  # noqa: E712
            .order_by(Live2DSkin.sort, Live2DSkin.id)
        ).first()
        if not first:
            raise HTTPException(400, "该模型没有可用皮肤")
        skin_id = first.id
    else:
        skin = session.get(Live2DSkin, skin_id)
        if not skin or skin.model_id != model.id:
            raise HTTPException(400, "默认皮肤不属于该模型")
        if not skin.enabled:
            raise HTTPException(400, "默认皮肤未启用")

    m_set = _get_or_create_setting(session, SETTING_MODEL_ID, label="看板娘默认模型 ID")
    s_set = _get_or_create_setting(session, SETTING_SKIN_ID, label="看板娘默认皮肤 ID")
    m_set.value = json.dumps(model.id)
    m_set.updated_at = _now()
    s_set.value = json.dumps(skin_id)
    s_set.updated_at = _now()
    session.add(m_set)
    session.add(s_set)
    # also mirror on model.default_skin_id for convenience
    model.default_skin_id = skin_id
    model.updated_at = _now()
    session.add(model)
    session.commit()
    return get_defaults(session)


def build_catalog(session: Session) -> dict:
    rows = _enabled_catalog_rows(session)
    models: list[list[str]] = []
    messages: list[str] = []
    for m, skins in rows:
        models.append([skin_catalog_path(s) for s in skins])
        messages.append(m.name)
    model_index, clothes_index, _, _ = resolve_default_indexes(session)
    if models:
        model_index = min(model_index, len(models) - 1)
        clothes_index = min(clothes_index, max(0, len(models[model_index]) - 1))
    else:
        model_index = 0
        clothes_index = 0
    return {
        "models": models,
        "messages": messages,
        "default_model_index": model_index,
        "default_clothes_index": clothes_index,
        "asset_base": LIVE2D_ASSET_BASE if LIVE2D_ASSET_BASE.endswith("/") else LIVE2D_ASSET_BASE + "/",
    }


def import_from_model_list(
    session: Session,
    *,
    path: Path | None = None,
    force: bool = False,
) -> dict:
    existing = session.exec(select(func.count()).select_from(Live2DModel)).one()
    if existing and not force:
        return {
            "models": existing,
            "skins": session.exec(select(func.count()).select_from(Live2DSkin)).one(),
            "skipped": True,
            "message": "已有模型数据，跳过导入（传 force=true 可强制重建内置项）",
        }

    list_path = path or LIVE2D_MODEL_LIST_PATH
    if not list_path.exists():
        raise HTTPException(400, f"找不到 model_list.json: {list_path}")

    data = json.loads(list_path.read_text(encoding="utf-8"))
    groups = data.get("models") or []
    messages = data.get("messages") or []
    if not isinstance(groups, list):
        raise HTTPException(400, "model_list.json 格式错误：models 应为数组")

    if force:
        # only wipe builtin; keep uploads
        builtins = list(session.exec(select(Live2DModel).where(Live2DModel.source == "builtin")).all())
        for m in builtins:
            for s in session.exec(select(Live2DSkin).where(Live2DSkin.model_id == m.id)).all():
                session.delete(s)
            session.delete(m)
        session.commit()

    created_models = 0
    created_skins = 0
    for i, paths in enumerate(groups):
        if not isinstance(paths, list) or not paths:
            continue
        name = messages[i] if i < len(messages) and isinstance(messages[i], str) else f"model-{i}"
        # stable slug from first path segment + index
        first = str(paths[0]).replace("\\", "/").strip("/")
        base = first.split("/")[0] if first else f"model-{i}"
        slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-") or f"model-{i}"
        slug = f"{slug}-{i}"
        # ensure unique
        while session.exec(select(Live2DModel).where(Live2DModel.slug == slug)).first():
            slug = f"{slug}-x"

        model = Live2DModel(
            slug=slug,
            name=name,
            sort=i,
            enabled=True,
            source="builtin",
            package_size=0,
            file_count=len(paths),
        )
        session.add(model)
        session.commit()
        session.refresh(model)
        created_models += 1

        first_skin_id = None
        for j, rel in enumerate(paths):
            rel_path = str(rel).replace("\\", "/").strip("/")
            # model_list may already include entry (Option A) or legacy dir-only paths.
            if rel_path.lower().endswith(".json"):
                parts = rel_path.rsplit("/", 1)
                if len(parts) == 2:
                    rel_path, entry_name = parts[0], parts[1]
                else:
                    entry_name = parts[0]
                    rel_path = ""
                family = "cubism4" if entry_name.lower().endswith(".model3.json") else "cubism2"
            else:
                entry_name, family = detect_entry_on_disk(rel_path)
            label = rel_path.split("/")[-1] if rel_path else f"skin-{j}"
            skin = Live2DSkin(
                model_id=model.id,
                rel_path=rel_path,
                entry_json=entry_name,
                cubism_family=family,
                label=label,
                sort=j,
                enabled=True,
            )
            session.add(skin)
            session.commit()
            session.refresh(skin)
            created_skins += 1
            if first_skin_id is None:
                first_skin_id = skin.id

        model.default_skin_id = first_skin_id
        model.updated_at = _now()
        session.add(model)
        session.commit()

    # seed site defaults to code fallback index if unset
    rows = _enabled_catalog_rows(session)
    if rows:
        idx = LIVE2D_DEFAULT_MODEL_INDEX % len(rows)
        m, skins = rows[idx]
        cidx = min(LIVE2D_DEFAULT_CLOTHES_INDEX, len(skins) - 1)
        existing_m = session.exec(select(SiteSetting).where(SiteSetting.key == SETTING_MODEL_ID)).first()
        if not existing_m or _parse_setting_int(existing_m.value) is None:
            set_defaults(
                session,
                Live2DDefaultsUpdate(default_model_id=m.id, default_skin_id=skins[cidx].id),
            )

    return {
        "models": created_models,
        "skins": created_skins,
        "skipped": False,
        "message": f"已导入 {created_models} 组模型 / {created_skins} 套皮肤",
    }


def register_upload(
    session: Session,
    *,
    files: list[tuple[str, bytes]],
    packages: list[dict],
    name: str,
    slug: str,
    enabled: bool,
    username: str,
) -> dict:
    slug = slug.strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "slug 仅允许小写字母、数字与连字符")
    if session.exec(select(Live2DModel).where(Live2DModel.slug == slug)).first():
        raise HTTPException(400, "slug 已存在")
    if slug_disk_exists(slug):
        raise HTTPException(
            400,
            "slug 与磁盘已有 model/<slug>/ 冲突（可能为内置包目录），请换一个 slug",
        )

    version = time.strftime("%Y%m%d%H%M%S")
    # Common prefix among package dirs (may be empty)
    pkg_dirs = [p["pkg_dir"] for p in packages]
    common = ""
    if pkg_dirs and all(pkg_dirs):
        split_dirs = [d.split("/") for d in pkg_dirs]
        for parts in zip(*split_dirs):
            if len(set(parts)) == 1:
                common = "/".join([*(common.split("/") if common else []), parts[0]]).strip("/")
            else:
                break

    # If single package, strip its directory so rel_path is clean under slug/ver
    strip = packages[0]["pkg_dir"] if len(packages) == 1 else common

    total, _ = write_package_files(slug=slug, version=version, files=files, strip_prefix=strip)

    model = Live2DModel(
        slug=slug,
        name=name.strip() or slug,
        sort=9999,
        enabled=enabled,
        source="upload",
        package_size=total,
        file_count=len(files),
    )
    session.add(model)
    session.commit()
    session.refresh(model)

    first_skin_id = None
    for j, pkg in enumerate(packages):
        pkg_dir = pkg["pkg_dir"]
        if strip and (pkg_dir == strip or pkg_dir.startswith(strip + "/")):
            inner = pkg_dir[len(strip) :].lstrip("/")
        else:
            inner = pkg_dir
        # versioned public rel_path under model/
        if inner:
            rel_path = f"{slug}/{version}/{inner}"
        else:
            rel_path = f"{slug}/{version}"
        label = pkg.get("label") or (inner.split("/")[-1] if inner else "default")
        skin = Live2DSkin(
            model_id=model.id,
            rel_path=rel_path,
            entry_json=pkg.get("entry_json") or "index.json",
            cubism_family=pkg.get("cubism_family") or "cubism2",
            label=label,
            sort=j,
            enabled=True,
        )
        session.add(skin)
        session.commit()
        session.refresh(skin)
        if first_skin_id is None:
            first_skin_id = skin.id

    model.default_skin_id = first_skin_id
    model.updated_at = _now()
    session.add(model)
    session.commit()
    return get_model_detail(session, model.id)


def append_skins_to_model(
    session: Session,
    *,
    model_id: int,
    files: list[tuple[str, bytes]],
    packages: list[dict],
    set_as_default: bool = False,
) -> dict:
    """Append Cubism2/3/4 packages as new skins under an existing model.

    Always writes model/<slug>/<version>/... so builtin/immutable URLs are never overwritten.
    """
    model = get_model(session, model_id)

    version = time.strftime("%Y%m%d%H%M%S")
    ver_root = Path(model_slug_root(model.slug)) / version
    if ver_root.exists():
        version = f"{version}-{int(time.time() * 1000) % 1000}"

    pkg_dirs = [p["pkg_dir"] for p in packages]
    common = ""
    if pkg_dirs and all(pkg_dirs):
        split_dirs = [d.split("/") for d in pkg_dirs]
        for parts in zip(*split_dirs):
            if len(set(parts)) == 1:
                common = "/".join([*(common.split("/") if common else []), parts[0]]).strip("/")
            else:
                break

    strip = packages[0]["pkg_dir"] if len(packages) == 1 else common

    total, _ = write_package_files(
        slug=model.slug, version=version, files=files, strip_prefix=strip
    )

    max_sort = session.exec(
        select(func.max(Live2DSkin.sort)).where(Live2DSkin.model_id == model_id)
    ).one()
    next_sort = (max_sort if max_sort is not None else -1) + 1

    first_new_skin_id: int | None = None
    for j, pkg in enumerate(packages):
        pkg_dir = pkg["pkg_dir"]
        if strip and (pkg_dir == strip or pkg_dir.startswith(strip + "/")):
            inner = pkg_dir[len(strip) :].lstrip("/")
        else:
            inner = pkg_dir
        if inner:
            rel_path = f"{model.slug}/{version}/{inner}"
        else:
            rel_path = f"{model.slug}/{version}"
        label = pkg.get("label") or (inner.split("/")[-1] if inner else "default")
        skin = Live2DSkin(
            model_id=model.id,
            rel_path=rel_path,
            entry_json=pkg.get("entry_json") or "index.json",
            cubism_family=pkg.get("cubism_family") or "cubism2",
            label=label,
            sort=next_sort + j,
            enabled=True,
        )
        session.add(skin)
        session.commit()
        session.refresh(skin)
        if first_new_skin_id is None:
            first_new_skin_id = skin.id

    if set_as_default and first_new_skin_id is not None:
        model.default_skin_id = first_new_skin_id

    if model.source == "upload":
        model.package_size = (model.package_size or 0) + total
        model.file_count = (model.file_count or 0) + len(files)

    model.updated_at = _now()
    session.add(model)
    session.commit()
    return get_model_detail(session, model.id)

