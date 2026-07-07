"""Security-hardening tests for FixPados backend.

Focus areas (new in this iteration):
- OTP rate limit (3/min/mobile) -> 4th send returns 429.
- OTP verify 5-wrong-attempts cap -> 429.
- OTP single-use (second successful verify with same code fails).
- Admin login: wrong password 401, right password 200 (JWT, role=admin),
  AND audit_logs entry expected per spec.
- KYC upload: MIME allow-list (JPG/PNG/PDF), 5 MB cap.
- Admin KYC approve/reject writes audit log + sets kyc_status.
- Booking PIN verify 5-attempt cap -> 429 (spec says auto-cancel).
- audit_logs collection grows after sensitive actions.
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


# ----------------- Helpers -----------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def _send_and_verify(session, mobile, role="customer", name=None):
    # Retry once with a wait if rate-limited (other tests may have used same mobile).
    import time
    for attempt in range(2):
        r1 = session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": role})
        if r1.status_code == 200:
            break
        if r1.status_code == 429 and attempt == 0:
            time.sleep(62)  # wait out the 1-min rate-limit window
            continue
        raise AssertionError(f"send-otp failed: {r1.status_code} {r1.text}")
    body = {"mobile": mobile, "code": "123456", "role": role}
    if name:
        body["name"] = name
    r2 = session.post(f"{API}/auth/verify-otp", json=body)
    assert r2.status_code == 200, f"verify-otp failed: {r2.status_code} {r2.text}"
    return r2.json()


def _admin_token(session):
    r = session.post(f"{API}/auth/admin-login", json={"password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _random_mobile(prefix):
    """Return a unique mobile so prior tests don't pollute OTP rate-limit window."""
    return f"+91{prefix}{uuid.uuid4().int % 100000:05d}"


# ----------------- OTP Rate Limit -----------------
class TestOTPRateLimit:
    """3 OTPs per minute per mobile. 4th must return 429."""

    def test_4th_send_returns_429(self, session):
        mobile = _random_mobile("9988")
        # First 3 should succeed
        for i in range(3):
            r = session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": "customer"})
            assert r.status_code == 200, f"Send #{i+1} failed: {r.status_code} {r.text}"
        # 4th must be rate-limited
        r4 = session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": "customer"})
        assert r4.status_code == 429, f"Expected 429 on 4th send, got {r4.status_code} {r4.text}"


# ----------------- OTP Verify Attempt Cap -----------------
class TestOTPVerifyAttempts:
    """Wrong code attempts capped at 5. 6th attempt (attempts already 5) returns 429."""

    def test_5_wrong_then_429(self, session):
        mobile = _random_mobile("9977")
        # Send OTP fresh
        r = session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": "customer"})
        assert r.status_code == 200, r.text
        # 5 wrong attempts -> each 400, attempts increment
        for i in range(5):
            r = session.post(f"{API}/auth/verify-otp",
                             json={"mobile": mobile, "code": "000000", "role": "customer"})
            assert r.status_code == 400, f"Wrong #{i+1}: expected 400 got {r.status_code} {r.text}"
        # 6th attempt (attempts now == 5, hits cap) returns 429
        r6 = session.post(f"{API}/auth/verify-otp",
                          json={"mobile": mobile, "code": "000000", "role": "customer"})
        assert r6.status_code == 429, f"Expected 429 after cap, got {r6.status_code} {r6.text}"
        # Even the correct code should now be locked out
        r_correct = session.post(f"{API}/auth/verify-otp",
                                 json={"mobile": mobile, "code": "123456", "role": "customer"})
        assert r_correct.status_code == 429, f"Correct code should still be locked, got {r_correct.status_code}"


# ----------------- OTP Single-Use -----------------
class TestOTPSingleUse:
    def test_otp_cannot_be_reused(self, session):
        mobile = _random_mobile("9966")
        r = session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": "customer"})
        assert r.status_code == 200
        # First verify succeeds
        r1 = session.post(f"{API}/auth/verify-otp",
                          json={"mobile": mobile, "code": "123456", "role": "customer", "name": "TEST_OTPOnce"})
        assert r1.status_code == 200, r1.text
        # Second verify with same code must fail (used)
        r2 = session.post(f"{API}/auth/verify-otp",
                          json={"mobile": mobile, "code": "123456", "role": "customer"})
        assert r2.status_code == 400, f"Expected 400 (used), got {r2.status_code} {r2.text}"
        assert "used" in r2.text.lower() or "already" in r2.text.lower()


