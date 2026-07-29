import json
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Student, Mentee, CheckIn, Escalation, InternalMark, MentorTask, TaskAcknowledgement, FutureNote
from core.llm import llm_client


def _normalize_date(value: str | None):
    if not value:
        return None
    raw_value = str(value)
    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").date()
    except ValueError:
        return None


def get_checkin_schedule(faculty_id: int, db: Session):
    mentees = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).all()
    today = date.today()
    overdue_list = []

    for mentee in mentees:
        student = db.query(Student).filter(Student.id == mentee.student_id).first()
        if not student:
            continue

        last_date = _normalize_date(mentee.last_checkin_date)
        days_since = (today - last_date).days if last_date else 999
        is_overdue = days_since >= 21 or last_date is None
        overdue_list.append({
            "id": mentee.id,
            "student_id": student.id,
            "name": student.name,
            "roll_no": student.roll_no,
            "class_section": mentee.class_section,
            "last_checkin_date": mentee.last_checkin_date,
            "days_since_checkin": days_since,
            "is_overdue": is_overdue,
            "relative_timing": "overdue" if is_overdue else "up to date",
        })

    overdue_list.sort(key=lambda item: (0 if item["is_overdue"] else 1, item["days_since_checkin"]), reverse=False)
    return overdue_list


def log_checkin(mentee_id: int, notes: str, mood_tag: str, mode: str, db: Session):
    mentee = db.query(Mentee).filter(Mentee.id == mentee_id).first()
    if not mentee:
        raise ValueError("Mentee not found")

    today = date.today().strftime("%Y-%m-%d")
    entry = CheckIn(
        mentee_id=mentee.id,
        date=today,
        mode=mode,
        notes=notes,
        mood_tag=mood_tag,
    )
    db.add(entry)
    mentee.last_checkin_date = today
    db.commit()
    db.refresh(entry)
    return {"status": "success", "message": "Wellbeing check-in logged."}


def get_mentee_timeline(mentee_id: int, db: Session):
    mentee = db.query(Mentee).filter(Mentee.id == mentee_id).first()
    if not mentee:
        raise ValueError("Mentee not found")

    entries = db.query(CheckIn).filter(CheckIn.mentee_id == mentee.id).order_by(CheckIn.date.desc()).all()
    return [
        {
            "id": entry.id,
            "date": entry.date,
            "mode": entry.mode,
            "notes": entry.notes,
            "mood_tag": entry.mood_tag,
        }
        for entry in entries
    ]


def suggest_checkin_prompt(mentee_id: int, db: Session):
    mentee = db.query(Mentee).filter(Mentee.id == mentee_id).first()
    if not mentee:
        raise ValueError("Mentee not found")

    student = db.query(Student).filter(Student.id == mentee.student_id).first()
    latest_checkin = db.query(CheckIn).filter(CheckIn.mentee_id == mentee.id).order_by(CheckIn.date.desc()).first()
    mark = db.query(InternalMark).filter(InternalMark.student_id == mentee.student_id).first()

    context_bits = []
    if mark and mark.attendance_percentage is not None and mark.attendance_percentage < 75:
        context_bits.append(f"their recent attendance has dipped and they may need a gentle nudge")
    elif latest_checkin and latest_checkin.mood_tag == "needs attention":
        context_bits.append("they shared that they were feeling under pressure recently")
    else:
        context_bits.append("the semester has been moving quickly and they may appreciate a personal check-in")

    if latest_checkin:
        context_bits.append(f"their last note mentioned they were feeling {latest_checkin.mood_tag}")

    context_text = " and ".join(context_bits)
    prompt = (
        f"Hi {student.name if student else 'there'}, I wanted to check in with you because {context_text}. "
        "I would love to hear how the semester is going and whether there is anything you need support with."
    )
    return prompt


def raise_escalation(mentee_id: int, reason: str, escalate_to: str, faculty_id: int, db: Session):
    mentee = db.query(Mentee).filter(Mentee.id == mentee_id).first()
    if not mentee:
        raise ValueError("Mentee not found")

    escalation = Escalation(
        mentee_id=mentee.id,
        raised_by=faculty_id,
        reason=reason,
        escalated_to=escalate_to,
        status="open",
    )
    db.add(escalation)
    db.commit()
    db.refresh(escalation)
    return {"status": "success", "message": f"Case escalated to {escalate_to}."}


