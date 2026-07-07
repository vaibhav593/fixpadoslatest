"""FixPados backend - Hyperlocal home services platform.

Roles: customer, worker, admin.
OTP login is mock by default; flip USE_TWILIO=true after adding Twilio creds.
"""
import logging
import os
import random
import string
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "fixpados-dev-secret-change-me")
JWT_ALG = "HS256"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

# Security limits.
PIN_MAX_ATTEMPTS = 5
FILE_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_DOC_MIMES = ("image/jpeg", "image/jpg", "image/png", "application/pdf")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="FixPados API")
api = APIRouter(prefix="/api")


# ----------------- Utilities -----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def clean(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = iso(v)
    return doc


def make_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role, "exp": now_utc() + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing auth token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


async def _push_notification(user_id: str, title: str, body: str, booking_id: Optional[str] = None):
    n = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "booking_id": booking_id,
        "read": False,
        "created_at": now_utc(),
    }
    await db.notifications.insert_one(n.copy())


async def audit(user_id: Optional[str], action: str, target_id: Optional[str] = None, meta: Optional[dict] = None):
    """Write to audit_logs. user_id may be None for system actions."""
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "target_id": target_id,
        "meta": meta or {},
        "timestamp": now_utc(),
    })


def validate_doc_base64(data: str, label: str):
    """Enforce 5 MB max + JPG/PNG/PDF MIME allow-list on base64 data URLs."""
    if not data:
        return
    if not data.startswith("data:"):
        raise HTTPException(400, f"{label}: invalid format (expected data URL)")
    try:
        header, b64 = data.split(",", 1)
        mime = header.split(":", 1)[1].split(";", 1)[0].lower()
    except Exception:
        raise HTTPException(400, f"{label}: invalid data URL")
    if mime not in ALLOWED_DOC_MIMES:
        raise HTTPException(400, f"{label}: type {mime} not allowed (JPG/PNG/PDF only)")
    # Base64 -> bytes length approx 3/4 * len(b64).
    approx = (len(b64) * 3) // 4
    if approx > FILE_MAX_BYTES:
        raise HTTPException(413, f"{label}: file exceeds 5 MB limit")


# ----------------- Models -----------------
class RegisterReq(BaseModel):
    """MVP registration: name + mobile + role. No OTP.

    Architecture note: when OTP/verification is re-introduced later, add an
    optional `otp` field here (or a sibling /auth/verify endpoint) and gate
    creation on its validity. The user model + JWT issuance stay unchanged.
    """
    name: str
    mobile: str
    role: Literal["customer", "worker"] = "customer"


class AdminLoginReq(BaseModel):
    password: str


class CategoryIn(BaseModel):
    name: str
    icon: str = "tool"
    icon_image: Optional[str] = ""  # base64 data URL (optional)
    active: bool = True


class BannerIn(BaseModel):
    title: str
    subtitle: str = ""
    image: str = ""  # base64 data URL
    active: bool = True


class AddressIn(BaseModel):
    label: str
    line: str
    landmark: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class BookingIn(BaseModel):
    name: str
    mobile: str
    address: str
    pincode: str
    landmark: Optional[str] = ""
    category_id: str
    problem: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    schedule_type: Literal["now", "later"] = "now"
    time_slot: Optional[str] = None
    scheduled_date: Optional[str] = None


class ServiceAreaIn(BaseModel):
    name: str
    pincode: str
    city: str
    radius_km: Optional[float] = None
    enabled: bool = True


class ServiceAreaPatch(BaseModel):
    name: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    radius_km: Optional[float] = None
    enabled: Optional[bool] = None


class ReasonReq(BaseModel):
    reason: str


class PinReq(BaseModel):
    pin: str


class RateReq(BaseModel):
    stars: int
    review: Optional[str] = ""


class MessageIn(BaseModel):
    text: str


class AssignWorkerReq(BaseModel):
    worker_id: str


class WorkerKycReq(BaseModel):
    # Required identity + contact.
    email: str
    # Full address block.
    full_address: str
    city: str
    state: str
    pincode: str
    # Work profile.
    experience: str  # e.g. "0-1 years", "5+ years", or free text
    # Documents (all mandatory).
    photo: str  # profile photo
    live_selfie: str
    aadhaar_front: str
    aadhaar_back: str
    # Skills.
    categories: List[str]
    # Optional.
    skill_certificate: Optional[str] = ""


class RejectKycReq(BaseModel):
    reason: str


