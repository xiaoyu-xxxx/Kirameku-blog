import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException

from app.config import DEMO_UPLOAD_RATE_LIMIT, DEMO_UPLOAD_RATE_WINDOW

_lock = Lock()
_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, *, limit: int | None = None, window: int | None = None) -> None:
    limit = limit if limit is not None else DEMO_UPLOAD_RATE_LIMIT
    window = window if window is not None else DEMO_UPLOAD_RATE_WINDOW
    now = time.time()
    with _lock:
        hits = _buckets[key]
        hits[:] = [t for t in hits if now - t < window]
        if len(hits) >= limit:
            raise HTTPException(429, "上传过于频繁，请稍后再试")
        hits.append(now)
