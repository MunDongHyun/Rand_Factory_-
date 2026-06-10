from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SERVER_ROOT = ROOT / "server"
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.services.thumbnail_storage import THUMBNAIL_DIR, upload_thumbnail  # noqa: E402


def main() -> int:
    if not THUMBNAIL_DIR.exists():
        print(f"thumbnail directory not found: {THUMBNAIL_DIR}")
        return 1

    files = sorted(p for p in THUMBNAIL_DIR.iterdir() if p.is_file())
    if not files:
        print(f"no thumbnail files found: {THUMBNAIL_DIR}")
        return 1

    uploaded = 0
    for path in files:
        upload_thumbnail(path.name, path.read_bytes())
        uploaded += 1
        print(f"uploaded {uploaded}/{len(files)}: {path.name}")

    print(f"done: uploaded {uploaded} thumbnail(s) to R2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