def get_escalations(faculty_id: int, db: Session):
    escalations = (
        db.query(
            Escalation.id,
            Escalation.mentee_id,
            Student.name.label("student_name"),
            Student.roll_no,
            Escalation.reason,
            Escalation.escalated_to,
            Escalation.status,
            Escalation.created_at,
        )
        .join(Mentee, Mentee.id == Escalation.mentee_id)
        .join(Student, Student.id == Mentee.student_id)
        .filter(Mentee.mentor_faculty_id == faculty_id)
        .order_by(Escalation.created_at.desc())
        .all()
    )
    
    return [
        {
            "id": e.id,
            "mentee_id": e.mentee_id,
            "student_name": e.student_name,
            "roll_no": e.roll_no,
            "reason": e.reason,
            "escalated_to": e.escalated_to,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in escalations
    ]


def update_escalation_status(escalation_id: int, new_status: str, db: Session):
    escalation = db.query(Escalation).filter(Escalation.id == escalation_id).first()
    if not escalation:
        raise ValueError("Escalation not found")
        
    if new_status not in ['open', 'in-progress', 'resolved']:
        raise ValueError("Invalid status. Must be 'open', 'in-progress', or 'resolved'")
        
    escalation.status = new_status
    db.commit()
    return {"status": "success", "message": f"Escalation updated to {new_status}"}


def get_mentor_stats(faculty_id: int, db: Session):
    total_mentees = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).count()
    
    schedule = get_checkin_schedule(faculty_id, db)
    overdue_count = sum(1 for item in schedule if item["is_overdue"])
    
    open_escalations = (
        db.query(Escalation)
        .join(Mentee)
        .filter(Mentee.mentor_faculty_id == faculty_id, Escalation.status == 'open')
        .count()
    )
    
    current_month_str = date.today().replace(day=1).strftime("%Y-%m-%d")
    checkins_this_month = (
        db.query(CheckIn)
        .join(Mentee)
        .filter(Mentee.mentor_faculty_id == faculty_id, CheckIn.date >= current_month_str)
        .count()
    )
    
    return {
        "total_mentees": total_mentees,
        "overdue_count": overdue_count,
        "open_escalations": open_escalations,
        "checkins_this_month": checkins_this_month
    }


def get_mentor_tasks(faculty_id: int, db: Session):
    tasks = db.query(MentorTask).filter(MentorTask.faculty_id == faculty_id).all()
    result = []
    for t in tasks:
        acks = db.query(TaskAcknowledgement).filter(TaskAcknowledgement.task_id == t.id).all()
        completed = sum(1 for a in acks if a.status == "completed")
        result.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_count": completed,
            "total_count": len(acks)
        })
    return result


def create_mentor_task(faculty_id: int, title: str, description: str, db: Session):
    task = MentorTask(faculty_id=faculty_id, title=title, description=description)
    db.add(task)
    db.commit()
    db.refresh(task)

    mentees = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).all()
    for m in mentees:
        ack = TaskAcknowledgement(task_id=task.id, mentee_id=m.id, status="pending")
        db.add(ack)
    
    db.commit()
    return {"status": "success", "task_id": task.id, "message": "Mentor task created"}


def edit_mentor_task(task_id: int, title: str, description: str, db: Session):
    task = db.query(MentorTask).filter(MentorTask.id == task_id).first()
    if not task:
        raise ValueError("Task not found")
    
    if title:
        task.title = title
    if description is not None:
        task.description = description
        
    db.commit()
    return {"status": "success", "task_id": task.id, "message": "Mentor task updated"}


def get_future_notes(mentee_id: int, db: Session):
    notes = db.query(FutureNote).filter(FutureNote.mentee_id == mentee_id).order_by(FutureNote.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "note": n.note,
            "created_at": n.created_at.isoformat() if n.created_at else None
        } for n in notes
    ]


def add_future_note(mentee_id: int, note: str, db: Session):
    new_note = FutureNote(mentee_id=mentee_id, note=note)
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return {"status": "success", "note_id": new_note.id, "message": "Future note saved"}


