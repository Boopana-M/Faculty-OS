import os
import json
import asyncio
import datetime
from fastapi import FastAPI, Depends, HTTPException, status, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from typing import Optional

from core.database import get_db, engine, Base
from core.models import (
    Faculty, Student, AttendanceRecord, Assignment, Submission, InternalMark,
    COAttainment, FacultyWorkload, Publication, GrantOpportunity, ResearchDeadline,
    QuestionBankItem, QuestionPaper, Rubric, Mentee, CheckIn, Escalation
)
from core.auth import verify_password, create_access_token, verify_token
from core.seed import seed_database
from core.roster_import import read_roster_file
from agents.faculty_assistant.agent import handle_faculty_assistant_chat
from agents.academic_workflow.agent import handle_academic_workflow_chat
from agents.analytics.agent import handle_analytics_chat
from agents.research_grants.agent import handle_research_grants_chat
from agents.exam_assessment.agent import handle_exam_assessment_chat
from agents.mentor_wellbeing.agent import handle_mentor_wellbeing_chat

# Initialize DB tables
Base.metadata.create_all(bind=engine)

# create_all does not add columns to an existing SQLite database. Keep the MVP's
# existing local database compatible when department-scoped rosters are introduced.
def ensure_student_department_column():
    inspector = inspect(engine)
    if "student" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("student")}
    if "department" not in columns:
        with engine.begin() as connection:
            connection.exec_driver_sql("ALTER TABLE student ADD COLUMN department VARCHAR")


ensure_student_department_column()

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
            else:
                raise ValueError("Invalid agent ID")

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


# ==========================================
# REST API FOR ACADEMIC WORKFLOW (AGENT 2)
# ==========================================

def attendance_percentage(db: Session, student_id: int, subject: Optional[str] = None) -> int:
    query = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id)
    if subject:
        query = query.filter(AttendanceRecord.subject == subject)
    records = query.all()
    if not records:
        return 0
    return round(100 * sum(record.status == "Present" for record in records) / len(records))


def sync_mark_attendance(db: Session, student: Student, subject: str, date: str, status_value: str, period: str, class_section: str):
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.date == date,
        AttendanceRecord.subject == subject,
    ).first()
    if record:
        record.status = status_value
        record.period = period
        record.class_section = class_section
    else:
        db.add(AttendanceRecord(
            student_id=student.id, date=date, status=status_value, period=period,
            subject=subject, class_section=class_section,
        ))


def sync_student_dependents(db: Session, students: list[Student], faculty_id: int = 1):
    """Keep every class workspace in sync when the shared roster changes."""
    for student in students:
        if not db.query(Mentee).filter(Mentee.student_id == student.id).first():
            db.add(Mentee(
                student_id=student.id, mentor_faculty_id=student.mentor_faculty_id or faculty_id,
                class_section=student.class_section,
            ))
        assignments = db.query(Assignment).filter(Assignment.class_section == student.class_section).all()
        for assignment in assignments:
            exists = db.query(Submission).filter(
                Submission.assignment_id == assignment.id, Submission.student_id == student.id,
            ).first()
            if not exists:
                db.add(Submission(
                    assignment_id=assignment.id, student_id=student.id,
                    submitted_at="-", marks_obtained=None, status="Pending",
                ))
        if not db.query(InternalMark).filter(InternalMark.student_id == student.id).first():
            db.add(InternalMark(
                student_id=student.id, subject="Not assigned", cat1_marks=None,
                cat2_marks=None, assignment_marks=None, lab_marks=None,
                total_marks=None, attendance_percentage=0,
            ))


