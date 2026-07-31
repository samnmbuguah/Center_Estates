from pathlib import Path

from django.conf import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".mp4", ".pdf"}


def store_evidence_file(upload, digest):
    extension = Path(upload.name or "").suffix.lower() or ".jpg"
    if extension not in ALLOWED_EXTENSIONS:
        extension = ".bin"
    relative_directory = Path("evidence") / digest[:2]
    absolute_directory = Path(settings.MEDIA_ROOT) / relative_directory
    absolute_directory.mkdir(parents=True, exist_ok=True)
    path = absolute_directory / f"{digest}{extension}"
    if not path.exists():
        with path.open("wb") as destination:
            for chunk in upload.chunks():
                destination.write(chunk)
    return f"{settings.MEDIA_URL}{relative_directory.as_posix()}/{path.name}"
