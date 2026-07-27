# EduPilot - Multi-Agent Faculty Platform (MVP Phase 0 & 1)

EduPilot is a specialized multi-agent operating system designed for academic faculty members to orchestrate schedules, manage syllabus data, track workflows, and retrieve institutional policies.

## Project Structure

```text
/backend
  /agents             # Capability agents (Faculty Assistant, Workflow, Analytics)
    /faculty_assistant# Phase 1: Daily-driver assistant, policy search, drafts
  /core               # Shared codebase (DB models, JWT auth, seed scripts, LLM client)
  /rag                # ChromaDB vector store ingestion and retrieval pipeline
/frontend             # React + Vite + TypeScript + Tailwind CSS UI
  /src
    /components       # Common design system components (Card, Seal, Button, Badge)
    /context          # AgentThemeProvider for real-time CSS variable skinning
    /pages            # Login, Dashboard, FacultyAssistant, StyleGuide
    /services         # api.ts (backend client + static mock flow)
```

## Features Implemented (Phase 0 & Phase 1)

1. **Robust Dark Theme Design System:** Adheres strictly to the user rule ("dont use light mode for ui") with vibrant indigo/emerald/amber accents, Fraunces serif display fonts, Inter body copy, and IBM Plex Mono data ledgers.
2. **Dynamic Skinning:** Seamlessly switches colors/styles when switching between agents using React Context and CSS variables.
3. **Internal Style Guide:** Accessible at `/dev/style-guide` to validate all tokens, buttons, cards, badges, inputs, and seal graphics.
4. **JWT-based Authentication:** Secure logins using passwords hashed with bcrypt, returning signed JWT tokens.
5. **Database Core & Seed:** SQLite configuration with a pre-seeded faculty member (`demo@faculty.edu` / `demo1234`), mock schedules, curriculum plans, and policy logs.
6. **Policy RAG Pipeline:** Ingests unstructured policy documents into ChromaDB, embedding text via sentence-transformers, and returning cited references.
7. **Streamed Faculty Chat:** PROGRESSIVE text stream of chat responses over Server-Sent Events (SSE) including execution traces of agent tools (`get_todays_schedule`, `search_policies`, `create_lesson_plan`, `draft_email`).
8. **Rich Layout Cards:** Chat-rendered timetable cards, copy-pastable/editable email draft cards, and collapsible unit lesson structures.

---

## How to Run

### 1. Run the Backend

Make sure you have Python 3.10+ installed.

1. Navigate to `/backend`
2. Create and activate virtual environment (already initialized at `.venv`):
   ```powershell
   .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start FastAPI server using Uvicorn:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   *The DB is seeded automatically on server startup. The API will run on `http://localhost:8000`.*

### 2. Run the Frontend

1. Navigate to `/frontend`
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend runs on `http://localhost:5173`. Click the dev style guide link to preview components.*

---

## Technical Notes & Fail-safes
- **LLM API Fallback:** If `ANTHROPIC_API_KEY` is not provided in `backend/.env`, the system defaults to a high-fidelity local parser that mimics Claude 3.5 Sonnet outputs.
- **RAG Fallback:** If ChromaDB or torch fails to initialize locally, the RAG engine switches to a keyword-matching fallback database, preventing system crashes.
- **Frontend Server Offline Fallback:** If the backend FastAPI is offline, the React client automatically intercepts requests and provides mock streaming, allowing full UI demonstration.
