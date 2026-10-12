"""HTTP API экспертной системы (FastAPI). Используется веб-интерфейсом и для будущей интеграции с платформой."""
from __future__ import annotations

import threading
from datetime import date
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, faq, history, quality
from .auth import allowed, load_tokens
from .config import ROOT, load_settings
from .llm import get_llm
from .pipeline import Pipeline
from .vectors import VectorIndex


class AppState:
    def __init__(self, settings=None, conn=None, llm=None):
        self.settings = settings or load_settings()
        self.conn = conn or db.connect(self.settings.db_path)
        self.lock = threading.RLock()
        self.vectors = VectorIndex(self.conn)
        self.pipeline = Pipeline(self.conn, self.settings, llm or get_llm(self.settings), self.vectors)
        self.tokens = load_tokens()


class User(BaseModel):
    name: str
    role: str


class ProcessIn(BaseModel):
    text: str = Field(min_length=3, max_length=20000)
    lang: Literal["ru", "kk"] | None = None
    mode: Literal["fast", "accurate"] | None = None
    as_of: date | None = None


class ApproveIn(BaseModel):
    variant: Literal["simple", "refs", "quotes"]
    text: str = Field(min_length=1)


class ReviewIn(BaseModel):
    verdict: Literal["correct", "incorrect", "partial"]
    corrected_text: str | None = None
    comment: str | None = None
    error_tags: list[str] = []


class FaqPublishIn(BaseModel):
    question_ru: str | None = None
    question_kk: str | None = None
    answer_ru: str | None = None
    answer_kk: str | None = None


class SettingsIn(BaseModel):
    mode: Literal["fast", "accurate"]


