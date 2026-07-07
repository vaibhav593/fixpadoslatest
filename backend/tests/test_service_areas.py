"""Service Areas + booking pincode gate + cross-area assignment safety.

Covers iteration 5 review-request bullets.
"""
import base64
import os
import uuid
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

UNAVAILABLE_MSG = "Sorry, services are currently unavailable in your area."


# ---------------- helpers ----------------
def auth(token):
    return {"Authorization": f"Bearer {token}"}


def jpg(size=1024):
    raw = b"\xff\xd8\xff\xe0" + b"\x00" * max(0, size - 4)
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def png(size=1024):
    raw = b"\x89PNG\r\n\x1a\n" + b"\x00" * max(0, size - 8)
    return "data:image/png;base64," + base64.b64encode(raw).decode()


def register(sess, role, name=None):
    mobile = f"+91{uuid.uuid4().int % 10000000000:010d}"
    r = sess.post(f"{API}/auth/register",
                  json={"name": name or f"TEST_{role}", "mobile": mobile, "role": role})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "mobile": mobile}


def admin_token(sess):
    r = sess.post(f"{API}/auth/admin-login", json={"password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def full_kyc_payload(pincode="400001"):
    return {
        "email": "worker@test.com",
        "full_address": "12 Test Lane",
        "city": "Somewhere",
        "state": "Maharashtra",
        "pincode": pincode,
        "experience": "3-5 years",
        "categories": [],
        "photo": jpg(2048),
        "live_selfie": jpg(2048),
        "aadhaar_front": jpg(2048),
        "aadhaar_back": png(2048),
    }


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin(session):
    return admin_token(session)


@pytest.fixture(scope="session")
def cats(session):
    return session.get(f"{API}/categories").json()


# ---------------- 1. public /service-areas/check ----------------
class TestPublicServiceAreaCheck:
    def test_check_seeded_pincode_serviced(self, session):
        r = session.get(f"{API}/service-areas/check", params={"pincode": "400050"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["serviced"] is True
        area = j["area"]
        for f in ("id", "name", "pincode", "city"):
            assert f in area, f"missing {f} in area response"
        assert area["pincode"] == "400050"
        assert "_id" not in area

    def test_check_unknown_pincode_not_serviced(self, session):
        r = session.get(f"{API}/service-areas/check", params={"pincode": "999999"})
        assert r.status_code == 200
        assert r.json() == {"serviced": False}

    def test_check_no_auth_required(self, session):
        # Fresh session with no headers other than default
        s = requests.Session()
        r = s.get(f"{API}/service-areas/check", params={"pincode": "400050"})
        assert r.status_code == 200

    @pytest.mark.parametrize("bad", ["12345", "abcdef", "", "1234567", "40005a"])
    def test_check_invalid_pincode_returns_400(self, session, bad):
        r = session.get(f"{API}/service-areas/check", params={"pincode": bad})
        assert r.status_code == 400, f"{bad!r} expected 400 got {r.status_code}"


# ---------------- 2. admin CRUD guards ----------------
class TestAdminCrudGuards:
    def test_no_token_returns_401(self, session):
        r = session.get(f"{API}/admin/service-areas")
        assert r.status_code == 401

    def test_customer_token_returns_403(self, session):
        c = register(session, "customer", "TEST_CustGuard")
        r = session.get(f"{API}/admin/service-areas", headers=auth(c["token"]))
        assert r.status_code == 403

    def test_worker_token_returns_403(self, session):
        w = register(session, "worker", "TEST_WkrGuard")
        r = session.get(f"{API}/admin/service-areas", headers=auth(w["token"]))
        assert r.status_code == 403

    def test_post_no_token_returns_401(self, session):
        r = session.post(f"{API}/admin/service-areas", json={
            "name": "X", "pincode": "111111", "city": "Y"})
        assert r.status_code == 401


# ---------------- 3. admin CRUD happy path + validation ----------------
class TestAdminCrud:
    def test_list_contains_seeded(self, session, admin):
        r = session.get(f"{API}/admin/service-areas", headers=auth(admin))
        assert r.status_code == 200
        items = r.json()
        assert any(x["pincode"] == "400050" for x in items), "seeded 400050 area missing"
        for x in items:
            assert "_id" not in x

    def test_create_and_duplicate_and_delete(self, session, admin):
        # Use a random pincode so tests are re-runnable
        pin = f"5{uuid.uuid4().int % 100000:05d}"
        r = session.post(f"{API}/admin/service-areas", headers=auth(admin), json={
            "name": "Bengaluru Central", "pincode": pin,
            "city": "Bengaluru", "radius_km": 8, "enabled": True,
        })
        assert r.status_code == 200, r.text
        area = r.json()
        assert area["id"] and area["pincode"] == pin
        assert area["created_at"] and area["updated_at"]
        assert "_id" not in area
        sid = area["id"]

        # Duplicate
        r2 = session.post(f"{API}/admin/service-areas", headers=auth(admin), json={
            "name": "Dup", "pincode": pin, "city": "Bengaluru"})
        assert r2.status_code == 400
        assert "already exists" in r2.json()["detail"].lower()

        # Cleanup
        rd = session.delete(f"{API}/admin/service-areas/{sid}", headers=auth(admin))
        assert rd.status_code == 200
        lst = session.get(f"{API}/admin/service-areas", headers=auth(admin)).json()
        assert not any(x["id"] == sid for x in lst)

    @pytest.mark.parametrize("payload", [
        {"name": "", "pincode": "600001", "city": "Chennai"},
        {"name": "OK", "pincode": "600001", "city": ""},
        {"name": "OK", "pincode": "12345", "city": "X"},
        {"name": "OK", "pincode": "abcdef", "city": "X"},
        {"name": "OK", "pincode": "12345a", "city": "X"},
    ])
    def test_create_validation(self, session, admin, payload):
        r = session.post(f"{API}/admin/service-areas", headers=auth(admin), json=payload)
        assert r.status_code == 400, r.text

    def test_patch_enabled_persists(self, session, admin):
        pin = f"7{uuid.uuid4().int % 100000:05d}"
        area = session.post(f"{API}/admin/service-areas", headers=auth(admin), json={
            "name": "PatchArea", "pincode": pin, "city": "PC"}).json()
        sid = area["id"]
        r = session.patch(f"{API}/admin/service-areas/{sid}", headers=auth(admin),
                          json={"enabled": False})
        assert r.status_code == 200
        assert r.json()["enabled"] is False
        # Re-fetch
        lst = session.get(f"{API}/admin/service-areas", headers=auth(admin)).json()
        found = next(x for x in lst if x["id"] == sid)
        assert found["enabled"] is False
        session.delete(f"{API}/admin/service-areas/{sid}", headers=auth(admin))

    def test_patch_pincode_collision(self, session, admin):
        pin = f"8{uuid.uuid4().int % 100000:05d}"
        area = session.post(f"{API}/admin/service-areas", headers=auth(admin), json={
            "name": "PatchCollide", "pincode": pin, "city": "PC"}).json()
        sid = area["id"]
        r = session.patch(f"{API}/admin/service-areas/{sid}", headers=auth(admin),
                          json={"pincode": "400050"})
        assert r.status_code == 400
        assert "already exists" in r.json()["detail"].lower()
        session.delete(f"{API}/admin/service-areas/{sid}", headers=auth(admin))

    def test_stats_returns_ints(self, session, admin):
        pin = f"9{uuid.uuid4().int % 100000:05d}"
        area = session.post(f"{API}/admin/service-areas", headers=auth(admin), json={
            "name": "StatsArea", "pincode": pin, "city": "SC"}).json()
        sid = area["id"]
        r = session.get(f"{API}/admin/service-areas/{sid}/stats", headers=auth(admin))
        assert r.status_code == 200
        j = r.json()
        for k in ("customers", "bookings", "workers"):
            assert isinstance(j[k], int), f"{k} not int"
            assert j[k] == 0
        session.delete(f"{API}/admin/service-areas/{sid}", headers=auth(admin))


# ---------------- 4. booking pincode gate ----------------
class TestBookingPincodeGate:
    def test_booking_serviced_pincode_ok(self, session, cats):
        c = register(session, "customer", "TEST_CustGateOK")
        cat = cats[0]
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A",
            "pincode": "400050", "category_id": cat["id"],
            "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 200, br.text
        b = br.json()
        assert b["pincode"] == "400050"
        assert b["service_area_id"]
        # Auto-assign should pick the seeded 400050 worker
        assert b["worker_id"], "auto-assign should have picked a seeded 400050 worker"
        w = session.get(f"{API}/workers/{b['worker_id']}").json()
        assert w.get("pincode") == "400050", "assigned worker's pincode mismatch"
        assert "_id" not in b

    def test_booking_unserviced_pincode_returns_exact_message(self, session, cats):
        c = register(session, "customer", "TEST_CustGateNo")
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A",
            "pincode": "999999", "category_id": cats[0]["id"],
            "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 400
        assert br.json()["detail"] == UNAVAILABLE_MSG  # byte-for-byte

    def test_booking_invalid_pincode_length(self, session, cats):
        c = register(session, "customer", "TEST_CustGate5")
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A",
            "pincode": "12345", "category_id": cats[0]["id"],
            "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 400
        assert "6-digit" in br.json()["detail"]

    def test_booking_missing_pincode_422(self, session, cats):
        c = register(session, "customer", "TEST_CustGateMiss")
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A",
            "category_id": cats[0]["id"], "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 422


# ---------------- 5. cross-area assignment safety + disable gate ----------------
class TestCrossAreaAssignment:
    def test_new_worker_gets_bookings_only_in_own_area_and_disable_blocks(self, session, admin):
        # Create a dedicated category so we control candidate workers
        cname = f"TEST_CAT_{uuid.uuid4().hex[:6]}"
        cr = session.post(f"{API}/categories", headers=auth(admin),
                          json={"name": cname, "icon": "tool", "active": True})
        assert cr.status_code == 200
        cid = cr.json()["id"]

        # New approved worker with pincode 560001
        w = register(session, "worker", "TEST_WkrBLR")
        p = full_kyc_payload(pincode="560001")
        p["categories"] = [cid]
        assert session.post(f"{API}/worker/upload-kyc",
                            headers=auth(w["token"]), json=p).status_code == 200
        assert session.post(f"{API}/admin/workers/{w['user']['id']}/approve",
                            headers=auth(admin)).status_code == 200

        # Add service area for 560001
        sr = session.post(f"{API}/admin/service-areas", headers=auth(admin), json={
            "name": "BLR Central", "pincode": "560001", "city": "Bengaluru", "enabled": True})
        assert sr.status_code == 200
        sid = sr.json()["id"]

        # Customer booking with 560001 + category cid — must assign to BLR worker (not the 400050 seeded)
        c = register(session, "customer", "TEST_CustBLR")
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A",
            "pincode": "560001", "category_id": cid,
            "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 200, br.text
        b = br.json()
        assert b["worker_id"] == w["user"]["id"], (
            f"expected 560001 worker {w['user']['id']}, got {b.get('worker_id')}"
        )
        assert b["service_area_id"] == sid

        # Also confirm no seeded 400050 worker was picked
        assigned = session.get(f"{API}/workers/{b['worker_id']}").json()
        assert assigned["pincode"] == "560001"

        # Disable the area -> new booking rejected with exact message; existing untouched
        pr = session.patch(f"{API}/admin/service-areas/{sid}", headers=auth(admin),
                           json={"enabled": False})
        assert pr.status_code == 200
        assert pr.json()["enabled"] is False

        br2 = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A",
            "pincode": "560001", "category_id": cid,
            "problem": "x", "schedule_type": "now",
        })
        assert br2.status_code == 400
        assert br2.json()["detail"] == UNAVAILABLE_MSG

        # Existing booking still exists and is unchanged
        existing = session.get(f"{API}/bookings/{b['id']}",
                               headers=auth(c["token"])).json()
        assert existing["id"] == b["id"]
        assert existing["worker_id"] == w["user"]["id"]

        # Cleanup: delete area + category
        session.delete(f"{API}/admin/service-areas/{sid}", headers=auth(admin))
        session.delete(f"{API}/categories/{cid}", headers=auth(admin))


# ---------------- 6. MongoDB serialization sanity ----------------
class TestNoObjectIdLeak:
    def test_service_area_responses_have_no_underscore_id(self, session, admin):
        lst = session.get(f"{API}/admin/service-areas", headers=auth(admin)).json()
        for a in lst:
            assert "_id" not in a
        chk = session.get(f"{API}/service-areas/check",
                          params={"pincode": "400050"}).json()
        assert "_id" not in chk.get("area", {})
