# EduPilot Architecture Spec - Phase 1

EduPilot uses a service-oriented architectural layout structured for high-fidelity multi-agent faculty support.

```mermaid
graph TD
    A[React App Shell] -->|HTTP/JWT| B[FastAPI Backend]
    A -->|SSE Stream| C[Faculty Assistant Chat]
    C -->|Tool Dispatch| D[get_todays_schedule]
    C -->|Tool Dispatch| E[search_policies]
    C -->|Tool Dispatch| F[create_lesson_plan]
    C -->|Tool Dispatch| G[draft_email]
    
    E -->|Embeddings| H[ChromaDB Vector Store]
    D -->|Query| I[SQLite Database]
    F -->|Generation| J[Claude 3.5 Sonnet / Mock]
    G -->|Generation| J
```

## Agents & Roles

1. **Faculty Assistant Agent (Indigo):** Main Daily driver orchestrator. Handles schedule lookups, email drafting, syllabus extraction, and general administrative RAG queries.
2. **Academic Workflow Agent (Emerald - Phase 2):** Grid-centric doer agent. Coordinates grading sheets, student roll marks, attendance submissions, and reminders.
3. **Analytics Agent (Amber - Phase 3):** Performance/charts generator. Assesses student at-risk trends and generates accreditation (NBA/NAAC) compliance reports.
