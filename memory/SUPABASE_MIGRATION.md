# FixPados → Supabase Migration Playbook

A complete plan to move FixPados off Emergent's MongoDB+FastAPI runtime to **Supabase (Postgres + Auth + Realtime + Storage)** with the frontend deployed on **Vercel** as an Expo for Web build (and the same codebase used for the Android APK via EAS).

This doc is fully self-contained. Execute it in a new GitHub repo cloned from the existing Emergent project.

---

## 0. Architecture (target)

```
[Customer App / Worker App / Admin Panel]  (Expo + React Native, same codebase)
                  │
                  ├── Supabase Auth (phone OTP)
                  ├── Supabase Postgres (RLS-protected tables)
                  ├── Supabase Storage (private bucket "kyc")
                  ├── Supabase Realtime (chats + booking status)
                  │
Hosting:  Expo for Web  →  Vercel
APK:      EAS Build  →  Android APK (no Play Store)
```

No FastAPI server. All business logic lives in:
- **Postgres RLS policies** for read/write authorization
- **Postgres functions / triggers** for state machine + PIN verification + audit logs
- **Supabase Edge Functions** for: send-OTP via Twilio (if needed), worker auto-assign, banner image upload validation

---

## 1. Supabase project setup

1. Create project at https://supabase.com (region: Mumbai/`ap-south-1`)
2. Note the **Project URL** and **anon key** + **service role key**
3. Enable **Phone auth** under `Authentication → Providers → Phone` (Twilio Verify)
4. Create Storage buckets: `kyc` (private), `banners` (public), `category-icons` (public)

---

## 2. Database schema (run in SQL editor)

```sql
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- USERS (mirrors auth.users + role/profile)
create table public.users (
  id uuid primary key references auth.users on delete cascade,
  mobile text not null unique,
  role text not null check (role in ('customer','worker','admin')),
  name text,
  photo text,
  created_at timestamptz default now()
);

-- WORKERS (extends users for role='worker')
create table public.workers (
  user_id uuid primary key references public.users on delete cascade,
  categories uuid[] default '{}',
  kyc_status text default 'pending' check (kyc_status in ('pending','submitted','approved','rejected')),
  rejection_reason text,
  rating numeric(3,2) default 0,
  completed_jobs int default 0,
  available bool default true,
  kyc_submitted_at timestamptz,
  kyc_reviewed_at timestamptz
);

-- WORKER_DOCUMENTS (file paths in Storage; never URLs)
create table public.worker_documents (
  id uuid primary key default uuid_generate_v4(),
  worker_id uuid references public.workers(user_id) on delete cascade,
  doc_type text check (doc_type in ('aadhaar_front','aadhaar_back','skill_certificate')),
  storage_path text not null,        -- e.g. kyc/<worker_id>/aadhaar_front.jpg
  mime text not null check (mime in ('image/jpeg','image/png','application/pdf')),
  size_bytes int not null check (size_bytes <= 5*1024*1024),
  created_at timestamptz default now()
);

-- SERVICES (= categories)
create table public.services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  icon text default 'tool',
  icon_image text,
  active bool default true,
  created_at timestamptz default now()
);

-- BANNERS
create table public.banners (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text default '',
  image text default '',
  active bool default true,
  created_at timestamptz default now()
);

-- ADDRESSES
create table public.addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users on delete cascade,
  label text default 'Home',
  line text not null,
  landmark text default '',
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now()
);

-- BOOKINGS
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.users not null,
  worker_id uuid references public.users,
  service_id uuid references public.services not null,
  name text, mobile text, address text not null, landmark text,
  problem text,
  latitude double precision, longitude double precision,
  schedule_type text check (schedule_type in ('now','later')) default 'now',
  time_slot text, scheduled_date date,
  status text default 'created'
    check (status in ('created','worker_assigned','worker_accepted','in_progress','completed','cancelled')),
  completion_pin text not null,            -- 4 digits, never SELECTable to worker
  pin_attempts int default 0,
  created_at timestamptz default now(),
  assigned_at timestamptz, accepted_at timestamptz, started_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz
);

-- CHATS (one per booking, implicit, no extra row needed) — use messages directly
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references public.bookings on delete cascade,
  sender_id uuid references public.users,
  sender_role text,
  text text not null check (length(text) <= 1000),
  created_at timestamptz default now()
);

-- RATINGS
create table public.ratings (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references public.bookings on delete cascade unique,
  customer_id uuid references public.users,
  worker_id uuid references public.users,
  stars int check (stars between 1 and 5),
  review text,
  created_at timestamptz default now()
);

-- EARNINGS (computed view also acceptable)
create table public.earnings (
  id uuid primary key default uuid_generate_v4(),
  worker_id uuid references public.users,
  booking_id uuid references public.bookings on delete cascade,
  amount numeric(10,2) not null,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users,
  title text, body text,
  booking_id uuid references public.bookings,
  read bool default false,
  created_at timestamptz default now()
);

-- CANCELLATIONS
create table public.cancellations (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references public.bookings on delete cascade,
  cancelled_by uuid references public.users,
  role text,
  reason text not null,
  created_at timestamptz default now()
);

-- AUDIT_LOGS
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users,
  action text not null,
  target_id uuid,
  meta jsonb default '{}',
  timestamp timestamptz default now()
);
```

