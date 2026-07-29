import os
import json
import asyncio
import datetime
from fastapi import FastAPI, Depends, HTTPException, status, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db, engine, Base
from core.models import (
    Faculty, Student, AttendanceRecord, Assignment, Submission, InternalMark,
    COAttainment, FacultyWorkload, Publication, GrantOpportunity, ResearchDeadline,
    QuestionBankItem, QuestionPaper, Rubric, Mentee, CheckIn, Escalation,
    PlacementDrive, Internship, Alumni, DonationLedger, Event, CommitteeTask,
    LabAsset, SoftwareLicense, BookRequisition
)
from core.auth import verify_password, create_access_token, verify_token
from core.seed import seed_database
from agents.faculty_assistant.agent import handle_faculty_assistant_chat
from agents.academic_workflow.agent import handle_academic_workflow_chat
from agents.analytics.agent import handle_analytics_chat
from agents.research_grants.agent import handle_research_grants_chat
from agents.placement_internships.agent import handle_placement_chat
from agents.alumni_relations.agent import handle_alumni_chat
from agents.event_management.agent import handle_event_chat
from agents.inventory_resources.agent import handle_inventory_chat
from agents.exam_assessment.agent import (
    handle_exam_assessment_chat,
    build_question_paper,
    build_rubric,
    create_question_bank_item,
    delete_question_bank_item,
    moderate_paper,
    serialize_paper,
    update_question_bank_item,
    update_question_paper,
    update_question_paper_status,
    validate_co_po_mapping,
)
from agents.mentor_wellbeing.agent import (
    handle_mentor_wellbeing_chat,
    get_checkin_schedule,
    get_mentee_timeline,
    log_checkin,
    suggest_checkin_prompt,
    raise_escalation,
    get_escalations,
    update_escalation_status,
    get_mentor_stats,
    get_mentor_tasks,
    create_mentor_task,
    get_future_notes,
    add_future_note,
    edit_mentor_task
)

def ensure_exam_schema():
    inspector = inspect(engine)
    if "question_paper" not in inspector.get_table_names():
        return

    columns = [column["name"] for column in inspector.get_columns("question_paper")]
    if "moderator_notes" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE question_paper ADD COLUMN moderator_notes TEXT"))

# Initialize DB tables
Base.metadata.create_all(bind=engine)
ensure_exam_schema()

app = FastAPI(title="EduPilot Backend", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, allow all origins. Can narrow in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed database on startup
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        seed_database(db)
    finally:
        db.close()

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "EduPilot API"}

