"""Запуск веб-интерфейса и API. --demo загружает демонстрационный набор при пустой базе."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn  # noqa: E402

from expert.api import AppState, create_app  # noqa: E402
from expert.demo import load_demo  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=8000)
parser.add_argument("--demo", action="store_true", help="загрузить демонстрационные документы, если база пуста")
args = parser.parse_args()

state = AppState()
if args.demo and not state.conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]:
    print(f"Загружено демо-редакций: {load_demo(state.conn)}")
uvicorn.run(create_app(state), host=args.host, port=args.port)
