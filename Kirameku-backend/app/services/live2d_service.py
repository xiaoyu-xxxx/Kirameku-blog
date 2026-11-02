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
    LIVE2D_MODEL_LIST_PATH,
)
from app.models.live2d import Live2DModel, Live2DSkin
from app.models.site_setting import SiteSetting
from app.schemas.live2d import (
    Live2DDefaultsUpdate,
    Live2DModelUpdate,
    Live2DSkinUpdate,
)
from app.utils.live2d_storage import delete_model_files, write_package_files

SETTING_MODEL_ID = "live2d_default_model_id"
SETTING_SKIN_ID = "live2d_default_skin_id"

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _now() -> datetime:
    return datetime.now()


def _skin_count(session: Session, model_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(Live2DSkin).where(Live2DSkin.model_id == model_id)
    ).one()


def serialize_model(session: Session, row: Live2DModel) -> dict:
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
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_skin(row: Live2DSkin) -> dict:
    return {
        "id": row.id,
        "model_id": row.model_id,
        "rel_path": row.rel_path,
        "label": row.label,
        "sort": row.sort,
        "enabled": row.enabled,
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
    for k, v in data.model_dump(exclude_unset=True).items():
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
    for s in skins:
        session.delete(s)
    # clear site defaults if pointing here
    _clear_defaults_if_model(session, model_id)
    session.delete(row)
    session.commit()
    delete_model_files(row.slug)


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
        models.append([s.rel_path for s in skins])
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
            label = rel_path.split("/")[-1] if rel_path else f"skin-{j}"
            skin = Live2DSkin(
                model_id=model.id,
                rel_path=rel_path,
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