---

## 3. Row-Level Security (RLS) policies

```sql
-- Enable RLS on every table
alter table public.users          enable row level security;
alter table public.workers        enable row level security;
alter table public.worker_documents enable row level security;
alter table public.services       enable row level security;
alter table public.banners        enable row level security;
alter table public.addresses      enable row level security;
alter table public.bookings       enable row level security;
alter table public.messages       enable row level security;
alter table public.ratings        enable row level security;
alter table public.earnings       enable row level security;
alter table public.notifications  enable row level security;
alter table public.cancellations  enable row level security;
alter table public.audit_logs     enable row level security;

-- Helper: is_admin
create or replace function public.is_admin() returns bool language sql security definer as $$
  select exists(select 1 from public.users where id = auth.uid() and role='admin')
$$;

-- USERS: read own, admin reads all
create policy users_self_read on public.users for select using (id = auth.uid() or is_admin());
create policy users_self_update on public.users for update using (id = auth.uid());

-- WORKERS: own read/write, admin all
create policy workers_own on public.workers for all using (user_id = auth.uid() or is_admin());

-- WORKER_DOCUMENTS: admin-only read, worker can insert own
create policy docs_admin_read on public.worker_documents for select using (is_admin());
create policy docs_worker_insert on public.worker_documents for insert
  with check (worker_id = auth.uid());

-- SERVICES + BANNERS: public read, admin write
create policy services_read on public.services for select using (true);
create policy services_write on public.services for all using (is_admin());
create policy banners_read on public.banners for select using (active = true or is_admin());
create policy banners_write on public.banners for all using (is_admin());

-- ADDRESSES: own
create policy addresses_own on public.addresses for all using (user_id = auth.uid());

-- BOOKINGS: customer owns + worker assigned + admin
create policy bookings_read on public.bookings for select using (
  customer_id = auth.uid() or worker_id = auth.uid() or is_admin()
);
create policy bookings_insert on public.bookings for insert
  with check (customer_id = auth.uid());
create policy bookings_update on public.bookings for update using (
  customer_id = auth.uid() or worker_id = auth.uid() or is_admin()
);

-- MESSAGES: only customer+worker on the booking
create policy messages_read on public.messages for select using (
  exists(select 1 from public.bookings b
         where b.id = booking_id
         and (b.customer_id = auth.uid() or b.worker_id = auth.uid()))
  or is_admin()
);
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid() and
  exists(select 1 from public.bookings b
         where b.id = booking_id
         and (b.customer_id = auth.uid() or b.worker_id = auth.uid()))
);

-- RATINGS: customer of the booking + admin
create policy ratings_rw on public.ratings for all using (
  customer_id = auth.uid() or is_admin()
);

-- EARNINGS: own worker + admin
create policy earnings_read on public.earnings for select using (
  worker_id = auth.uid() or is_admin()
);

-- NOTIFICATIONS: own
create policy notifications_own on public.notifications for all using (user_id = auth.uid() or is_admin());

-- CANCELLATIONS / AUDIT: admin only
create policy cancellations_admin on public.cancellations for select using (is_admin());
create policy audit_admin on public.audit_logs for select using (is_admin());
```

**Critical**: the `completion_pin` column on `bookings` should NEVER be exposed to workers. Use a Postgres function instead of direct SELECT, e.g. `verify_pin(booking_id, pin)` running as `security definer`, returning only `ok bool`.

---

## 4. Postgres functions (atomic state transitions + audit)

