# Faculty OS — 6-Agent MVP Build Spec

> **How to use this file:** Each "Phase" below is a self-contained, copy-pasteable prompt.
> Feed one phase at a time to your coding agent. Don't move to the next phase until the
> current one builds **and visually matches the design system** in Section 0.5 — not just
> "compiles." Phase 0 and Phase 1 are already built (per your screenshot) and are kept here
> only as the reference baseline every later agent must visually match — you don't need to
> rebuild them, just don't drift from their look.

---

## 0. Project Framing — why these 6 agents

You're expanding from 3 agents to **6**, under one umbrella product: **Faculty OS** — a
single "operating system" for everything a faculty member does, from daily admin to
research to student care. The first 3 were the operational core; the new 3 fill the gaps
that a real engineering-college faculty member deals with constantly but that don't fit
"schedule," "attendance," or "reports."

| # | Agent | Core Job | Status |
|---|-------|----------|--------|
| 1 | **Faculty Assistant** | Personal daily-driver: schedule, RAG over policies/syllabus, drafting, lesson plans | ✅ Built |
| 2 | **Academic Workflow** | Attendance, marks, assignments, reminders — the "doer" | 🔲 To build |
| 3 | **Analytics & Accreditation** | Insights, at-risk prediction, NBA/NAAC reports — the "thinker" | 🔲 To build |
| 4 | **Research & Grants** | Publications, funding opportunities, deadlines, co-author matching — the "career builder" | 🔲 New |
| 5 | **Exam & Assessment Design** | Bloom's-aligned question papers, CO/PO mapping, rubrics — the "paper setter" | 🔲 New |
| 6 | **Mentor & Wellbeing** | Mentee relationship management, check-ins, human-in-the-loop early warning — the "human touch" | 🔲 New |

**Why these 3 are the right additions (not just "more of the same"):**
- **Research & Grants** covers a faculty member's *career growth*, which nothing else in
  the system touches — publications and funding are tracked in spreadsheets or not at all
  today.
- **Exam & Assessment Design** solves one of the single most time-consuming, high-stakes
  admin burdens in Indian engineering colleges (paper-setting, CO/PO compliance, Bloom's
  taxonomy mapping for NBA) with almost no good tooling anywhere.
- **Mentor & Wellbeing** is deliberately NOT a duplicate of Analytics' at-risk scoring.
  Analytics tells you *what the numbers say*; this agent helps you *act on a relationship*
  — meeting logs, check-in cadence, escalation to a counselor — the human process around
  a number, not another number.

Agent 1 (Faculty Assistant) remains the **orchestrator/front door** for all 5 other agents
— it can delegate to any of them and synthesize a combined answer.

### Recommended Stack (unchanged)
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** FastAPI (Python), SQLAlchemy, Pydantic v2
- **Agent Orchestration:** LangGraph (or CrewAI) — Agent 1 as supervisor, 5 agents as tools
- **LLM:** Claude (Anthropic API), tool-calling for inter-agent delegation
- **Vector DB (RAG):** ChromaDB — used by Faculty Assistant (policies) AND now Research
  Agent (paper/grant corpora) and Assessment Agent (question bank)
- **Relational DB:** PostgreSQL
- **Charts:** Recharts
- **Deployment:** Vercel (frontend) + Railway/Render (backend)

---

## 0.5 Design System — DARK LEDGER theme (matches what's already built)

Your screenshot shows the coding agent shipped a **dark** version of the original spec —
near-black navy background, indigo seals, serif display headings, mono data/labels. That
execution is good and consistent. **Formalize it as the real design system below** so all
6 agents (not just Agent 1) match it exactly. Do not let any new agent introduce its own
background color, font, or component style.

### Design concept
**"Faculty register, digitized, at night."** Same ledger/gradebook DNA as before — ruled
tables, stamped seals, ledger numerals — but on a dark, focused, "control room" surface
instead of paper-white. Each of the 6 agents gets one accent hue; everything else (bg,
surface, text, borders, type) is shared and identical across all of them.

### Color tokens

