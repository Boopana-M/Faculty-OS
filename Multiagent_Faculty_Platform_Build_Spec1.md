# Multi-Agent Faculty Platform — MVP Build Spec

> **How to use this file:** Each "Phase" below is a self-contained, copy-pasteable prompt.
> Feed one phase at a time to your coding agent (Claude Code, Cursor, etc.). Don't move to
> the next phase until the current one builds **and visually matches the design system**
> below — not just "compiles." A screen that renders as unstyled black-on-white text (no
> fonts, no color, no spacing) means the design system was ignored or the CSS pipeline is
> broken. Section 0.5 exists specifically to prevent that.

---

## 0. Project Framing (read once, don't paste this section)

You are building **one project** that houses **3 specialized AI agents**, switchable from
a single dashboard by the faculty member:

| # | Agent | Core Job |
|---|-------|----------|
| 1 | **Faculty Assistant Agent** | Personal daily-driver: schedule, RAG over policies/syllabus, drafting |
| 2 | **Academic Workflow Agent** | Attendance, marks, assignments, reminders — the "doer" |
| 3 | **Analytics & Accreditation Agent** | Insights, at-risk prediction, NBA/NAAC reports — the "thinker" |

Agent 1 acts as the **orchestrator/front door** — when a request needs data or computation,
it calls Agent 2 and/or Agent 3 as tools and synthesizes their output back to the faculty
member in plain language.

### Recommended Stack
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion for transitions
- **Backend:** FastAPI (Python) — plays nicest with RAG/LLM tooling
- **Agent Orchestration:** LangGraph (or CrewAI) — model agents as nodes, Agent 1 as supervisor
- **LLM:** Claude (Anthropic API) via `anthropic` SDK, tool-calling for inter-agent delegation
- **Vector DB (RAG):** ChromaDB (local, zero-infra) for policies/syllabus documents
- **Relational DB:** PostgreSQL (Supabase works well for MVP — free auth + DB + storage)
- **Auth:** Supabase Auth or simple JWT (single-tenant faculty login is enough for MVP)
- **Charts:** Recharts (for Analytics Agent dashboards)
- **Deployment:** Vercel (frontend) + Railway/Render (backend)

---

## 0.5 Design System — read this before writing ANY UI code

This is the part that was missing last time and produced a flat, unstyled screen. Every
phase below assumes these tokens exist and are actually wired up before a single component
is built. **Do not let the coding agent invent its own palette or fall back on default
browser styles "for now."**

### Design concept
Think **"faculty register, digitized"** — the visual language of an academic gradebook and
official department paperwork (ruled tables, stamped seals, ledger numerals), rendered as a
clean modern product instead of a generic SaaS admin dashboard. This is the thing that makes
it feel designed rather than scaffolded. Avoid generic AI-tool defaults: no warm-cream-plus-
terracotta palette, no near-black-with-neon-accent palette, no zero-radius broadsheet grid.

**Signature element:** every agent gets a small circular "seal" badge (a solid color disc
with a thin inner ring and a simple line icon centered in it — like an official stamp on a
document) instead of a flat lucide icon. This seal appears next to the agent's name in the
switcher, at the top of its screen, and as the avatar for its chat messages. It's the one
recurring visual signature tying the whole product together across three different theme
colors.

### Color tokens (define these as CSS variables / Tailwind theme extension — not inline hex)

```css
:root {
  /* Base */
  --ink:        #14181F;   /* primary text */
  --ink-muted:  #5B6270;   /* secondary text */
  --paper:      #F6F7F9;   /* app background */
  --surface:    #FFFFFF;   /* card background */
  --border:     #E3E6EB;   /* hairline borders */

  /* Agent 1 - Faculty Assistant */
  --agent1-500: #4F46E5;   /* primary accent */
  --agent1-100: #EDECFD;   /* tint background */
  --agent1-700: #3730A3;   /* hover/pressed */

  /* Agent 2 - Academic Workflow */
  --agent2-500: #059669;
  --agent2-100: #E1F6EE;
  --agent2-700: #0F5132;

  /* Agent 3 - Analytics & Accreditation */
  --agent3-500: #D97706;
  --agent3-100: #FDF0E1;
  --agent3-700: #92400E;

  /* Status (used across all agents) */
  --status-good:  #059669;
  --status-warn:  #D97706;
  --status-bad:   #DC2626;
}
```

