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
  Production-ready MVP for a hyperlocal home services platform (HomeMate) connecting
  customers with verified local workers. Customer app (location, booking, status, chat,
  PIN verification, ratings). Worker app (registration, multi-category, Aadhaar KYC,
  dashboard, accept/reject/cancel, online/offline, dark theme). Admin panel (dashboard,
  worker approvals, categories, banners, analytics, chat monitoring). Tech & Security:
  role-based permissions, 5-minute OTP expiry, OTP rate limiting (3/min), audit logs,
  5MB JPG/PNG/PDF file limits, private document storage. Stack stays on MongoDB+FastAPI
  with mock OTP (code `123456`). Twilio swap is future.

backend:
  - task: "Auth: send-otp + verify-otp with mock 123456, 5-min expiry, 3/min rate-limit, 5 attempts cap"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Hardened OTP flow: 5-min expiry, 3/min rate limit per mobile via otp_log, 5 wrong-code attempts cap, single-use OTP. Needs verification."

  - task: "Audit logs for sensitive admin & booking actions"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added audit() helper writing to db.audit_logs. Wired into KYC approve/reject, booking assign/cancel/start/complete, admin login."

  - task: "Worker KYC upload with 5MB JPG/PNG/PDF validation"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "validate_doc_base64() enforces data-url MIME allow-list and 5MB cap on aadhaar_front/back & skill cert."

  - task: "Booking lifecycle: create, accept, reject, cancel, start, PIN verify with 5-attempt cap, rate"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Lifecycle endpoints exist; PIN endpoint enforces PIN_MAX_ATTEMPTS=5 then auto-cancels."

  - task: "Admin endpoints: login, dashboard stats, workers list/approve/reject, categories, banners, analytics, chat monitor"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Admin password gate -> JWT, dashboard counts, KYC approvals, CRUD categories/banners, analytics aggregates, chat monitor endpoint."

  - task: "Chat: send + list messages between customer and assigned worker"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Messages tied to booking_id; only participants can read/send."

frontend:
  - task: "Customer flow (royal blue theme): login -> OTP -> home -> book -> bookings -> chat -> rate"
    implemented: true
    working: "NA"
    file: "frontend/app/(customer)/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "UI verification will be done via screenshot tool, not testing_agent in this pass."

  - task: "Worker flow (dark theme): login -> OTP -> onboarding (Aadhaar) -> jobs dashboard -> earnings"
    implemented: true
    working: "NA"
    file: "frontend/app/(worker)/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "UI verification will be done via screenshot tool."

  - task: "Admin web flow: login -> dashboard -> workers/categories/banners/analytics"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "UI verification will be done via screenshot tool."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Auth: send-otp + verify-otp with mock 123456, 5-min expiry, 3/min rate-limit, 5 attempts cap"
    - "Audit logs for sensitive admin & booking actions"
    - "Worker KYC upload with 5MB JPG/PNG/PDF validation"
    - "Booking lifecycle: create, accept, reject, cancel, start, PIN verify with 5-attempt cap, rate"
    - "Admin endpoints: login, dashboard stats, workers list/approve/reject, categories, banners, analytics, chat monitor"
    - "Chat: send + list messages between customer and assigned worker"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Backend security hardening pass complete. Please run full backend regression:
      - OTP send rate limit (3/min should 429 on 4th), verify with `123456` (mock).
      - OTP wrong code 5 times -> 429; expiry path (cannot easily wait 5min, just confirm logic on expired doc).
      - KYC upload: reject non-allowed MIME and >5MB.
      - Booking lifecycle end-to-end including PIN wrong attempts 5x -> auto cancel.
      - Admin login with password `admin123`, then dashboard/workers/categories/banners/analytics/chat-monitor.
      - Verify audit_logs collection has entries after admin and booking actions.
      Credentials: customer mobile `+919876500001`, worker `+919876500099`, OTP `123456`, admin password `admin123`.
  - agent: "testing"
    message: |
      Iteration 2: 42/45 passed (1 critical bug + 2 gaps). Bug fixed by testing agent:
      `verify-otp` 500 due to naive/aware datetime compare on expires_at (server.py:262-267).
      Open gaps reported back to main: (a) admin_login missing audit_log entry, (b) verify-pin
      did not auto-cancel booking after 5 wrong attempts.
  - agent: "main"
    message: |
      Applied two fixes:
      (a) `audit(admin_id, 'admin_login')` after successful admin login.
      (b) `verify_pin` auto-cancels booking + writes `booking_cancelled` audit on 5th wrong PIN.
      Re-run security suite please.
  - agent: "testing"
    message: |
      Iteration 3: 45/45 PASS. No regressions. audit_log entries verified for admin_login,
      pin_locked, booking_cancelled (meta={reason:'pin_attempts_exceeded', by:'system'}).
      retest_needed: false.
  - agent: "main"
    message: |
      Frontend visual verification done via screenshot tool:
      - Customer flow (royal blue): home banner + service grid + bookings + profile OK.
      - Worker dark theme: applied via workerColors (bg #0F172A, surface #1E293B) — jobs,
        earnings, profile all confirmed dark.
      - Admin web: login → dashboard (50 customers / 22 workers / 35 bookings) → workers KYC
        list with status pills → categories CRUD → analytics chart OK.
      Backend status: green. UI status: green. Supabase migration plan written to
      /app/supabase_migration_plan.md (530 lines, includes Mongo→Postgres mapping + rollback).
  - agent: "testing"
    message: |
      Iteration 3 (re-test) complete. Full backend suite 45/45 PASS (100%). Both previously failing tests now green:
        - test_security.py::TestAdminLogin::test_right_password_returns_admin_jwt  (admin_login audit row written)
        - test_security.py::TestPinAttempts::test_after_pin_locked_booking_auto_cancelled  (status=cancelled, cancelled_by=system, cancel_reason='PIN attempts exceeded')
      Direct API verification of audit_logs:
        - action=admin_login rows present with user_id=<admin id>
        - action=booking_cancelled with meta={reason:'pin_attempts_exceeded', by:'system'} present
        - action=pin_locked with meta={attempts:5} present
      No regressions across the 31-test test_homemate_backend.py suite. No mocks. Run cmd: `pytest /app/backend/tests/ -v --junitxml=/app/test_reports/pytest/pytest_results.xml` (~75s). See /app/test_reports/iteration_3.json for details + remaining optional polish items (PIN cap off-by-one UX, verify-pin missing status check, server.py size, deprecated on_event).
