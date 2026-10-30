import json
from datetime import datetime
from sqlmodel import Session, select
from fastapi import HTTPException

from app.models import ExternalApi
from app.schemas import ExternalApiCreate, ExternalApiUpdate


def _parse_json(value: str):
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value


def _to_dict(row: ExternalApi) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "base_url": row.base_url,
        "path": row.path,
        "method": row.method,
        "enabled": row.enabled,
        "params": _parse_json(row.params),
        "description": row.description or "",
        "sort": row.sort,
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def list_apis(session: Session) -> list[dict]:
    rows = list(session.exec(select(ExternalApi).order_by(ExternalApi.sort, ExternalApi.id)).all())
    return [_to_dict(r) for r in rows]


def get_public_apis(session: Session) -> list[dict]:
    rows = list(
        session.exec(
            select(ExternalApi)
            .where(ExternalApi.enabled == True)  # noqa: E712
            .order_by(ExternalApi.sort, ExternalApi.id)
        ).all()
    )
    return [_to_dict(r) for r in rows]


def create_api(session: Session, data: ExternalApiCreate) -> ExternalApi:
    existing = session.exec(select(ExternalApi).where(ExternalApi.key == data.key)).first()
    if existing:
        raise HTTPException(400, f"外部 API {data.key} 已存在")
    row = ExternalApi(**data.model_dump())
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def update_api(session: Session, api_id: int, data: ExternalApiUpdate) -> ExternalApi:
    row = session.get(ExternalApi, api_id)
    if not row:
        raise HTTPException(404, "外部 API 不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def delete_api(session: Session, api_id: int):
    row = session.get(ExternalApi, api_id)
    if not row:
        raise HTTPException(404, "外部 API 不存在")
    session.delete(row)
    session.commit()