def handle_mentor_wellbeing_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    text_response = ""

    if "timeline" in msg_lower:
        tool_calls.append({"name": "get_mentee_timeline", "status": "running"})
        try:
            words = message.split()
            found_mentee = None
            for word in words:
                if len(word) > 2:
                    found_mentee = db.query(Mentee).join(Student).filter(
                        Student.name.ilike(f"%{word}%"), 
                        Mentee.mentor_faculty_id == faculty_id
                    ).first()
                    if found_mentee:
                        break
            
            if not found_mentee:
                found_mentee = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).first()
                
            mentee_id = found_mentee.id if found_mentee else None

            if not mentee_id:
                raise ValueError("No mentee found")

            timeline = get_mentee_timeline(mentee_id, db)
            tool_calls[-1].update({"status": "success", "result": f"Loaded {len(timeline)} timeline entries."})
            text_response = "Here is the recent wellbeing timeline for that mentee:\n\n"
            for item in timeline:
                text_response += f"- {item['date']} | {item['mood_tag']} | {item['mode']}\n  {item['notes']}\n"
            rich_data = {"type": "mentee_timeline", "timeline": timeline}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"I could not retrieve the timeline right now: {str(e)}"

    elif "overdue" in msg_lower or "schedule" in msg_lower or "mentees" in msg_lower:
        tool_calls.append({"name": "get_checkin_schedule", "status": "running"})
        try:
            overdue_list = get_checkin_schedule(faculty_id, db)
            tool_calls[-1].update({"status": "success", "result": f"Fetched {len(overdue_list)} mentees."})
            text_response = "Here is your current mentor check-in schedule:\n\n"
            for item in overdue_list:
                status = "Overdue" if item["is_overdue"] else "Up to date"
                text_response += f"- **{item['name']}** ({item['roll_no']}) — last check-in {item['last_checkin_date']} — **{status}**\n"
            rich_data = {"type": "mentees_list", "mentees": overdue_list}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"I could not retrieve the check-in schedule: {str(e)}"

    elif "prompt" in msg_lower or "suggest" in msg_lower:
        tool_calls.append({"name": "suggest_checkin_prompt", "status": "running"})
        try:
            mentee = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).first()
            if not mentee:
                raise ValueError("No mentee found")
            prompt_text = suggest_checkin_prompt(mentee.id, db)
            tool_calls[-1].update({"status": "success", "result": "Generated a context-aware prompt."})
            text_response = f"Here is a gentle conversation starter for your next check-in:\n\n\"{prompt_text}\""
            rich_data = {"type": "checkin_prompt_suggestion", "prompt": prompt_text}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"I could not generate a prompt right now: {str(e)}"

    elif "escalation" in msg_lower or "escalate" in msg_lower:
        tool_calls.append({"name": "raise_escalation", "status": "running"})
        try:
            mentee = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).first()
            if not mentee:
                raise ValueError("No mentee found")
            escalation = raise_escalation(mentee.id, "Student may benefit from additional counseling support.", "counselor", faculty_id, db)
            tool_calls[-1].update({"status": "success", "result": escalation["message"]})
            text_response = "I created a gentle escalation record for the selected case and flagged it for follow-up."
            rich_data = {"type": "escalation", "status": escalation["status"]}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"I could not raise an escalation: {str(e)}"

    elif "task" in msg_lower or "assign" in msg_lower:
        tool_calls.append({"name": "create_mentor_task", "status": "running"})
        try:
            title = "New Task"
            if ":" in message:
                title, desc = message.split(":", 1)
            else:
                desc = message
            task_res = create_mentor_task(faculty_id, title.strip(), desc.strip(), db)
            tool_calls[-1].update({"status": "success", "result": task_res["message"]})
            text_response = "I have assigned this task to all your mentees."
            rich_data = {"type": "mentor_task", "task_id": task_res["task_id"]}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"I could not create the task: {str(e)}"

    elif "note" in msg_lower or "save" in msg_lower or "future" in msg_lower:
        tool_calls.append({"name": "add_future_note", "status": "running"})
        try:
            words = message.split()
            found_mentee = None
            for word in words:
                if len(word) > 2:
                    found_mentee = db.query(Mentee).join(Student).filter(
                        Student.name.ilike(f"%{word}%"), 
                        Mentee.mentor_faculty_id == faculty_id
                    ).first()
                    if found_mentee:
                        break
            if not found_mentee:
                found_mentee = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).first()
            if not found_mentee:
                raise ValueError("No mentee found")
                
            note_res = add_future_note(found_mentee.id, message, db)
            tool_calls[-1].update({"status": "success", "result": note_res["message"]})
            text_response = "I have saved this note for the future."
            rich_data = {"type": "future_note", "note_id": note_res["note_id"]}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"I could not save the note: {str(e)}"

    else:
        system_prompt = (
            "You are EduPilot's Mentor & Wellbeing Agent. You manage the human relationship side of mentorship "
            "(check-ins, schedules, sensitive logs). Respond in a supportive, empathetic, calm tone. "
            "Speak in relative time and qualitative terms rather than numeric risk scores. "
            "Keep student notes private and scoped to the assigned mentor."
        )
        text_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])

    return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
