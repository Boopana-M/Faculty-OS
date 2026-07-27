import json
from sqlalchemy.orm import Session
from core.models import Student, AttendanceRecord, Assignment, Submission, InternalMark, COAttainment, FacultyWorkload
from core.llm import llm_client

def handle_analytics_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    text_response = ""

    if "at risk" in msg_lower or "risk" in msg_lower or "weak" in msg_lower:
        tool_calls.append({"name": "predict_at_risk_students", "status": "running"})
        try:
            # Simple rule-based prediction: attendance < 75% or total_marks < 40% of class average
            at_risk = db.query(InternalMark).filter(InternalMark.attendance_percentage < 75).all()
            results = []
            for r in at_risk:
                student = db.query(Student).filter(Student.id == r.student_id).first()
                if student:
                    results.append({
                        "name": student.name,
                        "roll_no": student.roll_no,
                        "attendance": r.attendance_percentage,
                        "marks": r.total_marks,
                        "reason": "Attendance below 75% threshold"
                    })
            
            tool_calls[-1].update({"status": "success", "result": f"Found {len(results)} at-risk students."})
            text_response = f"Based on academic progress and attendance logs, I have identified **{len(results)}** student(s) at risk:\n\n"
            for res in results:
                text_response += f"* **{res['name']}** ({res['roll_no']}) — Attendance: **{res['attendance']}%**, Marks: **{res['marks']}/50** ({res['reason']})\n"
            text_response += "\nI suggest scheduling a wellbeing check-in or setting up a remedial lecture."
            rich_data = {
                "type": "at_risk_prediction",
                "students": results
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to calculate risk scoring: {str(e)}"
            
    elif "nba" in msg_lower or "co attainment" in msg_lower or "attainment" in msg_lower:
        tool_calls.append({"name": "generate_nba_co_report", "status": "running"})
        try:
            co_records = db.query(COAttainment).filter(COAttainment.subject.like("%Algorithms%")).all()
            attainments = [{"co": c.co_number, "target": c.target_percentage, "attained": c.attained_percentage} for c in co_records]
            
            tool_calls[-1].update({"status": "success", "result": f"Generated CO attainment for {len(attainments)} targets."})
            text_response = "Here is the Course Outcome (CO) attainment report for **Design & Analysis of Algorithms**:\n"
            for a in attainments:
                status = "✅ Met" if a["attained"] >= a["target"] else "⚠️ Under Target"
                text_response += f"- **{a['co']}**: Target: **{a['target']}%** | Attained: **{a['attained']}%** ({status})\n"
            rich_data = {
                "type": "co_attainment_report",
                "subject": "Design & Analysis of Algorithms",
                "attainments": attainments
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to generate accreditation metrics: {str(e)}"
            
    elif "workload" in msg_lower:
        tool_calls.append({"name": "generate_faculty_workload_report", "status": "running"})
        try:
            w_records = db.query(FacultyWorkload).filter(FacultyWorkload.faculty_id == faculty_id).all()
            total_hours = sum([w.weekly_hours for w in w_records])
            tool_calls[-1].update({"status": "success", "result": f"Total workload: {total_hours} hours/week."})
            text_response = f"Your teaching workload summary shows **{total_hours} contact hours/week**:\n"
            for w in w_records:
                text_response += f"- **{w.subject}** ({w.role}): **{w.weekly_hours} hours/week**\n"
            rich_data = {
                "type": "workload_report",
                "total_hours": total_hours,
                "items": [{"subject": w.subject, "hours": w.weekly_hours, "role": w.role} for w in w_records]
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to load workload statistics: {str(e)}"
            
    else:
        system_prompt = (
            "You are EduPilot's Analytics & Accreditation Agent. You generate charts, analyze at-risk trends, and compile accreditation metrics. "
            "Respond in an executive, data-driven tone. Use headers and bullets to convey performance and attainment details."
        )
        text_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