### Typography (install real webfonts — do not silently fall back to system sans)

| Role | Typeface | Used for |
|---|---|---|
| Display | **Fraunces** (serif, variable weight) | Agent names, section headings, big KPI numbers — gives the "official document" gravitas |
| UI / Body | **Inter** | Buttons, labels, chat text, nav, body copy |
| Data / Mono | **IBM Plex Mono** | Roll numbers, dates, percentages, marks, timestamps — reinforces the "ledger" feel |

Type scale (rem): `2.25 / 1.875 / 1.5 / 1.25 / 1rem / 0.875 / 0.75`. Headings use Fraunces
at weight 500-600, never bold-italic. Body text is Inter 400, never below 14px for anything
a faculty member reads closely.

### Spacing, radius, shadow (use these everywhere — no ad hoc values)

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px
- Radius: `--radius-sm: 8px` (inputs, chips), `--radius-md: 12px` (cards), `--radius-lg: 20px` (modals, hero panels)
- Shadow: one soft ambient shadow only — `0 1px 2px rgba(20,24,31,0.04), 0 4px 16px rgba(20,24,31,0.06)`. No harsh drop shadows, no multiple competing shadow layers.

### Core components (spec once, reuse across all 3 agent UIs)

- **Button (primary):** agent accent-500 background, white text, `--radius-sm`, 10px/16px
  padding, subtle scale-down (0.98) + darken to accent-700 on press, no default browser
  focus ring — replace with a 2px accent-colored outline offset by 2px.
- **Card:** `--surface` background, 1px `--border`, `--radius-md`, the soft shadow above,
  20-24px internal padding. Never a card with no border AND no shadow — pick at least one
  so it reads as a distinct surface against `--paper`.
- **Input:** `--surface` background, 1px `--border`, `--radius-sm`, 10px/12px padding,
  border becomes agent accent-500 on focus (not the browser default blue).
- **Badge/status pill:** tinted background (accent-100 or status color at 12% opacity) with
  text in the corresponding 700-weight color, `--radius-sm`, small Plex Mono uppercase label.
- **Seal (signature element):** 40px circle, agent accent-500 fill, 2px white inner ring
  inset, centered 18px line icon in white. 28px version for compact contexts (chat avatars).

### ASCII wireframe — app shell (applies to every phase)

```
+-----------------------------------------------------------------+
|  [seal] EduPilot          o Faculty Assistant  o  o          [avatar] | <- top bar, --surface, border-bottom
+-----------+-------------------------------------------------------+
|  SIDEBAR  |                                                       |
|           |                                                       |
| * Faculty |                 MAIN CONTENT                          |
|   Assist. |           (theme = active agent's accent)             |
|           |                                                       |
| o Workflow|                                                       |
|           |                                                       |
| o Analytic|                                                       |
|           |                                                       |
+-----------+-------------------------------------------------------+
```
Sidebar items: active agent has its accent-100 tint as a pill background behind the seal +
label, plus a 3px accent-500 left border on the sidebar edge. Inactive agents show their
seal in grayscale at 70% opacity — color "switches on" only when selected. This IS the
theming mechanism; do not reload the page or swap the whole layout, just swap the CSS
variables that `--surface`/accent tokens point to.

### Technical guardrails — verify BEFORE calling any UI phase done

The flat, unstyled screen problem happens for one of these reasons. Check all four:

1. `tailwind.config.js` -> `content` array actually globs every file that uses Tailwind
   classes (e.g. `"./src/**/*.{ts,tsx}"`). If this is wrong, Tailwind purges everything
   and you get unstyled HTML with no errors.
2. The root CSS file has all three `@tailwind base; @tailwind components; @tailwind
   utilities;` directives, AND that CSS file is actually imported in `main.tsx`/`App.tsx`.
3. Google Fonts (or self-hosted equivalents) for Fraunces / Inter / IBM Plex Mono are
   linked in `index.html` or imported via `@font-face` — confirm in devtools that the
   computed font-family isn't silently falling back to Arial/Times.
4. **Take a screenshot (or describe the rendered DOM/computed styles) after building each
   screen and compare it against the ASCII wireframe and token list above before moving
   on.** If it looks like plain browser default styling — black serif-less text, no card
   backgrounds, no accent colors, default blue links/focus rings — stop and fix the
   pipeline before writing more components. Do not proceed to the next phase on a screen
   that fails this check.

