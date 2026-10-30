import json
from datetime import datetime
from sqlmodel import Session, select
from fastapi import HTTPException

from app.models import SiteSetting
from app.schemas import SiteSettingCreate, SiteSettingUpdate


def _parse_value(value: str):
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value


def _to_dict(row: SiteSetting) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "value": _parse_value(row.value),
        "label": row.label or "",
        "group": row.group or "basic",
        "input_type": row.input_type or "text",
        "description": row.description or "",
        "sort": row.sort,
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def list_settings(session: Session) -> list[dict]:
    rows = list(session.exec(select(SiteSetting).order_by(SiteSetting.sort, SiteSetting.id)).all())
    return [_to_dict(r) for r in rows]


def get_public_settings(session: Session) -> dict:
    rows = list(session.exec(select(SiteSetting)).all())
    return {r.key: _parse_value(r.value) for r in rows}


def create_setting(session: Session, data: SiteSettingCreate) -> SiteSetting:
    existing = session.exec(select(SiteSetting).where(SiteSetting.key == data.key)).first()
    if existing:
        raise HTTPException(400, f"站点设置 {data.key} 已存在")
    row = SiteSetting(**data.model_dump())
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def update_setting(session: Session, setting_id: int, data: SiteSettingUpdate) -> SiteSetting:
    row = session.get(SiteSetting, setting_id)
    if not row:
        raise HTTPException(404, "站点设置不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def delete_setting(session: Session, setting_id: int):
    row = session.get(SiteSetting, setting_id)
    if not row:
        raise HTTPException(404, "站点设置不存在")
    session.delete(row)
    session.commit()