def create_app(state: AppState | None = None) -> FastAPI:
    app = FastAPI(title="Экспертная система менеджера здравоохранения", version="0.1")
    app.state.expert = state or AppState()

    def st() -> AppState:
        return app.state.expert

    def current_user(authorization: str | None = Header(default=None)) -> User:
        token = (authorization or "").removeprefix("Bearer ").strip()
        info = st().tokens.get(token)
        if not info:
            raise HTTPException(401, "требуется авторизация")
        return User(**info)

    def need(permission: str):
        def dep(user: User = Depends(current_user)) -> User:
            if not allowed(user.role, permission):
                raise HTTPException(403, "недостаточно прав")
            return user
        return dep

    # ---------- обращения ----------
    @app.post("/api/requests")
    def process(body: ProcessIn, user: User = Depends(need("process"))):
        s = st()
        with s.lock:
            try:
                return s.pipeline.process(body.text, user=user.name, lang=body.lang, mode=body.mode,
                                          as_of=body.as_of.isoformat() if body.as_of else None)
            except ValueError as e:
                raise HTTPException(422, str(e))

    @app.get("/api/requests/{request_id}")
    def get_request(request_id: int, user: User = Depends(need("read"))):
        s = st()
        req = s.conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        if not req:
            raise HTTPException(404)
        answers = s.conn.execute("SELECT * FROM answers WHERE request_id = ? ORDER BY position", (request_id,))
        return {**dict(req), "answers": [quality.answer_row(a) for a in answers]}

    @app.post("/api/answers/{answer_id}/approve")
    def approve(answer_id: int, body: ApproveIn, user: User = Depends(need("approve"))):
        """Фиксация проверки сотрудником. Система ничего не отправляет заявителю — это делает сотрудник."""
        s = st()
        with s.lock:
            row = s.conn.execute("SELECT a.id, r.kind FROM answers a JOIN requests r ON r.id = a.request_id "
                                 "WHERE a.id = ?", (answer_id,)).fetchone()
            if not row:
                raise HTTPException(404)
            s.conn.execute("UPDATE answers SET operator_text = ?, approved_by = ?, approved_at = ? WHERE id = ?",
                           (body.text, user.name, db.now(), answer_id))
            s.conn.execute("UPDATE requests SET status = 'approved' WHERE id = (SELECT request_id FROM answers "
                           "WHERE id = ?) AND NOT EXISTS (SELECT 1 FROM answers WHERE request_id = "
                           "(SELECT request_id FROM answers WHERE id = ?) AND approved_at IS NULL)",
                           (answer_id, answer_id))
            db.audit(s.conn, user.name, user.role, "approve_answer", answer_id,
                     {"variant": body.variant, "kind": row["kind"]})
            s.conn.commit()
        return {"ok": True}

    # ---------- проверка человеком ----------
    @app.get("/api/reviews/queue")
    def review_queue(user: User = Depends(need("review"))):
        return quality.review_queue(st().conn)

    @app.post("/api/answers/{answer_id}/review")
    def review(answer_id: int, body: ReviewIn, user: User = Depends(need("review"))):
        with st().lock:
            try:
                rid = quality.submit_review(st().conn, answer_id, user.name, body.verdict, body.corrected_text,
                                            body.comment, body.error_tags)
            except KeyError:
                raise HTTPException(404)
        return {"review_id": rid}

    @app.get("/api/quality/report")
    def quality_report(user: User = Depends(need("review"))):
        return quality.report(st().conn, st().settings.get("confidence", "caution", 0.7))

    @app.post("/api/quality/regression")
    def regression(user: User = Depends(need("admin"))):
        with st().lock:
            return quality.run_regression(st().conn, st().pipeline, reason=f"manual:{user.name}")

    # ---------- FAQ ----------
    @app.get("/api/faq")
    def faq_list(status: str | None = None, user: User = Depends(need("read"))):
        q, args = "SELECT * FROM faq", []
        if status:
            q, args = q + " WHERE status = ?", [status]
        return [dict(r) for r in st().conn.execute(q + " ORDER BY frequency DESC, id DESC", args)]

    @app.post("/api/faq/build")
    def faq_build(user: User = Depends(need("faq"))):
        with st().lock:
            return {"created": faq.build_candidates(st().conn)}

    @app.post("/api/faq/{faq_id}/publish")
    def faq_publish(faq_id: int, body: FaqPublishIn, user: User = Depends(need("faq"))):
        with st().lock:
            try:
                faq.publish(st().conn, faq_id, user.name, **body.model_dump())
            except KeyError:
                raise HTTPException(404)
            except ValueError as e:
                raise HTTPException(422, str(e))
        return {"ok": True}

    @app.post("/api/faq/{faq_id}/reject")
    def faq_reject(faq_id: int, user: User = Depends(need("faq"))):
        with st().lock:
            faq.reject(st().conn, faq_id, user.name)
        return {"ok": True}

    # ---------- база НПА ----------
    @app.get("/api/documents")
    def documents(user: User = Depends(need("read"))):
        rows = st().conn.execute(
            "SELECT d.code, d.organ, d.block, d.status, "
            "(SELECT title FROM editions e WHERE e.document_id = d.id AND e.lang = 'ru' ORDER BY valid_from DESC LIMIT 1) AS title_ru, "
            "(SELECT title FROM editions e WHERE e.document_id = d.id AND e.lang = 'kk' ORDER BY valid_from DESC LIMIT 1) AS title_kk, "
            "(SELECT COUNT(DISTINCT edition_key) FROM editions e WHERE e.document_id = d.id) AS editions "
            "FROM documents d ORDER BY d.code")
        return [dict(r) for r in rows]

    @app.get("/api/documents/{code}/editions")
    def editions(code: str, user: User = Depends(need("read"))):
        return history.editions(st().conn, code)

    @app.get("/api/documents/{code}/compare")
    def compare(code: str, lang: Literal["ru", "kk"], date_a: date, date_b: date, user: User = Depends(need("read"))):
        try:
            return history.compare(st().conn, code, lang, date_a.isoformat(), date_b.isoformat())
        except KeyError:
            raise HTTPException(404)

    @app.get("/api/search")
    def search(q: str, lang: Literal["ru", "kk"] = "ru", as_of: date | None = None, k: int = 10,
               user: User = Depends(need("read"))):
        hits = st().pipeline.searcher.search(q, lang, (as_of or date.today()).isoformat(), k=min(k, 50))
        return [h.as_dict() for h in hits]

    # ---------- администрирование ----------
    @app.get("/api/admin/status")
    def admin_status(user: User = Depends(need("admin"))):
        c = st().conn
        return {
            "documents": c.execute("SELECT COUNT(*) FROM documents").fetchone()[0],
            "fragments_active": c.execute("SELECT COUNT(*) FROM fragments WHERE valid_to IS NULL").fetchone()[0],
            "kb_version": db.kb_version(c),
            "mode": db.kv_get(c, "mode", st().settings.get("mode", "default", "fast")),
            "llm": st().pipeline.llm.name,
            "last_update": db.kv_get(c, "last_update"),
            "notifications": [dict(r) for r in c.execute(
                "SELECT * FROM notifications ORDER BY id DESC LIMIT 20")],
            "update_log": [dict(r) for r in c.execute("SELECT * FROM update_log ORDER BY id DESC LIMIT 50")],
        }

    @app.post("/api/admin/settings")
    def admin_settings(body: SettingsIn, user: User = Depends(need("admin"))):
        with st().lock:
            db.kv_set(st().conn, "mode", body.mode)
            db.audit(st().conn, user.name, user.role, "settings", "mode", body.model_dump())
            st().conn.commit()
        return {"ok": True}

    @app.post("/api/admin/update")
    def admin_update(user: User = Depends(need("admin"))):
        from .updater import run_update
        s = st()
        with s.lock:
            stats = run_update(s.conn, s.settings,
                               after_update=lambda _: quality.run_regression(s.conn, s.pipeline, "auto:update"))
            db.audit(s.conn, user.name, user.role, "update", None, stats)
            s.conn.commit()
        return stats

    @app.get("/api/admin/audit")
    def audit_log(user: User = Depends(need("admin"))):
        return [dict(r) for r in st().conn.execute("SELECT * FROM audit ORDER BY id DESC LIMIT 200")]

    @app.get("/api/me")
    def me(user: User = Depends(current_user)):
        return user

    static = ROOT / "expert" / "static"
    app.mount("/static", StaticFiles(directory=static), name="static")

    @app.get("/")
    def index():
        return FileResponse(static / "index.html")

    return app