---

## Phase 0 — Foundation & Shell (no agent logic yet)

```
Build the foundational scaffold for a multi-agent faculty platform called "EduPilot".

TECH STACK:
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- Backend: FastAPI (Python 3.11+), SQLAlchemy, Pydantic v2
- DB: PostgreSQL (use SQLite for local dev fallback via env flag)
- Auth: Simple JWT-based faculty login (single role for MVP: "faculty")

DESIGN SYSTEM: Implement the FULL design system from Section 0.5 of the build spec before
writing any screen - color tokens as CSS variables + Tailwind theme extension, Fraunces /
Inter / IBM Plex Mono loaded and verified, spacing/radius/shadow scale, and the reusable
Button / Card / Input / Badge / Seal components. Build a small internal `/dev/style-guide`
route that renders one of each token and component so it can be visually checked in
isolation - check it against Section 0.5 before building the login page.

WHAT TO BUILD IN THIS PHASE:

1. Monorepo structure:
   /frontend        (React app)
   /backend
     /agents        (empty, one subfolder per agent - created in later phases)
     /core          (shared: db models, auth, config, LLM client wrapper)
     /rag           (empty, vector store setup - Phase 1)
   /docs

2. Backend:
   - FastAPI app with CORS, health check endpoint (/health)
   - Faculty DB model: id, name, email, department, designation, password_hash
   - JWT auth: /auth/login, /auth/me
   - Config via .env (DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET)
   - A single `/agents/chat` endpoint stub that accepts { agent_id, message, session_id }
     and returns a hardcoded placeholder response per agent.

3. Frontend:
   - Login page: centered card on `--paper` background, EduPilot wordmark in Fraunces with
     the indigo seal above it, email/password Inputs using the shared component, primary
     Button. This is the FIRST thing you build with the real design system, so it's also
     the first visual sanity check - it must not look like the bare HTML default.
   - App shell after login exactly per the ASCII wireframe in Section 0.5: top bar +
     left sidebar agent switcher + main content area.
   - Sidebar: 3 seals (grayscale/70% when inactive, full accent-100 pill + color when
     active), agent name in Inter medium beneath or beside each seal.
   - Main content area: placeholder screen per agent using THAT agent's accent-100 as a
     soft background wash (not the full saturated accent - that's only for buttons/badges/
     borders) with the agent's Fraunces-set name and a one-line description.
   - AgentThemeProvider (React Context) that swaps which CSS variables `--surface`/accent
     point to when switching agents - swap via variables, not full remount.
   - Framer Motion cross-fade (~200ms) between agent screens.

4. Seed script: one demo faculty user (email: demo@faculty.edu / password: demo1234).

DELIVERABLE FOR THIS PHASE:
- `npm run dev` (frontend) and `uvicorn main:app --reload` (backend) both run locally.
- The style guide route, login page, and shell all visually match Section 0.5 - real
  fonts rendering, real color tokens applied, cards with visible border+shadow, seals
  rendering as colored circles with icons, not flat unstyled text on white. Confirm this
  with a screenshot before considering the phase done.
- Faculty can log in, see the agent switcher, click between all 3 agents, and see each
  agent's themed placeholder screen with a working cross-fade transition.
```

---

## Phase 1 — Agent 1: Faculty Assistant Agent