# ----------------- Auth -----------------
@api.post("/auth/register")
async def register(req: RegisterReq):
    """MVP onboarding: create (or re-issue token for) a user from name + mobile.

    No OTP, no verification. Idempotent by (mobile, role): if a user already
    exists, we just hand back a fresh JWT — this powers "auto-login on future
    launches" when the client retries with the same mobile.
    """
    name = (req.name or "").strip()
    mobile = (req.mobile or "").strip()
    if len(name) < 2:
        raise HTTPException(400, "Full name is required")
    if len(mobile) < 6:
        raise HTTPException(400, "Mobile number is required")

    user = await db.users.find_one({"mobile": mobile, "role": req.role}, {"_id": 0})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "mobile": mobile,
            "role": req.role,
            "name": name,
            "created_at": now_utc(),
        }
        if req.role == "worker":
            user.update({
                "kyc_status": "pending",
                "kyc_docs": {},
                "rejection_reason": None,
                "verified": False,
                "rating": 0,
                "completed_jobs": 0,
                "categories": [],
                "photo": "",
                "available": True,
                # Verification system (canonical) — kept in sync with kyc_status.
                "verification_status": "pending_verification",
                "verification_date": now_utc(),
                "approved_date": None,
                "rejected_date": None,
            })
        await db.users.insert_one(user.copy())
        await audit(user["id"], "user_registered", user["id"], {"role": req.role})
    else:
        # Update the saved name if the user re-registers with a new one.
        if user.get("name") != name:
            await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})
            user["name"] = name

    user = clean(user)
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": user}


@api.post("/auth/admin-login")
async def admin_login(req: AdminLoginReq):
    if req.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid admin password")
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if not admin:
        admin = {
            "id": str(uuid.uuid4()),
            "mobile": "admin",
            "role": "admin",
            "name": "Admin",
            "created_at": now_utc(),
        }
        await db.users.insert_one(admin.copy())
    admin = clean(admin)
    token = make_token(admin["id"], "admin")
    await audit(admin["id"], "admin_login")
    return {"token": token, "user": admin}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return clean(user)


# ----------------- Categories -----------------
@api.get("/categories")
async def list_categories(active_only: bool = False):
    q = {"active": True} if active_only else {}
    items = await db.categories.find(q, {"_id": 0}).sort("name", 1).to_list(200)
    return items


@api.post("/categories")
async def create_category(body: CategoryIn, user=Depends(require_admin)):
    cat = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_utc()}
    await db.categories.insert_one(cat.copy())
    await audit(user["id"], "category_created", cat["id"], {"name": body.name})
    return clean(cat)


