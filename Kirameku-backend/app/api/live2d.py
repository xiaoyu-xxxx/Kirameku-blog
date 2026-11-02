from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, HTTPException
from sqlmodel import Session

from app.deps import get_current_user, get_session
from app.schemas.live2d import (
    Live2DCatalogOut,
    Live2DDefaultsOut,
    Live2DDefaultsUpdate,
    Live2DImportResult,
    Live2DModelDetailOut,
    Live2DModelOut,
    Live2DModelUpdate,
    Live2DSkinOut,
    Live2DSkinUpdate,
)
from app.services import live2d_service
from app.utils.live2d_package import discover_cubism2_packages, extract_live2d_zip
from app.utils.rate_limit import check_rate_limit
from app.config import LIVE2D_UPLOAD_RATE_LIMIT, LIVE2D_UPLOAD_RATE_WINDOW

admin_router = APIRouter(prefix="/api/live2d", tags=["看板娘 Live2D"])
public_router = APIRouter(prefix="/api/public/live2d", tags=["公开 Live2D"])


@public_router.get("/catalog", response_model=Live2DCatalogOut)
def public_catalog(response: Response, session: Session = Depends(get_session)):
    """公开 catalog：短缓存，禁止 immutable。"""
    response.headers["Cache-Control"] = "public, max-age=60, must-revalidate"
    return live2d_service.build_catalog(session)


@admin_router.get("/models", response_model=list[Live2DModelOut])
def list_models(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.list_models(session)


@admin_router.get("/models/{model_id}", response_model=Live2DModelDetailOut)
def get_model(
    model_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.get_model_detail(session, model_id)


@admin_router.put("/models/{model_id}", response_model=Live2DModelOut)
def update_model(
    model_id: int,
    data: Live2DModelUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.update_model(session, model_id, data)


@admin_router.delete("/models/{model_id}")
def delete_model(
    model_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    live2d_service.delete_model(session, model_id)
    return {"ok": True}


@admin_router.post("/models/{model_id}/skins/upload", response_model=Live2DModelDetailOut)
async def upload_skins(
    model_id: int,
    file: UploadFile = File(...),
    set_as_default: bool = Form(False),
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    """Append Cubism2 zip packages as new skins on an existing model (versioned paths)."""
    username = user.get("sub") or "admin"
    check_rate_limit(
        f"live2d-upload:{username}",
        limit=LIVE2D_UPLOAD_RATE_LIMIT,
        window=LIVE2D_UPLOAD_RATE_WINDOW,
    )
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "仅支持 zip 格式")
    raw = await file.read()
    files = extract_live2d_zip(raw)
    packages = discover_cubism2_packages(files)
    return live2d_service.append_skins_to_model(
        session,
        model_id=model_id,
        files=files,
        packages=packages,
        set_as_default=set_as_default,
    )


@admin_router.post("/skins/{skin_id}/preview-cache", response_model=Live2DSkinOut)
async def upload_skin_preview_cache(
    skin_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    """Internal: store assembled Cubism2 snapshot under previews/<model_id>/<skin_id>.png."""
    raw = await file.read()
    content_type = file.content_type or ""
    # sniff if browser omitted content-type
    if not content_type or content_type == "application/octet-stream":
        if raw.startswith(b"\x89PNG\r\n\x1a\n"):
            content_type = "image/png"
        elif len(raw) >= 12 and raw[0:4] == b"RIFF" and raw[8:12] == b"WEBP":
            content_type = "image/webp"
    return live2d_service.save_skin_preview_cache(
        session,
        skin_id,
        data=raw,
        content_type=content_type,
    )


@admin_router.delete("/skins/{skin_id}/preview-cache", response_model=Live2DSkinOut)
def delete_skin_preview_cache(
    skin_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    """Optional: discard assembled preview cache (not an ops 'clear cover' button)."""
    return live2d_service.delete_skin_preview_cache(session, skin_id)


@admin_router.put("/skins/{skin_id}", response_model=Live2DSkinOut)
def update_skin(
    skin_id: int,
    data: Live2DSkinUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.update_skin(session, skin_id, data)


@admin_router.get("/defaults", response_model=Live2DDefaultsOut)
def get_defaults(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.get_defaults(session)


@admin_router.put("/defaults", response_model=Live2DDefaultsOut)
def put_defaults(
    data: Live2DDefaultsUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.set_defaults(session, data)


@admin_router.post("/import", response_model=Live2DImportResult)
def import_models(
    force: bool = False,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return live2d_service.import_from_model_list(session, force=force)


@admin_router.post("/upload", response_model=Live2DModelDetailOut)
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(...),
    slug: str = Form(...),
    enabled: bool = Form(True),
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    username = user.get("sub") or "admin"
    check_rate_limit(
        f"live2d-upload:{username}",
        limit=LIVE2D_UPLOAD_RATE_LIMIT,
        window=LIVE2D_UPLOAD_RATE_WINDOW,
    )
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "仅支持 zip 格式")
    raw = await file.read()
    files = extract_live2d_zip(raw)
    packages = discover_cubism2_packages(files)
    return live2d_service.register_upload(
        session,
        files=files,
        packages=packages,
        name=name,
        slug=slug,
        enabled=enabled,
        username=username,
    )
