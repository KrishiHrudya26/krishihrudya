import os, uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = "/var/www/krishihrudya/uploads"
MAX_PHOTO_SIZE = 30 * 1024 * 1024   # 30MB
MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200MB

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("")
async def upload_file(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    ext = ""
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    is_video = content_type.startswith("video/") or ext in ("mp4", "mov", "m4v", "webm", "3gp")
    is_image = content_type.startswith("image/") or ext in ("jpg", "jpeg", "png", "webp", "heic", "heif")

    if not is_video and not is_image:
        raise HTTPException(400, f"File type not allowed: {content_type} / .{ext}")

    content = await file.read()

    if is_video and len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(400, "Video too large — max 200MB")
    if is_image and len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(400, "Photo too large — max 30MB")

    if not ext:
        ext = "mp4" if is_video else "jpg"

    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    return JSONResponse({
        "url": f"/uploads/{filename}",
        "type": "video" if is_video else "photo"
    })
