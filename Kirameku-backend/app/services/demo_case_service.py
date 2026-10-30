from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.demo_case import DemoCase
from app.schemas.demo_case import DemoCaseCreate, DemoCaseUpdate
from app.utils.demo_storage import (
    build_iframe_snippet,
    build_public_url,
    delete_demo_files,
    upload_demo_files,
)


def list_demo_cases(session: Session) -> list[DemoCase]:
    q = select(DemoCase).order_by(DemoCase.updated_at.desc())
    return list(session.exec(q).all())


def get_demo_case(session: Session, case_id: int) -> DemoCase:
    row = session.get(DemoCase, case_id)
    if not row:
        raise HTTPException(404, "案例不存在")
    return row


def get_demo_case_by_slug(session: Session, slug: str) -> DemoCase | None:
    return session.exec(select(DemoCase).where(DemoCase.slug == slug)).first()


def create_demo_case(session: Session, data: DemoCaseCreate, *, username: str) -> DemoCase:
    if get_demo_case_by_slug(session, data.slug):
        raise HTTPException(400, "slug 已存在")
    row = DemoCase(**data.model_dump(), created_by=username, updated_by=username)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def update_demo_case(
    session: Session,
    case_id: int,
    data: DemoCaseUpdate,
    *,
    username: str,
) -> DemoCase:
    row = get_demo_case(session, case_id)
    payload = data.model_dump(exclude_unset=True)
    new_slug = payload.get("slug")
    if new_slug and new_slug != row.slug and row.file_count > 0:
        raise HTTPException(400, "已上传文件的案例不允许修改 slug，请新建案例")
    if new_slug and new_slug != row.slug and get_demo_case_by_slug(session, new_slug):
        raise HTTPException(400, "slug 已存在")
    for k, v in payload.items():
        setattr(row, k, v)
    row.updated_by = username
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def delete_demo_case(session: Session, case_id: int) -> None:
    row = get_demo_case(session, case_id)
    delete_demo_files(row.slug)
    session.delete(row)
    session.commit()


def apply_demo_package(
    session: Session,
    case_id: int,
    files: list[tuple[str, bytes]],
    *,
    username: str,
) -> DemoCase:
    row = get_demo_case(session, case_id)
    delete_demo_files(row.slug)
    total = upload_demo_files(row.slug, files)
    row.package_size = total
    row.file_count = len(files)
    row.updated_by = username
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def demo_case_public_url(row: DemoCase) -> str:
    return build_public_url(row.slug, row.entry_path, row.entry_query, row.base_url)


def demo_case_iframe_snippet(row: DemoCase) -> str:
    url = demo_case_public_url(row)
    return build_iframe_snippet(name=row.name, url=url)
