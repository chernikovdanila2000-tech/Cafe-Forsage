from fastapi.testclient import TestClient

from expert.api import AppState, create_app

H = {"operator": {"Authorization": "Bearer operator-demo"},
     "validator": {"Authorization": "Bearer validator-demo"},
     "admin": {"Authorization": "Bearer admin-demo"}}


def make_client(conn, settings, llm):
    return TestClient(create_app(AppState(settings=settings, conn=conn, llm=llm)))


def test_roles_and_flow(conn, settings, fake_llm):
    client = make_client(conn, settings, fake_llm)
    assert client.post("/api/requests", json={"text": "Вопрос?"}).status_code == 401
    r = client.post("/api/requests", headers=H["operator"],
                    json={"text": "Жалоба: отказали в прикреплении. Вправе ли поликлиника отказать в прикреплении?"})
    assert r.status_code == 200, r.text
    body = r.json()
    answer_id = body["answers"][0]["id"]
    assert body["requires_approval"]

    assert client.post(f"/api/answers/{answer_id}/review", headers=H["operator"],
                       json={"verdict": "correct"}).status_code == 403
    assert client.post(f"/api/answers/{answer_id}/approve", headers=H["operator"],
                       json={"variant": "refs", "text": "Ответ"}).status_code == 200
    req = client.get(f"/api/requests/{body['request_id']}", headers=H["operator"]).json()
    assert req["status"] == "approved" and req["answers"][0]["approved_by"] == "Оператор (демо)"

    assert client.post(f"/api/answers/{answer_id}/review", headers=H["validator"],
                       json={"verdict": "correct"}).status_code == 200
    assert client.get("/api/quality/report", headers=H["validator"]).json()["reviewed"] == 1
    assert client.get("/api/admin/status", headers=H["validator"]).status_code == 403
    status = client.get("/api/admin/status", headers=H["admin"]).json()
    assert status["documents"] == 3
    audit = client.get("/api/admin/audit", headers=H["admin"]).json()
    assert {a["action"] for a in audit} >= {"process_request", "approve_answer", "review"}


def test_documents_and_compare(conn, settings, fake_llm):
    client = make_client(conn, settings, fake_llm)
    docs = client.get("/api/documents", headers=H["operator"]).json()
    assert {d["code"] for d in docs} == {"DEMO-PMSP", "DEMO-APPEALS", "DEMO-DRUGS"}
    diff = client.get("/api/documents/DEMO-PMSP/compare", headers=H["operator"],
                      params={"lang": "kk", "date_a": "2024-06-01", "date_b": "2026-01-01"}).json()
    assert diff["changed"][0]["path"] == "ch:3/p:7"
    assert client.get("/", headers={}).status_code == 200
