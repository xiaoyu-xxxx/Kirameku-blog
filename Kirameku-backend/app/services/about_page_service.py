from datetime import datetime
from sqlmodel import Session, select

from app.models import AboutPage
from app.schemas import AboutPageUpdate


def get_about(session: Session) -> dict:
    row = session.exec(select(AboutPage).order_by(AboutPage.id)).first()
    if not row:
        return {"content": "", "cover": "", "updated_at": ""}
    return {
        "id": row.id,
        "content": row.content or "",
        "cover": row.cover or "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def upsert_about(session: Session, data: AboutPageUpdate) -> dict:
    row = session.exec(select(AboutPage).order_by(AboutPage.id)).first()
    if not row:
        row = AboutPage(content=data.content, cover=data.cover)
    else:
        row.content = data.content
        row.cover = data.cover
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return {
        "id": row.id,
        "content": row.content or "",
        "cover": row.cover or "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
