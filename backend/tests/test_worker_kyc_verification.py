"""Worker KYC verification & registration guardrails.

Aligned with new /api/auth/register (name+mobile) flow and expanded
WorkerKycReq schema (email, full_address, city, state, pincode,
experience, categories, photo, live_selfie, aadhaar_front, aadhaar_back).
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


def full_kyc_payload():
    return {
        "email": "worker@test.com",
        "full_address": "12 Test Lane, Andheri",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "experience": "3-5 years",
        "categories": [],  # filled per test
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
def cats(session):
    return session.get(f"{API}/categories").json()


# ---------------- 1. register worker -> pending, cannot use worker endpoints ----------------
class TestWorkerRegister:
    def test_register_worker_pending_status(self, session):
        w = register(session, "worker", "TEST_Reg")
        me = session.get(f"{API}/auth/me", headers=auth(w["token"])).json()
        assert me["role"] == "worker"
        assert me["kyc_status"] == "pending"
        assert me.get("verification_status") == "pending_verification"

    def test_worker_jobs_403_when_pending(self, session):
        w = register(session, "worker", "TEST_Reg2")
        r = session.get(f"{API}/worker/jobs", headers=auth(w["token"]))
        assert r.status_code == 403

    def test_worker_earnings_403_when_pending(self, session):
        w = register(session, "worker", "TEST_Reg3")
        r = session.get(f"{API}/worker/earnings", headers=auth(w["token"]))
        assert r.status_code == 403


# ---------------- 2. upload-kyc field validation ----------------
class TestKycFieldValidation:
    @pytest.fixture
    def worker(self, session):
        return register(session, "worker", "TEST_KYCVal")

    @pytest.fixture
    def base_payload(self, cats):
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        return p

    @pytest.mark.parametrize("field,bad", [
        ("email", ""),
        ("email", "not-an-email"),
        ("full_address", ""),
        ("city", ""),
        ("state", ""),
        ("pincode", "12345"),      # only 5 digits
        ("pincode", "abcdef"),     # non-numeric
        ("experience", ""),
        ("photo", ""),
        ("live_selfie", ""),
        ("aadhaar_front", ""),
        ("aadhaar_back", ""),
    ])
    def test_missing_or_invalid_field_returns_400(self, session, worker, base_payload, field, bad):
        payload = dict(base_payload)
        payload[field] = bad
        r = session.post(f"{API}/worker/upload-kyc", headers=auth(worker["token"]), json=payload)
        assert r.status_code == 400, f"{field}={bad!r} expected 400 got {r.status_code} {r.text}"

    def test_empty_categories_returns_400(self, session, worker, base_payload):
        payload = dict(base_payload)
        payload["categories"] = []
        r = session.post(f"{API}/worker/upload-kyc", headers=auth(worker["token"]), json=payload)
        assert r.status_code == 400


# ---------------- 3. document validation ----------------
class TestDocValidation:
    def test_bad_mime_returns_400(self, session, cats):
        w = register(session, "worker", "TEST_MIME")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        p["aadhaar_front"] = "data:text/plain;base64," + base64.b64encode(b"hi").decode()
        r = session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)
        assert r.status_code == 400

    def test_oversize_file_returns_413(self, session, cats):
        w = register(session, "worker", "TEST_BIG")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        p["photo"] = jpg(6 * 1024 * 1024)  # 6MB raw
        r = session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)
        assert r.status_code == 413


# ---------------- 4. valid upload -> submitted + persisted ----------------
class TestValidKycSubmission:
    def test_valid_submission_flips_status_and_persists(self, session, cats):
        w = register(session, "worker", "TEST_OK")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        r = session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["kyc_status"] == "submitted"
        assert j["verification_status"] == "pending_verification"

        me = session.get(f"{API}/auth/me", headers=auth(w["token"])).json()
        assert me["email"] == p["email"]
        assert me["full_address"] == p["full_address"]
        assert me["city"] == p["city"]
        assert me["state"] == p["state"]
        assert me["pincode"] == p["pincode"]
        assert me["experience"] == p["experience"]
        assert me["categories"] == p["categories"]
        assert me["photo"] == p["photo"]
        assert me["live_selfie"] == p["live_selfie"]

    def test_submitted_worker_still_403_on_worker_endpoints(self, session, cats):
        w = register(session, "worker", "TEST_Sub403")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        assert session.post(f"{API}/worker/upload-kyc",
                            headers=auth(w["token"]), json=p).status_code == 200
        assert session.get(f"{API}/worker/jobs", headers=auth(w["token"])).status_code == 403
        assert session.get(f"{API}/worker/earnings", headers=auth(w["token"])).status_code == 403


# ---------------- 5. admin login + admin listing exposes new fields ----------------
class TestAdminFlow:
    def test_admin_login(self, session):
        r = session.post(f"{API}/auth/admin-login", json={"password": "admin123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_admin_listing_shows_new_fields(self, session, cats):
        w = register(session, "worker", "TEST_AdminList")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)

        admin = admin_token(session)
        r = session.get(f"{API}/admin/workers", headers=auth(admin))
        assert r.status_code == 200
        target = next((x for x in r.json() if x["id"] == w["user"]["id"]), None)
        assert target, "submitted worker missing from admin listing"
        for f in ("email", "full_address", "city", "state", "pincode",
                  "experience", "live_selfie", "photo"):
            assert f in target and target[f], f"missing/empty {f} in admin listing"
        assert target["kyc_docs"].get("aadhaar_front")
        assert target["kyc_docs"].get("aadhaar_back")


# ---------------- 6. approve / reject flow ----------------
class TestApproveReject:
    def test_approve_grants_access(self, session, cats):
        w = register(session, "worker", "TEST_Approve")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)

        admin = admin_token(session)
        r = session.post(f"{API}/admin/workers/{w['user']['id']}/approve",
                         headers=auth(admin))
        assert r.status_code == 200

        me = session.get(f"{API}/auth/me", headers=auth(w["token"])).json()
        assert me["kyc_status"] == "approved"
        assert me["verification_status"] == "approved"
        assert me["verified"] is True

        assert session.get(f"{API}/worker/jobs", headers=auth(w["token"])).status_code == 200
        assert session.get(f"{API}/worker/earnings", headers=auth(w["token"])).status_code == 200

    def test_reject_removes_access(self, session, cats):
        w = register(session, "worker", "TEST_Rej")
        p = full_kyc_payload()
        p["categories"] = [cats[0]["id"]]
        session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)

        admin = admin_token(session)
        r = session.post(f"{API}/admin/workers/{w['user']['id']}/reject",
                         headers=auth(admin), json={"reason": "Blurry docs"})
        assert r.status_code == 200

        me = session.get(f"{API}/auth/me", headers=auth(w["token"])).json()
        assert me["kyc_status"] == "rejected"
        assert me["verification_status"] == "rejected"

        assert session.get(f"{API}/worker/jobs", headers=auth(w["token"])).status_code == 403
        assert session.get(f"{API}/worker/earnings", headers=auth(w["token"])).status_code == 403


# ---------------- 7. auto-assign never picks unapproved worker ----------------
class TestAutoAssignSafety:
    def test_booking_not_assigned_to_submitted_worker(self, session):
        # Create a new category so only the submitted worker chooses it
        admin = admin_token(session)
        cname = f"TEST_CAT_{uuid.uuid4().hex[:6]}"
        cr = session.post(f"{API}/categories", headers=auth(admin),
                          json={"name": cname, "icon": "tool", "active": True})
        assert cr.status_code == 200
        cid = cr.json()["id"]

        # Submitted (not approved) worker with this category
        w = register(session, "worker", "TEST_Submitted")
        p = full_kyc_payload()
        p["categories"] = [cid]
        assert session.post(f"{API}/worker/upload-kyc",
                            headers=auth(w["token"]), json=p).status_code == 200

        # Customer creates booking under that category
        c = register(session, "customer", "TEST_CustAA")
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A", "pincode": "400050",
            "category_id": cid, "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 200, br.text
        booking = br.json()
        # Either unassigned OR assigned to an approved worker — never the submitted one
        assert booking.get("worker_id") != w["user"]["id"], \
            "Submitted worker was auto-assigned - security violation"
        if booking.get("worker_id"):
            wr = session.get(f"{API}/workers/{booking['worker_id']}").json()
            assert wr["kyc_status"] == "approved"


# ---------------- 8. Category CRUD regression ----------------
class TestCategoryCrudRegression:
    def test_category_crud(self, session):
        admin = admin_token(session)
        name = f"TEST_C_{uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/categories", headers=auth(admin),
                         json={"name": name, "icon": "tool", "active": True})
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = session.patch(f"{API}/categories/{cid}", headers=auth(admin),
                           json={"name": name, "icon": "tool", "active": False})
        assert r2.status_code == 200
        assert r2.json()["active"] is False
        r3 = session.delete(f"{API}/categories/{cid}", headers=auth(admin))
        assert r3.status_code == 200


# ---------------- 9. Full booking lifecycle regression (approved worker) ----------------
class TestBookingLifecycleRegression:
    def test_end_to_end_with_approved_worker(self, session, cats):
        # Approved worker via admin
        w = register(session, "worker", "TEST_LifeW")
        p = full_kyc_payload()
        elec = next(c for c in cats if c["name"] == "Electrician")
        p["categories"] = [elec["id"]]
        session.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=p)
        admin = admin_token(session)
        session.post(f"{API}/admin/workers/{w['user']['id']}/approve", headers=auth(admin))

        # Customer + booking
        c = register(session, "customer", "TEST_LifeC")
        br = session.post(f"{API}/bookings", headers=auth(c["token"]), json={
            "name": "T", "mobile": c["mobile"], "address": "A", "pincode": "400050",
            "category_id": elec["id"], "problem": "x", "schedule_type": "now",
        })
        assert br.status_code == 200, br.text
        booking = br.json()
        assert booking["worker_id"]
        # Booking may be assigned to a seeded worker OR our new approved worker.
        # Login as whichever worker was assigned.
        assigned_wid = booking["worker_id"]
        if assigned_wid == w["user"]["id"]:
            wt = w["token"]
        else:
            wmobile = session.get(f"{API}/workers/{assigned_wid}").json()["mobile"]
            wr = session.post(f"{API}/auth/register",
                              json={"name": "seeded", "mobile": wmobile, "role": "worker"})
            wt = wr.json()["token"]

        bid = booking["id"]
        # Accept -> start -> verify pin
        assert session.patch(f"{API}/bookings/{bid}/accept", headers=auth(wt)).status_code == 200
        assert session.patch(f"{API}/bookings/{bid}/start", headers=auth(wt)).status_code == 200
        cb = session.get(f"{API}/bookings/{bid}", headers=auth(c["token"])).json()
        pin = cb["completion_pin"]
        rv = session.post(f"{API}/bookings/{bid}/verify-pin",
                          headers=auth(wt), json={"pin": pin})
        assert rv.status_code == 200, rv.text
        rr = session.post(f"{API}/bookings/{bid}/rate",
                          headers=auth(c["token"]), json={"stars": 5, "review": "OK"})
        assert rr.status_code == 200