# ----------------- Admin Login -----------------
class TestAdminLogin:
    def test_wrong_password_401(self, session):
        r = session.post(f"{API}/auth/admin-login", json={"password": "wrong-password"})
        assert r.status_code == 401

    def test_right_password_returns_admin_jwt(self, session):
        # Capture audit log size before
        token_before = _admin_token(session)
        before = session.get(f"{API}/admin/audit-logs", headers=auth(token_before)).json()
        before_count = len(before)

        # Real login under test
        r = session.post(f"{API}/auth/admin-login", json={"password": "admin123"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and j["token"]
        assert j["user"]["role"] == "admin"

        # Per spec: audit log entry should be created on admin login
        after = session.get(f"{API}/admin/audit-logs", headers=auth(j["token"])).json()
        # Soft-check: spec requires audit entry. If implementation doesn't write one,
        # this assertion fails and we report it.
        assert len(after) > before_count, \
            "Spec requires audit_log entry for admin login; none observed."


# ----------------- KYC Upload -----------------
def _make_jpg_data_url(size_bytes: int = 1024) -> str:
    """Build a fake JPG data URL of approximately `size_bytes` decoded bytes."""
    raw = b"\xff\xd8\xff\xe0" + b"\x00" * max(0, size_bytes - 4)
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def _make_png_data_url(size_bytes: int = 1024) -> str:
    raw = b"\x89PNG\r\n\x1a\n" + b"\x00" * max(0, size_bytes - 8)
    return "data:image/png;base64," + base64.b64encode(raw).decode()


class TestKYCUpload:
    @pytest.fixture(scope="class")
    def worker(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        mobile = _random_mobile("9955")
        data = _send_and_verify(s, mobile, "worker", name="TEST_KYCWorker")
        return {"session": s, "token": data["token"], "user": data["user"]}

    def test_reject_disallowed_mime_text(self, worker):
        bad = "data:text/plain;base64," + base64.b64encode(b"hello world").decode()
        good = _make_jpg_data_url(512)
        r = worker["session"].post(f"{API}/worker/upload-kyc",
                                   headers=auth(worker["token"]),
                                   json={"aadhaar_front": bad, "aadhaar_back": good})
        assert r.status_code == 400, f"Expected 400 for bad MIME, got {r.status_code} {r.text}"

    def test_reject_oversize_file(self, worker):
        # 6 MB raw -> base64 ~8 MB; validator checks decoded >5 MB
        big = _make_jpg_data_url(6 * 1024 * 1024)
        good = _make_png_data_url(1024)
        r = worker["session"].post(f"{API}/worker/upload-kyc",
                                   headers=auth(worker["token"]),
                                   json={"aadhaar_front": big, "aadhaar_back": good})
        assert r.status_code == 413, f"Expected 413 for >5MB, got {r.status_code} {r.text}"

    def test_accept_valid_small_jpg_sets_submitted(self, worker):
        good_front = _make_jpg_data_url(2048)
        good_back = _make_png_data_url(2048)
        r = worker["session"].post(f"{API}/worker/upload-kyc",
                                   headers=auth(worker["token"]),
                                   json={"aadhaar_front": good_front,
                                         "aadhaar_back": good_back,
                                         "photo": good_front})
        assert r.status_code == 200, r.text
        assert r.json()["kyc_status"] == "submitted"


# ----------------- Admin KYC Approve / Reject -----------------
class TestAdminKYCActions:
    def test_approve_writes_audit_and_status(self, session):
        # New worker submits KYC first
        wsess = requests.Session()
        wsess.headers.update({"Content-Type": "application/json"})
        wmobile = _random_mobile("9944")
        w = _send_and_verify(wsess, wmobile, "worker", name="TEST_Approve")
        kyc_payload = {
            "aadhaar_front": _make_jpg_data_url(2048),
            "aadhaar_back": _make_png_data_url(2048),
        }
        kr = wsess.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]), json=kyc_payload)
        assert kr.status_code == 200

        admin = _admin_token(session)
        logs_before = session.get(f"{API}/admin/audit-logs", headers=auth(admin)).json()
        before_count = len(logs_before)

        r = session.post(f"{API}/admin/workers/{w['user']['id']}/approve", headers=auth(admin))
        assert r.status_code == 200, r.text

        # Status check
        w2 = session.get(f"{API}/workers/{w['user']['id']}").json()
        assert w2["kyc_status"] == "approved"
        assert w2["verified"] is True

        # Audit grew + contains worker_approved for this id
        logs_after = session.get(f"{API}/admin/audit-logs", headers=auth(admin)).json()
        assert len(logs_after) > before_count
        assert any(l.get("action") == "worker_approved" and l.get("target_id") == w["user"]["id"]
                   for l in logs_after), "Missing worker_approved audit entry"

    def test_reject_writes_audit_and_status(self, session):
        wsess = requests.Session()
        wsess.headers.update({"Content-Type": "application/json"})
        wmobile = _random_mobile("9933")
        w = _send_and_verify(wsess, wmobile, "worker", name="TEST_Reject")
        wsess.post(f"{API}/worker/upload-kyc", headers=auth(w["token"]),
                   json={"aadhaar_front": _make_jpg_data_url(2048),
                         "aadhaar_back": _make_png_data_url(2048)})

        admin = _admin_token(session)
        r = session.post(f"{API}/admin/workers/{w['user']['id']}/reject",
                         headers=auth(admin), json={"reason": "Blurry docs"})
        assert r.status_code == 200, r.text

        w2 = session.get(f"{API}/workers/{w['user']['id']}").json()
        assert w2["kyc_status"] == "rejected"
        assert w2["rejection_reason"] == "Blurry docs"

        logs = session.get(f"{API}/admin/audit-logs", headers=auth(admin)).json()
        assert any(l.get("action") == "worker_rejected" and l.get("target_id") == w["user"]["id"]
                   for l in logs), "Missing worker_rejected audit entry"

    def test_admin_endpoints_require_admin_jwt(self, session):
        wsess = requests.Session()
        wsess.headers.update({"Content-Type": "application/json"})
        cmobile = _random_mobile("9922")
        c = _send_and_verify(wsess, cmobile, "customer")
        # Customer token should NOT be able to approve
        r = session.post(f"{API}/admin/workers/nonexistent/approve", headers=auth(c["token"]))
        assert r.status_code == 403
        # No auth at all
        r2 = session.get(f"{API}/admin/audit-logs")
        assert r2.status_code == 401


