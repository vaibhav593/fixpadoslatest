"""FixPados backend pytest suite.

Covers auth (OTP), categories (CRUD), bookings full lifecycle,
worker endpoints, chat, notifications, addresses, profile.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get(
    "EXPO_BACKEND_URL"
)
if not BASE_URL:
    # Read from frontend/.env explicitly so tests don't depend on shell exports
    from pathlib import Path
    env_file = Path("/app/frontend/.env")
    for line in env_file.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break

BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ----------------- Fixtures -----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, mobile, role, name=None):
    # Retry once with a wait if rate-limited (other tests may have used same mobile).
    for attempt in range(2):
        r1 = session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": role})
        if r1.status_code == 200:
            break
        if r1.status_code == 429 and attempt == 0:
            time.sleep(62)
            continue
        raise AssertionError(f"send-otp failed: {r1.status_code} {r1.text}")
    body = {"mobile": mobile, "code": "123456", "role": role}
    if name:
        body["name"] = name
    r2 = session.post(f"{API}/auth/verify-otp", json=body)
    assert r2.status_code == 200, r2.text
    return r2.json()


@pytest.fixture(scope="session")
def customer(session):
    mobile = f"+9198765{uuid.uuid4().int % 100000:05d}"
    data = _login(session, mobile, "customer", name="TEST_Customer")
    return {"token": data["token"], "user": data["user"], "mobile": mobile}


@pytest.fixture(scope="session")
def worker_user(session):
    mobile = f"+9199991{uuid.uuid4().int % 100000:05d}"
    data = _login(session, mobile, "worker", name="TEST_Worker")
    return {"token": data["token"], "user": data["user"], "mobile": mobile}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ----------------- Health -----------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ----------------- Auth -----------------
class TestAuth:
    def test_send_otp_returns_mock(self, session):
        r = session.post(f"{API}/auth/send-otp", json={"mobile": "+919876543210", "role": "customer"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("mock") is True
        assert "hint" in j and j["hint"]

    def test_verify_otp_creates_user_and_returns_jwt(self, session):
        mobile = f"+9198761{uuid.uuid4().int % 100000:05d}"
        session.post(f"{API}/auth/send-otp", json={"mobile": mobile, "role": "customer"})
        r = session.post(f"{API}/auth/verify-otp", json={
            "mobile": mobile, "code": "123456", "role": "customer", "name": "TEST_New"
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and isinstance(j["token"], str)
        assert "user" in j and j["user"]["mobile"] == mobile
        assert j["user"]["role"] == "customer"

    def test_me_returns_user(self, session, customer):
        r = session.get(f"{API}/auth/me", headers=auth(customer["token"]))
        assert r.status_code == 200
        j = r.json()
        assert j["id"] == customer["user"]["id"]
        assert j["mobile"] == customer["mobile"]

    def test_me_without_token_401(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_invalid_token_401(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-token"})
        assert r.status_code == 401

    def test_verify_without_otp_request(self, session):
        mobile = f"+9198769{uuid.uuid4().int % 100000:05d}"
        r = session.post(f"{API}/auth/verify-otp", json={
            "mobile": mobile, "code": "123456", "role": "customer"
        })
        assert r.status_code == 400


# ----------------- Categories -----------------
class TestCategories:
    def test_list_categories_has_five_seeded(self, session):
        r = session.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        names = {c["name"] for c in cats}
        for expected in ("Electrician", "Plumber", "Carpenter", "AC Repair", "House Cleaning"):
            assert expected in names, f"Missing seeded category: {expected}"

    def test_create_update_delete_category(self, session):
        # admin login
        admin_r = session.post(f"{API}/auth/admin-login", json={"password": "admin123"})
        assert admin_r.status_code == 200, admin_r.text
        admin_token = admin_r.json()["token"]
        # create
        r = session.post(f"{API}/categories", headers=auth(admin_token),
                         json={"name": f"TEST_Cat_{uuid.uuid4().hex[:6]}", "icon": "tool", "active": True})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]

        # update active flag (now admin gated)
        r2 = session.patch(f"{API}/categories/{cid}", headers=auth(admin_token),
                           json={"name": r.json()["name"], "icon": "tool", "active": False})
        assert r2.status_code == 200
        assert r2.json()["active"] is False

        # delete (admin gated)
        r3 = session.delete(f"{API}/categories/{cid}", headers=auth(admin_token))
        assert r3.status_code == 200


# ----------------- Bookings full flow -----------------
class TestBookingFlow:
    @pytest.fixture(scope="class")
    def state(self, session):
        # Login a customer
        c_mobile = f"+9198762{uuid.uuid4().int % 100000:05d}"
        c = _login(session, c_mobile, "customer", name="TEST_FlowCustomer")
        # Get a category
        cats = session.get(f"{API}/categories").json()
        cat = next(c for c in cats if c["name"] == "Electrician")
        # Create booking
        body = {
            "name": "TEST_Flow", "mobile": c_mobile,
            "address": "Test address 1", "landmark": "near park",
            "category_id": cat["id"], "problem": "Fan not working",
            "schedule_type": "now",
        }
        r = session.post(f"{API}/bookings", headers=auth(c["token"]), json=body)
        assert r.status_code == 200, r.text
        booking = r.json()
        return {
            "customer": c, "booking": booking, "category": cat,
            "c_mobile": c_mobile,
        }

    def test_booking_auto_assigned(self, session, state):
        b = state["booking"]
        assert b["status"] == "worker_assigned"
        assert b["worker_id"] is not None
        assert "completion_pin" in b and len(b["completion_pin"]) == 4

    def test_customer_notifications_received(self, session, state):
        r = session.get(f"{API}/notifications/me", headers=auth(state["customer"]["token"]))
        assert r.status_code == 200
        notifs = r.json()
        # Should have at least Booking Created + Worker Assigned
        titles = [n["title"] for n in notifs]
        assert "Booking Created" in titles
        assert "Worker Assigned" in titles

    def test_my_bookings_customer(self, session, state):
        r = session.get(f"{API}/bookings/me", headers=auth(state["customer"]["token"]))
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert state["booking"]["id"] in ids

    def test_get_booking_attaches_worker_and_pin_visible(self, session, state):
        r = session.get(f"{API}/bookings/{state['booking']['id']}",
                        headers=auth(state["customer"]["token"]))
        assert r.status_code == 200
        b = r.json()
        assert "worker" in b and b["worker"]["id"]
        assert "completion_pin" in b  # customer sees PIN

    def test_worker_login_and_jobs_hide_pin(self, session, state):
        # We need to login as the assigned worker (seeded). Find the worker doc mobile.
        wid = state["booking"]["worker_id"]
        # We can hit /api/workers/{id} to get mobile
        wr = session.get(f"{API}/workers/{wid}")
        assert wr.status_code == 200
        wmobile = wr.json()["mobile"]
        # Worker login with that mobile + role worker. NOTE: seeded workers have no E.164 prefix
        wlogin = _login(session, wmobile, "worker")
        state["worker_token"] = wlogin["token"]
        state["worker_id"] = wid
        # GET bookings/me as worker
        r = session.get(f"{API}/bookings/me", headers=auth(wlogin["token"]))
        assert r.status_code == 200
        wbookings = [b for b in r.json() if b["id"] == state["booking"]["id"]]
        assert wbookings, "Worker should see assigned booking"
        assert "completion_pin" not in wbookings[0]

    def test_get_booking_as_worker_no_pin(self, session, state):
        r = session.get(f"{API}/bookings/{state['booking']['id']}",
                        headers=auth(state["worker_token"]))
        assert r.status_code == 200
        b = r.json()
        assert "completion_pin" not in b
        assert "customer" in b  # worker sees customer info

    def test_worker_accept(self, session, state):
        r = session.patch(f"{API}/bookings/{state['booking']['id']}/accept",
                          headers=auth(state["worker_token"]))
        assert r.status_code == 200, r.text
        # verify by GET
        b = session.get(f"{API}/bookings/{state['booking']['id']}",
                        headers=auth(state["customer"]["token"])).json()
        assert b["status"] == "worker_accepted"

    def test_worker_start(self, session, state):
        r = session.patch(f"{API}/bookings/{state['booking']['id']}/start",
                          headers=auth(state["worker_token"]))
        assert r.status_code == 200
        b = session.get(f"{API}/bookings/{state['booking']['id']}",
                        headers=auth(state["customer"]["token"])).json()
        assert b["status"] == "in_progress"

    def test_verify_pin_wrong_returns_400(self, session, state):
        r = session.post(f"{API}/bookings/{state['booking']['id']}/verify-pin",
                         headers=auth(state["worker_token"]), json={"pin": "0000"})
        assert r.status_code == 400

    def test_verify_pin_correct_completes_and_increments(self, session, state):
        # Get PIN from customer view
        b = session.get(f"{API}/bookings/{state['booking']['id']}",
                        headers=auth(state["customer"]["token"])).json()
        pin = b["completion_pin"]
        # Get worker completed_jobs before
        wbefore = session.get(f"{API}/workers/{state['worker_id']}").json()
        before = wbefore.get("completed_jobs", 0)

        r = session.post(f"{API}/bookings/{state['booking']['id']}/verify-pin",
                         headers=auth(state["worker_token"]), json={"pin": pin})
        assert r.status_code == 200, r.text
        # Verify status
        b2 = session.get(f"{API}/bookings/{state['booking']['id']}",
                         headers=auth(state["customer"]["token"])).json()
        assert b2["status"] == "completed"
        # Verify increment
        wafter = session.get(f"{API}/workers/{state['worker_id']}").json()
        assert wafter["completed_jobs"] == before + 1

    def test_rate_after_completion(self, session, state):
        r = session.post(f"{API}/bookings/{state['booking']['id']}/rate",
                         headers=auth(state["customer"]["token"]),
                         json={"stars": 5, "review": "Great service"})
        assert r.status_code == 200
        b = session.get(f"{API}/bookings/{state['booking']['id']}",
                        headers=auth(state["customer"]["token"])).json()
        assert b["rating"] == 5
        assert b["review"] == "Great service"

    def test_rate_before_completion_returns_400(self, session, state):
        # Create new booking
        body = {
            "name": "TEST_2", "mobile": state["c_mobile"],
            "address": "Addr 2", "category_id": state["category"]["id"],
            "problem": "x", "schedule_type": "now",
        }
        r = session.post(f"{API}/bookings", headers=auth(state["customer"]["token"]), json=body)
        bid = r.json()["id"]
        rr = session.post(f"{API}/bookings/{bid}/rate",
                          headers=auth(state["customer"]["token"]),
                          json={"stars": 4})
        assert rr.status_code == 400


# ----------------- Chat -----------------
class TestChat:
    @pytest.fixture(scope="class")
    def chat_state(self, session):
        c_mobile = f"+9198763{uuid.uuid4().int % 100000:05d}"
        c = _login(session, c_mobile, "customer", name="TEST_ChatC")
        cats = session.get(f"{API}/categories").json()
        cat = cats[0]
        body = {"name": "T", "mobile": c_mobile, "address": "A",
                "category_id": cat["id"], "problem": "p", "schedule_type": "now"}
        r = session.post(f"{API}/bookings", headers=auth(c["token"]), json=body)
        booking = r.json()
        wid = booking["worker_id"]
        wmobile = session.get(f"{API}/workers/{wid}").json()["mobile"]
        w = _login(session, wmobile, "worker")
        return {"customer": c, "worker": w, "booking": booking}

    def test_send_and_list_messages(self, session, chat_state):
        bid = chat_state["booking"]["id"]
        # send from customer
        r = session.post(f"{API}/chat/{bid}/messages",
                         headers=auth(chat_state["customer"]["token"]),
                         json={"text": "Hello worker"})
        assert r.status_code == 200, r.text
        time.sleep(0.5)
        # send from worker
        r2 = session.post(f"{API}/chat/{bid}/messages",
                          headers=auth(chat_state["worker"]["token"]),
                          json={"text": "Hi customer"})
        assert r2.status_code == 200
        # list
        r3 = session.get(f"{API}/chat/{bid}/messages",
                         headers=auth(chat_state["customer"]["token"]))
        assert r3.status_code == 200
        msgs = r3.json()
        assert len(msgs) >= 2
        # chronological
        assert msgs[0]["text"] == "Hello worker"
        assert msgs[1]["text"] == "Hi customer"

    def test_chat_forbidden_for_stranger(self, session, chat_state):
        # create another customer not part of the booking
        m = f"+9198764{uuid.uuid4().int % 100000:05d}"
        stranger = _login(session, m, "customer", name="TEST_Stranger")
        r = session.get(f"{API}/chat/{chat_state['booking']['id']}/messages",
                        headers=auth(stranger["token"]))
        assert r.status_code == 403

    def test_chat_since_filter(self, session, chat_state):
        bid = chat_state["booking"]["id"]
        # send a fresh message
        time.sleep(1)
        from datetime import datetime, timezone
        cutoff = datetime.now(timezone.utc).isoformat()
        time.sleep(0.5)
        session.post(f"{API}/chat/{bid}/messages",
                     headers=auth(chat_state["customer"]["token"]),
                     json={"text": "after cutoff"})
        # Use params= so requests URL-encodes '+' in +00:00 as %2B
        r = session.get(f"{API}/chat/{bid}/messages",
                        params={"since": cutoff},
                        headers=auth(chat_state["customer"]["token"]))
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) == 1, f"Expected 1 message after cutoff, got {len(msgs)}"
        assert msgs[0]["text"] == "after cutoff"


# ----------------- Cancellation -----------------
class TestCancellation:
    def test_cancel_booking(self, session, customer):
        cats = session.get(f"{API}/categories").json()
        body = {"name": "T", "mobile": customer["mobile"], "address": "A",
                "category_id": cats[0]["id"], "problem": "p", "schedule_type": "now"}
        r = session.post(f"{API}/bookings", headers=auth(customer["token"]), json=body)
        bid = r.json()["id"]
        rc = session.patch(f"{API}/bookings/{bid}/cancel",
                           headers=auth(customer["token"]),
                           json={"reason": "Not needed"})
        assert rc.status_code == 200
        b = session.get(f"{API}/bookings/{bid}", headers=auth(customer["token"])).json()
        assert b["status"] == "cancelled"
        assert b["cancelled_by"] == "customer"
        assert b["cancellation_reason"] == "Not needed"


# ----------------- Worker endpoints -----------------
class TestWorkerEndpoints:
    def test_worker_jobs_forbidden_for_customer(self, session, customer):
        r = session.get(f"{API}/worker/jobs", headers=auth(customer["token"]))
        assert r.status_code == 403

    def test_worker_earnings_returns_fields(self, session):
        # Use a seeded worker
        wlist = session.get(f"{API}/workers").json()
        assert wlist
        wmobile = wlist[0]["mobile"]
        w = _login(session, wmobile, "worker")
        r = session.get(f"{API}/worker/earnings", headers=auth(w["token"]))
        assert r.status_code == 200
        j = r.json()
        for k in ("completed_jobs", "total_earnings", "this_week", "rating"):
            assert k in j

    def test_worker_jobs_no_pin(self, session):
        wlist = session.get(f"{API}/workers").json()
        wmobile = wlist[0]["mobile"]
        w = _login(session, wmobile, "worker")
        r = session.get(f"{API}/worker/jobs", headers=auth(w["token"]))
        assert r.status_code == 200
        for j in r.json():
            assert "completion_pin" not in j


# ----------------- Notifications -----------------
class TestNotifications:
    def test_list_mark_read_all(self, session, customer):
        # ensure at least one notification by creating a booking
        cats = session.get(f"{API}/categories").json()
        body = {"name": "T", "mobile": customer["mobile"], "address": "A",
                "category_id": cats[0]["id"], "problem": "p", "schedule_type": "now"}
        session.post(f"{API}/bookings", headers=auth(customer["token"]), json=body)

        r = session.get(f"{API}/notifications/me", headers=auth(customer["token"]))
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        # mark one read
        r2 = session.patch(f"{API}/notifications/{items[0]['id']}/read",
                           headers=auth(customer["token"]))
        assert r2.status_code == 200
        # read all
        r3 = session.post(f"{API}/notifications/read-all", headers=auth(customer["token"]))
        assert r3.status_code == 200
        # Verify all read
        items2 = session.get(f"{API}/notifications/me", headers=auth(customer["token"])).json()
        assert all(n["read"] for n in items2)


# ----------------- Addresses -----------------
class TestAddresses:
    def test_address_crud_scoped(self, session, customer):
        # Create
        r = session.post(f"{API}/addresses", headers=auth(customer["token"]),
                         json={"label": "Home", "line": "TEST_Addr", "landmark": "near temple"})
        assert r.status_code == 200
        aid = r.json()["id"]
        # List - should contain it
        r2 = session.get(f"{API}/addresses", headers=auth(customer["token"]))
        assert r2.status_code == 200
        assert any(a["id"] == aid for a in r2.json())
        # Another user should not see it
        m = f"+9198768{uuid.uuid4().int % 100000:05d}"
        other = _login(session, m, "customer")
        r3 = session.get(f"{API}/addresses", headers=auth(other["token"]))
        assert r3.status_code == 200
        assert all(a["id"] != aid for a in r3.json())
        # Delete
        rd = session.delete(f"{API}/addresses/{aid}", headers=auth(customer["token"]))
        assert rd.status_code == 200
        # Verify
        r4 = session.get(f"{API}/addresses", headers=auth(customer["token"]))
        assert all(a["id"] != aid for a in r4.json())


# ----------------- Profile -----------------
class TestProfile:
    def test_profile_update_allowed_fields(self, session):
        # Use a fresh worker so we can toggle available
        m = f"+9199992{uuid.uuid4().int % 100000:05d}"
        w = _login(session, m, "worker", name="TEST_P")
        r = session.patch(f"{API}/profile", headers=auth(w["token"]),
                          json={"name": "TEST_Updated", "available": False, "evil": "should_ignore"})
        assert r.status_code == 200
        j = r.json()
        assert j["name"] == "TEST_Updated"
        assert j["available"] is False
        assert "evil" not in j