# Auth API
@app.post("/auth/login")
def login(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required"
        )
        
    faculty = db.query(Faculty).filter(Faculty.email == email).first()
    if not faculty or not verify_password(password, faculty.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    access_token = create_access_token(data={"sub": faculty.email, "id": faculty.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": faculty.id,
            "name": faculty.name,
            "email": faculty.email,
            "department": faculty.department,
            "designation": faculty.designation
        }
    }

@app.get("/auth/me")
def get_current_user(token: str = Depends(verify_token), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    email = token.get("sub")
    faculty = db.query(Faculty).filter(Faculty.email == email).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty member not found"
        )
    return {
        "id": faculty.id,
        "name": faculty.name,
        "email": faculty.email,
        "department": faculty.department,
        "designation": faculty.designation
    }

# Schedule CRUD API

@app.get("/api/schedule")
def get_schedule(token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = 1
    if token:
        faculty_id = token.get("id", 1)

    from core.models import Timetable
    schedules = db.query(Timetable).filter(Timetable.faculty_id == faculty_id).all()
    return [
        {
            "id": s.id,
            "day_of_week": s.day_of_week,
            "period": s.period,
            "subject": s.subject,
            "class_section": s.class_section,
            "room": s.room
        }
        for s in schedules
    ]

@app.post("/api/schedule")
def create_schedule(payload: dict = Body(...), token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = 1
    if token:
        faculty_id = token.get("id", 1)

    day_of_week = payload.get("day_of_week")
    period = payload.get("period")
    subject = payload.get("subject")
    class_section = payload.get("class_section")
    room = payload.get("room")

    if not all([day_of_week, period, subject, class_section, room]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    from core.models import Timetable
    new_slot = Timetable(
        faculty_id=faculty_id,
        day_of_week=day_of_week,
        period=period,
        subject=subject,
        class_section=class_section,
        room=room
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)

    return {
        "id": new_slot.id,
        "day_of_week": new_slot.day_of_week,
        "period": new_slot.period,
        "subject": new_slot.subject,
        "class_section": new_slot.class_section,
        "room": new_slot.room
    }

@app.put("/api/schedule/{slot_id}")
def update_schedule(slot_id: int, payload: dict = Body(...), token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = 1
    if token:
        faculty_id = token.get("id", 1)

    from core.models import Timetable
    slot = db.query(Timetable).filter(Timetable.id == slot_id, Timetable.faculty_id == faculty_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")

    if "day_of_week" in payload:
        slot.day_of_week = payload["day_of_week"]
    if "period" in payload:
        slot.period = payload["period"]
    if "subject" in payload:
        slot.subject = payload["subject"]
    if "class_section" in payload:
        slot.class_section = payload["class_section"]
    if "room" in payload:
        slot.room = payload["room"]

    db.commit()
    db.refresh(slot)

    return {
        "id": slot.id,
        "day_of_week": slot.day_of_week,
        "period": slot.period,
        "subject": slot.subject,
        "class_section": slot.class_section,
        "room": slot.room
    }

@app.delete("/api/schedule/{slot_id}")
def delete_schedule(slot_id: int, token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = 1
    if token:
        faculty_id = token.get("id", 1)

    from core.models import Timetable
    slot = db.query(Timetable).filter(Timetable.id == slot_id, Timetable.faculty_id == faculty_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")

    db.delete(slot)
    db.commit()

    return {"status": "success", "message": f"Deleted slot {slot_id}"}

@app.post("/api/schedule/bulk")
def bulk_upload_schedule(payload: dict = Body(...), token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = 1
    if token:
        faculty_id = token.get("id", 1)

    slots_data = payload.get("slots")
    if not isinstance(slots_data, list):
        raise HTTPException(status_code=400, detail="slots must be a list")

    from core.models import Timetable
    
    # Delete existing schedules for this faculty if requested (overwrite mode)
    overwrite = payload.get("overwrite", False)
    if overwrite:
        db.query(Timetable).filter(Timetable.faculty_id == faculty_id).delete()

    added_slots = []
    for slot_data in slots_data:
        day_of_week = slot_data.get("day_of_week")
        period = slot_data.get("period")
        subject = slot_data.get("subject")
        class_section = slot_data.get("class_section")
        room = slot_data.get("room")

        if not all([day_of_week, period, subject, class_section, room]):
            continue

        new_slot = Timetable(
            faculty_id=faculty_id,
            day_of_week=day_of_week,
            period=period,
            subject=subject,
            class_section=class_section,
            room=room
        )
        db.add(new_slot)
        added_slots.append(new_slot)

    db.commit()
    return {
        "status": "success",
        "count": len(added_slots),
        "message": f"Successfully imported {len(added_slots)} schedule slots."
    }

# Policy Upload API

@app.post("/api/policy")
async def upload_policy(
    title: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not title or not category:
        raise HTTPException(status_code=400, detail="Title and Category are required")
        
    try:
        content = await file.read()
        text_content = content.decode("utf-8", errors="ignore")
        
        # Save file locally
        policies_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "policies")
        os.makedirs(policies_dir, exist_ok=True)
        
        safe_filename = "".join([c if c.isalnum() or c in (".", "_", "-") else "_" for c in file.filename])
        file_path = os.path.join("policies", safe_filename)
        abs_file_path = os.path.join(policies_dir, safe_filename)
        
        with open(abs_file_path, "w", encoding="utf-8") as f:
            f.write(text_content)
            
        from core.models import PolicyDocument
        
        existing = db.query(PolicyDocument).filter(PolicyDocument.title == title).first()
        if existing:
            existing.category = category
            existing.file_path = file_path
            policy_doc = existing
        else:
            policy_doc = PolicyDocument(
                title=title,
                category=category,
                file_path=file_path
            )
            db.add(policy_doc)
            
        db.commit()
        db.refresh(policy_doc)
        
        # Ingest document chunks into RAG
        from rag.rag_pipeline import rag_pipeline
        rag_pipeline.ingest_document(
            title=title,
            text=text_content,
            category=category,
            source_name=file_path
        )
        
        return {
            "status": "success",
            "id": policy_doc.id,
            "title": policy_doc.title,
            "category": policy_doc.category,
            "file_path": policy_doc.file_path,
            "message": "Policy successfully uploaded and ingested into RAG pipeline."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy upload failed: {str(e)}")

# Syllabus CRUD API

@app.get("/api/subjects")
def get_subjects(token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = 1
    if token:
        faculty_id = token.get("id", 1)
        
    from core.models import Timetable
    subjects = db.query(Timetable.subject).filter(Timetable.faculty_id == faculty_id).distinct().all()
    return [s[0] for s in subjects if s[0]]

@app.get("/api/syllabus/{subject}")
def get_syllabus(subject: str, db: Session = Depends(get_db)):
    from core.models import SyllabusUnit
    units = db.query(SyllabusUnit).filter(SyllabusUnit.subject == subject).all()
    return [
        {
            "id": u.id,
            "subject": u.subject,
            "unit_number": u.unit_number,
            "title": u.title,
            "topics": u.topics,
            "pdf_url": u.pdf_url
        }
        for u in units
    ]

@app.post("/api/syllabus")
def create_syllabus_unit(payload: dict = Body(...), db: Session = Depends(get_db)):
    subject = payload.get("subject")
    unit_number = payload.get("unit_number")
    title = payload.get("title")
    topics = payload.get("topics")
    pdf_url = payload.get("pdf_url")
    
    if not all([subject, unit_number, title, topics]):
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    from core.models import SyllabusUnit
    new_unit = SyllabusUnit(
        subject=subject,
        unit_number=int(unit_number),
        title=title,
        topics=topics,
        pdf_url=pdf_url
    )
    db.add(new_unit)
    db.commit()
    db.refresh(new_unit)
    return {
        "id": new_unit.id,
        "subject": new_unit.subject,
        "unit_number": new_unit.unit_number,
        "title": new_unit.title,
        "topics": new_unit.topics,
        "pdf_url": new_unit.pdf_url
    }

@app.post("/api/syllabus/bulk")
def bulk_upload_syllabus(payload: dict = Body(...), db: Session = Depends(get_db)):
    subject = payload.get("subject")
    units_data = payload.get("units")
    overwrite = payload.get("overwrite", False)
    
    if not subject or not isinstance(units_data, list):
        raise HTTPException(status_code=400, detail="Invalid payload")
        
    from core.models import SyllabusUnit
    
    if overwrite:
        db.query(SyllabusUnit).filter(SyllabusUnit.subject == subject).delete()
        
    added_units = []
    for u_data in units_data:
        unit_number = u_data.get("unit_number")
        title = u_data.get("title")
        topics = u_data.get("topics")
        pdf_url = u_data.get("pdf_url")
        
        if not all([unit_number, title, topics]):
            continue
            
        new_unit = SyllabusUnit(
            subject=subject,
            unit_number=int(unit_number),
            title=title,
            topics=topics,
            pdf_url=pdf_url
        )
        db.add(new_unit)
        added_units.append(new_unit)
        
    db.commit()
    return {
        "status": "success",
        "count": len(added_units),
        "message": f"Successfully imported {len(added_units)} syllabus units for {subject}."
    }

# Exam & Assessment REST APIs

@app.get("/api/exam/questions")
def get_exam_questions(db: Session = Depends(get_db)):
    from core.models import QuestionBankItem
    items = db.query(QuestionBankItem).all()
    return [
        {
            "id": item.id,
            "subject": item.subject,
            "unit": item.unit,
            "co_number": item.co_number,
            "bloom_level": item.bloom_level,
            "question_text": item.question_text,
            "marks": item.marks,
            "difficulty": item.difficulty,
        }
        for item in items
    ]

@app.post("/api/exam/questions")
def create_exam_question(payload: dict = Body(...), db: Session = Depends(get_db)):
    return create_question_bank_item(db, payload)

@app.put("/api/exam/questions/{question_id}")
def update_exam_question(question_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    return update_question_bank_item(db, question_id, payload)

@app.delete("/api/exam/questions/{question_id}")
def delete_exam_question(question_id: int, db: Session = Depends(get_db)):
    delete_question_bank_item(db, question_id)
    return {"status": "success"}

@app.get("/api/exam/papers")
def get_exam_papers(db: Session = Depends(get_db)):
    from core.models import QuestionPaper
    papers = db.query(QuestionPaper).order_by(QuestionPaper.id.desc()).all()
    return [serialize_paper(paper) for paper in papers]

@app.post("/api/exam/generate-paper")
def generate_exam_paper(payload: dict = Body(...), db: Session = Depends(get_db)):
    paper = build_question_paper(db, payload)
    return {"status": "success", "paper_id": paper.id, "paper": serialize_paper(paper)}

@app.put("/api/exam/papers/{paper_id}")
def patch_exam_paper(paper_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    return update_question_paper(db, paper_id, payload)

@app.post("/api/exam/papers/{paper_id}/moderate")
def moderate_exam_paper(paper_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    status = payload.get("status", "moderated")
    notes = payload.get("moderator_notes")
    paper = moderate_paper(db, paper_id, notes, status)
    return {"status": "success", "paper": serialize_paper(paper)}

@app.get("/api/exam/papers/{paper_id}/validate")
def validate_exam_paper(paper_id: int, db: Session = Depends(get_db)):
    return validate_co_po_mapping(db, paper_id)

@app.post("/api/exam/generate-rubric")
def generate_exam_rubric(payload: dict = Body(...), db: Session = Depends(get_db)):
    return build_rubric(db, payload)

# Agent Chat endpoints

@app.post("/agents/chat")
def general_agent_chat(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    General agent chat endpoint.
    Accepts: { agent_id, message, session_id, history }
    """
    agent_id = payload.get("agent_id")
    message = payload.get("message", "")
    history = payload.get("history", [])
    
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id is required")
        
    if agent_id == "agent1":
        return handle_faculty_assistant_chat(message, 1, db, history)
    elif agent_id == "agent2":
        return handle_academic_workflow_chat(message, 1, db, history)
    elif agent_id == "agent3":
        return handle_analytics_chat(message, 1, db, history)
    elif agent_id == "agent4":
        return handle_research_grants_chat(message, 1, db, history)
    elif agent_id == "agent5":
        return handle_exam_assessment_chat(message, 1, db, history)
    elif agent_id == "agent6":
        return handle_mentor_wellbeing_chat(message, 1, db, history)
    else:
        raise HTTPException(status_code=404, detail="Agent not found")

@app.post("/agents/{agent_id}/chat")
def agent_chat_stream(agent_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Streamed chat for any Agent via Server-Sent Events (SSE)
    """
    message = payload.get("message", "")
    history = payload.get("history", [])
    faculty_id = payload.get("faculty_id", 1) 

    async def event_generator():
        try:
            if agent_id == "agent1":
                agent_result = handle_faculty_assistant_chat(message, faculty_id, db, history)
            elif agent_id == "agent2":
                agent_result = handle_academic_workflow_chat(message, faculty_id, db, history)
            elif agent_id == "agent3":
                agent_result = handle_analytics_chat(message, faculty_id, db, history)
            elif agent_id == "agent4":
                agent_result = handle_research_grants_chat(message, faculty_id, db, history)
            elif agent_id == "agent5":
                agent_result = handle_exam_assessment_chat(message, faculty_id, db, history)
            elif agent_id == "agent6":
                agent_result = handle_mentor_wellbeing_chat(message, faculty_id, db, history)
            elif agent_id == "agent7":
                agent_result = handle_placement_chat(message, faculty_id, db, history)
            elif agent_id == "agent8":
                agent_result = handle_alumni_chat(message, faculty_id, db, history)
            elif agent_id == "agent9":
                agent_result = handle_event_chat(message, faculty_id, db, history)
            elif agent_id == "agent10":
                agent_result = handle_inventory_chat(message, faculty_id, db, history)
            else:
                raise ValueError(f"Invalid agent ID: {agent_id}")

            text_response = agent_result["text"]
            tool_calls = agent_result["tool_calls"]
            rich_data = agent_result["rich_data"]

            # Stream the tool trace visual
            if tool_calls:
                for tc in tool_calls:
                    yield f"data: {json.dumps({'type': 'trace', 'name': tc['name'], 'status': 'running'})}\n\n"
                    await asyncio.sleep(0.3)
                    yield f"data: {json.dumps({'type': 'trace', 'name': tc['name'], 'status': tc['status'], 'result': tc.get('result', '')})}\n\n"
                    await asyncio.sleep(0.1)

            # Stream words
            words = text_response.split(" ")
            for i, word in enumerate(words):
                space = " " if i < len(words) - 1 else ""
                yield f"data: {json.dumps({'type': 'content', 'delta': word + space})}\n\n"
                await asyncio.sleep(0.01)

            # Yield final done response
            yield f"data: {json.dumps({'type': 'done', 'tool_calls': tool_calls, 'rich_data': rich_data})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/agents/faculty-assistant/chat")
def legacy_faculty_assistant_chat_stream(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Legacy backward compatibility stream mapping"""
    return agent_chat_stream("agent1", payload, db)

@app.post("/agents/mentor-wellbeing/chat")
def mentor_wellbeing_chat_alias(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Spec-compatible alias for the wellbeing agent chat endpoint."""
    return agent_chat_stream("agent6", payload, db)


# ==========================================
# REST API FOR ACADEMIC WORKFLOW (AGENT 2)
# ==========================================

@app.get("/api/attendance")
def get_attendance(db: Session = Depends(get_db)):
    records = db.query(AttendanceRecord).all()
    res = []
    for r in records:
        student = db.query(Student).filter(Student.id == r.student_id).first()
        res.append({
            "id": r.id,
            "roll_no": student.roll_no if student else "N/A",
            "name": student.name if student else "N/A",
            "date": r.date,
            "status": r.status,
            "period": r.period,
            "subject": r.subject,
            "class_section": r.class_section
        })
    return res

@app.post("/api/attendance/mark")
def mark_attendance(payload: dict = Body(...), db: Session = Depends(get_db)):
    roll_no = payload.get("roll_no")
    date = payload.get("date", datetime.date.today().strftime("%Y-%m-%d"))
    status = payload.get("status", "Present")
    subject = payload.get("subject", "Design & Analysis of Algorithms")
    class_section = payload.get("class_section", "CSE-A")
    period = payload.get("period", "09:00 - 10:00")

    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
         raise HTTPException(status_code=404, detail="Student not found")

    # Update or insert
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.date == date,
        AttendanceRecord.subject == subject
    ).first()

    if record:
        record.status = status
    else:
        record = AttendanceRecord(
            student_id=student.id,
            date=date,
            status=status,
            period=period,
            subject=subject,
            class_section=class_section
        )
        db.add(record)
    
    db.commit()
    return {"status": "success", "message": f"Attendance marked for {roll_no} as {status}."}

@app.get("/api/assignments")
def get_assignments(db: Session = Depends(get_db)):
    assigns = db.query(Assignment).all()
    res = []
    for a in assigns:
        # Get submissions count
        subs = db.query(Submission).filter(Submission.assignment_id == a.id).all()
        res.append({
            "id": a.id,
            "title": a.title,
            "subject": a.subject,
            "class_section": a.class_section,
            "due_date": a.due_date,
            "max_marks": a.max_marks,
            "status": a.status,
            "submissions_count": len(subs),
            "graded_count": len([s for s in subs if s.status == "Graded"])
        })
    return res

@app.post("/api/assignments/schedule")
def schedule_assignment(payload: dict = Body(...), db: Session = Depends(get_db)):
    title = payload.get("title")
    subject = payload.get("subject", "Design & Analysis of Algorithms")
    class_section = payload.get("class_section", "CSE-A")
    due_date = payload.get("due_date")
    max_marks = payload.get("max_marks", 10)

    if not title or not due_date:
        raise HTTPException(status_code=400, detail="Title and due date are required")

    new_assign = Assignment(
        title=title,
        subject=subject,
        class_section=class_section,
        due_date=due_date,
        max_marks=max_marks,
        status="Open"
    )
    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    
    # Auto-seed submissions for students in that class section
    students = db.query(Student).filter(Student.class_section == class_section).all()
    for s in students:
        # Just create blank pending submissions
        sub = Submission(
            assignment_id=new_assign.id,
            student_id=s.id,
            submitted_at="-",
            marks_obtained=None,
            status="Pending"
        )
        db.add(sub)
    db.commit()

    return {"status": "success", "id": new_assign.id, "message": f"Assignment scheduled for {class_section}."}

@app.get("/api/marks")
def get_marks(db: Session = Depends(get_db)):
    marks = db.query(InternalMark).all()
    res = []
    for m in marks:
        student = db.query(Student).filter(Student.id == m.student_id).first()
        res.append({
            "id": m.id,
            "roll_no": student.roll_no if student else "N/A",
            "name": student.name if student else "N/A",
            "subject": m.subject,
            "cat1_marks": m.cat1_marks,
            "cat2_marks": m.cat2_marks,
            "assignment_marks": m.assignment_marks,
            "lab_marks": m.lab_marks,
            "total_marks": m.total_marks,
            "attendance_percentage": m.attendance_percentage
        })
    return res

@app.post("/api/marks/calculate")
def calculate_marks(payload: dict = Body(...), db: Session = Depends(get_db)):
    # Re-sums the marks
    marks = db.query(InternalMark).all()
    for m in marks:
        m.total_marks = (m.cat1_marks or 0) + (m.cat2_marks or 0) + (m.assignment_marks or 0) + (m.lab_marks or 0)
    db.commit()
    return {"status": "success", "message": "Calculated total marks successfully."}

@app.get("/api/reminders")
def get_reminders_list():
    return [
        {"id": 1, "task": "Grade DAA Assignment 2 (Greedy)", "due": "2026-08-05", "urgency": "high"},
        {"id": 2, "task": "Syllabus mapping validation for CAT2 papers", "due": "2026-08-06", "urgency": "medium"},
        {"id": 3, "task": "Mentee check-in with A. Kumar (overdue)", "due": "2026-07-30", "urgency": "high"}
    ]


# ==========================================
# REST API FOR ANALYTICS (AGENT 3)
# ==========================================

@app.get("/api/analytics/kpis")
def get_analytics_kpis(db: Session = Depends(get_db)):
    total_students = db.query(Student).count()
    attendance_records = db.query(AttendanceRecord).all()
    present_count = len([r for r in attendance_records if r.status == "Present"])
    avg_attendance = int((present_count / len(attendance_records)) * 100) if attendance_records else 100
    
    marks = db.query(InternalMark).all()
    avg_marks = int(sum([m.total_marks for m in marks]) / len(marks)) if marks else 0
    
    co_att = db.query(COAttainment).all()
    attained_count = len([c for c in co_att if c.attained_percentage >= c.target_percentage])
    co_attainment_rate = int((attained_count / len(co_att)) * 100) if co_att else 0

    return {
        "total_students": total_students,
        "avg_attendance": avg_attendance,
        "avg_internal_marks": f"{avg_marks}/50",
        "co_attainment_rate": f"{co_attainment_rate}%"
    }

@app.get("/api/analytics/charts")
def get_analytics_charts(db: Session = Depends(get_db)):
    # Performance distribution: ranges 0-10, 10-20, 20-30, 30-40, 40-50
    marks = db.query(InternalMark).all()
    distribution = {"0-10": 0, "10-20": 0, "20-30": 0, "30-40": 0, "40-50": 0}
    for m in marks:
        val = m.total_marks or 0
        if val <= 10: distribution["0-10"] += 1
        elif val <= 20: distribution["10-20"] += 1
        elif val <= 30: distribution["20-30"] += 1
        elif val <= 40: distribution["30-40"] += 1
        else: distribution["40-50"] += 1
    
    performance_chart = [{"range": k, "count": v} for k, v in distribution.items()]
    
    # Attendance trend (by date)
    attendance_records = db.query(AttendanceRecord).all()
    dates_map = {}
    for r in attendance_records:
        dates_map.setdefault(r.date, []).append(r.status)
    attendance_chart = []
    for date, statuses in sorted(dates_map.items()):
        presents = len([s for s in statuses if s == "Present"])
        attendance_chart.append({
            "date": date,
            "rate": int((presents / len(statuses)) * 100)
        })
        
    # CO attainments
    co_records = db.query(COAttainment).all()
    co_chart = [{"co": c.co_number, "target": c.target_percentage, "attained": c.attained_percentage} for c in co_records]

    return {
        "performance_chart": performance_chart,
        "attendance_chart": attendance_chart,
        "co_chart": co_chart
    }

@app.get("/api/analytics/at-risk")
def get_at_risk_analytics(db: Session = Depends(get_db)):
    marks = db.query(InternalMark).filter(InternalMark.attendance_percentage < 75).all()
    res = []
    for m in marks:
        student = db.query(Student).filter(Student.id == m.student_id).first()
        if student:
            res.append({
                "roll_no": student.roll_no,
                "name": student.name,
                "attendance": m.attendance_percentage,
                "marks": m.total_marks,
                "risk_level": "High" if m.attendance_percentage < 50 else "Medium"
            })
    return res

@app.get("/api/analytics/report/pdf")
def get_analytics_pdf():
    return {
        "status": "success",
        "url": "/reports/nba_attainment_draft.pdf",
        "message": "Styled Draft PDF report generated on Letterhead."
    }


# ==========================================
# REST API FOR RESEARCH & GRANTS (AGENT 4)
# ==========================================

@app.get("/api/research/publications")
def get_publications(db: Session = Depends(get_db)):
    pubs = db.query(Publication).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "venue": p.venue,
            "type": p.type,
            "year": p.year,
            "co_authors": p.co_authors,
            "doi_or_link": p.doi_or_link,
            "citation_count": p.citation_count
        }
        for p in pubs
    ]

@app.post("/api/research/publications")
def log_publication(payload: dict = Body(...), db: Session = Depends(get_db)):
    title = payload.get("title")
    venue = payload.get("venue")
    type_ = payload.get("type", "journal")
    year = payload.get("year", 2026)
    co_authors = payload.get("co_authors")
    doi_or_link = payload.get("doi_or_link")

    if not title or not venue:
        raise HTTPException(status_code=400, detail="Title and venue are required")

    new_pub = Publication(
        faculty_id=1,
        title=title,
        venue=venue,
        type=type_,
        year=year,
        co_authors=co_authors,
        doi_or_link=doi_or_link,
        citation_count=0
    )
    db.add(new_pub)
    db.commit()
    db.refresh(new_pub)
    return {"status": "success", "id": new_pub.id, "message": "Publication logged successfully."}

@app.get("/api/research/grants")
def get_grants(db: Session = Depends(get_db)):
    grants = db.query(GrantOpportunity).all()
    return [
        {
            "id": g.id,
            "title": g.title,
            "funding_body": g.funding_body,
            "amount": g.amount,
            "eligibility": g.eligibility,
            "deadline": g.deadline,
            "focus_area": g.focus_area
        }
        for g in grants
    ]

@app.get("/api/research/deadlines")
def get_research_deadlines(db: Session = Depends(get_db)):
    deadlines = db.query(ResearchDeadline).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "type": d.type,
            "due_date": d.due_date
        }
        for d in deadlines
    ]


# ==========================================
# REST API FOR MENTOR & WELLBEING (AGENT 6)
# ==========================================

@app.get("/api/mentor/mentees")
def get_mentees_list(token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = token.get("id", 1) if token else 1
    mentee_items = get_checkin_schedule(faculty_id, db)
    return [
        {
            "id": item["id"],
            "student_id": item["student_id"],
            "roll_no": item["roll_no"],
            "name": item["name"],
            "class_section": item["class_section"],
            "last_checkin_date": item["last_checkin_date"],
            "is_overdue": item["is_overdue"],
        }
        for item in mentee_items
    ]

@app.get("/api/mentor/timeline/{student_id}")
def get_mentee_timeline_endpoint(student_id: int, db: Session = Depends(get_db)):
    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")
    return get_mentee_timeline(mentee.id, db)

@app.post("/api/mentor/checkin")
def log_checkin_record(payload: dict = Body(...), db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    mode = payload.get("mode", "in-person")
    notes = payload.get("notes", "")
    mood_tag = payload.get("mood_tag", "doing well")

    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")

    return log_checkin(mentee.id, notes, mood_tag, mode, db)

@app.post("/api/mentor/escalate")
def escalate_mentee(payload: dict = Body(...), token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    reason = payload.get("reason")
    escalated_to = payload.get("escalated_to", "counselor")

    if not reason:
        raise HTTPException(status_code=400, detail="Escalation reason is required")

    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")

    faculty_id = token.get("id", 1) if token else 1
    return raise_escalation(mentee.id, reason, escalated_to, faculty_id, db)

@app.get("/api/mentor/suggest-prompt/{student_id}")
def get_suggested_wellbeing_prompt(student_id: int, db: Session = Depends(get_db)):
    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")

    return {"prompt": suggest_checkin_prompt(mentee.id, db)}

@app.get("/api/mentor/escalations")
def get_escalations_list(token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = token.get("id", 1) if token else 1
    return get_escalations(faculty_id, db)

@app.put("/api/mentor/escalation/{escalation_id}/status")
def update_escalation_endpoint(escalation_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    new_status = payload.get("status", "in-progress")
    return update_escalation_status(escalation_id, new_status, db)

@app.get("/api/mentor/stats")
def get_mentor_stats_endpoint(token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = token.get("id", 1) if token else 1
    return get_mentor_stats(faculty_id, db)


@app.get("/api/mentor/tasks")
def api_get_mentor_tasks(token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = token.get("id", 1) if token else 1
    return get_mentor_tasks(faculty_id, db)

@app.post("/api/mentor/tasks")
def api_create_mentor_task(payload: dict = Body(...), token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    faculty_id = token.get("id", 1) if token else 1
    title = payload.get("title", "New Task")
    description = payload.get("description", "")
    return create_mentor_task(faculty_id, title, description, db)

@app.put("/api/mentor/tasks/{task_id}")
def edit_mentor_tasks_endpoint(task_id: int, payload: dict = Body(...), token: Optional[dict] = Depends(verify_token), db: Session = Depends(get_db)):
    title = payload.get("title")
    description = payload.get("description")
    return edit_mentor_task(task_id, title, description, db)

@app.get("/api/mentor/notes/{student_id}")
def api_get_future_notes(student_id: int, db: Session = Depends(get_db)):
    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")
    return get_future_notes(mentee.id, db)

@app.post("/api/mentor/notes")
def api_add_future_note(payload: dict = Body(...), db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    note = payload.get("note")
    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")
    return add_future_note(mentee.id, note, db)

# ==========================================
# PHASE 7: PLACEMENT & INTERNSHIPS
# ==========================================
@app.get("/api/placement/drives")
def get_placement_drives(db: Session = Depends(get_db)):
    return db.query(PlacementDrive).all()

@app.post("/api/placement/drives")
def create_placement_drive(payload: dict = Body(...), db: Session = Depends(get_db)):
    drive = PlacementDrive(
        company_name=payload.get("company_name"),
        job_roles=payload.get("job_roles"),
        eligible_branches=payload.get("eligible_branches"),
        expected_ctc=payload.get("expected_ctc"),
        visit_date=payload.get("visit_date"),
        status=payload.get("status", "Scheduled")
    )
    db.add(drive)
    db.commit()
    db.refresh(drive)
    return drive

@app.put("/api/placement/drives/{id}")
def update_placement_drive(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    drive = db.query(PlacementDrive).filter(PlacementDrive.id == id).first()
    if not drive: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(drive, k, v)
    db.commit()
    db.refresh(drive)
    return drive

@app.get("/api/placement/internships")
def get_internships(db: Session = Depends(get_db)):
    return db.query(Internship).all()

@app.post("/api/placement/internships")
def create_internship(payload: dict = Body(...), db: Session = Depends(get_db)):
    internship = Internship(
        student_name=payload.get("student_name"),
        roll_no=payload.get("roll_no"),
        company=payload.get("company"),
        role=payload.get("role"),
        stipend=payload.get("stipend"),
        start_date=payload.get("start_date"),
        end_date=payload.get("end_date")
    )
    db.add(internship)
    db.commit()
    db.refresh(internship)
    return internship

@app.put("/api/placement/internships/{id}")
def update_internship(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    internship = db.query(Internship).filter(Internship.id == id).first()
    if not internship: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(internship, k, v)
    db.commit()
    db.refresh(internship)
    return internship

# ==========================================
# PHASE 8: ALUMNI RELATIONS
# ==========================================
@app.get("/api/alumni/directory")
def get_alumni_directory(db: Session = Depends(get_db)):
    return db.query(Alumni).all()

@app.post("/api/alumni/directory")
def create_alumni(payload: dict = Body(...), db: Session = Depends(get_db)):
    alumni = Alumni(
        name=payload.get("name"),
        batch=payload.get("batch"),
        branch=payload.get("branch"),
        company=payload.get("company"),
        designation=payload.get("designation"),
        current_city=payload.get("current_city")
    )
    db.add(alumni)
    db.commit()
    db.refresh(alumni)
    return alumni

@app.put("/api/alumni/directory/{id}")
def update_alumni(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    alumni = db.query(Alumni).filter(Alumni.id == id).first()
    if not alumni: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(alumni, k, v)
    db.commit()
    db.refresh(alumni)
    return alumni

@app.get("/api/alumni/donations")
def get_alumni_donations(db: Session = Depends(get_db)):
    return db.query(DonationLedger).all()

@app.post("/api/alumni/donations")
def create_donation(payload: dict = Body(...), db: Session = Depends(get_db)):
    donation = DonationLedger(
        alumni_name=payload.get("alumni_name"),
        amount=payload.get("amount"),
        date=payload.get("date"),
        purpose=payload.get("purpose"),
        status=payload.get("status", "Pending")
    )
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation

@app.put("/api/alumni/donations/{id}")
def update_donation(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    donation = db.query(DonationLedger).filter(DonationLedger.id == id).first()
    if not donation: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(donation, k, v)
    db.commit()
    db.refresh(donation)
    return donation

# ==========================================
# PHASE 9: EVENT MANAGEMENT
# ==========================================
@app.get("/api/events")
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).all()

@app.post("/api/events")
def create_event(payload: dict = Body(...), db: Session = Depends(get_db)):
    event = Event(
        name=payload.get("name"),
        type=payload.get("type"),
        date=payload.get("date"),
        venue=payload.get("venue"),
        budget_allocated=payload.get("budget_allocated"),
        organizer=payload.get("organizer")
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

@app.put("/api/events/{id}")
def update_event(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == id).first()
    if not event: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event

@app.get("/api/events/tasks")
def get_committee_tasks(db: Session = Depends(get_db)):
    return db.query(CommitteeTask).all()

@app.post("/api/events/tasks")
def create_committee_task(payload: dict = Body(...), db: Session = Depends(get_db)):
    task = CommitteeTask(
        event_name=payload.get("event_name"),
        task_description=payload.get("task_description"),
        assigned_to=payload.get("assigned_to"),
        deadline=payload.get("deadline"),
        status=payload.get("status", "Pending")
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@app.put("/api/events/tasks/{id}")
def update_committee_task(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    task = db.query(CommitteeTask).filter(CommitteeTask.id == id).first()
    if not task: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task

# ==========================================
# PHASE 10: INVENTORY & RESOURCES
# ==========================================
@app.get("/api/inventory/assets")
def get_lab_assets(db: Session = Depends(get_db)):
    return db.query(LabAsset).all()

@app.post("/api/inventory/assets")
def create_lab_asset(payload: dict = Body(...), db: Session = Depends(get_db)):
    asset = LabAsset(
        name=payload.get("name"),
        asset_type=payload.get("asset_type"),
        serial_number=payload.get("serial_number"),
        purchase_date=payload.get("purchase_date"),
        status=payload.get("status", "Active"),
        location=payload.get("location")
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset

@app.put("/api/inventory/assets/{id}")
def update_lab_asset(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    asset = db.query(LabAsset).filter(LabAsset.id == id).first()
    if not asset: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(asset, k, v)
    db.commit()
    db.refresh(asset)
    return asset

@app.get("/api/inventory/licenses")
def get_software_licenses(db: Session = Depends(get_db)):
    return db.query(SoftwareLicense).all()

@app.post("/api/inventory/licenses")
def create_software_license(payload: dict = Body(...), db: Session = Depends(get_db)):
    license = SoftwareLicense(
        name=payload.get("name"),
        vendor=payload.get("vendor"),
        license_key=payload.get("license_key"),
        seats_total=payload.get("seats_total"),
        seats_used=payload.get("seats_used", 0),
        expiration_date=payload.get("expiration_date")
    )
    db.add(license)
    db.commit()
    db.refresh(license)
    return license

@app.put("/api/inventory/licenses/{id}")
def update_software_license(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    license = db.query(SoftwareLicense).filter(SoftwareLicense.id == id).first()
    if not license: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(license, k, v)
    db.commit()
    db.refresh(license)
    return license

@app.get("/api/inventory/books")
def get_book_requisitions(db: Session = Depends(get_db)):
    return db.query(BookRequisition).all()

@app.post("/api/inventory/books")
def create_book_requisition(payload: dict = Body(...), db: Session = Depends(get_db)):
    req = BookRequisition(
        title=payload.get("title"),
        author=payload.get("author"),
        edition=payload.get("edition"),
        requested_by=payload.get("requested_by"),
        status=payload.get("status", "Pending")
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

@app.put("/api/inventory/books/{id}")
def update_book_requisition(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    req = db.query(BookRequisition).filter(BookRequisition.id == id).first()
    if not req: raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.items(): setattr(req, k, v)
    db.commit()
    db.refresh(req)
    return req

# Phase 7-10 chat endpoints are dynamically handled by /agents/{agent_id}/chat