# ----------------- Booking PIN attempt cap -----------------
class TestPinAttempts:
    """Spec: PIN verify wrong 5 times -> booking should auto-cancel.
    Implementation: returns 429 on attempts >= 5 but does NOT auto-cancel.
    Test verifies whichever behavior happens and reports gap.
    """

    @pytest.fixture(scope="class")
    def booking_state(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # Customer
        cmobile = _random_mobile("9911")
        c = _send_and_verify(s, cmobile, "customer", name="TEST_PinCustomer")
        # Get electrician category
        cats = s.get(f"{API}/categories").json()
        cat = next(c for c in cats if c["name"] == "Electrician")
        # Create booking (auto-assigns a seeded worker)
        body = {"name": "T", "mobile": cmobile, "address": "Addr",
                "category_id": cat["id"], "problem": "x", "schedule_type": "now"}
        r = s.post(f"{API}/bookings", headers=auth(c["token"]), json=body)
        booking = r.json()
        # Login as the assigned worker
        wid = booking["worker_id"]
        wmobile = s.get(f"{API}/workers/{wid}").json()["mobile"]
        w = _send_and_verify(s, wmobile, "worker")
        # Move booking forward: accept -> start
        s.patch(f"{API}/bookings/{booking['id']}/accept", headers=auth(w["token"]))
        s.patch(f"{API}/bookings/{booking['id']}/start", headers=auth(w["token"]))
        return {"session": s, "customer": c, "worker": w, "booking": booking}

    def test_wrong_pin_5_then_429(self, booking_state):
        st = booking_state
        bid = st["booking"]["id"]
        wt = st["worker"]["token"]
        # Implementation increments BEFORE checking cap, so first 4 wrong attempts -> 400,
        # 5th wrong attempt -> 429 (attempts==5 hits cap).
        for i in range(4):
            r = st["session"].post(f"{API}/bookings/{bid}/verify-pin",
                                   headers=auth(wt), json={"pin": "0000"})
            assert r.status_code == 400, f"Attempt #{i+1} expected 400 got {r.status_code}"
        r5 = st["session"].post(f"{API}/bookings/{bid}/verify-pin",
                                headers=auth(wt), json={"pin": "0000"})
        assert r5.status_code == 429, f"Expected 429 on 5th wrong, got {r5.status_code}"

    def test_after_pin_locked_booking_auto_cancelled(self, booking_state):
        """Spec says auto-cancel after 5 wrong PIN attempts."""
        st = booking_state
        bid = st["booking"]["id"]
        b = st["session"].get(f"{API}/bookings/{bid}", headers=auth(st["customer"]["token"])).json()
        # Per spec: should be cancelled. If still in_progress, this is a bug.
        assert b["status"] == "cancelled", \
            f"Spec: booking should auto-cancel after 5 wrong PIN attempts. Got status={b['status']}"


# ----------------- Audit log growth across sensitive actions -----------------
class TestAuditLogGrowth:
    def test_booking_lifecycle_creates_audit_entries(self, session):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        admin = _admin_token(session)
        before = session.get(f"{API}/admin/audit-logs", headers=auth(admin)).json()
        before_count = len(before)

        # Create + cancel booking
        cmobile = _random_mobile("9900")
        c = _send_and_verify(s, cmobile, "customer")
        cats = s.get(f"{API}/categories").json()
        body = {"name": "T", "mobile": cmobile, "address": "A",
                "category_id": cats[0]["id"], "problem": "p", "schedule_type": "now"}
        br = s.post(f"{API}/bookings", headers=auth(c["token"]), json=body)
        bid = br.json()["id"]
        s.patch(f"{API}/bookings/{bid}/cancel",
                headers=auth(c["token"]), json={"reason": "test cancel"})

        after = session.get(f"{API}/admin/audit-logs", headers=auth(admin)).json()
        assert len(after) >= before_count + 2, \
            f"Expected at least 2 new audit entries (created+cancelled), got {len(after)-before_count}"
        actions = [l.get("action") for l in after[:10]]
        assert "booking_cancelled" in actions or any(l.get("action") == "booking_cancelled" for l in after)
        assert any(l.get("action") == "booking_created" for l in after)
