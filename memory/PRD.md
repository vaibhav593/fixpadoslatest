# FixPados — Hyperlocal Home Services Platform (India)

## Vision
Connect customers with verified local workers (Electrician, Plumber, Carpenter, AC Repair, House Cleaning) and enable real-world bookings with a simple, scalable, low-cost architecture.

## MVP Scope (current build)
- Single Expo app with role-based experience: **Customer** and **Worker**
- **OTP-free MVP onboarding**: registration screen collects Full Name + Mobile, creates the user via `POST /api/auth/register`, and stores a 30-day JWT for auto-login on subsequent launches. OTP can be re-introduced later by adding an `otp` field to `RegisterReq` and gating on its validity — the user model and JWT issuance stay untouched.
- Database-driven service categories (admin can add / edit / toggle / delete)
- Booking flow: form → auto-assign nearest worker → status timeline → 4-digit completion PIN → ratings
- 1-to-1 text chat (polling every 3s)
- In-app notifications (no push)
- Profile + Saved Addresses + Booking History
- `expo-location` for current location + Google Maps deep-link (no API key needed)

## Architecture
- **Backend:** FastAPI (Python) + MongoDB (Motor async)
- **Auth:** JWT, 30-day session
- **Frontend:** Expo Router (file-based) + React Native + `react-native-keyboard-controller`
- All routes prefixed `/api/*`; CORS open for preview

## Roles
| Role | Tabs | Key actions |
|---|---|---|
| Customer | Home · Bookings · Chat · Alerts · Profile | Book, cancel, chat, rate, share PIN |
| Worker | Jobs · Earnings · Profile | Accept, start, navigate, enter PIN |
| Admin | (under Customer profile) | CRUD service categories |

## Booking status flow
`created → worker_assigned → worker_accepted → in_progress → completed`
With `cancelled` reachable from the first three.

## Key files
- `backend/server.py` — All API endpoints + seeders
- `frontend/app/index.tsx` — Splash + auth redirect
- `frontend/app/role.tsx` — Customer/Worker selector
- `frontend/app/login.tsx` & `verify.tsx` — OTP flow
- `frontend/app/(customer)/*` — Customer tabs
- `frontend/app/(worker)/*` — Worker tabs
- `frontend/app/booking/[id].tsx` & `new.tsx` — Booking detail & creation
- `frontend/app/worker-job/[id].tsx` — Worker job actions + PIN
- `frontend/app/chat/[bookingId].tsx` — 1-to-1 chat
- `frontend/app/admin.tsx` — Category management
- `frontend/src/api.ts` — Typed HTTP client
- `frontend/src/theme.ts` — Design tokens

## Seed data on startup
- 5 categories (Electrician, Plumber, Carpenter, AC Repair, House Cleaning)
- 3 demo workers (Rajesh Kumar, Suresh Mehta, Amit Sharma) with photos & ratings

## Updates (latest iteration)

- **Worker KYC**: pending → submitted → approved/rejected. Photo + multi-category + Aadhaar (front/back required) + skill certificate (optional). Verified badge ties to `kyc_status == approved`.
- **Worker actions**: reject (pre-accept, auto-reassigns) and cancel (with mandatory reason).
- **Admin Panel (web responsive)**: `/admin/login` (password `admin123`, configurable via `ADMIN_PASSWORD` env). Sections: Dashboard (8 KPIs), Workers (KYC review with image previews), Categories (icon upload), Banners (CRUD with image), Bookings (filters + assign/reassign + view chat transcript), Analytics (category performance bars + customer growth chart + cancellation rate).
- **Banners**: Customer home now fetches active banner from `/api/banners/active` (falls back to defaults). Admin can CRUD + activate/deactivate without app update.
- **APK build**: Use the **Publish** button in the top-right of Emergent to generate an Android APK — no Play Store needed.

## Admin credentials
- URL: `/admin/login` on the web preview
- Password: `admin123` (override via `ADMIN_PASSWORD` in `/app/backend/.env`)

## Status flow (extended)
`created → worker_assigned → worker_accepted → in_progress → completed`
With `cancelled` reachable from the first three (mandatory reason). Worker reject → `created` (auto-reassigned).
