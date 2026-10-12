"""Плановое обновление базы НПА (запускается планировщиком, например cron ежедневно)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from expert import db, quality  # noqa: E402
from expert.config import load_settings  # noqa: E402
from expert.llm import get_llm  # noqa: E402
from expert.pipeline import Pipeline  # noqa: E402
from expert.updater import run_update  # noqa: E402

settings = load_settings()
conn = db.connect(settings.db_path)
pipeline = Pipeline(conn, settings, get_llm(settings))
stats = run_update(conn, settings, after_update=lambda _: quality.run_regression(conn, pipeline, "auto:update"))
print(json.dumps(stats, ensure_ascii=False, indent=2))
sys.exit(1 if stats["errors"] else 0)
