from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.deps import get_current_user, get_session
from app.services import github_user_service

router = APIRouter(prefix="/api/github-users", tags=["前台用户"])


class BanBody(BaseModel):
    reason: str = Field(default="", max_length=200)


@router.get("/admin")
def admin_list_github_users(
    q: str | None = None,
    is_banned: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return github_user_service.list_github_users_admin(
        session, q=q, is_banned=is_banned, page=page, size=size
    )


@router.get("/admin/{user_id}")
def admin_get_github_user(
    user_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return github_user_service.get_github_user_admin(session, user_id)


@router.put("/admin/{user_id}/ban")
def admin_ban_github_user(
    user_id: int,
    data: BanBody,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return github_user_service.ban_github_user(session, user_id, data.reason)


@router.put("/admin/{user_id}/unban")
def admin_unban_github_user(
    user_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return github_user_service.unban_github_user(session, user_id)
