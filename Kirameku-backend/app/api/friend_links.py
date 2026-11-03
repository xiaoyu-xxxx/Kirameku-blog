from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from app.deps import get_session, get_current_user
from app.schemas import FriendLinkCreate, FriendLinkUpdate, FriendLinkOut
from app.schemas.friend_link import FriendLinkApply
from app.services import friend_link_service
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/api/friend-links", tags=["友链"])

# 公开申请：10 分钟内同一 IP 最多 3 次
_APPLY_LIMIT = 3
_APPLY_WINDOW = 600


def _client_ip(request: Request) -> str:
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not ip:
        ip = request.headers.get("x-real-ip", "")
    if not ip:
        ip = request.client.host if request.client else ""
    return ip or "unknown"


@router.get("", response_model=list[FriendLinkOut])
def list_friend_links(session: Session = Depends(get_session)):
    return friend_link_service.get_friend_links(session, approved_only=True)


@router.get("/admin", response_model=list[FriendLinkOut])
def admin_list_friend_links(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return friend_link_service.get_friend_links(session, approved_only=False)


@router.post("/apply", response_model=FriendLinkOut)
def apply_friend_link(
    data: FriendLinkApply,
    request: Request,
    session: Session = Depends(get_session),
):
    """公开友链申请：强制未审核；蜜罐非空假成功不落库。"""
    check_rate_limit(
        f"friend-apply:{_client_ip(request)}",
        limit=_APPLY_LIMIT,
        window=_APPLY_WINDOW,
        message="提交过于频繁，请稍后再试",
    )

    # 蜜罐：静默假成功
    if (data.website or "").strip():
        now = datetime.now()
        return FriendLinkOut(
            id=0,
            name=data.name,
            url=data.url,
            avatar=data.avatar or "",
            description=data.description or "",
            sort=0,
            is_approved=False,
            created_at=now,
            updated_at=None,
        )

    fl = friend_link_service.apply_friend_link(session, data)
    return fl


@router.post("", response_model=FriendLinkOut)
def create_friend_link(
    data: FriendLinkCreate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return friend_link_service.create_friend_link(session, data)


@router.put("/{link_id}", response_model=FriendLinkOut)
def update_friend_link(
    link_id: int,
    data: FriendLinkUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return friend_link_service.update_friend_link(session, link_id, data)


@router.delete("/{link_id}")
def delete_friend_link(
    link_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    friend_link_service.delete_friend_link(session, link_id)
    return {"ok": True}