```css
:root {
  /* Base (dark) */
  --bg:             #0B0D13;   /* app background */
  --surface:        #12151D;   /* card / panel background */
  --surface-raised: #171B26;   /* hover / nested elements */
  --border:         rgba(255,255,255,0.08);
  --border-strong:  rgba(255,255,255,0.16);
  --ink:            #F1F2F6;   /* primary text */
  --ink-muted:      #8A91A6;   /* secondary text */

  /* Agent 1 — Faculty Assistant (indigo) */
  --agent1-500: #6366F1;
  --agent1-a15: rgba(99,102,241,0.15);
  --agent1-200: #A5A8F5;

  /* Agent 2 — Academic Workflow (emerald) */
  --agent2-500: #10B981;
  --agent2-a15: rgba(16,185,129,0.15);
  --agent2-200: #6EE7B7;

  /* Agent 3 — Analytics & Accreditation (amber) */
  --agent3-500: #F59E0B;
  --agent3-a15: rgba(245,158,11,0.15);
  --agent3-200: #FCD34D;

  /* Agent 4 — Research & Grants (sky) */
  --agent4-500: #38BDF8;
  --agent4-a15: rgba(56,189,248,0.15);
  --agent4-200: #93DFFB;

  /* Agent 5 — Exam & Assessment Design (fuchsia) */
  --agent5-500: #D946EF;
  --agent5-a15: rgba(217,70,239,0.15);
  --agent5-200: #F0ABFC;

  /* Agent 6 — Mentor & Wellbeing (rose) */
  --agent6-500: #FB7185;
  --agent6-a15: rgba(251,113,133,0.15);
  --agent6-200: #FDA4AF;

  /* Status (readable on dark surfaces) */
  --status-good: #34D399;
  --status-warn: #FBBF24;
  --status-bad:  #F87171;
  --status-good-a15: rgba(52,211,153,0.15);
  --status-warn-a15: rgba(251,191,36,0.15);
  --status-bad-a15:  rgba(248,113,113,0.15);
}
```

### Typography (already correctly implemented — keep exactly as is)

| Role | Typeface | Used for |
|---|---|---|
| Display | **Fraunces** (serif, variable weight) | Agent names, greetings, big KPI numbers |
| UI / Body | **Inter** | Buttons, labels, chat text, nav, body copy |
| Data / Mono | **IBM Plex Mono** | Roll numbers, dates, percentages, badges, uppercase labels like "SYSTEM 1.0" |

Type scale (rem): `2.25 / 1.875 / 1.5 / 1.25 / 1rem / 0.875 / 0.75`.

### Spacing, radius, shadow

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px
- Radius: `--radius-sm: 8px` (inputs, chips, badges), `--radius-md: 12px` (cards), `--radius-lg: 20px` (modals)
- On dark surfaces, depth comes from a lighter `--surface-raised` fill + `--border`, NOT
  drop shadows (shadows barely read on dark backgrounds). Reserve shadow for floating
  elements over content, e.g. `0 8px 24px rgba(0,0,0,0.4)` for the query bar / drawers.

### Core components (identical across all 6 agents — only the accent variable changes)

- **Button (primary):** agent accent-500 background, `--bg`-colored (near-black) text for
  contrast, `--radius-sm`, 10px/16px padding, scale-down 0.98 on press.
- **Button (secondary/outline):** transparent bg, 1px `--border-strong`, `--ink` text,
  border becomes accent-500 on hover.
- **Card:** `--surface` background, 1px `--border`, `--radius-md`, 20-24px padding.
- **Input:** `--surface-raised` background, 1px `--border`, `--radius-sm`, border becomes
  accent-500 on focus.
- **Badge/status pill:** accent-a15 (or status-*-a15) background, accent-200 (or status
  color) text, `--radius-sm`, Plex Mono, uppercase, small.
