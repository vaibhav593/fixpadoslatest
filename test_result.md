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
  Add Service Area Control for Admin. Admin can Create/Edit/Enable/Disable
  Service Areas (name, pincode, city, radius_km optional). Booking must be
  blocked unless the customer's pincode matches an enabled service area with
  the exact 400 message "Sorry, services are currently unavailable in your
  area." Workers only receive orders from approved service areas — auto-assign
  must never assign a job to a worker whose pincode is outside the booking's
  service area. Admin can also see per-area counts of customers / bookings /
  workers. Service Areas live INSIDE the existing admin section.

backend:
  - task: "POST /api/bookings requires `pincode` (6-digit) and rejects with 400 'Sorry, services are currently unavailable in your area.' when the pincode has no enabled service area"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "iteration 5 — verified byte-for-byte error message; also validates 6-digit rule and 422 on missing pincode."

  - task: "Public GET /api/service-areas/check?pincode=XXXXXX returns { serviced, area? }"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "iteration 5 — 200/serviced=true for 400050, 200/serviced=false for 999999, 400 on invalid; unauthenticated OK."

  - task: "Admin CRUD: GET/POST/PATCH/DELETE /api/admin/service-areas + GET /api/admin/service-areas/{id}/stats"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "iteration 5 — guards (401/403 for customer/worker), full CRUD, duplicate/collision guards, /stats returns ints."

  - task: "Auto-assign restricted to workers whose pincode == booking.pincode AND kyc_status == approved (no cross-area assignment)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "iteration 5 — 560001 worker never picks up 400050 traffic; disabling an area blocks new bookings but leaves existing ones intact."

  - task: "Seed default service area (Bandra West / 400050 / Mumbai / radius 5km / enabled) so the seeded demo workers (pincode 400050) can pick up bookings"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "iteration 5 — also added a one-line migration to backfill pincode='400050' on pre-existing seeded demo workers."

frontend:
  - task: "Customer booking form asks for pincode + preflight service-area check + inline 'unavailable' message"
    implemented: true
    working: "NA"
    file: "frontend/app/booking/new.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added pincode input (testID=booking-pincode-input); on 6-digit input, calls /service-areas/check and either shows green 'we service this area' or the required error toast (testID=area-status-unavailable). Submit is blocked when unavailable."

  - task: "New admin route /admin/service-areas with list + add/edit modal + enable/disable switch + delete + stats"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/service-areas.tsx, frontend/src/components/AdminShell.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New screen + nav entry in AdminShell. Toggle instantly PATCHes enabled. Add/Edit modal supports name/pincode/city/radius_km/enabled. Per-row stats show customers/bookings/workers."

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus:
    - "POST /api/bookings requires `pincode` (6-digit) and rejects with 400 'Sorry, services are currently unavailable in your area.' when the pincode has no enabled service area"
    - "Public GET /api/service-areas/check?pincode=XXXXXX returns { serviced, area? }"
    - "Admin CRUD: GET/POST/PATCH/DELETE /api/admin/service-areas + GET /api/admin/service-areas/{id}/stats"
    - "Auto-assign restricted to workers whose pincode == booking.pincode AND kyc_status == approved (no cross-area assignment)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Iteration 5 — Service Area enforcement pass. Backend-only regression
      requested.

      Please verify:

      1. **Seed area exists**: on startup the DB has a single service area for
         pincode 400050 ("Bandra West", Mumbai, enabled).

      2. **Public check endpoint**:
         - GET /api/service-areas/check?pincode=400050 → { serviced: true, area: {...} }
         - GET /api/service-areas/check?pincode=999999 → { serviced: false }
         - GET /api/service-areas/check?pincode=12345 → 400 (invalid pincode)
         - No auth token needed.

      3. **Admin CRUD**:
         - Non-admin (customer/worker token) hitting /api/admin/service-areas* → 403.
         - Admin (password admin123) can:
             a) GET /api/admin/service-areas → includes the seeded area.
             b) POST a new area (unique pincode, e.g. 560001, "Bengaluru Central", city=Bengaluru, radius_km=8, enabled=true) → 200 with the area doc.
             c) POST again with the same pincode → 400 "already exists".
             d) POST with name empty / city empty / pincode non-6-digit → 400.
             e) PATCH the new area to enabled=false → GET reflects the change.
             f) PATCH to change pincode to an existing pincode (400050) → 400.
             g) GET /admin/service-areas/{id}/stats → { customers, bookings, workers } as integers.
             h) DELETE the new area → 200 and it disappears from GET list.

      4. **Booking service-area gate** (as customer):
         - Register a fresh customer, book under a valid category:
             POST /bookings with pincode="400050" → 200, booking has pincode & service_area_id set. Auto-assign picks the seeded approved worker (pincode 400050).
             POST /bookings with pincode="999999" → 400 with EXACT body detail = "Sorry, services are currently unavailable in your area."
             POST /bookings with pincode="12345" (5 digits) → 400 "Please enter a valid 6-digit pincode".
             POST /bookings without pincode field → 422 (missing required field).

      5. **Cross-area assignment safety**:
         - Create a NEW admin-approved worker with pincode="560001" and categories that include some existing category id C (either register+upload-kyc then admin approve, or seed directly via the API path).
         - Add & enable a service area for 560001.
         - As a customer, POST /bookings with pincode="560001" and category=C.
         - The booking's worker_id MUST be the 560001 worker, NEVER the 400050 seeded worker (they must not cross service areas).
         - Now DISABLE the 560001 area via admin PATCH (enabled=false). Any subsequent POST /bookings with pincode="560001" → 400 "Sorry, services are currently unavailable in your area." (Existing booking not affected.)

      6. **Regression**:
         - Full booking lifecycle (create → accept → start → verify-pin → rate) still works when service area is enabled.
         - Worker KYC upload / approve / reject flow (from iteration 4) still passes.

      Credentials in /app/memory/test_credentials.md (admin123).
      Notes:
      - `MONGO_URL` / `DB_NAME` from /app/backend/.env.
      - Frontend testing NOT requested this pass.
      - Existing iteration-4 test suite `test_worker_kyc_verification.py` sends
        upload-kyc calls; those tests continue to be relevant but do not test
        service areas. The two `.obsolete` files can be ignored.
  - agent: "testing"
    message: |
      Iteration 5: 55/55 PASS (28 new + 27 iteration-4 regression). Every
      requested behavior verified.
      - Public /service-areas/check: 200/serviced=true for 400050, 200/serviced=false for 999999, 400 on bad pincode, no-auth confirmed.
      - Admin CRUD guarded (401/403), full lifecycle (create, duplicate, empty-name, empty-city, non-6-digit, PATCH enable/disable, PATCH pincode collision, /stats returning ints, delete).
      - Booking gate: 200 with service_area_id when pincode='400050'; 400 with EXACT detail "Sorry, services are currently unavailable in your area." for 999999 (byte-for-byte); 400 '6-digit' message for '12345'; 422 when missing.
      - Cross-area safety: 560001 worker never receives 400050 traffic and vice versa.
      - Disable-area blocks new bookings; already-created bookings untouched.
      - Regression: full booking lifecycle + KYC approve/reject still green.
      - No `_id` leakage anywhere.
      Fixed a small seed regression along the way: seeded demo workers were
      created before the `pincode` field existed, so `_auto_assign` returned
      None. Added a one-line update_many migration in seed_db that backfills
      pincode='400050' on the three known demo worker mobiles. Backend
      restarted, all tests now pass.
      Report at /app/test_reports/iteration_5.json. Suite at
      /app/backend/tests/test_service_areas.py.
      retest_needed: false.