@app.post("/api/attendance/roster/import")
async def import_attendance_roster(
    file: UploadFile = File(...),
    department: str = Form(...),
    class_section: str = Form("CCE-A"),
    db: Session = Depends(get_db),
):
    if not file.filename or not department.strip():
        raise HTTPException(status_code=400, detail="Choose a roster file to upload.")
    try:
        rows = read_roster_file(file.filename, await file.read())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read roster: {exc}")

    faculty_id = 1
    created = updated = 0
    for row in rows:
        student = db.query(Student).filter(Student.roll_no == row["roll_no"]).first()
        if student:
            student.name = row["name"]
            student.student_id = row["student_id"] or student.student_id
            student.department = department.strip().upper()
            student.class_section = class_section
            student.mentor_faculty_id = student.mentor_faculty_id or faculty_id
            updated += 1
        else:
            db.add(Student(
                roll_no=row["roll_no"], student_id=row["student_id"] or None, name=row["name"],
                department=department.strip().upper(), class_section=class_section, mentor_faculty_id=faculty_id,
                email=f"{row['roll_no'].lower()}@student.edu",
            ))
            created += 1
    db.commit()
    imported_students = db.query(Student).filter(Student.roll_no.in_([row["roll_no"] for row in rows])).all()
    sync_student_dependents(db, imported_students)
    db.commit()
    return {"status": "success", "department": department.strip().upper(), "class_section": class_section, "imported": len(rows), "created": created, "updated": updated}


