#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Fix Worker Registration & Verification flow: workers must NOT reach the pending
  verification page after only entering Name + Mobile. They must first fill:
  - Basic Details (Full Name, Mobile, Email)
  - Address (Full Address, City, State, Pincode)
  - Work Details (Service Category, Experience)
  - Verification (Profile Photo, Live Selfie, Aadhaar Front, Aadhaar Back)
  Only after all these are submitted should the status become "pending_verification".
  Admin can view all submitted details + images and Approve / Reject.
  Only approved workers can access jobs / earnings / go online. Pending/rejected
  workers cannot receive bookings. Bookings must NEVER be assigned to a
  non-approved worker.

backend:
  - task: "POST /api/worker/upload-kyc requires email, full_address, city, state, pincode (6-digit), experience, categories, profile photo, live_selfie, aadhaar_front, aadhaar_back; sets kyc_status=submitted + verification_status=pending_verification"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewrote WorkerKycReq to require all new fields; added field-level validation (email contains @, pincode 6 digits, non-empty city/state/full_address/experience, categories non-empty). Missing photo/live_selfie/aadhaar_front/aadhaar_back returns 400. On success, stores email/full_address/city/state/pincode/experience/photo/live_selfie on user + kyc_docs, and sets kyc_status='submitted', verification_status='pending_verification'."

  - task: "Auto-assign booking only picks kyc_status=approved workers (removed unsafe last-resort fallback)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Removed the `db.users.find_one({'role': 'worker'})` last-resort fallback in _auto_assign. A pending / submitted / rejected worker can no longer be auto-assigned to a booking."

  - task: "GET /api/admin/workers returns all new submitted fields (email, address, city, state, pincode, experience, live_selfie)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "No projection change needed — Mongo returns all fields; verify list + detail responses include the new keys once a worker submits KYC."

  - task: "Worker jobs / earnings endpoints still require kyc_status=approved"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Pre-existing 403 guard in /worker/jobs and /worker/earnings. Please regression-test that a newly-registered worker (kyc_status=pending) gets 403 on both."

frontend:
  - task: "Newly registered worker must be sent to /worker-onboarding, NOT /worker-pending"
    implemented: true
    working: "NA"
    file: "frontend/app/register.tsx, frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "register.tsx + index.tsx now route by kyc_status: pending → /worker-onboarding, submitted → /worker-pending, approved → /(worker)/jobs, rejected → /worker-rejected. UI verification via screenshot tool if needed."

  - task: "Worker onboarding form requires all mandatory fields before allowing submit"
    implemented: true
    working: "NA"
    file: "frontend/app/worker-onboarding.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Fully rewrote worker-onboarding.tsx with Basic Details / Address / Work Details / Verification sections and required-field validation."

  - task: "(worker) route group blocks non-approved workers from jobs/earnings/profile"
    implemented: true
    working: "NA"
    file: "frontend/app/(worker)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added auth guard in (worker)/_layout.tsx: fetches /auth/me and redirects submitted → /worker-pending, rejected → /worker-rejected, pending → /worker-onboarding, only approved renders tabs."

  - task: "Admin worker detail modal shows all new submitted fields + live selfie"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/workers.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Modal now shows Applicant Details card (email/full_address/city/state/pincode/experience) + Live Selfie image + existing Aadhaar images."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "POST /api/worker/upload-kyc requires email, full_address, city, state, pincode (6-digit), experience, categories, profile photo, live_selfie, aadhaar_front, aadhaar_back; sets kyc_status=submitted + verification_status=pending_verification"
    - "Auto-assign booking only picks kyc_status=approved workers (removed unsafe last-resort fallback)"
    - "Worker jobs / earnings endpoints still require kyc_status=approved"
    - "GET /api/admin/workers returns all new submitted fields (email, address, city, state, pincode, experience, live_selfie)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Worker registration + verification hardening pass. Backend expects the full
      onboarding payload before setting kyc_status='submitted'.

      Please run the following backend regression:

      1. **Register a worker (name+mobile only)** via POST /api/auth/register
         { "name": "New Worker", "mobile": "+919000000010", "role": "worker" }.
         Expect: user created with kyc_status='pending'.

      2. **Guard: worker cannot reach worker-only endpoints before approval**
         - GET /api/worker/jobs → 403
         - GET /api/worker/earnings → 403

      3. **upload-kyc field validation** — using the token from step 1, POST
         /api/worker/upload-kyc and confirm each of the following returns 400:
         - missing email / invalid email (no '@')
         - missing full_address / city / state
         - pincode non-6-digit or non-numeric
         - missing experience / categories (empty list)
         - missing profile photo (`photo`) → 400 "Profile photo is required"
         - missing live_selfie → 400 "Live selfie is required"
         - missing aadhaar_front / aadhaar_back → 400
         - Wrong MIME (e.g. `data:text/plain;base64,...`) → 400
         - >5MB base64 → 413

      4. **Successful upload-kyc** with valid data (small JPEG base64 for each
         document) → response has kyc_status='submitted' and
         verification_status='pending_verification'. GET /api/auth/me confirms
         the same. Worker still 403 on /worker/jobs and /worker/earnings.

      5. **Admin visibility** — after step 4, log in as admin (password
         admin123) and GET /api/admin/workers → the new worker row must include
         email, full_address, city, state, pincode, experience, live_selfie.

      6. **Admin approve** → POST /api/admin/workers/{id}/approve.
         Worker now: kyc_status='approved', verification_status='approved',
         verified=true. Worker's token can now hit /worker/jobs (200) and
         /worker/earnings (200).

      7. **Booking auto-assign safety** — create a fresh category, register a
         customer, book a service. The auto-assigner MUST NOT pick a
         non-approved worker. Verify by:
         - registering a second brand-new worker with the same category
           chosen via upload-kyc (kyc_status='submitted') and one seeded
           approved worker with a different category.
         - Placing a booking under the mismatched category: worker_id should
           EITHER be the seeded approved worker OR remain unassigned — it must
           NEVER be the submitted (unapproved) new worker.

      Credentials in /app/memory/test_credentials.md (admin123).

      Notes:
      - `MONGO_URL` / `DB_NAME` from /app/backend/.env.
      - Frontend testing NOT requested this pass — backend only.
      - Skill certificate remains optional.
  - agent: "main"
    message: |
      NOTE for agent-to-agent context (previous iterations, already fixed):
      - iteration 3 finished green (45/45) — that suite lives in
        /app/backend/tests/test_security.py + test_homemate_backend.py. The
        WorkerKycReq schema changes may break those existing tests since they
        POST the old shape. If they fail, update them to send the new required
        payload — this is expected behavior.