```
Build out the FIRST real agent: the Faculty Assistant Agent, on top of the Phase 0 scaffold.
This agent is the orchestrator/front door of the whole system. Use the design tokens,
components, and seal system from Section 0.5 - this agent's accent is --agent1-500 (indigo).

BACKEND - /backend/agents/faculty_assistant/

1. Data models (SQLAlchemy):
   - Timetable: faculty_id, day_of_week, period, subject, class_section, room
   - SyllabusUnit: subject, unit_number, title, topics (text), pdf_url
   - PolicyDocument: title, category, file_path, uploaded_at (for RAG ingestion)

2. RAG pipeline (/backend/rag/):
   - Ingest policy documents (PDF/text) into ChromaDB, chunked ~500 tokens with overlap
   - Embedding via sentence-transformers all-MiniLM-L6-v2 for MVP (free, local, fast)
   - Retrieval function: given a query, return top-k relevant chunks + source doc name

3. Agent logic (LangGraph or a simple function-calling loop using the Anthropic SDK):
   - System prompt: warm, efficient personal assistant for a faculty member
   - Tools: get_todays_schedule, get_syllabus, search_policies, draft_email,
     create_lesson_plan, delegate_to_academic_workflow (stub), delegate_to_analytics (stub)

4. Endpoint: POST /agents/faculty-assistant/chat - streamed via SSE for token-by-token
   typing effect in the UI.

FRONTEND - Faculty Assistant Agent screen (accent: --agent1-500 indigo)

Layout (chat-first, two-column, per this wireframe):
```
+-------------------------------------------+---------------+
|  [seal] Faculty Assistant                  |  Today        |
|-------------------------------------------  |---------------|
|  o Faculty message (right, agent1-100      |  9:00 CSE-A   |
|    bg bubble, ink text)                    |  10:00 CSE-B  |
|                                             |  ...          |
|  [seal] Agent reply (left, --surface       |---------------|
|    card, streamed text)                    |  Ask a policy |
|                                             |  [ search ]   |
|  [rich cards render inline here:           |               |
|   schedule card / draft card /             |               |
|   lesson-plan card]                        |               |
|                                             |               |
|-------------------------------------------  |               |
| [ chip ][ chip ][ chip ][ chip ]            |               |
| [ message input..................][Send]   |               |
+-------------------------------------------+---------------+
```
- Message bubbles: faculty messages right-aligned, `--agent1-100` background, `--ink` text,
  `--radius-md`. Agent messages left-aligned in a `--surface` card with a 28px seal avatar,
  streamed progressively.
- Quick-action chips (below input): "What's on today?" / "Draft a leave request" /
  "Show syllabus" / "Make a lesson plan" - pill-shaped, `--border` outline, fill with
  `--agent1-100` on hover.
- Rich rendering (not raw text): schedule responses render as a compact timetable Card
  with Plex Mono times; email drafts render as a "draft card" with Copy/Edit buttons and
  a subtle envelope motif; lesson plans render as a collapsible Card with objectives/
  activities/assessment as separate labeled sections using Badge components for duration.
- Right panel ("Today at a Glance"): sticky, `--surface` background, vertical timeline of
  today's classes with Plex Mono times, plus a compact policy search box.
- Empty state: greeting Card in Fraunces - "Good morning, [Name]." with class count for
  the day and any pending drafts, using the seal as the focal graphic.

DELIVERABLE:
- Screenshot-check this screen against the wireframe and Section 0.5 tokens before
  considering it done - indigo accent, Fraunces headings, Plex Mono numbers, visible card
  borders/shadows, seal avatars. Faculty can chat, get today's schedule, a syllabus unit,
  a cited policy answer, an email draft, and a structured lesson plan, all as rich cards.
```

---

## Phase 2 — Agent 2: Academic Workflow Agent

```
Build the Academic Workflow Agent on top of Phases 0-1. Accent: --agent2-500 (emerald).
This agent is the "operational doer" - table/kanban-first, not chat-first.

BACKEND - /backend/agents/academic_workflow/

1. Data models:
   - AttendanceRecord: student_id, class_section, date, status (present/absent/late)
   - Assignment: id, subject, class_section, title, due_date, max_marks
   - Submission: assignment_id, student_id, submitted_at, marks_obtained, status
   - InternalMark: student_id, subject, component (CAT1/CAT2/Assignment/etc.), marks
   - Student: id, name, roll_no, class_section, mentor_faculty_id, email

2. Tools/functions: get_attendance_report, mark_attendance, get_pending_submissions,
   calculate_internal_marks (configurable weights, e.g. CAT1 20% + CAT2 20% + Assignments
   10%), generate_progress_report, get_pending_faculty_tasks, schedule_assignment.

3. Endpoint: POST /agents/academic-workflow/chat (streaming) + plain REST endpoints
   (GET /attendance, GET /assignments, etc.) so tables render fast without an LLM round-trip.

4. Wire up delegate_to_academic_workflow() from Agent 1 for real.

FRONTEND - Academic Workflow Agent screen (accent: --agent2-500 emerald)

Layout wireframe:
```
+---------------------------------------------------------+
| [seal] Academic Workflow                                 |
| [Attendance] [Assignments] [Marks] [Reminders]  <- tabs  |
|----------------------------------------------------------|
|  CSE-A v   Date: 26 Jul 2026 v     92% present  o good   |
|  +---------------------------------------------------+   |
|  | Roll     Name          Status                      |  |
|  | 24CC001  A. Kumar      [Present]                    |  |
|  | 24CC002  B. Priya      [Absent]                      |  |
|  | ...  (Plex Mono roll numbers, toggle pills)          |  |
|  +---------------------------------------------------+   |
|                                        [Mark all present] |
+---------------------------------------------------------+
                                      +-------------+
                                      | Ask Workflow | <- floating drawer, collapsed
                                      +-------------+
