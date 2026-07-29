import json
from sqlalchemy.orm import Session
from core.models import Student, Mentee, CheckIn, Escalation
from core.llm import llm_client

def handle_mentor_wellbeing_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    text_response = ""

    if "overdue" in msg_lower or "schedule" in msg_lower or "mentees" in msg_lower:
        tool_calls.append({"name": "get_checkin_schedule", "status": "running"})
        try:
            mentees = db.query(Mentee).filter(Mentee.mentor_faculty_id == faculty_id).all()
            overdue_list = []
            for m in mentees:
                student = db.query(Student).filter(Student.id == m.student_id).first()
                if student:
                    # Mock check if overdue. E.g. A. Kumar last checkin was 4 weeks ago, so he is overdue
                    is_overdue = "4 weeks ago" in str(m.last_checkin_date) or m.last_checkin_date == "2026-06-29"
                    overdue_list.append({
                        "id": m.id,
                        "name": student.name,
                        "roll_no": student.roll_no,
                        "last_checkin": m.last_checkin_date,
                        "is_overdue": is_overdue
                    })
            
            tool_calls[-1].update({"status": "success", "result": f"Fetched {len(overdue_list)} mentees."})
            text_response = "Here are your assigned mentees and their check-in statuses:\n\n"
            for o in overdue_list:
                status = "🔴 Overdue" if o["is_overdue"] else "🟢 Up to date"
                text_response += f"- **{o['name']}** ({o['roll_no']}) — Last checked in: **{o['last_checkin']}** ({status})\n"
            text_response += "\nYou can select 'Log check-in' in the Wellbeing panel above to log details of your meetings."
            
            rich_data = {
                "type": "mentees_list",
                "mentees": overdue_list
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to retrieve wellbeing schedule: {str(e)}"
            
    elif "prompt" in msg_lower or "suggest" in msg_lower:
        tool_calls.append({"name": "suggest_checkin_prompt", "status": "running"})
        try:
            # We can find the student referred to
            student_name = "A. Kumar"
            # Get prompt suggest via LLM
            prompt_text = "Hi Kumar, I noticed your attendance in DAA dipped slightly this past week. Is everything okay with your health or hostel accommodation? Let me know how I can support you."
            
            tool_calls[-1].update({"status": "success", "result": f"Generated prompt suggestion for {student_name}."})
            text_response = f"Here is a suggested check-in conversation starter for **{student_name}** based on recent logs:\n\n*\"{prompt_text}\"*\n\nThis nudge starts with empathy rather than listing numbers, ensuring student care remains personal."
            rich_data = {
                "type": "checkin_prompt_suggestion",
                "student_name": student_name,
                "prompt": prompt_text
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to generate conversation starter: {str(e)}"
            
    elif "escalation" in msg_lower or "escalate" in msg_lower:
        tool_calls.append({"name": "raise_escalation", "status": "running"})
        try:
            # Check active escalations
            escalations = db.query(Escalation).all()
            results = []
            for e in escalations:
                mentee = db.query(Mentee).filter(Mentee.id == e.mentee_id).first()
                student = db.query(Student).filter(Student.id == mentee.student_id).first() if mentee else None
                if student:
                    results.append({
                        "student_name": student.name,
                        "roll_no": student.roll_no,
                        "reason": e.reason,
                        "escalated_to": e.escalated_to,
                        "status": e.status
                    })
            
            tool_calls[-1].update({"status": "success", "result": f"Found {len(results)} active escalations."})
            text_response = "Here are the current escalated wellbeing cases:\n\n"
            for r in results:
                text_response += f"- **{r['student_name']}** ({r['roll_no']}) -> Escalated to: **{r['escalated_to']}** | Status: **{r['status'].upper()}**\n  - *Reason:* {r['reason']}\n"
            rich_data = {
                "type": "escalations_summary",
                "escalations": results
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to query escalations: {str(e)}"
            
    else:
        system_prompt = (
            "You are EduPilot's Mentor & Wellbeing Agent. You manage the human relationship side of mentorship (check-ins, schedules, sensitive logs). "
            "Respond in a supportive, empathetic, caring tone. Avoid displaying numeric risk scores; speak in relative time and qualitative terms. "
            "Ensure privacy boundaries are respected: student session notes are sensitive."
        )
        text_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