- **Seal:** 40px circle, accent-500 fill, 2px inner ring in `--bg` (creates the "stamped
  into dark paper" look already visible in your screenshot), centered white line icon.
  28px compact version for chat avatars and sidebar rows. Inactive sidebar items: seal at
  40% opacity, full color + accent-a15 pill background when active — exactly as already
  implemented for Agent 1 in the sidebar.

### ASCII wireframe — app shell with 6 agents

```
+-----------------------------------------------------------------+
|  [seal] EduPilot     [seal] FACULTY ASSISTANT      Dr. Name  [>]| <- top bar, --surface
+-----------+-------------------------------------------------------+
| FACULTY   |                                                       |
| AGENTS    |                                                       |
|           |                 MAIN CONTENT                          |
| * Faculty |           (theme = active agent's accent)             |
|   Assist. |                                                       |
| o Academic|                                                       |
|   Workflow|                                                       |
| o Analytic|                                                       |
|   s & Acc.|                                                       |
| o Research|                                                       |
|   & Grants|                                                       |
| o Exam &  |                                                       |
|   Assess. |                                                       |
| o Mentor &|                                                       |
|   Wellbng |                                                       |
+-----------+-------------------------------------------------------+
```
Sidebar now lists 6 rows in this fixed order (matches the table in Section 0). Same
active/inactive treatment as already built for Agent 1 — do not change that pattern, just
extend it three more times.

### Technical guardrails — verify BEFORE calling any new agent's UI done

1. `tailwind.config.js` content globs actually cover every file using Tailwind classes.
2. Root CSS has all 3 `@tailwind` directives and is imported in the app entrypoint.
3. Fraunces / Inter / IBM Plex Mono are actually loading (check computed font-family in
   devtools) — new agents must NOT introduce a different font "for variety."
4. **Screenshot each new agent's main screen next to the existing Agent 1 screen.**
   Background color, border treatment, seal style, and type should be indistinguishable
   in *kind* — only the accent hue should differ. If a new screen looks like a different
   app, stop and fix it before moving on.

---

## Phase 0 — Foundation & Shell — ✅ Already built

Keep as-is. If revisiting, the sidebar needs exactly 6 rows per the wireframe above instead
of 3 — add the 3 new agent entries (grayscale/inactive by default) now so the shell is
ready for phases 4-6, even before those agents have real functionality.

```
Update the existing EduPilot shell: add 3 new entries to the sidebar agent switcher —
"Research & Grants" (sky seal), "Exam & Assessment Design" (fuchsia seal), "Mentor &
Wellbeing" (rose seal) — using the exact same sidebar row pattern already built for the
first 3 agents (seal + name + subtitle, grayscale/40% opacity when inactive, accent-a15
pill + full color when active). Each should route to a placeholder screen using that
agent's accent-a15 as a soft background wash, matching the placeholder pattern from the
original Phase 0, until its real phase is built. Do not change anything about the already-
built Faculty Assistant screen.
```

---

## Phase 1 — Agent 1: Faculty Assistant — ✅ Already built

No action needed. Reference screen for visual QA on every phase below.

---

## Phase 2 — Agent 2: Academic Workflow

```
Build the Academic Workflow Agent. Accent: --agent2-500 (emerald). Operational
doer — table/kanban-first, not chat-first. Match the dark theme exactly as built for
Agent 1 (--bg, --surface, --border, Fraunces/Inter/Plex Mono, seal system) — only the
accent color changes.

BACKEND - /backend/agents/academic_workflow/
1. Models: AttendanceRecord, Assignment, Submission, InternalMark, Student
   (student_id, roll_no, name, class_section, mentor_faculty_id, email).
2. Tools: get_attendance_report, mark_attendance, get_pending_submissions,
   calculate_internal_marks (configurable weights), generate_progress_report,
   get_pending_faculty_tasks, schedule_assignment.
3. Endpoint: POST /agents/academic-workflow/chat (streaming) + REST endpoints
   (GET /attendance, GET /assignments) for fast table loads.
4. Wire up delegate_to_academic_workflow() from Agent 1.

FRONTEND (accent: emerald)
- Tab bar under the seal/title: Attendance | Assignments | Marks | Reminders.
- Attendance tab: data grid on --surface, Plex Mono roll numbers, status toggle pills
  (--status-good / --status-bad), big Fraunces percentage in the summary bar.
- Assignments tab: kanban columns (Scheduled/Open/Grading/Closed), Cards with submission-
  count badges.
- Marks tab: spreadsheet table, Plex Mono numerals, auto-total column tinted
  --agent2-a15.
- Reminders tab: checklist, overdue items get a --status-bad left border.
- Floating chat drawer, bottom-right, collapsed emerald seal pill, expands into a
  --surface panel.

DELIVERABLE: screenshot next to Agent 1 — same bg/surface/border/type, only accent
differs. Faculty can mark attendance, track submissions, view marks, get reminders, via
UI and natural language.
```

---

## Phase 3 — Agent 3: Analytics & Accreditation

```
Build the Analytics & Accreditation Agent. Accent: --agent3-500 (amber). Executive
dashboard — dense with charts, numbers-forward. Same dark theme as Agent 1.

BACKEND - /backend/agents/analytics/
1. Reuses Academic Workflow's tables. Add: COAttainment, FacultyWorkload.
2. Tools: analyze_performance, predict_at_risk_students (transparent weighted formula:
   attendance % + marks trend + submission rate), generate_nba_co_report,
   generate_faculty_workload_report, get_department_statistics.
3. Endpoint: POST /agents/analytics/chat (streaming) + REST for dashboard widgets.
4. Wire up delegate_to_analytics() from Agent 1.

FRONTEND (accent: amber)
- 4 KPI cards in a row: Fraunces numerals, Plex Mono sparkline, Inter uppercase label.
- 2x2 chart grid (Recharts): performance distribution, attendance trend, at-risk table
  (Badge: red >70 / amber 40-70 / green <40, sortable), CO attainment vs target.
- Chart palette: amber primary series + --ink-muted for comparison series only — no
  default rainbow Recharts colors.
- Report buttons -> downloadable styled PDF (letterhead pattern), labeled clearly as
  draft-for-review.
- Floating query bar, bottom-center, amber border, expands upward with inline answer card.

DELIVERABLE: screenshot next to Agent 1 for visual consistency. Live dashboard, both
reports generate, natural-language at-risk queries work.
```

---

## Phase 4 — Agent 4: Research & Grants (NEW)

```
Build the Research & Grants Agent — a faculty member's personal research career copilot.
Accent: --agent4-500 (sky). This is new; there is no equivalent in the original 3-agent
spec. Same dark theme, seal system, and component set as Agent 1.

PURPOSE: Track publications, patents, and funding opportunities; surface deadlines;
suggest collaborators; draft research-related documents. Nothing else in Faculty OS
touches career/research growth — this fills that gap.

BACKEND - /backend/agents/research_grants/
1. Data models:
   - Publication: faculty_id, title, venue, type (journal/conference/patent), year,
     co_authors, doi_or_link, citation_count
   - GrantOpportunity: title, funding_body, amount, eligibility, deadline, focus_area
   - ResearchDeadline: type (submission/review/renewal), title, due_date, related_publication_id
2. RAG corpus: ingest the faculty member's own publication PDFs + a small curated set of
   funding-body call documents into ChromaDB (separate collection from the policy RAG in
   Agent 1) so the agent can answer "what funding fits my current research area" with
   citations.
3. Tools:
   - log_publication(details) -> add to Publication table
   - get_publication_summary(faculty_id) -> counts by type/year, citation trend
   - find_matching_grants(research_area) -> RAG + filter GrantOpportunity by focus_area
     and open deadline
   - get_upcoming_deadlines(faculty_id) -> merges submission/review/renewal deadlines,
     sorted by urgency
   - suggest_coauthors(research_area) -> simple heuristic: match faculty in same
     department/subject area with recent related publications (MVP: rule-based, not
     real network analysis)
   - draft_grant_summary(opportunity_id, faculty_research_area) -> LLM-drafted 1-paragraph
     fit statement for a grant application, NOT a full proposal (avoid overpromising scope)
4. Endpoint: POST /agents/research-grants/chat (streaming) + REST for the publication list
   and deadline feed.

FRONTEND (accent: sky, Layout: split — timeline-left, publications-right)
Wireframe:
```
+---------------------------------------------------------+
| [seal] Research & Grants                                 |
|----------------------------------------------------------|
| DEADLINES (left, 35%)          | PUBLICATIONS (right, 65%)|
| +----------------------------+ | +-----------------------+|
| | o 3 days  IEEE Conf.        | | 2026  "Title of paper" ||
| |   Camera-ready due          | |   Journal * cited 4    ||
| | o 12 days AICTE Grant       | |-------------------------||
| |   Application deadline      | | 2025  "Another paper"  ||
| | o 30 days Patent renewal    | |   Conference * cited 12||
| +----------------------------+ | +-----------------------+|
|                                 |                          |
| MATCHING GRANTS                | [+ Log new publication]  |
| +----------------------------+ |                          |
| | AICTE RPS  amount: 8L       | |                          |
| |  fit: "Matches your ML..."  | |                          |
| +----------------------------+ |                          |
+---------------------------------------------------------+
| [ Ask about grants, deadlines, or co-authors...] [Send]  |
+---------------------------------------------------------+
```
- Deadline items: urgency-colored left border (--status-bad if <7 days, --status-warn if
  <30, else --agent4-500), Plex Mono day-count in a Badge.
- Publications list: Fraunces year as a small label, title in Inter medium, venue + citation
  count in Plex Mono/--ink-muted, grouped by year with a thin divider.
- Matching Grants cards: sky accent border-left, amount in Plex Mono, one-line AI fit
  reasoning in italic Inter, "View full call" link.
- Empty state (no publications logged yet): seal-centered card, "Log your first
  publication to start building your research timeline."

DELIVERABLE: screenshot next to Agent 1 for consistency. Faculty can log a publication,
see upcoming deadlines sorted by urgency, get grant matches with a plain-language fit
reason, and ask natural-language questions like "what grants fit my AI research."
```

---

## Phase 5 — Agent 5: Exam & Assessment Design (NEW)

```
Build the Exam & Assessment Design Agent — solves paper-setting, one of the most
time-consuming and highest-stakes admin tasks for engineering faculty. Accent:
--agent5-500 (fuchsia). Same dark theme, seal system, component set as Agent 1.

PURPOSE: Generate question papers aligned to Bloom's taxonomy and CO/PO mapping (required
for NBA compliance), build rubrics, and manage paper moderation — turning a multi-hour
manual task into a guided, auditable workflow.

BACKEND - /backend/agents/exam_assessment/
1. Data models:
   - QuestionBankItem: subject, unit, co_number, bloom_level (Remember/Understand/Apply/
     Analyze/Evaluate/Create), question_text, marks, difficulty
   - QuestionPaper: subject, exam_type (CAT1/CAT2/Semester), total_marks, duration,
     co_coverage (json), bloom_distribution (json), status (draft/moderated/final)
   - Rubric: question_paper_id or assignment_id, criteria (json: criterion, max_marks,
     descriptors)
2. RAG corpus: ingest past question papers + the subject syllabus (reuse Agent 1's
   SyllabusUnit data) so generated questions are grounded in actual unit content, not
   generic templates.
3. Tools:
   - generate_question_paper(subject, exam_type, total_marks, co_targets, bloom_targets)
     -> drafts a full paper hitting the requested CO coverage and Bloom's distribution,
     pulling from QuestionBankItem where possible and generating new questions (grounded
     via RAG on the syllabus) where the bank is thin
   - validate_co_po_mapping(question_paper_id) -> checks whether the paper's actual CO
     coverage matches the department's required distribution, flags gaps
   - generate_rubric(question_or_assignment) -> criterion-based rubric with marks and
     descriptors
   - moderate_paper(question_paper_id, moderator_notes) -> status transition + notes log
4. Endpoint: POST /agents/exam-assessment/chat (streaming) + REST for question bank CRUD
   and paper status.

FRONTEND (accent: fuchsia, Layout: paper builder wizard + question bank browser)
Wireframe:
```
+---------------------------------------------------------+
| [seal] Exam & Assessment Design                          |
|----------------------------------------------------------|
| BUILD A PAPER                    | CO / BLOOM COVERAGE    |
| Subject: [Design & Analysis...v] | +---------------------+|
| Exam type: [CAT-2 v]             | | CO1 ####      80%    ||
| Total marks: [50]  Duration:[90m]| | CO2 ###       60%    ||
| Bloom target:                    | | CO3 #####     95%    ||
|  Remember  [10%]                 | +---------------------+|
|  Understand[20%]                 | Bloom distribution      |
|  Apply     [30%]                 | (donut chart, fuchsia   |
|  Analyze   [25%]                 |  + slate segments)      |
|  Evaluate  [10%]                 |                          |
|  Create    [5%]                  |                          |
| [ Generate Paper ]               |                          |
|-----------------------------------------------------------|
| DRAFT PAPER (generated)                    [Moderate v]   |
| Q1. Explain... (CO1, Understand, 5 marks)     [Edit][x]   |
| Q2. Derive...  (CO2, Apply, 10 marks)          [Edit][x]  |
| ...                                                        |
+---------------------------------------------------------+
```
- Bloom target inputs: small horizontal sliders or numeric inputs, sum-to-100% validation
  with a live Badge showing current total (fuchsia if =100%, --status-bad if not).
- CO coverage panel: horizontal bar-per-CO using fuchsia fill, percentage in Plex Mono,
  --status-warn tint if below the department's required minimum.
- Draft paper list: each question as a row Card, CO + Bloom level as small Badges,
  Edit/Remove actions, drag-to-reorder.
- Status pill top-right of the draft (Draft/Moderated/Final) using the standard Badge
  component with status colors.
- Rubric generation: accessible as a secondary action per question or per paper, opens a
  Card with criterion rows (criterion / max marks / descriptor) in an editable table.

DELIVERABLE: screenshot next to Agent 1 for consistency. Faculty can generate a full
question paper against CO and Bloom's targets, see coverage visualized, edit/remove
questions, generate a rubric, and move a paper through draft -> moderated -> final.
```

---

## Phase 6 — Agent 6: Mentor & Wellbeing (NEW)

```
Build the Mentor & Wellbeing Agent — manages the human relationship side of mentorship,
distinct from Analytics' numeric at-risk scoring. Accent: --agent6-500 (rose). Same dark
theme, seal system, component set as Agent 1.

PURPOSE: Track mentee check-ins, meeting logs, and a gentle escalation path — helping
faculty follow through on the *human* process around a student who needs support, not
just see another risk percentage. Deliberately calmer, warmer, less data-dense than
Analytics.

BACKEND - /backend/agents/mentor_wellbeing/
1. Data models:
   - Mentee: student_id, mentor_faculty_id, class_section, last_checkin_date
   - CheckIn: mentee_id, date, mode (in-person/call/chat), notes (free text, treat as
     sensitive — encrypt at rest or at minimum restrict access to the assigned mentor),
     mood_tag (optional, faculty-selected: doing well / needs attention / concerning)
   - Escalation: mentee_id, raised_by, reason, escalated_to (counselor/HOD), status
     (open/in-progress/resolved), created_at
2. Tools:
   - get_checkin_schedule(faculty_id) -> mentees overdue for a check-in (configurable
     cadence, e.g. every 3 weeks), sorted by how overdue
   - log_checkin(mentee_id, notes, mood_tag) -> saves a check-in record
   - get_mentee_timeline(mentee_id) -> chronological check-in history for one student
   - suggest_checkin_prompt(mentee_id) -> LLM-generated, context-aware conversation
     starters (pulls recent attendance/marks trend from Academic Workflow/Analytics via
     delegation ONLY as light context, never as the entire basis for the conversation —
     the point is the human conversation, not a data readout)
   - raise_escalation(mentee_id, reason, escalate_to) -> creates an Escalation record and
     a notification stub for the counselor/HOD
3. IMPORTANT PRIVACY NOTE FOR THE BUILDING AGENT: check-in notes are sensitive personal
   data about students. Do not expose them outside the assigned mentor's own view, do not
   include raw notes in any aggregate analytics, and do not let this agent's data flow
   into Agent 3's risk scoring without the notes being stripped to structured tags only.
4. Endpoint: POST /agents/mentor-wellbeing/chat (streaming) + REST for check-in schedule
   and mentee list.

FRONTEND (accent: rose, Layout: calm list-first, NOT dashboard-dense)
Wireframe:
```
+---------------------------------------------------------+
| [seal] Mentor & Wellbeing                                 |
|----------------------------------------------------------|
| MY MENTEES                                                |
| +-------------------------------------------------------+|
| | o A. Kumar (24CC001)      Last check-in: 4 weeks ago   ||
| |   [ Log check-in ]  [ View timeline ]                  ||
| |-------------------------------------------------------  ||
| | o B. Priya (24CC002)      Last check-in: 3 days ago     ||
| |   [ Log check-in ]  [ View timeline ]                  ||
| +-------------------------------------------------------+|
|                                                            |
| SUGGESTED THIS WEEK                                       |
| +-------------------------------------------------------+|
| | rose dot  A. Kumar is overdue for a check-in. Recent    ||
| | attendance dipped slightly — might be worth asking      ||
| | how the semester is going.        [ Start check-in ]   ||
| +-------------------------------------------------------+|
+---------------------------------------------------------+
```
- Mentee rows: simple list Cards, NOT a data grid — name in Inter medium, "last check-in"
  in --ink-muted, rose left-border only on overdue rows (not a red/urgent color — keep the
  tone caring, not alarming).
- No numeric risk scores displayed here — that lives in Analytics. This screen speaks in
  relative time ("3 days ago") and plain language, not percentages.
- Check-in logging: a simple modal — mode dropdown, mood tag as 3 gentle Badge options
  (doing well / needs attention / concerning) in muted rose/amber/status-bad tones, free
  text notes field.
- Suggested-this-week panel: rose-accent Cards with a one-line, human-toned nudge
  (generated by suggest_checkin_prompt), never a bare data dump.
- Mentee timeline (on "View timeline"): vertical log, most recent first, each entry a
  small Card with date (Plex Mono) + mood Badge + notes.

DELIVERABLE: screenshot next to Agent 1 for consistency — same dark theme and components,
but visibly calmer/less dense than Analytics. Faculty can see who's overdue for a
check-in, log one, view a mentee's timeline, and raise an escalation.
```

---

## Phase 7 — True Multi-Agent Collaboration (6-agent version)

```
Wire all 6 agents together so Agent 1 (Faculty Assistant) can orchestrate multi-step
requests across any of the other 5.

BASELINE WORKFLOW (unchanged from the 3-agent version, must still work):
  "Generate today's attendance, identify weak students, and email their mentors."
  Faculty Assistant -> Academic Workflow (attendance) -> Analytics (risk) ->
  Faculty Assistant (drafts + summary card).

NEW EXTENDED WORKFLOW to implement, showing the full 6-agent value:
  "Which of my mentees are overdue for a check-in AND have a dropping attendance trend,
   and draft me a gentle check-in prompt for each?"

  1. Faculty Assistant plans: needs Mentor & Wellbeing (overdue list) + Academic Workflow
     (attendance trend) + itself (drafting the prompts).
  2. delegate_to_mentor_wellbeing() -> get_checkin_schedule() -> overdue mentee list.
  3. delegate_to_academic_workflow() -> get_attendance_report() per mentee -> trend check.
  4. Cross-reference: mentees who are BOTH overdue AND trending down.
  5. Faculty Assistant calls suggest_checkin_prompt() (via Mentor & Wellbeing) for each
     flagged mentee and returns a summary card: mentee name, why flagged (plain language,
     no raw percentages), and a ready-to-use conversation starter, with a
     "Log check-in now" action that deep-links into the Mentor & Wellbeing agent.

FRONTEND - Cross-agent trace visualization:
Extend the existing trace strip to support any subset of the 6 seals lighting up in
sequence (not hardcoded to 3) with a short label per step. Keep the same visual pattern
already used for the baseline workflow — just make it generic over however many agents a
given plan actually touches.

DELIVERABLE: both the original 3-agent workflow and the new 6-agent mentee check-in
workflow work end-to-end, with a visible trace of which agents were involved and why.
```

---

## Phase 8 — Polish & MVP Hardening

```
Final pass before calling this MVP-complete:

1. Error handling: every agent endpoint handles LLM timeouts, empty RAG results, and DB
   errors with faculty-friendly messages in the interface's voice.
2. Loading states: skeleton loaders matching each surface's shape, typing indicator for
   streaming chat, consistent across all 6 agents.
3. Empty states: every tab/list/dashboard across all 6 agents has a designed empty state
   using its seal + a one-line action-oriented message.
4. Accessibility/quality floor: visible focus rings (2px accent outline), color contrast
   checked especially for the -a15 tinted backgrounds against --ink text, responsive down
   to 1024px, reduced-motion respected.
5. Session persistence: chat history per agent persists across reloads.
6. Privacy pass specifically for Mentor & Wellbeing: confirm check-in notes are scoped to
   the assigned mentor only, and confirm nothing from that agent leaks unredacted into
   Analytics or any cross-agent summary.
7. Seed/demo data covering all 6 agents (including a few overdue mentees, a few near-
   deadline grants, and a sample question bank) so a fresh clone demos in under 5 minutes.
8. README with setup instructions, env vars, and a 60-second architecture summary
   covering all 6 agents.
9. Final full-app screenshot pass: all 6 agent screens side by side — same bg/surface/
   border/type, only accent hue and layout density differ by design (chat-first,
   table-first, dashboard-first, timeline-first, wizard-first, list-first respectively).

DELIVERABLE: a demo-ready MVP — one login, six distinctly-purposed but visually cohesive
agents, real inter-agent delegation with a visible trace across any combination of them,
and both flagship workflows (attendance/at-risk/email, and mentee check-in) working live.
```