```
- Tab bar directly under the seal/title, active tab underlined in `--agent2-500`.
- Attendance tab: data grid, roll numbers in Plex Mono, status as toggle pills using
  Badge component (`--status-good` green / `--status-bad` red), summary bar with a big
  Fraunces percentage number at top.
- Assignments tab: kanban columns (Scheduled / Open / Grading / Closed), each Assignment
  as a Card with a submission-count Badge ("18/25 submitted") using `--status-warn` amber
  if under 70%, `--status-good` if complete.
- Marks tab: spreadsheet-style table, Plex Mono numerals throughout, auto-calculated
  total column highlighted with `--agent2-100` background.
- Reminders tab: checklist feed, overdue items get a `--status-bad` left border accent.
- Floating chat drawer bottom-right: collapsed pill with the emerald seal, expands upward
  into a `--surface` panel on click; results render as compact inline tables, with a
  "View in Assignments tab" link.

DELIVERABLE:
- Screenshot-check: emerald accents, visible grid lines/borders, Plex Mono data, colored
  status pills - this should read as an operational spreadsheet-grade tool, not a chat
  screen with a table pasted in. Faculty can mark attendance, track submissions, view
  auto-calculated marks, and get reminders via direct UI AND natural language.
```

---

## Phase 3 — Agent 3: Analytics & Accreditation Agent

```
Build the Analytics & Accreditation Agent on top of Phases 0-2. Accent: --agent3-500
(amber). This is the "executive dashboard" - dense with charts, numbers-forward.

BACKEND - /backend/agents/analytics/

1. Reuses Academic Workflow's tables (attendance, marks, assignments) - no duplicate
   schema. Add: COAttainment (course_id, co_number, attainment_percentage,
   target_percentage), FacultyWorkload (faculty_id, subject, hours_per_week, sections).

2. Tools/functions: analyze_performance, predict_at_risk_students (transparent weighted
   formula: attendance % + marks trend + submission rate - explainable, no black-box ML
   needed for MVP), generate_nba_co_report, generate_faculty_workload_report,
   get_department_statistics.

3. Endpoint: POST /agents/analytics/chat (streaming) + REST endpoints for dashboard
   widgets so charts load without waiting on an LLM round-trip.

4. Wire up delegate_to_analytics() from Agent 1.

FRONTEND - Analytics & Accreditation Agent screen (accent: --agent3-500 amber)

Layout wireframe:
```
+---------------------------------------------------------+
| [seal] Analytics & Accreditation                         |
|----------------------------------------------------------|
| +--------++--------++--------++--------+                 |
| | 87.4%  || 74.2   ||   6    || 91%/95%|  <- KPI cards,  |
| |Attend. ||Avg Int.||At-Risk ||CO Attn.|    Fraunces     |
| | ...spark ...spark ||        ||        |    big numbers |
| +--------++--------++--------++--------+                 |
| +-------------------++-------------------+                |
| | Performance dist.  || Attendance trend  |  <- charts    |
| |  (bar, amber/slate)||  (line)           |                |
| +-------------------++-------------------+                |
| +-------------------++-------------------+                |
| | At-risk students   || CO attainment vs  |                |
| |  (sortable table)  ||  target (bar)     |                |
| +-------------------++-------------------+                |
| [Generate NBA CO Report]  [Generate Workload Report]       |
+---------------------------------------------------------+
                  +--------------------------+
                  | Ask about performance...  | <- floating query bar
                  +--------------------------+