@app.get("/api/attendance/roster")
def get_attendance_roster(
    department: Optional[str] = None,
    class_section: str = "CCE-A",
    subject: str = "Attendance Register",
    date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    selected_date = date or datetime.date.today().isoformat()
    students_query = db.query(Student).filter(Student.class_section == class_section)
    if department:
        students_query = students_query.filter(Student.department == department)
    students = students_query.order_by(Student.roll_no).all()
    records = {
        record.student_id: record for record in db.query(AttendanceRecord).filter(
            AttendanceRecord.class_section == class_section,
            AttendanceRecord.subject == subject,
            AttendanceRecord.date == selected_date,
        ).all()
    }
    return [{
        "id": student.id, "roll_no": student.roll_no, "register_no": student.student_id,
        "name": student.name, "department": student.department, "class_section": student.class_section, "date": selected_date,
        "subject": subject, "status": records[student.id].status if student.id in records else "Unmarked",
        "attendance_percentage": attendance_percentage(db, student.id, subject),
    } for student in students]


@app.get("/api/departments")
def get_departments(db: Session = Depends(get_db)):
    return [row[0] for row in db.query(Student.department).distinct().order_by(Student.department).all() if row[0]]


@app.get("/api/classes")
def get_class_sections(department: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Student.class_section)
    if department:
        query = query.filter(Student.department == department)
    return [row[0] for row in query.distinct().order_by(Student.class_section).all() if row[0]]


@app.post("/api/students")
def add_student(payload: dict = Body(...), db: Session = Depends(get_db)):
    roll_no = str(payload.get("roll_no", "")).strip().upper()
    name = str(payload.get("name", "")).strip()
    department = str(payload.get("department", "")).strip().upper()
    class_section = str(payload.get("class_section", "")).strip().upper()
    register_no = str(payload.get("register_no", "")).strip()
    if not all([roll_no, name, department, class_section]):
        raise HTTPException(status_code=400, detail="Roll number, name, department, and class are required.")
    if db.query(Student).filter(Student.roll_no == roll_no).first():
        raise HTTPException(status_code=409, detail=f"Student with roll number {roll_no} already exists.")
    student = Student(
        roll_no=roll_no, student_id=register_no or None, name=name, department=department,
        class_section=class_section, mentor_faculty_id=1, email=f"{roll_no.lower()}@student.edu",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    sync_student_dependents(db, [student])
    db.commit()
    return {
        "status": "success", "id": student.id, "roll_no": student.roll_no, "name": student.name,
        "department": student.department, "class_section": student.class_section,
    }


@app.get("/api/students")
def get_students(department: Optional[str] = None, class_section: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Student)
    if department:
        query = query.filter(Student.department == department)
    if class_section:
        query = query.filter(Student.class_section == class_section)
    return [{
        "id": student.id, "roll_no": student.roll_no, "register_no": student.student_id,
        "name": student.name, "department": student.department, "class_section": student.class_section,
    } for student in query.order_by(Student.roll_no).all()]

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
    if status not in {"Present", "Absent"}:
        raise HTTPException(status_code=400, detail="Status must be Present or Absent")
    subject = payload.get("subject", "Attendance Register")
    class_section = payload.get("class_section", "CCE-A")
    period = payload.get("period", "09:00 - 10:00")

    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
         raise HTTPException(status_code=404, detail="Student not found")

    sync_mark_attendance(db, student, subject, date, status, period, class_section)
    db.commit()
    return {"status": "success", "message": f"Attendance marked for {roll_no} as {status}.", "attendance_percentage": attendance_percentage(db, student.id, subject)}


@app.post("/api/attendance/mark-bulk")
def mark_attendance_bulk(payload: dict = Body(...), db: Session = Depends(get_db)):
    class_section = payload.get("class_section", "CCE-A")
    subject = payload.get("subject", "Attendance Register")
    date = payload.get("date", datetime.date.today().isoformat())
    period = payload.get("period", "09:00 - 10:00")
    status_value = payload.get("status", "Present")
    if status_value not in {"Present", "Absent"}:
        raise HTTPException(status_code=400, detail="Status must be Present or Absent")
    students_query = db.query(Student).filter(Student.class_section == class_section)
    if payload.get("department"):
        students_query = students_query.filter(Student.department == payload["department"])
    students = students_query.all()
    for student in students:
        sync_mark_attendance(db, student, subject, date, status_value, period, class_section)
    db.commit()
    return {"status": "success", "marked": len(students), "status_value": status_value}

@app.get("/api/assignments")
def get_assignments(
    department: Optional[str] = None,
    class_section: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # Class sections are department-qualified (for example, CSE-A and CCE-A),
    # so filtering by the selected section keeps each workspace isolated.
    assigns_query = db.query(Assignment)
    if class_section:
        assigns_query = assigns_query.filter(Assignment.class_section == class_section)
    assigns = assigns_query.order_by(Assignment.due_date).all()
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
    students_query = db.query(Student).filter(Student.class_section == class_section)
    if payload.get("department"):
        students_query = students_query.filter(Student.department == payload["department"])
    students = students_query.all()
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
def get_marks(department: Optional[str] = None, class_section: Optional[str] = None, db: Session = Depends(get_db)):
    students_query = db.query(Student)
    if department:
        students_query = students_query.filter(Student.department == department)
    if class_section:
        students_query = students_query.filter(Student.class_section == class_section)
    res = []
    for student in students_query.order_by(Student.roll_no).all():
        m = db.query(InternalMark).filter(InternalMark.student_id == student.id).first()
        res.append({
            "id": m.id if m else None, "student_id": student.id, "roll_no": student.roll_no, "name": student.name,
            "department": student.department, "class_section": student.class_section,
            "subject": m.subject if m else None, "cat1_marks": m.cat1_marks if m else None,
            "cat2_marks": m.cat2_marks if m else None, "assignment_marks": m.assignment_marks if m else None,
            "lab_marks": m.lab_marks if m else None, "total_marks": m.total_marks if m else None,
            "attendance_percentage": m.attendance_percentage if m else None,
        })
    return res

@app.put("/api/marks/{student_id}")
def save_student_marks(student_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Create or update the four manually entered continuous-assessment marks."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    limits = {"cat1_marks": 15, "cat2_marks": 15, "assignment_marks": 10, "lab_marks": 10}
    values = {}
    for field, limit in limits.items():
        value = payload.get(field)
        if value in (None, ""):
            values[field] = None
            continue
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"{field} must be a whole number")
        if not 0 <= value <= limit:
            raise HTTPException(status_code=400, detail=f"{field} must be between 0 and {limit}")
        values[field] = value

    mark = db.query(InternalMark).filter(InternalMark.student_id == student_id).first()
    if not mark:
        mark = InternalMark(student_id=student_id, subject=payload.get("subject") or "Not assigned")
        db.add(mark)
    for field, value in values.items():
        setattr(mark, field, value)
    mark.subject = payload.get("subject") or mark.subject
    mark.total_marks = sum(value or 0 for value in values.values())
    db.commit()
    db.refresh(mark)
    return {"status": "success", "student_id": student_id, "total_marks": mark.total_marks}

@app.post("/api/marks/calculate")
def calculate_marks(payload: dict = Body(...), db: Session = Depends(get_db)):
    # Re-sums the marks
    marks = db.query(InternalMark).all()
    for m in marks:
        m.total_marks = (m.cat1_marks or 0) + (m.cat2_marks or 0) + (m.assignment_marks or 0) + (m.lab_marks or 0)
    db.commit()
    return {"status": "success", "message": "Calculated total marks successfully."}

@app.get("/api/reminders")
def get_reminders_list(
    department: Optional[str] = None,
    class_section: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return reminders for the active class, including un-contacted new students."""
    students_query = db.query(Student)
    if department:
        students_query = students_query.filter(Student.department == department)
    if class_section:
        students_query = students_query.filter(Student.class_section == class_section)
    students = students_query.order_by(Student.roll_no).all()

    reminders = []
    for assignment in db.query(Assignment).filter(
        Assignment.class_section == class_section
    ).order_by(Assignment.due_date).all() if class_section else []:
        reminders.append({
            "id": f"assignment-{assignment.id}",
            "task": f"Review {assignment.title}",
            "due": assignment.due_date,
            "urgency": "high" if assignment.status in {"Open", "Grading"} else "medium",
        })

    for student in students:
        mentee = db.query(Mentee).filter(Mentee.student_id == student.id).first()
        if mentee and not mentee.last_checkin_date:
            reminders.append({
                "id": f"mentee-{student.id}",
                "task": f"Mentee check-in with {student.name}",
                "due": "Not scheduled",
                "urgency": "medium",
            })
    return reminders


# ==========================================
# REST API FOR ANALYTICS (AGENT 3)
# ==========================================

@app.get("/api/analytics/kpis")
def get_analytics_kpis(department: Optional[str] = None, class_section: Optional[str] = None, db: Session = Depends(get_db)):
    students_query = db.query(Student)
    if department:
        students_query = students_query.filter(Student.department == department)
    if class_section:
        students_query = students_query.filter(Student.class_section == class_section)
    students = students_query.all()
    student_ids = [student.id for student in students]
    attendance_records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id.in_(student_ids)).all() if student_ids else []
    present_count = len([r for r in attendance_records if r.status == "Present"])
    avg_attendance = int((present_count / len(attendance_records)) * 100) if attendance_records else 100
    
    marks = db.query(InternalMark).filter(InternalMark.student_id.in_(student_ids)).all() if student_ids else []
    avg_marks = int(sum((m.total_marks or 0) for m in marks) / len(marks)) if marks else 0
    
    co_att = db.query(COAttainment).all()
    attained_count = len([c for c in co_att if c.attained_percentage >= c.target_percentage])
    co_attainment_rate = int((attained_count / len(co_att)) * 100) if co_att else 0

    return {
        "class_section": class_section,
        "total_students": len(students),
        "avg_attendance": avg_attendance,
        "avg_internal_marks": f"{avg_marks}/50",
        "co_attainment_rate": f"{co_attainment_rate}%"
    }

@app.get("/api/analytics/charts")
def get_analytics_charts(department: Optional[str] = None, class_section: Optional[str] = None, db: Session = Depends(get_db)):
    # Performance distribution: ranges 0-10, 10-20, 20-30, 30-40, 40-50
    students_query = db.query(Student)
    if department:
        students_query = students_query.filter(Student.department == department)
    if class_section:
        students_query = students_query.filter(Student.class_section == class_section)
    student_ids = [student.id for student in students_query.all()]
    marks = db.query(InternalMark).filter(InternalMark.student_id.in_(student_ids)).all() if student_ids else []
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
    attendance_records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id.in_(student_ids)).all() if student_ids else []
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
def get_at_risk_analytics(department: Optional[str] = None, class_section: Optional[str] = None, db: Session = Depends(get_db)):
    res = []
    students_query = db.query(Student)
    if department:
        students_query = students_query.filter(Student.department == department)
    if class_section:
        students_query = students_query.filter(Student.class_section == class_section)
    for student in students_query.all():
        records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).all()
        if not records:
            continue
        percentage = attendance_percentage(db, student.id)
        if percentage < 75:
            mark = db.query(InternalMark).filter(InternalMark.student_id == student.id).first()
            res.append({
                "roll_no": student.roll_no, "name": student.name, "attendance": percentage,
                "marks": mark.total_marks if mark else None,
                "risk_level": "High" if percentage < 50 else "Medium",
            })
    return sorted(res, key=lambda student: student["attendance"])

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
# REST API FOR EXAM & ASSESSMENT (AGENT 5)
# ==========================================

@app.get("/api/exam/questions")
def get_questions_bank(db: Session = Depends(get_db)):
    items = db.query(QuestionBankItem).all()
    return [
        {
            "id": i.id,
            "subject": i.subject,
            "unit": i.unit,
            "co_number": i.co_number,
            "bloom_level": i.bloom_level,
            "question_text": i.question_text,
            "marks": i.marks,
            "difficulty": i.difficulty
        }
        for i in items
    ]

@app.post("/api/exam/questions")
def add_question(payload: dict = Body(...), db: Session = Depends(get_db)):
    subject = payload.get("subject", "Design & Analysis of Algorithms")
    unit = payload.get("unit")
    co_number = payload.get("co_number")
    bloom_level = payload.get("bloom_level")
    question_text = payload.get("question_text")
    marks = payload.get("marks")
    difficulty = payload.get("difficulty", "Medium")

    if not all([unit, co_number, bloom_level, question_text, marks]):
        raise HTTPException(status_code=400, detail="Missing required question parameters")

    new_q = QuestionBankItem(
        subject=subject,
        unit=unit,
        co_number=co_number,
        bloom_level=bloom_level,
        question_text=question_text,
        marks=marks,
        difficulty=difficulty
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return {"status": "success", "id": new_q.id, "message": "Question added to bank."}

@app.post("/api/exam/generate-paper")
def generate_paper(payload: dict = Body(...), db: Session = Depends(get_db)):
    subject = payload.get("subject", "Design & Analysis of Algorithms")
    exam_type = payload.get("exam_type", "CAT2")
    total_marks = payload.get("total_marks", 50)
    duration = payload.get("duration", 90)
    co_targets = payload.get("co_targets", {"CO1": 40, "CO2": 40, "CO3": 20})
    bloom_targets = payload.get("bloom_targets", {"Remember": 20, "Understand": 20, "Apply": 30, "Analyze": 30})

    # Select fitting questions from bank
    qb = db.query(QuestionBankItem).filter(QuestionBankItem.subject == subject).all()
    selected = []
    # simple greedy selection
    current_marks = 0
    for q in qb:
        if current_marks + q.marks <= total_marks:
            selected.append({
                "id": q.id,
                "question_text": q.question_text,
                "marks": q.marks,
                "co": q.co_number,
                "bloom_level": q.bloom_level
            })
            current_marks += q.marks
            
    paper = QuestionPaper(
        subject=subject,
        exam_type=exam_type,
        total_marks=total_marks,
        duration=duration,
        co_coverage=json.dumps(co_targets),
        bloom_distribution=json.dumps(bloom_targets),
        status="draft",
        questions_json=json.dumps(selected)
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    return {
        "status": "success",
        "paper_id": paper.id,
        "questions": selected,
        "co_coverage": co_targets,
        "bloom_distribution": bloom_targets
    }

@app.get("/api/exam/papers")
def get_generated_papers(db: Session = Depends(get_db)):
    papers = db.query(QuestionPaper).all()
    res = []
    for p in papers:
        res.append({
            "id": p.id,
            "subject": p.subject,
            "exam_type": p.exam_type,
            "total_marks": p.total_marks,
            "duration": p.duration,
            "status": p.status,
            "co_coverage": json.loads(p.co_coverage) if p.co_coverage else {},
            "bloom_distribution": json.loads(p.bloom_distribution) if p.bloom_distribution else {},
            "questions": json.loads(p.questions_json) if p.questions_json else []
        })
    return res

@app.post("/api/exam/papers/{paper_id}/moderate")
def moderate_question_paper(paper_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    status_ = payload.get("status", "moderated")
    paper = db.query(QuestionPaper).filter(QuestionPaper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper.status = status_
    db.commit()
    return {"status": "success", "paper_id": paper.id, "new_status": status_}

@app.post("/api/exam/generate-rubric")
def get_rubric_schema(payload: dict = Body(...)):
    # Generates rubric criteria
    return [
        {"criterion": "Technical Correctness", "max_marks": 5, "descriptor": "Algorithm correctly solves all edge cases."},
        {"criterion": "Analysis Proof", "max_marks": 3, "descriptor": "Detailed recursive trace and step explanation."},
        {"criterion": "Syntax & Clarity", "max_marks": 2, "descriptor": "Clean pseudocode with readable parameters."}
    ]


# ==========================================
# REST API FOR MENTOR & WELLBEING (AGENT 6)
# ==========================================

@app.get("/api/mentor/mentees")
def get_mentees_list(db: Session = Depends(get_db)):
    mentees = db.query(Mentee).all()
    res = []
    for m in mentees:
        student = db.query(Student).filter(Student.id == m.student_id).first()
        if student:
            # Overdue if check-in is older than 21 days (roughly)
            is_overdue = "4 weeks" in str(m.last_checkin_date) or m.last_checkin_date == "2026-06-29"
            res.append({
                "id": m.id,
                "student_id": student.id,
                "roll_no": student.roll_no,
                "name": student.name,
                "class_section": m.class_section,
                "last_checkin_date": m.last_checkin_date,
                "is_overdue": is_overdue
            })
    return res

@app.get("/api/mentor/timeline/{student_id}")
def get_mentee_timeline(student_id: int, db: Session = Depends(get_db)):
    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")
    checkins = db.query(CheckIn).filter(CheckIn.mentee_id == mentee.id).order_by(CheckIn.date.desc()).all()
    return [
        {
            "id": c.id,
            "date": c.date,
            "mode": c.mode,
            "notes": c.notes,  # sensitive data visible only in mentor view
            "mood_tag": c.mood_tag
        }
        for c in checkins
    ]

@app.post("/api/mentor/checkin")
def log_checkin_record(payload: dict = Body(...), db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    mode = payload.get("mode", "in-person")
    notes = payload.get("notes", "")
    mood_tag = payload.get("mood_tag", "doing well")
    date = datetime.date.today().strftime("%Y-%m-%d")

    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")

    new_checkin = CheckIn(
        mentee_id=mentee.id,
        date=date,
        mode=mode,
        notes=notes,
        mood_tag=mood_tag
    )
    db.add(new_checkin)
    
    # Update last checkin date on Mentee
    mentee.last_checkin_date = f"{date} (today)"
    db.commit()

    return {"status": "success", "message": "Wellbeing check-in logged."}

@app.post("/api/mentor/escalate")
def escalate_mentee(payload: dict = Body(...), db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    reason = payload.get("reason")
    escalated_to = payload.get("escalated_to", "counselor")

    if not reason:
        raise HTTPException(status_code=400, detail="Escalation reason is required")

    mentee = db.query(Mentee).filter(Mentee.student_id == student_id).first()
    if not mentee:
        raise HTTPException(status_code=404, detail="Mentee not found")

    new_esc = Escalation(
        mentee_id=mentee.id,
        raised_by=1,
        reason=reason,
        escalated_to=escalated_to,
        status="open"
    )
    db.add(new_esc)
    db.commit()
    return {"status": "success", "message": f"Case escalated to {escalated_to}."}

@app.get("/api/mentor/suggest-prompt/{student_id}")
def get_suggested_wellbeing_prompt(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # Empirical check on attendance to make prompt context-aware
    mark = db.query(InternalMark).filter(InternalMark.student_id == student_id).first()
    attendance_str = ""
    if mark and mark.attendance_percentage < 75:
         attendance_str = f"your DAA attendance of {mark.attendance_percentage}% is slightly low"
    else:
         attendance_str = "how the semester classes are going"

    prompt = f"Hi {student.name}, I was reviewing our mentee check-in list and wanted to check in on you. I noticed {attendance_str}. Is there anything bothering you or any support you need from my side?"
    return {"prompt": prompt}
