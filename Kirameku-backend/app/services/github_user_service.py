from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlmodel import Session, select, col

from app.models import Comment, GitHubUser, Message


def _truncate(text: str | None, n: int = 80) -> str:
    if not text:
        return ""
    text = text.strip()
    return text if len(text) <= n else text[:n] + "…"


def _counts_for_user(session: Session, user_id: int) -> tuple[int, int]:
    comment_count = session.exec(
        select(func.count()).select_from(Comment).where(Comment.github_user_id == user_id)
    ).one()
    message_count = session.exec(
        select(func.count()).select_from(Message).where(Message.github_user_id == user_id)
    ).one()
    return int(comment_count or 0), int(message_count or 0)


def _user_to_list_item(session: Session, user: GitHubUser) -> dict:
    comment_count, message_count = _counts_for_user(session, user.id)
    return {
        "id": user.id,
        "github_id": user.github_id,
        "login": user.login,
        "avatar": user.avatar,
        "bio": user.bio,
        "created_at": user.created_at,
        "is_banned": bool(user.is_banned),
        "banned_at": user.banned_at,
        "ban_reason": user.ban_reason or "",
        "comment_count": comment_count,
        "message_count": message_count,
    }


def list_github_users_admin(
    session: Session,
    q: str | None = None,
    is_banned: bool | None = None,
    page: int = 1,
    size: int = 20,
) -> dict:
    filters = []
    if q:
        like = f"%{q.strip()}%"
        filters.append(or_(col(GitHubUser.login).ilike(like), col(GitHubUser.bio).ilike(like)))
    if is_banned is not None:
        filters.append(GitHubUser.is_banned == is_banned)

    count_stmt = select(func.count()).select_from(GitHubUser)
    list_stmt = select(GitHubUser)
    for f in filters:
        count_stmt = count_stmt.where(f)
        list_stmt = list_stmt.where(f)

    total = int(session.exec(count_stmt).one() or 0)
    rows = list(
        session.exec(
            list_stmt.order_by(GitHubUser.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        ).all()
    )
    return {
        "items": [_user_to_list_item(session, u) for u in rows],
        "total": total,
    }


def get_github_user_admin(session: Session, user_id: int) -> dict:
    user = session.get(GitHubUser, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")

    data = _user_to_list_item(session, user)

    comments = list(
        session.exec(
            select(Comment)
            .where(Comment.github_user_id == user_id)
            .order_by(Comment.created_at.desc())
            .limit(5)
        ).all()
    )
    messages = list(
        session.exec(
            select(Message)
            .where(Message.github_user_id == user_id)
            .order_by(Message.created_at.desc())
            .limit(5)
        ).all()
    )

    data["recent_comments"] = [
        {
            "id": c.id,
            "content": _truncate(c.content),
            "status": c.status,
            "created_at": c.created_at,
            "type": "comment",
        }
        for c in comments
    ]
    data["recent_messages"] = [
        {
            "id": m.id,
            "content": _truncate(m.content),
            "status": m.status,
            "created_at": m.created_at,
            "type": "message",
        }
        for m in messages
    ]
    return data


def ban_github_user(session: Session, user_id: int, reason: str = "") -> dict:
    user = session.get(GitHubUser, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    reason = (reason or "").strip()
    if len(reason) > 200:
        raise HTTPException(400, "禁用原因不能超过 200 字")
    user.is_banned = True
    user.banned_at = datetime.now()
    user.ban_reason = reason
    session.add(user)
    session.commit()
    session.refresh(user)
    return _user_to_list_item(session, user)


def unban_github_user(session: Session, user_id: int) -> dict:
    user = session.get(GitHubUser, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    user.is_banned = False
    user.banned_at = None
    user.ban_reason = ""
    session.add(user)
    session.commit()
    session.refresh(user)
    return _user_to_list_item(session, user)


def assert_not_banned(github_user: GitHubUser) -> None:
    """写路径强制：已登录但被禁用 → 403。"""
    if github_user is not None and bool(getattr(github_user, "is_banned", False)):
        raise HTTPException(403, "账号已被禁用，无法发言")