@api.patch("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, user=Depends(require_admin)):
    await db.categories.update_one({"id": cid}, {"$set": body.dict()})
    cat = await db.categories.find_one({"id": cid}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Not found")
    return cat


@api.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(require_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# ────────────────────────────────────────────────────────────────
# Service areas — admin CRUD + public check
# ────────────────────────────────────────────────────────────────
def _validate_pincode(p: str) -> str:
    p = (p or "").strip()
    if not p.isdigit() or len(p) != 6:
        raise HTTPException(400, "Pincode must be a 6-digit number")
    return p


@api.get("/service-areas/check")
async def service_area_check(pincode: str):
    """Public endpoint — customer app pre-checks whether a pincode is serviced."""
    p = _validate_pincode(pincode)
    area = await _service_area_for_pincode(p)
    if not area:
        return {"serviced": False}
    return {"serviced": True, "area": clean(area)}


@api.get("/admin/service-areas")
async def list_service_areas(user=Depends(require_admin)):
    items = await db.service_areas.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [clean(i) for i in items]


@api.get("/admin/service-areas/{sid}/stats")
async def service_area_stats(sid: str, user=Depends(require_admin)):
    area = await db.service_areas.find_one({"id": sid}, {"_id": 0})
    if not area:
        raise HTTPException(404, "Service area not found")
    customers = await db.users.count_documents({"role": "customer", "pincode": area["pincode"]})
    bookings = await db.bookings.count_documents({"pincode": area["pincode"]})
    workers = await db.users.count_documents({"role": "worker", "pincode": area["pincode"]})
    return {"customers": customers, "bookings": bookings, "workers": workers}


@api.post("/admin/service-areas")
async def create_service_area(body: ServiceAreaIn, user=Depends(require_admin)):
    p = _validate_pincode(body.pincode)
    name = (body.name or "").strip()
    city = (body.city or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    if not city:
        raise HTTPException(400, "City is required")
    existing = await db.service_areas.find_one({"pincode": p})
    if existing:
        raise HTTPException(400, f"A service area for pincode {p} already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "pincode": p,
        "city": city,
        "radius_km": body.radius_km,
        "enabled": body.enabled,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.service_areas.insert_one(doc.copy())
    await audit(user["id"], "service_area_created", doc["id"], {"name": name, "pincode": p})
    return clean(doc)


@api.patch("/admin/service-areas/{sid}")
async def update_service_area(sid: str, body: ServiceAreaPatch, user=Depends(require_admin)):
    area = await db.service_areas.find_one({"id": sid}, {"_id": 0})
    if not area:
        raise HTTPException(404, "Service area not found")
    update: dict = {"updated_at": now_utc()}
    if body.name is not None:
        n = body.name.strip()
        if not n:
            raise HTTPException(400, "Name cannot be empty")
        update["name"] = n
    if body.pincode is not None:
        p = _validate_pincode(body.pincode)
        clash = await db.service_areas.find_one({"pincode": p, "id": {"$ne": sid}})
        if clash:
            raise HTTPException(400, f"A service area for pincode {p} already exists")
        update["pincode"] = p
    if body.city is not None:
        c = body.city.strip()
        if not c:
            raise HTTPException(400, "City cannot be empty")
        update["city"] = c
    if body.radius_km is not None:
        update["radius_km"] = body.radius_km
    if body.enabled is not None:
        update["enabled"] = body.enabled
    await db.service_areas.update_one({"id": sid}, {"$set": update})
    await audit(user["id"], "service_area_updated", sid, update)
    out = await db.service_areas.find_one({"id": sid}, {"_id": 0})
    return clean(out)


@api.delete("/admin/service-areas/{sid}")
async def delete_service_area(sid: str, user=Depends(require_admin)):
    res = await db.service_areas.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Service area not found")
    await audit(user["id"], "service_area_deleted", sid)
    return {"ok": True}


# ----------------- Banners -----------------
@api.get("/banners/active")
async def active_banner():
    b = await db.banners.find_one({"active": True}, {"_id": 0}, sort=[("created_at", -1)])
    return b or {}


@api.get("/banners")
async def list_banners(user=Depends(require_admin)):
    items = await db.banners.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for it in items:
        clean(it)
    return items


@api.post("/banners")
async def create_banner(body: BannerIn, user=Depends(require_admin)):
    if body.image:
        validate_doc_base64(body.image, "Banner image")
    b = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_utc()}
    await db.banners.insert_one(b.copy())
    await audit(user["id"], "banner_created", b["id"], {"title": body.title})
    return clean(b)


@api.patch("/banners/{bid}")
async def update_banner(bid: str, body: BannerIn, user=Depends(require_admin)):
    if body.image:
        validate_doc_base64(body.image, "Banner image")
    await db.banners.update_one({"id": bid}, {"$set": body.dict()})
    await audit(user["id"], "banner_updated", bid)
    b = await db.banners.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    return clean(b)


@api.delete("/banners/{bid}")
async def delete_banner(bid: str, user=Depends(require_admin)):
    await db.banners.delete_one({"id": bid})
    await audit(user["id"], "banner_deleted", bid)
    return {"ok": True}


@api.get("/admin/audit-logs")
async def list_audit_logs(limit: int = 200, user=Depends(require_admin)):
    items = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(min(limit, 500))
    for it in items:
        clean(it)
    return items


# ----------------- Workers -----------------
@api.get("/workers")
async def list_workers(category_id: Optional[str] = None):
    # Security: only approved workers are visible to customers / booking flows.
    q = {"role": "worker", "kyc_status": "approved"}
    if category_id:
        q["categories"] = category_id
    workers = await db.users.find(q, {"_id": 0}).to_list(200)
    return workers


@api.get("/workers/{wid}")
async def get_worker(wid: str):
    w = await db.users.find_one({"id": wid, "role": "worker"}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Worker not found")
    return w


@api.post("/worker/upload-kyc")
async def upload_kyc(body: WorkerKycReq, user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    # ---- Field validation ----
    if not (body.email or "").strip() or "@" not in body.email:
        raise HTTPException(400, "Valid email is required")
    if not (body.full_address or "").strip():
        raise HTTPException(400, "Full address is required")
    if not (body.city or "").strip():
        raise HTTPException(400, "City is required")
    if not (body.state or "").strip():
        raise HTTPException(400, "State is required")
    pincode = (body.pincode or "").strip()
    if not pincode.isdigit() or len(pincode) != 6:
        raise HTTPException(400, "Pincode must be a 6-digit number")
    if not (body.experience or "").strip():
        raise HTTPException(400, "Experience is required")
    if not body.categories:
        raise HTTPException(400, "Select at least one service category")
    # ---- Document validation (all mandatory) ----
    if not body.photo:
        raise HTTPException(400, "Profile photo is required")
    validate_doc_base64(body.photo, "Profile photo")
    if not body.live_selfie:
        raise HTTPException(400, "Live selfie is required")
    validate_doc_base64(body.live_selfie, "Live selfie")
    if not body.aadhaar_front:
        raise HTTPException(400, "Aadhaar front is required")
    validate_doc_base64(body.aadhaar_front, "Aadhaar front")
    if not body.aadhaar_back:
        raise HTTPException(400, "Aadhaar back is required")
    validate_doc_base64(body.aadhaar_back, "Aadhaar back")
    if body.skill_certificate:
        validate_doc_base64(body.skill_certificate, "Skill certificate")

    update = {
        "email": body.email.strip(),
        "full_address": body.full_address.strip(),
        "city": body.city.strip(),
        "state": body.state.strip(),
        "pincode": pincode,
        "experience": body.experience.strip(),
        "categories": body.categories,
        "photo": body.photo,
        "live_selfie": body.live_selfie,
        "kyc_docs": {
            "aadhaar_front": body.aadhaar_front,
            "aadhaar_back": body.aadhaar_back,
            "skill_certificate": body.skill_certificate or "",
        },
        "kyc_status": "submitted",
        "kyc_submitted_at": now_utc(),
        "verification_status": "pending_verification",
        "verification_date": now_utc(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    await audit(user["id"], "worker_kyc_submitted", user["id"])
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return clean(u)


# ----------------- Worker management (admin) -----------------
@api.get("/admin/workers")
async def admin_workers(
    kyc_status: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(require_admin),
):
    q: Dict[str, Any] = {"role": "worker"}
    if kyc_status:
        if kyc_status == "pending_verification":
            # Consolidated bucket: pre-submission and submitted-but-unreviewed.
            q["kyc_status"] = {"$in": ["pending", "submitted"]}
        else:
            q["kyc_status"] = kyc_status
    if search and search.strip():
        s = search.strip()
        q["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"mobile": {"$regex": s, "$options": "i"}},
        ]
    items = await db.users.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in items:
        clean(it)
    return items


@api.post("/admin/workers/{wid}/approve")
async def approve_worker(wid: str, user=Depends(require_admin)):
    w = await db.users.find_one({"id": wid, "role": "worker"}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Worker not found")
    await db.users.update_one(
        {"id": wid},
        {"$set": {
            "kyc_status": "approved",
            "verified": True,
            "rejection_reason": None,
            "kyc_reviewed_at": now_utc(),
            "verification_status": "approved",
            "approved_date": now_utc(),
            "rejected_date": None,
        }},
    )
    await audit(user["id"], "worker_approved", wid)
    await _push_notification(wid, "You are verified ✓", "Your documents were approved. You can now receive jobs.")
    return {"ok": True}


@api.post("/admin/workers/{wid}/reject")
async def reject_worker(wid: str, body: RejectKycReq, user=Depends(require_admin)):
    w = await db.users.find_one({"id": wid, "role": "worker"}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Worker not found")
    await db.users.update_one(
        {"id": wid},
        {"$set": {
            "kyc_status": "rejected",
            "verified": False,
            "rejection_reason": body.reason,
            "kyc_reviewed_at": now_utc(),
            "verification_status": "rejected",
            "rejected_date": now_utc(),
            "approved_date": None,
        }},
    )
    await audit(user["id"], "worker_rejected", wid, {"reason": body.reason})
    await _push_notification(wid, "Verification Rejected", body.reason or "Please update your details and resubmit.")
    return {"ok": True}


@api.post("/worker/resubmit")
async def worker_resubmit(user=Depends(get_current_user)):
    """Worker re-enters the verification queue after rejection."""
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    if user.get("verification_status") not in ("rejected", "approved"):
        # Already pending — no-op (idempotent).
        return {"ok": True}
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "kyc_status": "pending",
            "verification_status": "pending_verification",
            "verification_date": now_utc(),
            "rejection_reason": None,
            "rejected_date": None,
            "approved_date": None,
            "verified": False,
        }},
    )
    await audit(user["id"], "worker_resubmitted", user["id"])
    return {"ok": True}


# ----------------- Bookings -----------------
async def _service_area_for_pincode(pincode: str) -> Optional[dict]:
    """Return the enabled service area matching this pincode, else None."""
    return await db.service_areas.find_one(
        {"pincode": pincode, "enabled": True}, {"_id": 0}
    )


async def _auto_assign(booking: dict):
    """Pick an approved worker for the category **inside the same service area**.

    Rules:
    - Only workers with `kyc_status == "approved"` are ever considered.
    - The worker's stored `pincode` MUST equal the booking's `pincode` (no cross-area assignment).
    """
    booking_pincode = booking.get("pincode")
    if not booking_pincode:
        return None

    filters_base = {"role": "worker", "kyc_status": "approved", "pincode": booking_pincode}

    worker = await db.users.find_one(
        {**filters_base, "categories": booking["category_id"], "available": True},
        {"_id": 0},
    )
    if not worker:
        worker = await db.users.find_one(
            {**filters_base, "categories": booking["category_id"]}, {"_id": 0}
        )
    if not worker:
        worker = await db.users.find_one(filters_base, {"_id": 0})
    if not worker:
        return None
    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {"worker_id": worker["id"], "status": "worker_assigned", "assigned_at": now_utc()}},
    )
    await _push_notification(booking["customer_id"], "Worker Assigned",
                             f"{worker['name']} has been assigned to your booking.", booking["id"])
    await _push_notification(worker["id"], "New Job Assigned",
                             f"You have a new {booking['category_name']} job.", booking["id"])
    return worker["id"]


@api.post("/bookings")
async def create_booking(body: BookingIn, user=Depends(get_current_user)):
    category = await db.categories.find_one({"id": body.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(400, "Invalid category")
    # ---- Service area gate ----
    pincode = (body.pincode or "").strip()
    if not pincode.isdigit() or len(pincode) != 6:
        raise HTTPException(400, "Please enter a valid 6-digit pincode")
    area = await _service_area_for_pincode(pincode)
    if not area:
        raise HTTPException(400, "Sorry, services are currently unavailable in your area.")

    pin = "".join(random.choices(string.digits, k=4))
    booking = {
        "id": str(uuid.uuid4()),
        "customer_id": user["id"],
        "worker_id": None,
        "status": "created",
        "name": body.name,
        "mobile": body.mobile,
        "address": body.address,
        "pincode": pincode,
        "service_area_id": area["id"],
        "landmark": body.landmark,
        "category_id": body.category_id,
        "category_name": category["name"],
        "category_icon": category.get("icon", "tool"),
        "problem": body.problem,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "schedule_type": body.schedule_type,
        "time_slot": body.time_slot,
        "scheduled_date": body.scheduled_date,
        "completion_pin": pin,
        "created_at": now_utc(),
        "cancelled_by": None,
        "cancellation_reason": None,
        "cancelled_at": None,
        "rating": None,
        "review": None,
    }
    await db.bookings.insert_one(booking.copy())
    await audit(user["id"], "booking_created", booking["id"], {"category": category["name"]})
    await _push_notification(user["id"], "Booking Created",
                             f"Your {category['name']} booking is placed.", booking["id"])
    await _auto_assign(booking)
    out = await db.bookings.find_one({"id": booking["id"]}, {"_id": 0})
    return clean(out)


@api.get("/bookings/me")
async def my_bookings(user=Depends(get_current_user)):
    if user["role"] == "customer":
        items = await db.bookings.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    elif user["role"] == "worker":
        items = await db.bookings.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        items = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in items:
        clean(it)
        if user["role"] == "worker":
            it.pop("completion_pin", None)
    return items


@api.get("/bookings/{bid}")
async def get_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "customer" and b["customer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "worker" and b.get("worker_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    clean(b)
    if user["role"] == "worker":
        b.pop("completion_pin", None)
    if b.get("worker_id"):
        w = await db.users.find_one({"id": b["worker_id"]}, {"_id": 0})
        if w:
            b["worker"] = {
                "id": w["id"], "name": w["name"], "rating": w.get("rating", 0),
                "verified": w.get("verified", False) and w.get("kyc_status") == "approved",
                "completed_jobs": w.get("completed_jobs", 0),
                "photo": w.get("photo", ""), "categories": w.get("categories", []),
                "mobile": w.get("mobile"),
            }
    if user["role"] in ("worker", "admin"):
        c = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0})
        if c:
            b["customer"] = {"id": c["id"], "name": c["name"], "mobile": c.get("mobile")}
    return b


@api.patch("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, body: ReasonReq, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    is_owner = b["customer_id"] == user["id"] or b.get("worker_id") == user["id"]
    if not is_owner and user["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    if b["status"] in ("completed", "cancelled"):
        raise HTTPException(400, "Cannot cancel at this stage")
    if not (body.reason or "").strip():
        raise HTTPException(400, "Reason is required")
    await db.bookings.update_one({"id": bid}, {"$set": {
        "status": "cancelled",
        "cancelled_by": user["role"],
        "cancellation_reason": body.reason,
        "cancelled_at": now_utc(),
    }})
    await db.cancellations.insert_one({
        "id": str(uuid.uuid4()),
        "booking_id": bid,
        "cancelled_by": user["id"],
        "role": user["role"],
        "reason": body.reason,
        "created_at": now_utc(),
    })
    await audit(user["id"], "booking_cancelled", bid, {"reason": body.reason})
    await _push_notification(b["customer_id"], "Booking Cancelled", body.reason, bid)
    if b.get("worker_id"):
        await _push_notification(b["worker_id"], "Booking Cancelled", body.reason, bid)
    return {"ok": True}


@api.patch("/bookings/{bid}/reject")
async def worker_reject(bid: str, body: ReasonReq, user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b.get("worker_id") != user["id"]:
        raise HTTPException(404, "Job not found")
    if b["status"] not in ("worker_assigned",):
        raise HTTPException(400, "Can only reject newly assigned jobs")
    if not (body.reason or "").strip():
        raise HTTPException(400, "Reason is required")
    # Unassign so it can be reassigned to another worker
    await db.bookings.update_one(
        {"id": bid},
        {"$set": {
            "worker_id": None,
            "status": "created",
            "reassign_log": (b.get("reassign_log") or []) + [{
                "worker_id": user["id"],
                "action": "rejected",
                "reason": body.reason,
                "at": iso(now_utc()),
            }],
        }},
    )
    await _push_notification(b["customer_id"], "Worker Unavailable",
                             "We're finding another worker for you.", bid)
    # Try to reassign immediately to someone else
    new_booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    # Avoid picking same worker again by temporarily filtering
    worker = await db.users.find_one(
        {"role": "worker", "categories": new_booking["category_id"], "available": True,
         "kyc_status": "approved", "id": {"$ne": user["id"]}},
        {"_id": 0},
    )
    if worker:
        await db.bookings.update_one(
            {"id": bid},
            {"$set": {"worker_id": worker["id"], "status": "worker_assigned", "assigned_at": now_utc()}},
        )
        await _push_notification(b["customer_id"], "Worker Assigned",
                                 f"{worker['name']} has been assigned.", bid)
        await _push_notification(worker["id"], "New Job Assigned",
                                 f"You have a new {new_booking['category_name']} job.", bid)
    return {"ok": True}


@api.patch("/bookings/{bid}/accept")
async def worker_accept(bid: str, user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b.get("worker_id") != user["id"]:
        raise HTTPException(404, "Job not found")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "worker_accepted", "accepted_at": now_utc()}})
    await _push_notification(b["customer_id"], "Worker Accepted",
                             f"{user['name']} accepted your booking.", bid)
    return {"ok": True}


@api.patch("/bookings/{bid}/start")
async def worker_start(bid: str, user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b.get("worker_id") != user["id"]:
        raise HTTPException(404, "Job not found")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "in_progress", "started_at": now_utc()}})
    await _push_notification(b["customer_id"], "Service Started", "Your worker started the service.", bid)
    return {"ok": True}


@api.post("/bookings/{bid}/verify-pin")
async def verify_pin(bid: str, body: PinReq, user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b.get("worker_id") != user["id"]:
        raise HTTPException(404, "Job not found")
    if body.pin.strip() != b.get("completion_pin"):
        attempts = (b.get("pin_attempts") or 0) + 1
        await db.bookings.update_one({"id": bid}, {"$set": {"pin_attempts": attempts}})
        if attempts >= PIN_MAX_ATTEMPTS:
            await db.bookings.update_one(
                {"id": bid},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_by": "system",
                    "cancel_reason": "PIN attempts exceeded",
                    "cancelled_at": now_utc(),
                }},
            )
            await audit(user["id"], "pin_locked", bid, {"attempts": attempts})
            await audit(None, "booking_cancelled", bid, {"reason": "pin_attempts_exceeded", "by": "system"})
            await _push_notification(b["customer_id"], "Booking Cancelled",
                                     "Booking auto-cancelled after too many wrong PIN attempts.", bid)
            raise HTTPException(429, "Too many wrong PIN attempts. Booking cancelled.")
        await audit(user["id"], "pin_failed", bid, {"attempts": attempts})
        raise HTTPException(400, "Invalid PIN")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "completed", "completed_at": now_utc()}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"completed_jobs": 1}})
    await audit(user["id"], "pin_verified", bid)
    await audit(user["id"], "booking_completed", bid)
    await _push_notification(b["customer_id"], "Booking Completed", "Please rate your experience.", bid)
    return {"ok": True}