```
- KPI cards: Fraunces numerals at 2.25rem, small Plex Mono sparkline beneath, label in
  Inter uppercase small caps at `--ink-muted`.
- Charts (Recharts): cohesive palette - amber (`--agent3-500`) for the primary series,
  `--ink-muted`/slate for comparison series. No rainbow chart colors.
- At-risk table: risk score as a Badge - red >70, amber 40-70, green <40 - sortable by
  clicking the column header.
- Report buttons: primary Button style, generate downloadable styled PDF (use the PDF
  skill's letterhead pattern) - clarify in the UI these are draft-for-review documents.
- Floating query bar: bottom-center, amber accent border, expands upward with an inline
  answer card (mini chart or table) on submit, doesn't navigate away from the dashboard.

DELIVERABLE:
- Screenshot-check: amber KPI numerals in Fraunces, consistent chart palette (not default
  rainbow Recharts colors), risk badges colored correctly, visible card structure. Faculty
  sees a live dashboard, can generate both reports, and can query at-risk students in
  natural language.
```

---

## Phase 4 — True Multi-Agent Collaboration (the "wow" workflow)

```
Wire the 3 agents together so Agent 1 can orchestrate a multi-step request across both
other agents in a single turn:

  Faculty: "Generate today's attendance, identify weak students, and email their mentors."

REQUIRED FLOW:
1. Agent 1 produces an explicit short plan (log it for debuggability) before executing.
2. delegate_to_academic_workflow() -> get_attendance_report() for today -> absentee list.
3. delegate_to_analytics() -> predict_at_risk_students() -> cross-reference with absentees
   to flag "weak + absent" students.
4. draft_email() once per flagged student's mentor, personalized with attendance % and
   marks trend.
5. Agent 1 returns a SUMMARY CARD (not raw logs): flagged count, one-line reason per
   student, and each draft email as a collapsible Card with Send / Edit / Discard actions.
   (MVP: "Send" can mark-as-sent in DB / log; real email sending is a clearly-flagged
   stretch goal.)

FRONTEND - Cross-agent trace visualization:
While Agent 1 executes a multi-step plan, show a thin animated "trace strip" above the
chat: three connected seals (indigo -> emerald -> amber -> indigo) that light up in
sequence as each step completes, with a short label under each ("Reading attendance" ->
"Scoring risk" -> "Drafting emails"). This makes the collaboration diagram from the
original spec visually real, using the same seal signature element from Section 0.5 - not
a new motif.

DELIVERABLE:
- The example workflow works end-to-end and the trace strip makes the hand-off between
  agents legible to the faculty member before they see the final summary card.
```

---

## Phase 5 — Polish & MVP Hardening

```
Final pass before calling this MVP-complete:

1. Error handling: every agent endpoint gracefully handles LLM timeouts, empty RAG
   results, and DB errors with faculty-friendly messages in the interface's voice (state
   what happened and what to do next - never a raw stack trace, never an apology).
2. Loading states: skeleton loaders (shaped like the actual card/table they'll become,
   using `--border` colored pulse) for charts/tables, typing indicator for chat streaming.
3. Empty states: every tab/dashboard has a designed empty state using the seal motif +
   a one-line action-oriented message, not a blank white screen.
4. Accessibility/quality floor: visible keyboard focus rings (2px accent outline, not
   removed), color contrast checked for all status pills against their backgrounds,
   responsive down to 1024px, reduced-motion respected for the cross-fade/trace animations.
5. Session persistence: chat history per agent persists across reloads (DB-backed, keyed
   by faculty_id + agent_id).
6. Seed/demo data script covering all 3 agents so a fresh clone demos in under 5 minutes.
7. README with setup instructions, env vars, and a 60-second architecture summary.
8. Final full-app screenshot pass: every screen checked against Section 0.5 one more time
   side by side - if anything reads as default-browser-styled, fix it before calling this done.

DELIVERABLE: a demo-ready MVP - one login, three distinctly-themed agents that actually
look designed (real typography, real color system, the seal signature tying them
together), real inter-agent delegation with a visible trace, and the flagship
"attendance -> at-risk -> mentor email" workflow working live.
```

---

## Notes on the "4 agents" framing

Your spec describes **3 distinct capability agents** (Faculty Assistant, Academic Workflow,
Analytics & Accreditation) plus the **shell/switcher itself**, which is sometimes counted
as a 4th "agent" in loose usage even though it's really just the orchestrator UI + Agent 1
acting as supervisor. This spec treats it that way. If you actually meant a distinct 4th
capability (e.g. a Student-Facing Agent, or an Admin/HOD Agent), let me know and I'll add
a phase for it.
