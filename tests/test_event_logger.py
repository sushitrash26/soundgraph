import pytest
import uuid
import tempfile
import os
from backend.services.event_logger import EventLogger

@pytest.fixture
def temp_logger():
    # Use a temporary SQLite database file for isolation
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    logger = EventLogger(db_path=path)
    yield logger
    if os.path.exists(path):
        os.remove(path)

def test_request_and_impressions_logging(temp_logger):
    req_id = str(uuid.uuid4())
    user_id = "test_user_w1"
    
    req_data = {
        "request_id": req_id,
        "user_id": user_id,
        "endpoint": "/recommendations",
        "params": {"limit": 2, "mood": "chill"},
        "candidate_counts": {"persona": 5, "served": 2},
        "candidate_snapshot": ["track_1", "track_2"],
        "model_version": "1.0.0",
        "embedding_version": "gemini-2",
        "config_version": "1.0.0",
        "experiment_id": "test_exp",
        "latency_ms": 42
    }
    
    impressions = [
        {
            "impression_id": "imp_001",
            "user_id": user_id,
            "track_id": "track_1",
            "position": 0,
            "arm": 0,
            "source": "persona_exploit",
            "rank_in_source": 0,
            "score_raw": 0.95,
            "score_fused": 0.95,
            "propensity": None,
            "context": [0.1, 0.2, 0.3],
            "preview_ok": True
        },
        {
            "impression_id": "imp_002",
            "user_id": user_id,
            "track_id": "track_2",
            "position": 1,
            "arm": 1,
            "source": "frontier_wildcard",
            "rank_in_source": 1,
            "score_raw": 0.88,
            "score_fused": 0.88,
            "propensity": 0.1,
            "context": [0.1, 0.2, 0.3],
            "preview_ok": True
        }
    ]
    
    # Synchronously log using internal method for direct assertion
    temp_logger._sync_log_request_and_impressions(req_data, impressions)
    
    # Assert deck replay
    deck = temp_logger.get_deck_by_request_id(req_id)
    assert deck is not None
    assert deck["request_id"] == req_id
    assert deck["user_id"] == user_id
    assert deck["latency_ms"] == 42
    assert deck["candidate_counts"]["served"] == 2
    assert deck["candidate_snapshot"] == ["track_1", "track_2"]
    assert len(deck["impressions"]) == 2
    assert deck["impressions"][0]["impression_id"] == "imp_001"
    assert deck["impressions"][0]["track_id"] == "track_1"
    assert deck["impressions"][0]["arm"] == 0
    assert deck["impressions"][0]["context"] == [0.1, 0.2, 0.3]
    assert deck["impressions"][1]["impression_id"] == "imp_002"

def test_events_idempotency(temp_logger):
    # Setup request and impression first so FK constraint is satisfied
    req_id = "req_idem"
    user_id = "user_idem"
    temp_logger._sync_log_request_and_impressions(
        {"request_id": req_id, "user_id": user_id},
        [{"impression_id": "imp_idem", "user_id": user_id, "track_id": "track_x", "position": 0}]
    )
    
    event_id = "event_unique_123"
    event = {
        "event_id": event_id,
        "impression_id": "imp_idem",
        "user_id": user_id,
        "track_id": "track_x",
        "type": "like",
        "value_ms": 12000
    }
    
    # First insert
    count1 = temp_logger.log_events([event])
    assert count1 == 1
    
    # Duplicate insert with identical event_id must be ignored idempotently
    count2 = temp_logger.log_events([event])
    assert count2 == 0
    
    # Query database to ensure only 1 row exists
    with temp_logger._get_connection() as conn:
        rows = conn.execute("SELECT * FROM events WHERE event_id = ?", (event_id,)).fetchall()
        assert len(rows) == 1
        assert rows[0]["type"] == "like"
        assert rows[0]["value_ms"] == 12000

def test_user_cascade_deletion(temp_logger):
    user_id = "user_to_delete"
    req_id = "req_del"
    imp_id = "imp_del"
    event_id = "event_del"
    
    temp_logger._sync_log_request_and_impressions(
        {"request_id": req_id, "user_id": user_id},
        [{"impression_id": imp_id, "user_id": user_id, "track_id": "track_del", "position": 0}]
    )
    temp_logger.log_events([{
        "event_id": event_id,
        "impression_id": imp_id,
        "user_id": user_id,
        "track_id": "track_del",
        "type": "dwell_threshold",
        "value_ms": 6000
    }])
    
    # Verify rows exist
    with temp_logger._get_connection() as conn:
        assert conn.execute("SELECT count(*) FROM requests WHERE user_id = ?", (user_id,)).fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM impressions WHERE user_id = ?", (user_id,)).fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM events WHERE user_id = ?", (user_id,)).fetchone()[0] == 1
        
    # Delete user data (GDPR cascade)
    deleted_count = temp_logger.delete_user_data(user_id)
    assert deleted_count >= 1
    
    # Verify all tables are cleared for user_id
    with temp_logger._get_connection() as conn:
        assert conn.execute("SELECT count(*) FROM requests WHERE user_id = ?", (user_id,)).fetchone()[0] == 0
        assert conn.execute("SELECT count(*) FROM impressions WHERE user_id = ?", (user_id,)).fetchone()[0] == 0
        assert conn.execute("SELECT count(*) FROM events WHERE user_id = ?", (user_id,)).fetchone()[0] == 0

def test_api_endpoints(monkeypatch, temp_logger):
    from fastapi.testclient import TestClient
    from backend.main import app
    import backend.services.event_logger as el_mod

    # Monkeypatch get_instance to return temp_logger
    monkeypatch.setattr(el_mod.EventLogger, "get_instance", classmethod(lambda cls: temp_logger))

    client = TestClient(app)

    # 1. Log a request directly in temp_logger to prepare for deck replay
    req_id = "req_api_test"
    user_id = "user_api_test"
    temp_logger._sync_log_request_and_impressions(
        {
            "request_id": req_id,
            "user_id": user_id,
            "endpoint": "/recommendations",
            "params": {"limit": 1},
            "candidate_counts": {"served": 1},
            "candidate_snapshot": ["track_api_1"],
            "latency_ms": 15
        },
        [{
            "impression_id": "imp_api_1",
            "user_id": user_id,
            "track_id": "track_api_1",
            "position": 0,
            "arm": 0,
            "source": "persona_exploit",
            "rank_in_source": 0,
            "score_raw": 0.9,
            "score_fused": 0.9,
            "propensity": None,
            "context": [0.5, 0.5],
            "preview_ok": True
        }]
    )

    # 2. Test GET /recommendations/deck/{request_id}
    res = client.get(f"/recommendations/deck/{req_id}")
    assert res.status_code == 200
    deck = res.json()
    assert deck["request_id"] == req_id
    assert len(deck["impressions"]) == 1
    assert deck["impressions"][0]["impression_id"] == "imp_api_1"

    # 3. Test POST /events
    events_payload = {
        "events": [
            {
                "event_id": "ev_api_1",
                "impression_id": "imp_api_1",
                "user_id": user_id,
                "track_id": "track_api_1",
                "type": "like",
                "value_ms": 8000
            }
        ]
    }
    res_ev = client.post("/events", json=events_payload)
    assert res_ev.status_code == 200
    data = res_ev.json()
    assert data["status"] == "ok"
    assert data["inserted"] == 1

    # 4. Test DELETE /user/{user_id}/data
    res_del = client.delete(f"/user/{user_id}/data")
    assert res_del.status_code == 200
    assert res_del.json()["deleted_records"] >= 1