```sql
-- Verify PIN server-side (worker cannot bypass)
create or replace function public.verify_completion_pin(p_booking uuid, p_pin text)
returns jsonb language plpgsql security definer as $$
declare b record; result jsonb;
begin
  select * into b from public.bookings where id = p_booking;
  if b is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.worker_id <> auth.uid() then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if b.pin_attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
  if b.completion_pin <> p_pin then
    update public.bookings set pin_attempts = pin_attempts + 1 where id = p_booking;
    insert into public.audit_logs(user_id, action, target_id, meta)
      values (auth.uid(), 'pin_failed', p_booking, jsonb_build_object('attempts', b.pin_attempts + 1));
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update public.bookings set status='completed', completed_at=now() where id = p_booking;
  update public.workers set completed_jobs = completed_jobs + 1 where user_id = b.worker_id;
  insert into public.audit_logs(user_id, action, target_id) values (auth.uid(), 'pin_verified', p_booking);
  insert into public.audit_logs(user_id, action, target_id) values (auth.uid(), 'booking_completed', p_booking);
  return jsonb_build_object('ok', true);
end $$;

-- Booking create trigger → autogen pin + audit
create or replace function public.bookings_before_insert() returns trigger language plpgsql as $$
begin
  if new.completion_pin is null then
    new.completion_pin := lpad((floor(random()*10000))::text, 4, '0');
  end if;
  return new;
end $$;
create trigger trg_bookings_pin before insert on public.bookings
  for each row execute function public.bookings_before_insert();

create or replace function public.bookings_after_insert() returns trigger language plpgsql as $$
begin
  insert into public.audit_logs(user_id, action, target_id)
    values (new.customer_id, 'booking_created', new.id);
  return new;
end $$;
create trigger trg_bookings_audit after insert on public.bookings
  for each row execute function public.bookings_after_insert();
```

---

## 5. OTP rules (handled by Supabase Auth Phone)

Configure in Dashboard → Authentication → Providers → Phone:
- OTP length: **6**
- OTP expiry: **300 seconds (5 min)**
- Rate limit: **3/min** per phone number (Settings → Rate Limits)
- Max attempts: built-in lockout after 5 wrong tries
- Sessions: JWT, default 1h access + 30d refresh

**Use OTP only for**: registration, login, device change, account recovery.
**Do NOT** call `supabase.auth.signInWithOtp` for booking/chat/ratings/acceptance — those are protected by JWT sessions + RLS.

---

## 6. Storage rules (private KYC bucket)

```sql
-- kyc bucket: workers can insert, admins read; no public URLs
create policy kyc_worker_insert on storage.objects for insert
  with check (bucket_id = 'kyc' and auth.uid()::text = (storage.foldername(name))[1]);

create policy kyc_admin_read on storage.objects for select
  using (bucket_id = 'kyc' and public.is_admin());
```

Files stored at path `<worker_id>/aadhaar_front.jpg`. Always serve via **signed URLs** with short TTL (60s) from an Edge Function — never `getPublicUrl`.

In the Expo app, validate MIME + size **before upload**:
```ts
if (!['image/jpeg','image/png','application/pdf'].includes(file.mime)) throw …
if (file.size > 5 * 1024 * 1024) throw …
```

---

## 7. Realtime (chat + booking status)

```ts
// Subscribe to new messages in a booking
const channel = supabase
  .channel(`messages:${bookingId}`)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
      (payload) => append(payload.new))
  .subscribe();

// Booking status changes
supabase.channel(`booking:${id}`)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
      (payload) => setBooking(payload.new))
  .subscribe();
```

No polling needed — RLS still applies, so non-participants get nothing.

---

## 8. Frontend changes (Expo app)

Replace `src/api.ts` (HTTP calls) with `src/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true } }
);

// OTP
export const sendOTP = (mobile: string) => supabase.auth.signInWithOtp({ phone: mobile });
export const verifyOTP = (mobile: string, code: string) =>
  supabase.auth.verifyOtp({ phone: mobile, token: code, type: 'sms' });

// Bookings
export const myBookings = () => supabase.from('bookings').select('*').order('created_at', { ascending: false });
export const createBooking = (b: any) => supabase.from('bookings').insert(b).select().single();
export const verifyPin = (bookingId: string, pin: string) =>
  supabase.rpc('verify_completion_pin', { p_booking: bookingId, p_pin: pin });
```

Everything else (screens, navigation, components) stays the same — they just consume Supabase calls instead of fetch.

---

## 9. Hosting

**Frontend (Vercel):**
1. In repo: `expo export --platform web`
2. Connect repo to Vercel, set:
   - Build: `npx expo export --platform web`
   - Output: `dist`
   - Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy — admin panel lives at `https://<your-domain>/admin/login`

**Android APK (EAS):**
```bash
npm i -g eas-cli
eas build --platform android --profile preview   # → standalone APK, no Play Store
```

---

## 10. Audit log events to emit
worker_approved · worker_rejected · booking_created · booking_cancelled · booking_completed · pin_verified · pin_failed · pin_locked · category_created/updated/deleted · banner_created/updated/deleted

All written from triggers or `security definer` functions so they can't be skipped client-side.

---

## 11. Sanity checks before launch
- [ ] RLS on every table (`select tablename, rowsecurity from pg_tables where schemaname='public';`)
- [ ] Anon key cannot read `worker_documents` or `audit_logs`
- [ ] `verify_completion_pin` is the ONLY way for a worker to complete a booking
- [ ] Storage `kyc/*` is private; no `getPublicUrl` calls in the codebase
- [ ] OTP: 5-min expiry + 3/min rate limit configured
- [ ] All endpoints require JWT (Supabase enforces this automatically when RLS is on)
