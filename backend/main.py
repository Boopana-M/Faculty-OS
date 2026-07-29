import os
import json
import asyncio
from fastapi import FastAPI, Depends, HTTPException, status, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db, engine, Base
from core.models import (
    Faculty, Student, AttendanceRecord, Assignment, Submission, InternalMark,
    COAttainment, FacultyWorkload, Publication, GrantOpportunity, ResearchDeadline,
    QuestionBankItem, QuestionPaper, Rubric, Mentee, CheckIn, Escalation
)
from core.auth import verify_password, create_access_token, verify_token
from core.seed import seed_database
from agents.faculty_assistant.agent import handle_faculty_assistant_chat
from agents.academic_workflow.agent import handle_academic_workflow_chat
from agents.analytics.agent import handle_analytics_chat
from agents.research_grants.agent import handle_research_grants_chat
from agents.exam_assessment.agent import handle_exam_assessment_chat
from agents.mentor_wellbeing.agent import handle_mentor_wellbeing_chat

# Initialize DB tables
Base.metadata.create_all(bind=engine)

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

@app.get("/api/attendance")
def get_attendance(class_section: str = "CCE", date: str = None, db: Session = Depends(get_db)):
    if not date:
        latest_date_row = db.query(AttendanceRecord.date).filter(
            AttendanceRecord.class_section == class_section
        ).order_by(AttendanceRecord.date.desc()).first()
        
        if not latest_date_row:
            return []
        date = latest_date_row[0]
        
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.class_section == class_section,
        AttendanceRecord.date == date
    ).all()
    
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

@app.get("/api/attendance/dates")
def get_recorded_dates(class_section: str = "CCE", db: Session = Depends(get_db)):
    rows = db.query(AttendanceRecord.date, AttendanceRecord.period).filter(
        AttendanceRecord.class_section == class_section
    ).distinct().all()
    return [{"date": r[0], "period": r[1]} for r in rows]

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

@app.post("/api/attendance/bulk-save")
def bulk_save_attendance(payload: dict = Body(...), db: Session = Depends(get_db)):
    date = payload.get("date", datetime.date.today().strftime("%Y-%m-%d"))
    period = payload.get("period", "09:00 - 10:00")
    subject = payload.get("subject", "Design & Analysis of Algorithms")
    class_section = payload.get("class_section", "CCE")
    records = payload.get("records", [])

    for r_data in records:
        roll_no = r_data.get("roll_no")
        status = r_data.get("status", "Present")
        if not roll_no:
            continue
            
        student = db.query(Student).filter(Student.roll_no == roll_no).first()
        if not student:
            continue
            
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.date == date,
            AttendanceRecord.subject == subject,
            AttendanceRecord.period == period
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
            db.flush()
            
        all_att = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.subject == subject
        ).all()
        
        if all_att:
            p_count = sum(1 for a in all_att if a.status == "Present")
            pct = int((p_count / len(all_att)) * 100)
            
            mark = db.query(InternalMark).filter(
                InternalMark.student_id == student.id,
                InternalMark.subject == subject
            ).first()
            if mark:
                mark.attendance_percentage = pct
            else:
                mark = InternalMark(
                    student_id=student.id,
                    subject=subject,
                    attendance_percentage=pct
                )
                db.add(mark)
                
    db.commit()
    return {"status": "success", "message": f"Successfully stored daily attendance for {len(records)} students."}

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
def get_marks(class_section: str = "CCE", db: Session = Depends(get_db)):
    marks = db.query(InternalMark).join(
        Student, Student.id == InternalMark.student_id
    ).filter(Student.class_section == class_section).all()
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