@api.post("/bookings/{bid}/rate")
async def rate_booking(bid: str, body: RateReq, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b["customer_id"] != user["id"]:
        raise HTTPException(404, "Booking not found")
    if b["status"] != "completed":
        raise HTTPException(400, "Rate after completion")
    stars = max(1, min(5, body.stars))
    await db.bookings.update_one({"id": bid}, {"$set": {"rating": stars, "review": body.review}})
    if b.get("worker_id"):
        # Average rating from all rated bookings for this worker.
        agg = await db.bookings.aggregate([
            {"$match": {"worker_id": b["worker_id"], "rating": {"$ne": None}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
        ]).to_list(1)
        if agg:
            await db.users.update_one({"id": b["worker_id"]},
                                      {"$set": {"rating": round(agg[0]["avg"], 2)}})
    return {"ok": True}


# ----------------- Worker dashboard -----------------
@api.get("/worker/jobs")
async def worker_jobs(user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    if user.get("kyc_status") != "approved":
        raise HTTPException(403, "Verification pending — you cannot access jobs yet.")
    items = await db.bookings.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for it in items:
        clean(it)
        it.pop("completion_pin", None)
    return items


@api.get("/worker/earnings")
async def worker_earnings(user=Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Worker only")
    if user.get("kyc_status") != "approved":
        raise HTTPException(403, "Verification pending — earnings unlock after approval.")
    completed = await db.bookings.count_documents({"worker_id": user["id"], "status": "completed"})
    available = await db.bookings.count_documents({"worker_id": user["id"], "status": "worker_assigned"})
    active = await db.bookings.count_documents({
        "worker_id": user["id"],
        "status": {"$in": ["worker_accepted", "in_progress"]},
    })
    return {
        "completed_jobs": completed,
        "available_jobs": available,
        "active_jobs": active,
        "total_earnings": completed * 350,
        "this_week": min(completed, 5) * 350,
        "rating": user.get("rating", 0),
    }


# ----------------- Chat -----------------
@api.get("/chat/{bid}/messages")
async def list_messages(bid: str, user=Depends(get_current_user), since: Optional[str] = None):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] != "admin" and user["id"] not in (b["customer_id"], b.get("worker_id")):
        raise HTTPException(403, "Not part of this booking")
    q = {"booking_id": bid}
    if since:
        s = since.replace(" ", "+").replace("Z", "+00:00")
        try:
            since_dt = datetime.fromisoformat(s)
            q["created_at"] = {"$gt": since_dt}
        except Exception:
            raise HTTPException(400, "Invalid `since` timestamp")
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    for m in msgs:
        clean(m)
    return msgs


@api.post("/chat/{bid}/messages")
async def send_message(bid: str, body: MessageIn, user=Depends(get_current_user)):
    if user["role"] == "admin":
        raise HTTPException(403, "Admin cannot send messages")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["id"] not in (b["customer_id"], b.get("worker_id")):
        raise HTTPException(403, "Not part of this booking")
    text = body.text.strip()[:1000]
    if not text:
        raise HTTPException(400, "Empty message")
    m = {
        "id": str(uuid.uuid4()),
        "booking_id": bid,
        "sender_id": user["id"],
        "sender_role": user["role"],
        "text": text,
        "created_at": now_utc(),
    }
    await db.messages.insert_one(m.copy())
    other = b["customer_id"] if user["id"] != b["customer_id"] else b.get("worker_id")
    if other:
        await _push_notification(other, "New Message", body.text[:50], bid)
    return clean(m)


# ----------------- Notifications -----------------
@api.get("/notifications/me")
async def my_notifications(user=Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for it in items:
        clean(it)
    return items


@api.patch("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ----------------- Profile + Addresses -----------------
@api.patch("/profile")
async def update_profile(body: dict, user=Depends(get_current_user)):
    allowed = {k: v for k, v in body.items() if k in ("name", "photo", "categories", "available")}
    if allowed:
        await db.users.update_one({"id": user["id"]}, {"$set": allowed})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return clean(u)


@api.get("/addresses")
async def list_addresses(user=Depends(get_current_user)):
    items = await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    for it in items:
        clean(it)
    return items


@api.post("/addresses")
async def add_address(body: AddressIn, user=Depends(get_current_user)):
    a = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.dict(), "created_at": now_utc()}
    await db.addresses.insert_one(a.copy())
    return clean(a)


@api.delete("/addresses/{aid}")
async def del_address(aid: str, user=Depends(get_current_user)):
    await db.addresses.delete_one({"id": aid, "user_id": user["id"]})
    return {"ok": True}


# ----------------- Admin dashboard / analytics -----------------
@api.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    return {
        "categories": await db.categories.count_documents({}),
        "customers": await db.users.count_documents({"role": "customer"}),
        "workers": await db.users.count_documents({"role": "worker"}),
        "active_workers": await db.users.count_documents({"role": "worker", "available": True, "kyc_status": "approved"}),
        "pending_kyc": await db.users.count_documents({"role": "worker", "kyc_status": "submitted"}),
        # Verification counters (the canonical three buckets).
        "pending_verification": await db.users.count_documents({"role": "worker", "kyc_status": {"$in": ["pending", "submitted"]}}),
        "approved_workers": await db.users.count_documents({"role": "worker", "kyc_status": "approved"}),
        "rejected_workers": await db.users.count_documents({"role": "worker", "kyc_status": "rejected"}),
        "bookings": await db.bookings.count_documents({}),
        "completed": await db.bookings.count_documents({"status": "completed"}),
        "cancelled": await db.bookings.count_documents({"status": "cancelled"}),
        "in_progress": await db.bookings.count_documents({"status": {"$in": ["worker_assigned", "worker_accepted", "in_progress"]}}),
    }


@api.get("/admin/bookings")
async def admin_bookings(status: Optional[str] = None, schedule_type: Optional[str] = None, user=Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    if schedule_type:
        q["schedule_type"] = schedule_type
    items = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in items:
        clean(it)
    return items


@api.patch("/admin/bookings/{bid}/assign-worker")
async def admin_assign_worker(bid: str, body: AssignWorkerReq, user=Depends(require_admin)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    w = await db.users.find_one({"id": body.worker_id, "role": "worker"}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Worker not found")
    if w.get("kyc_status") != "approved":
        raise HTTPException(400, "Only approved workers can be assigned")
    await db.bookings.update_one(
        {"id": bid},
        {"$set": {"worker_id": w["id"], "status": "worker_assigned", "assigned_at": now_utc()}},
    )
    await _push_notification(b["customer_id"], "Worker Assigned", f"{w['name']} has been assigned.", bid)
    await _push_notification(w["id"], "New Job Assigned",
                             f"You have a new {b['category_name']} job.", bid)
    return {"ok": True}


@api.get("/admin/analytics")
async def admin_analytics(user=Depends(require_admin)):
    # Category performance: completed counts grouped by category.
    cat_perf = await db.bookings.aggregate([
        {"$group": {"_id": "$category_name", "total": {"$sum": 1},
                    "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
                    "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}}}},
        {"$project": {"_id": 0, "category": "$_id", "total": 1, "completed": 1, "cancelled": 1}},
        {"$sort": {"total": -1}},
    ]).to_list(50)
    # Customer growth: daily new customers last 14 days.
    since = now_utc() - timedelta(days=14)
    growth_raw = await db.users.aggregate([
        {"$match": {"role": "customer", "created_at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]).to_list(50)
    growth = [{"date": g["_id"], "count": g["n"]} for g in growth_raw]
    total_bk = await db.bookings.count_documents({})
    cancelled = await db.bookings.count_documents({"status": "cancelled"})
    return {
        "category_performance": cat_perf,
        "customer_growth": growth,
        "cancellation_rate": round((cancelled / total_bk) * 100, 1) if total_bk else 0,
        "total_bookings": total_bk,
        "active_workers": await db.users.count_documents({"role": "worker", "available": True, "kyc_status": "approved"}),
    }


@api.get("/admin/chat/{bid}")
async def admin_read_chat(bid: str, user=Depends(require_admin)):
    msgs = await db.messages.find({"booking_id": bid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for m in msgs:
        clean(m)
    return msgs


@api.get("/")
async def root():
    return {"service": "FixPados API", "ok": True}


# ----------------- Seeders -----------------
DEFAULT_CATEGORIES = [
    {"name": "Electrician", "icon": "zap"},
    {"name": "Plumber", "icon": "droplet"},
    {"name": "Carpenter", "icon": "hammer"},
    {"name": "AC Repair", "icon": "wind"},
    {"name": "House Cleaning", "icon": "sparkles"},
]


async def seed_db():
    if await db.categories.count_documents({}) == 0:
        cats = [{"id": str(uuid.uuid4()), **c, "icon_image": "", "active": True, "created_at": now_utc()}
                for c in DEFAULT_CATEGORIES]
        await db.categories.insert_many([c.copy() for c in cats])
        logger.info(f"Seeded {len(cats)} categories")

    # Ensure existing categories have icon_image field (migration).
    await db.categories.update_many({"icon_image": {"$exists": False}}, {"$set": {"icon_image": ""}})

    if await db.users.count_documents({"role": "worker"}) == 0:
        cats = await db.categories.find({}, {"_id": 0}).to_list(20)
        names = ["Rajesh Kumar", "Suresh Mehta", "Amit Sharma"]
        photos = [
            "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400",
            "https://images.unsplash.com/photo-1649769069590-268b0b994462?w=400",
            "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400",
        ]
        for i, n in enumerate(names):
            w = {
                "id": str(uuid.uuid4()),
                "mobile": f"99999000{i+1}",
                "role": "worker",
                "name": n,
                "email": f"{n.split()[0].lower()}.demo@fixpados.com",
                "full_address": f"{i+1} Demo Street, Bandra",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400050",
                "experience": ["1-3 years", "3-5 years", "5+ years"][i % 3],
                "kyc_status": "approved",
                "kyc_docs": {},
                "live_selfie": photos[i],
                "rejection_reason": None,
                "verified": True,
                "rating": 4.5 + (i * 0.1),
                "completed_jobs": 50 + i * 20,
                "categories": [cats[i % len(cats)]["id"], cats[(i + 1) % len(cats)]["id"]],
                "photo": photos[i],
                "available": True,
                "created_at": now_utc(),
                "verification_status": "approved",
                "verification_date": now_utc(),
                "approved_date": now_utc(),
                "rejected_date": None,
            }
            await db.users.insert_one(w.copy())
        logger.info("Seeded demo workers")

    # Migrate workers missing kyc_status.
    await db.users.update_many(
        {"role": "worker", "kyc_status": {"$exists": False}},
        {"$set": {"kyc_status": "approved", "kyc_docs": {}, "rejection_reason": None}},
    )

    # Migrate seeded demo workers missing pincode (pre-service-areas seed).
    await db.users.update_many(
        {"role": "worker", "mobile": {"$in": ["999990001", "999990002", "999990003"]},
         "pincode": {"$exists": False}},
        {"$set": {"pincode": "400050"}},
    )

    # Migrate workers missing verification fields (verification system rollout).
    async for w in db.users.find({"role": "worker", "verification_status": {"$exists": False}}, {"_id": 0}):
        ks = w.get("kyc_status", "pending")
        if ks == "approved":
            vs, ad, rd = "approved", w.get("kyc_reviewed_at") or w.get("created_at") or now_utc(), None
        elif ks == "rejected":
            vs, ad, rd = "rejected", None, w.get("kyc_reviewed_at") or w.get("created_at") or now_utc()
        else:
            vs, ad, rd = "pending_verification", None, None
        await db.users.update_one(
            {"id": w["id"]},
            {"$set": {
                "verification_status": vs,
                "verification_date": w.get("created_at") or now_utc(),
                "approved_date": ad,
                "rejected_date": rd,
            }},
        )

    if await db.banners.count_documents({}) == 0:
        await db.banners.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Reliable Local Services At Your Doorstep",
            "subtitle": "Fast. Trusted. Verified.",
            "image": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400&q=80",
            "active": True,
            "created_at": now_utc(),
        })
        logger.info("Seeded default banner")

    if await db.service_areas.count_documents({}) == 0:
        await db.service_areas.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Bandra West",
            "pincode": "400050",
            "city": "Mumbai",
            "radius_km": 5.0,
            "enabled": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        })
        logger.info("Seeded default service area (Bandra West / 400050)")


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def on_startup():
    await seed_db()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
