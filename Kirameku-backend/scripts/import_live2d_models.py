#!/usr/bin/env python3
"""Import builtin Live2D models from public/live2d/model_list.json into DB.

Usage (from Kirameku-backend):
  python scripts/import_live2d_models.py
  python scripts/import_live2d_models.py --force
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlmodel import Session  # noqa: E402

from app.database import engine, init_db  # noqa: E402
from app.services import live2d_service  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Live2D model_list.json")
    parser.add_argument("--force", action="store_true", help="Rebuild builtin rows")
    parser.add_argument("--path", type=Path, default=None, help="Override model_list.json path")
    args = parser.parse_args()

    init_db()
    with Session(engine) as session:
        result = live2d_service.import_from_model_list(
            session, path=args.path, force=args.force
        )
    print(result)


if __name__ == "__main__":
    main()