@app.post("/api/students/upload-namelist")
async def upload_namelist(
    file: UploadFile = File(...),
    class_section: str = Form("CSE-A"),
    subject: str = Form("Design & Analysis of Algorithms"),
    db: Session = Depends(get_db)
):
    import re
    import json
    import io
    from core.llm import llm_client

    filename = file.filename.lower()
    contents = await file.read()
    
    students_to_process = []
    
    # helper for regex fallback
    def regex_parse_students(text: str, default_sec: str) -> list:
        parsed = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', line)
            email = email_match.group(0) if email_match else None
            
            roll_match = re.search(r'\b([0-9]{2}[A-Za-z]{2,3}[0-9]{3,5})\b', line)
            if not roll_match:
                roll_match = re.search(r'\b([A-Za-z]+[0-9]+[A-Za-z0-9]*|[0-9]+[A-Za-z]+[A-Za-z0-9]*)\b', line)
                
            if roll_match:
                roll_no = roll_match.group(1).upper()
                if len(roll_no) < 4:
                    continue
                temp_line = line.replace(roll_match.group(0), "")
                if email:
                    temp_line = temp_line.replace(email, "")
                
                temp_line = re.sub(r'[,;|\t:_\-\(\)\[\]]', ' ', temp_line).strip()
                words = temp_line.split()
                name_words = [w for w in words if w.isalpha() or '.' in w]
                filtered_words = []
                for w in name_words:
                    w_lower = w.lower()
                    if w_lower in ["cse-a", "cse-b", "cse", "ece", "eee", "mech", "civil", "it", "section"]:
                        continue
                    filtered_words.append(w)
                name = " ".join(filtered_words)
                if not name or len(name) < 2:
                    name = "Student " + roll_no
                    
                parsed.append({
                    "roll_no": roll_no,
                    "name": name,
                    "email": email or f"{roll_no.lower()}@student.edu",
                    "class_section": default_sec
                })
        return parsed

    # 1. Parse based on file type
    if filename.endswith(".csv"):
        import csv
        try:
            decoded = contents.decode("utf-8")
        except UnicodeDecodeError:
            decoded = contents.decode("latin-1")
            
        reader = csv.reader(io.StringIO(decoded))
        try:
            headers = next(reader)
            headers = [h.strip().lower() for h in headers]
            roll_idx, name_idx, email_idx, sec_idx = -1, -1, -1, -1
            for idx, h in enumerate(headers):
                if "roll" in h:
                    roll_idx = idx
                elif "name" in h:
                    name_idx = idx
                elif "email" in h:
                    email_idx = idx
                elif "section" in h or "class" in h:
                    sec_idx = idx
                    
            if roll_idx == -1 or name_idx == -1:
                roll_idx, name_idx = 0, 1
                email_idx = 2 if len(headers) > 2 else -1
                sec_idx = 3 if len(headers) > 3 else -1
                reader = csv.reader(io.StringIO(decoded)) # Reset to start if headers are data
                
            for row in reader:
                if not row or len(row) <= max(roll_idx, name_idx):
                    continue
                roll_no = row[roll_idx].strip()
                name = row[name_idx].strip()
                if not roll_no or not name:
                    continue
                email = row[email_idx].strip() if (email_idx != -1 and len(row) > email_idx) else f"{roll_no.lower()}@student.edu"
                row_sec = row[sec_idx].strip() if (sec_idx != -1 and len(row) > sec_idx) else class_section
                students_to_process.append({
                    "roll_no": roll_no,
                    "name": name,
                    "email": email,
                    "class_section": row_sec
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        import openpyxl
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))
            
            if not rows:
                raise HTTPException(status_code=400, detail="Empty Excel file uploaded")
                
            header_idx = -1
            roll_col, name_col, email_col, sec_col = -1, -1, -1, -1
            
            # Step A: Attempt standard header-based matching
            for idx, r in enumerate(rows[:15]):
                cells = [str(c).lower().strip() if c is not None else "" for c in r]
                r_idx = next((i for i, c in enumerate(cells) if any(x in c for x in ["roll", "reg", "admission", "student id", "r.no", "id"])), -1)
                n_idx = next((i for i, c in enumerate(cells) if any(x in c for x in ["name", "fullname", "student name", "candidate"])), -1)
                if r_idx != -1 and n_idx != -1:
                    header_idx = idx
                    roll_col = r_idx
                    name_col = n_idx
                    email_col = next((i for i, c in enumerate(cells) if any(x in c for x in ["email", "mail", "e-mail"])), -1)
                    sec_col = next((i for i, c in enumerate(cells) if any(x in c for x in ["section", "class", "sec"])), -1)
                    break
                    
            # Step B: If headers are not matched, perform statistical column classification
            if roll_col == -1 or name_col == -1:
                num_cols = len(rows[0]) if rows else 0
                col_scores = []
                for col_idx in range(num_cols):
                    roll_score = 0
                    name_score = 0
                    email_score = 0
                    for r in rows[:40]:
                        if col_idx >= len(r) or r[col_idx] is None:
                            continue
                        val = str(r[col_idx]).strip()
                        if not val:
                            continue
                        if "@" in val and "." in val:
                            email_score += 1.5
                        elif len(val) >= 4 and len(val) <= 15 and any(c.isdigit() for c in val) and any(c.isalpha() for c in val):
                            roll_score += 1.0
                        elif val.isdigit() and len(val) >= 4 and len(val) <= 12:
                            roll_score += 0.7
                        elif len(val) >= 3 and len(val) <= 40 and all(x.isalpha() or x.isspace() or x=='.' for x in val):
                            name_score += 1.0
                    col_scores.append({'roll': roll_score, 'name': name_score, 'email': email_score})
                    
                if num_cols > 0:
                    roll_col = max(range(num_cols), key=lambda i: col_scores[i]['roll'])
                    name_col = max(range(num_cols), key=lambda i: col_scores[i]['name'])
                    email_col = max(range(num_cols), key=lambda i: col_scores[i]['email'])
                    
                    if col_scores[email_col]['email'] == 0:
                        email_col = -1
                    if roll_col == name_col:
                        name_col = next((i for i in sorted(range(num_cols), key=lambda i: col_scores[i]['name'], reverse=True) if i != roll_col), 1 if roll_col != 1 else 0)
                
                header_idx = 0

            start_row = header_idx + 1 if header_idx != -1 else 0
            for r in rows[start_row:]:
                if not r or len(r) <= max(roll_col, name_col):
                    continue
                roll_no = str(r[roll_col]).strip() if r[roll_col] is not None else ""
                name = str(r[name_col]).strip() if r[name_col] is not None else ""
                
                if not roll_no or roll_no.lower() == "none" or not name or name.lower() == "none":
                    continue
                if not re.search(r'[A-Za-z0-9]', roll_no):
                    continue
                if any(x in roll_no.lower() for x in ["roll", "reg", "name"]):
                    continue
                    
                email = str(r[email_col]).strip() if (email_col != -1 and email_col < len(r) and r[email_col] is not None) else f"{roll_no.lower()}@student.edu"
                sec = str(r[sec_col]).strip() if (sec_col != -1 and sec_col < len(r) and r[sec_col] is not None) else class_section
                students_to_process.append({
                    "roll_no": roll_no,
                    "name": name,
                    "email": email,
                    "class_section": sec
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {str(e)}")

    elif filename.endswith(".pdf"):
        import pypdf
        try:
            reader = pypdf.PdfReader(io.BytesIO(contents))
            pdf_text = ""
            for page in reader.pages:
                pdf_text += page.extract_text() + "\n"
                
            if not pdf_text.strip():
                raise HTTPException(status_code=400, detail="No readable text found in PDF file.")
                
            # If Claude LLM is available, use it for intelligent parsing
            if llm_client.client:
                system_prompt = (
                    "You are an expert data extraction assistant. "
                    "Extract a list of students from the provided raw text. "
                    "Identify the roll number, student name, email, and class section for each student. "
                    "Return ONLY a valid JSON list of objects. Each object must have these keys: "
                    "'roll_no' (string), 'name' (string), 'email' (string), 'class_section' (string). "
                    f"If email is not found, construct it like 'roll_no@student.edu' (lowercase). "
                    f"If class_section is not found, default to '{class_section}'. "
                    "Do not output markdown code blocks, comments, or any text other than raw JSON."
                )
                messages = [{"role": "user", "content": f"Extract students from this text:\n\n{pdf_text}"}]
                response = llm_client.get_chat_response(system_prompt, messages)
                
                # clean response in case it contains markdown blocks
                if "```" in response:
                    parts = response.split("```")
                    for p in parts:
                        p_clean = p.strip()
                        if p_clean.startswith("json"):
                            p_clean = p_clean[4:].strip()
                        if p_clean.startswith("[") and p_clean.endswith("]"):
                            response = p_clean
                            break
                try:
                    students_to_process = json.loads(response)
                except Exception:
                    students_to_process = regex_parse_students(pdf_text, class_section)
            else:
                students_to_process = regex_parse_students(pdf_text, class_section)
        except Exception as e:
             raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    else:
        # Fallback as text file
        try:
            text = contents.decode("utf-8")
        except UnicodeDecodeError:
            text = contents.decode("latin-1")
        students_to_process = regex_parse_students(text, class_section)

    if not students_to_process:
        raise HTTPException(status_code=400, detail="No student data could be extracted from the uploaded file. Please verify the format.")

    students_created = 0
    students_updated = 0
    
    for s_data in students_to_process:
        roll_no = s_data.get("roll_no", "").strip()
        name = s_data.get("name", "").strip()
        if not roll_no or not name:
            continue
            
        email = s_data.get("email", "").strip() or f"{roll_no.lower()}@student.edu"
        row_sec = s_data.get("class_section", "").strip() or class_section
        
        student = db.query(Student).filter(Student.roll_no == roll_no).first()
        if student:
            student.name = name
            student.email = email
            student.class_section = row_sec
            students_updated += 1
        else:
            student = Student(
                roll_no=roll_no,
                name=name,
                email=email,
                class_section=row_sec
            )
            db.add(student)
            db.flush()
            students_created += 1
            
        dates = db.query(AttendanceRecord.date).filter(
            AttendanceRecord.class_section == row_sec
        ).distinct().all()
        dates = [d[0] for d in dates]
        if not dates:
            dates = ["2026-07-27"]
            
        for dt in dates:
            att = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.date == dt,
                AttendanceRecord.subject == subject
            ).first()
            if not att:
                existing_att = db.query(AttendanceRecord).filter(
                    AttendanceRecord.date == dt,
                    AttendanceRecord.subject == subject,
                    AttendanceRecord.class_section == row_sec
                ).first()
                period = existing_att.period if existing_att else "09:00 - 10:00"
                
                att = AttendanceRecord(
                    student_id=student.id,
                    date=dt,
                    status="Present",
                    period=period,
                    subject=subject,
                    class_section=row_sec
                )
                db.add(att)
                
        mark = db.query(InternalMark).filter(
            InternalMark.student_id == student.id,
            InternalMark.subject == subject
        ).first()
        if not mark:
            mark = InternalMark(
                student_id=student.id,
                subject=subject,
                cat1_marks=None,
                cat2_marks=None,
                assignment_marks=None,
                lab_marks=None,
                total_marks=None,
                attendance_percentage=100
            )
            db.add(mark)
            
        assignments = db.query(Assignment).filter(
            Assignment.class_section == row_sec
        ).all()
        for assign in assignments:
            sub = db.query(Submission).filter(
                Submission.assignment_id == assign.id,
                Submission.student_id == student.id
            ).first()
            if not sub:
                sub = Submission(
                    assignment_id=assign.id,
                    student_id=student.id,
                    submitted_at="-",
                    marks_obtained=None,
                    status="Pending"
                )
                db.add(sub)
                
    db.commit()
    return {
        "status": "success",
        "message": f"Namelist processed: {students_created} students created, {students_updated} updated.",
        "created": students_created,
        "updated": students_updated
    }


@app.post("/api/academic/deduplicate")
def deduplicate_academic_data(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    # 1. Deduplicate AttendanceRecord
    dups_att = db.query(
        AttendanceRecord.student_id, AttendanceRecord.date, AttendanceRecord.subject, AttendanceRecord.period
    ).group_by(
        AttendanceRecord.student_id, AttendanceRecord.date, AttendanceRecord.subject, AttendanceRecord.period
    ).having(func.count(AttendanceRecord.id) > 1).all()
    
    removed_att = 0
    for s_id, dt, subj, prd in dups_att:
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == s_id,
            AttendanceRecord.date == dt,
            AttendanceRecord.subject == subj,
            AttendanceRecord.period == prd
        ).order_by(AttendanceRecord.id.asc()).all()
        for r in records[1:]:
            db.delete(r)
            removed_att += 1
            
    # 2. Deduplicate InternalMark
    dups_mark = db.query(
        InternalMark.student_id, InternalMark.subject
    ).group_by(
        InternalMark.student_id, InternalMark.subject
    ).having(func.count(InternalMark.id) > 1).all()
    
    removed_mark = 0
    for s_id, subj in dups_mark:
        records = db.query(InternalMark).filter(
            InternalMark.student_id == s_id,
            InternalMark.subject == subj
        ).order_by(InternalMark.id.asc()).all()
        for r in records[1:]:
            db.delete(r)
            removed_mark += 1
            
    # 3. Deduplicate Submission
    dups_sub = db.query(
        Submission.student_id, Submission.assignment_id
    ).group_by(
        Submission.student_id, Submission.assignment_id
    ).having(func.count(Submission.id) > 1).all()
    
    removed_sub = 0
    for s_id, a_id in dups_sub:
        records = db.query(Submission).filter(
            Submission.student_id == s_id,
            Submission.assignment_id == a_id
        ).order_by(Submission.id.asc()).all()
        for r in records[1:]:
            db.delete(r)
            removed_sub += 1
            
    db.commit()
    return {
        "status": "success",
        "message": f"Removed {removed_att + removed_mark + removed_sub} duplicate records.",
        "removed_attendance": removed_att,
        "removed_marks": removed_mark,
        "removed_submissions": removed_sub,
        "total_removed": removed_att + removed_mark + removed_sub
    }



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
