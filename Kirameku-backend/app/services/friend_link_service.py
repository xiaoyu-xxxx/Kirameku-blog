from datetime import datetime
from sqlmodel import Session, select
from fastapi import HTTPException

from app.models import FriendLink
from app.schemas import FriendLinkCreate, FriendLinkUpdate
from app.schemas.friend_link import FriendLinkApply


def get_friend_links(session: Session, approved_only: bool = True) -> list[FriendLink]:
    q = select(FriendLink)
    if approved_only:
        q = q.where(FriendLink.is_approved == True)  # noqa: E712
    q = q.order_by(FriendLink.sort)
    return list(session.exec(q).all())


def create_friend_link(session: Session, data: FriendLinkCreate) -> FriendLink:
    fl = FriendLink(**data.model_dump())
    session.add(fl)
    session.commit()
    session.refresh(fl)
    return fl


def apply_friend_link(session: Session, data: FriendLinkApply) -> FriendLink:
    """公开申请：强制未审核入库。蜜罐假成功由 API 层处理。"""
    # 同 url 已有待审 → 409
    pending = session.exec(
        select(FriendLink).where(
            FriendLink.url == data.url,
            FriendLink.is_approved == False,  # noqa: E712
        )
    ).first()
    if pending:
        raise HTTPException(status_code=409, detail="已有待审申请")

    fl = FriendLink(
        name=data.name,
        url=data.url,
        avatar=data.avatar or "",
        description=data.description or "",
        sort=0,
        is_approved=False,
    )
    session.add(fl)
    session.commit()
    session.refresh(fl)
    return fl


def update_friend_link(
    session: Session, link_id: int, data: FriendLinkUpdate
) -> FriendLink:
    fl = session.get(FriendLink, link_id)
    if not fl:
        raise HTTPException(status_code=404, detail="友链不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(fl, k, v)
    fl.updated_at = datetime.now()
    session.add(fl)
    session.commit()
    session.refresh(fl)
    return fl


def delete_friend_link(session: Session, link_id: int):
    fl = session.get(FriendLink, link_id)
    if not fl:
        raise HTTPException(status_code=404, detail="友链不存在")
    session.delete(fl)
    session.commit()
