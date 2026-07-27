import json
from datetime import datetime
from sqlalchemy.orm import Session
from core.models import Timetable, SyllabusUnit, PolicyDocument
from core.llm import llm_client
from rag.rag_pipeline import rag_pipeline

def get_day_name():
    # Returns Monday, Tuesday, Wednesday, etc.
    return datetime.now().strftime("%A")

def handle_faculty_assistant_chat(message: str, faculty_id: int, db: Session):
    """
    Synchronous processing logic for the Faculty Assistant.
    Determines user intent, executes DB/RAG tools, calls LLM, 
    and returns a structured payload.
    """
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    
    # 1. INTENT DETECTOR & TOOL EXECUTION
    
    # Intent A: Timetable Schedule
    if any(k in msg_lower for k in ["schedule", "today", "timetable", "class", "classes", "what's on"]):
        tool_calls.append({"name": "get_todays_schedule", "status": "running"})
        try:
            day = get_day_name()
            # If user queried a specific day, let's try to match it
            for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
                if d in msg_lower:
                    day = d.capitalize()
                    break
            
            classes = db.query(Timetable).filter(
                Timetable.faculty_id == faculty_id,
                Timetable.day_of_week == day
            ).all()
            
            schedule_list = []
            for c in classes:
                schedule_list.append({
                    "period": c.period,
                    "subject": c.subject,
                    "class_section": c.class_section,
                    "room": c.room
                })
            
            tool_calls[-1].update({"status": "success", "result": f"Found {len(schedule_list)} classes for {day}."})
            rich_data = {
                "type": "schedule",
                "day": day,
                "schedule": schedule_list
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})

    # Intent B: Syllabus Lookup
    elif any(k in msg_lower for k in ["syllabus", "unit", "topics", "daa", "compiler", "ml", "machine learning"]):
        tool_calls.append({"name": "get_syllabus", "status": "running"})
        try:
            # Determine subject
            subject = "Design & Analysis of Algorithms"
            if "compiler" in msg_lower or "cd" in msg_lower:
                subject = "Compiler Design"
            elif "ml" in msg_lower or "machine learning" in msg_lower:
                subject = "Machine Learning"
            
            # Determine unit if specified
            unit_num = None
            for i in range(1, 6):
                if f"unit {i}" in msg_lower or f"unit-{i}" in msg_lower or str(i) in msg_lower:
                    unit_num = i
                    break

            query_db = db.query(SyllabusUnit).filter(SyllabusUnit.subject.like(f"%{subject}%"))
            if unit_num:
                query_db = query_db.filter(SyllabusUnit.unit_number == unit_num)
            
            units = query_db.all()
            units_list = []
            for u in units:
                units_list.append({
                    "subject": u.subject,
                    "unit_number": u.unit_number,
                    "title": u.title,
                    "topics": u.topics,
                    "pdf_url": u.pdf_url
                })
            
            tool_calls[-1].update({"status": "success", "result": f"Found {len(units_list)} units for {subject}."})
            rich_data = {
                "type": "syllabus",
                "subject": subject,
                "units": units_list
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})

    # Intent C: Policy Document RAG search
    elif any(k in msg_lower for k in ["policy", "rule", "leave", "cl", "el", "sick", "duty", "attendance criteria", "condonation"]):
        tool_calls.append({"name": "search_policies", "status": "running"})
        try:
            rag_results = rag_pipeline.query(message, n_results=2)
            tool_calls[-1].update({"status": "success", "result": f"Retrieved {len(rag_results)} policy chunks."})
            
            citations = []
            for r in rag_results:
                citations.append({
                    "source": r["metadata"].get("source", "Policy Document"),
                    "title": r["metadata"].get("title", "Policy"),
                    "snippet": r["text"][:200] + "..."
                })
            
            rich_data = {
                "type": "policy",
                "citations": citations
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})

    # Intent D: Draft Email
    elif any(k in msg_lower for k in ["draft", "email", "letter", "request", "write to"]):
        tool_calls.append({"name": "draft_email", "status": "running"})
        # Parse potential names/subjects
        to_name = "HOD"
        if "dean" in msg_lower:
            to_name = "Dean"
        elif "principal" in msg_lower:
            to_name = "Principal"
            
        purpose = "leave request"
        if "casual" in msg_lower or "cl" in msg_lower:
            purpose = "Casual Leave request for tomorrow"
        elif "marks" in msg_lower or "attendance" in msg_lower:
            purpose = "student reminder"
            
        rich_data = {
            "type": "email_draft",
            "to_name": to_name,
            "purpose": purpose
        }
        tool_calls[-1].update({"status": "success", "result": "Configured email draft helper."})

    # Intent E: Lesson Plan
    elif any(k in msg_lower for k in ["lesson plan", "make a plan", "create a plan", "lesson-plan"]):
        tool_calls.append({"name": "create_lesson_plan", "status": "running"})
        subject = "Design & Analysis of Algorithms"
        if "ml" in msg_lower or "machine learning" in msg_lower:
            subject = "Machine Learning"
        
        rich_data = {
            "type": "lesson_plan",
            "subject": subject,
            "unit": 1,
            "topic": "Introduction to Asymptotic Analysis"
        }
        tool_calls[-1].update({"status": "success", "result": "Configured lesson plan generator."})

    # Interservice Delegation Stubs
    elif "delegate" in msg_lower or "workflow" in msg_lower or "analytics" in msg_lower:
        if "workflow" in msg_lower:
            tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Redirected query to Academic Workflow Agent."})
            rich_data = {"type": "delegation", "agent": "Academic Workflow"}
        else:
            tool_calls.append({"name": "delegate_to_analytics", "status": "success", "result": "Redirected query to Analytics & Accreditation Agent."})
            rich_data = {"type": "delegation", "agent": "Analytics & Accreditation"}

    # 2. GENERATE COMPREHENSIVE SYSTEM PROMPT & CALL LLM
    
    # We will build a system prompt describing the active faculty member and incorporating
    # tool results if they were run.
    system_prompt = (
        "You are EduPilot's Faculty Assistant, a warm, highly efficient, and professional personal AI assistant. "
        "Your task is to help the faculty member manage their schedule, drafts, syllabus, and queries. "
        "Present your response clearly. Use markdown headers, bullet points, and highlight key details. "
    )
    
    # Incorporate tool results in LLM prompt to ground the answer
    if tool_calls:
        system_prompt += "\nYou have run tools to help answer the user. Here are the tool outputs:\n"
        for t in tool_calls:
            if t["status"] == "success":
                system_prompt += f"Tool '{t['name']}': {t['result']}\n"
                if rich_data:
                    system_prompt += f"Data context: {json.dumps(rich_data)}\n"
            else:
                system_prompt += f"Tool '{t['name']}': Failed with error '{t.get('error')}'\n"

    # Call LLM or get mock response
    messages = [{"role": "user", "content": message}]
    
    # Generate the text response
    text_response = llm_client.get_chat_response(system_prompt, messages)

    # 3. COMBINE RICH RENDER DATA FOR THE DRAFT AND PLAN TYPES
    if rich_data and rich_data["type"] == "email_draft":
        # If it is a draft, let's extract the subject and body from the text response
        # or supply standard structured draft values.
        subject = "Application for Casual Leave"
        body = text_response
        if "Subject:" in text_response:
            try:
                parts = text_response.split("Subject:")
                after_subject = parts[1].split("\n", 1)
                subject = after_subject[0].strip()
                body = after_subject[1].strip()
            except Exception:
                pass
        
        # Strip code blocks from body if present
        body = body.replace("```body", "").replace("```subject", "").replace("```", "").strip()
        rich_data.update({
            "subject": subject,
            "body": body
        })

    elif rich_data and rich_data["type"] == "lesson_plan":
        # Parse objective, activities, assessment out of response or supply default
        rich_data.update({
            "objectives": "Understand basic asymptotic runtime analysis (Big-O, Omega, Theta).",
            "activities": [
                {"name": "Lecture Introduction", "duration": "15 mins", "description": "Review algorithm specifications & input sizes."},
                {"name": "Step-by-step Loop Analysis", "duration": "20 mins", "description": "Derive math complexity for single and nested loops."},
                {"name": "Student Practical Challenge", "duration": "15 mins", "description": "Given three loop segments, compute runtime on paper."}
            ],
            "assessment": "Homework: Compute big-O runtime for 3 recursive algorithms (binary search, merge sort, fibonacci)."
        })

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
