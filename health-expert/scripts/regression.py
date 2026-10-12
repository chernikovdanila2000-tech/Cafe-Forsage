"""Регрессионный прогон контрольного набора (после смены модели, настроек или обновления базы)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from expert import db, quality  # noqa: E402
from expert.config import load_settings  # noqa: E402
from expert.llm import get_llm  # noqa: E402
from expert.pipeline import Pipeline  # noqa: E402

settings = load_settings()
conn = db.connect(settings.db_path)
result = quality.run_regression(conn, Pipeline(conn, settings, get_llm(settings)),
                                reason=sys.argv[1] if len(sys.argv) > 1 else "manual")
print(json.dumps({k: v for k, v in result.items() if k != "details"}, ensure_ascii=False))
for d in result["details"]:
    print(("OK  " if d["ok"] else "FAIL"), d)
sys.exit(1 if result["degraded"] else 0)
