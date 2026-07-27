import json
from datetime import datetime
from sqlalchemy.orm import Session
from core.models import Timetable, SyllabusUnit, PolicyDocument
from core.llm import llm_client
from rag.rag_pipeline import rag_pipeline

def get_day_name():
    # Returns Monday, Tuesday, Wednesday, etc.
    return datetime.now().strftime("%A")

def handle_faculty_assistant_chat(message: str, faculty_id: int, db: Session, history: list = None):
    """
    Synchronous processing logic for the Faculty Assistant.
    Determines user intent, executes DB/RAG tools, calls LLM, 
    and returns a structured payload.
    """
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    
    # 1. INTENT DETECTOR & TOOL EXECUTION
    
    # Check if this is part of the interactive drafting flow
    is_draft_flow = False
    last_assistant_content = ""
    if history:
        for h in reversed(history):
            if h.get("role") == "assistant":
                last_assistant_content = h.get("content", "")
                break
                
    if "/draft-mail" in msg_lower or "draft a mail" in msg_lower or "draft mail" in msg_lower:
        is_draft_flow = True
    elif last_assistant_content and any(k in last_assistant_content for k in [
        "Please type how many days and the reason for your leave",
        "details of the instruction/announcement for students",
        "recipient is and what you would like to inquire about",
        "type the subject of the email",
        "Who is the recipient, and what is the main content/purpose"
    ]):
        is_draft_flow = True
        
    if is_draft_flow:
        # State Machine Logic
        if "/draft-mail-type leave" in msg_lower:
            text_response = "Great! Let's draft a **Leave Permission** email.\n\nHow many days of leave do you need, and what is the reason? Please select an option below or write your own details in the chat."
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "1 day, personal work", "value": "/draft-mail-leave-details 1 day, personal urgent work at home" },
                    { "label": "2 days, personal work", "value": "/draft-mail-leave-details 2 days, personal urgent work at home" },
                    { "label": "3 days, medical reasons", "value": "/draft-mail-leave-details 3 days, medical reason (fever)" },
                    { "label": "Write my own details...", "value": "/draft-mail-leave-custom", "action": "custom" }
                ]
            }
        elif "/draft-mail-leave-custom" in msg_lower:
            text_response = "Please type how many days and the reason for your leave: (e.g. '2 days for personal work')"
        elif "/draft-mail-leave-details" in msg_lower or "Please type how many days and the reason for your leave" in last_assistant_content:
            details = message.replace("/draft-mail-leave-details", "").strip()
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is a drafted leave request email for you:\n\n**Subject:** Application for Casual Leave - Preethi R\n\n**Body:**\nDear Head of Department,\n\nI am writing to formally request leave for {details}.\n\nI have arranged for my classes to be handled during this period and will be reachable via phone and email if anything urgent arises.\n\nThank you for your consideration.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept."
            rich_data = {
                "type": "email_draft",
                "to_name": "HOD",
                "purpose": "Leave Request",
                "subject": "Application for Casual Leave - Preethi R",
                "body": f"Dear Head of Department,\n\nI am writing to formally request leave for {details}.\n\nI have arranged for my classes to be handled during this period and will be reachable via phone and email if anything urgent arises.\n\nThank you for your consideration.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept."
            }
        elif "/draft-mail-type instruction" in msg_lower:
            text_response = "Great! Let's draft an **Instruction to Students** email.\n\nWhat is the instruction/announcement? Please select a recommendation below or write your own details."
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "Class cancelled tomorrow", "value": "/draft-mail-instruction-details Class is cancelled tomorrow due to faculty development program" },
                    { "label": "Assignment due next week", "value": "/draft-mail-instruction-details Homework assignment 4 is due next Tuesday at 5 PM" },
                    { "label": "Exam schedule reminder", "value": "/draft-mail-instruction-details The mid-term exam will be held on Monday at LH-201 at 10 AM" },
                    { "label": "Write my own details...", "value": "/draft-mail-instruction-custom", "action": "custom" }
                ]
            }
        elif "/draft-mail-instruction-custom" in msg_lower:
            text_response = "Please type the details of the instruction/announcement for students:"
        elif "/draft-mail-instruction-details" in msg_lower or "details of the instruction/announcement for students" in last_assistant_content:
            details = message.replace("/draft-mail-instruction-details", "").strip()
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is a drafted reminder email for your students:\n\n**Subject:** Important Class Update for Students\n\n**Body:**\nDear Students,\n\nPlease note the following update regarding our course:\n\n{details}.\n\nPlease plan accordingly and reach out if you have any questions.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept."
            rich_data = {
                "type": "email_draft",
                "to_name": "Students",
                "purpose": "Class Update",
                "subject": "Important Class Update for Students",
                "body": f"Dear Students,\n\nPlease note the following update regarding our course:\n\n{details}.\n\nPlease plan accordingly and reach out if you have any questions.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept."
            }
        elif "/draft-mail-type inquiry" in msg_lower:
            text_response = "Great! Let's draft a **General Inquiry** email.\n\nWho is the recipient, and what is the inquiry? Please select an option below or write your own details."
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "To HOD: Room allocation", "value": "/draft-mail-inquiry-details To HOD, inquiry about seminar hall availability this Friday" },
                    { "label": "To Admin: Salary status", "value": "/draft-mail-inquiry-details To Admin, inquiry about salary disbursement status" },
                    { "label": "Write my own details...", "value": "/draft-mail-inquiry-custom", "action": "custom" }
                ]
            }
        elif "/draft-mail-inquiry-custom" in msg_lower:
            text_response = "Please type who the recipient is and what you would like to inquire about: (e.g. 'To HOD, asking for syllabus copy')"
        elif "/draft-mail-inquiry-details" in msg_lower or "recipient is and what you would like to inquire about" in last_assistant_content:
            details = message.replace("/draft-mail-inquiry-details", "").strip()
            to_name = details.split(',')[0].replace('To ', '').strip() if details.startswith('To') else 'Recipient'
            inquiry_text = details.split(',')[1].strip() if ',' in details else details
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is a drafted inquiry email for you:\n\n**Subject:** Inquiry: {inquiry_text}\n\n**Body:**\nDear {to_name},\n\nI hope this email finds you well.\n\nI am writing to inquire about the following:\n{inquiry_text}.\n\nKindly let me know the status at your earliest convenience.\n\nThank you,\nPreethi R\nProfessor & Head, CSE Dept."
            rich_data = {
                "type": "email_draft",
                "to_name": to_name,
                "purpose": "General Inquiry",
                "subject": f"Inquiry: {inquiry_text}",
                "body": f"Dear {to_name},\n\nI hope this email finds you well.\n\nI am writing to inquire about the following:\n{inquiry_text}.\n\nKindly let me know the status at your earliest convenience.\n\nThank you,\nPreethi R\nProfessor & Head, CSE Dept."
            }
        elif "/draft-mail-type custom" in msg_lower:
            text_response = "Please type the subject of the email you would like to draft:"
        elif "type the subject of the email" in last_assistant_content:
            text_response = f'Got it. Subject will be: "{message}".\n\nWho is the recipient, and what is the main content/purpose of this email? (e.g. \'To Dean, discussing the new syllabus changes\')'
        elif "Who is the recipient, and what is the main content/purpose" in last_assistant_content:
            def find_custom_subject():
                if not history:
                    return "General Draft"
                reversed_history = list(reversed(history))
                for idx, h in enumerate(reversed_history):
                    if h.get("role") == "assistant" and "type the subject of the email" in h.get("content", ""):
                        user_msg = reversed_history[idx - 1] if idx - 1 >= 0 else {}
                        if user_msg.get("role") == "user":
                            return user_msg.get("content", "General Draft")
                return "General Draft"
            subject = find_custom_subject()
            to_name = message.split(',')[0].replace('To ', '').strip() if message.startswith('To') else 'Recipient'
            body_text = message.split(',')[1].strip() if ',' in message else message
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is your custom drafted email:\n\n**Subject:** {subject}\n\n**Body:**\nDear {to_name},\n\nI hope this email finds you well.\n\nRegarding: {subject}\n\n{body_text}.\n\nThank you.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept."
            rich_data = {
                "type": "email_draft",
                "to_name": to_name,
                "purpose": "Custom Draft",
                "subject": subject,
                "body": f"Dear {to_name},\n\nI hope this email finds you well.\n\nRegarding: {subject}\n\n{body_text}.\n\nThank you.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept."
            }
        elif "/draft-mail" in msg_lower or msg_lower == "draft a mail" or msg_lower == "draft mail":
            text_response = "I can help you draft a professional email. Please select one of the common subjects below or write your own subject:\n\n1. 📝 **Leave Permission**\n2. 🎓 **Instruction to Students**\n3. 📋 **General Inquiry**\n4. ✍️ **Write my own subject...**"
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "Leave Permission", "value": "/draft-mail-type leave", "icon": "📝" },
                    { "label": "Instruction to Students", "value": "/draft-mail-type instruction", "icon": "🎓" },
                    { "label": "General Inquiry", "value": "/draft-mail-type inquiry", "icon": "📋" },
                    { "label": "Write my own subject...", "value": "/draft-mail-type custom", "icon": "✍️" }
                ]
            }
        else:
            text_response = "Sorry, I couldn't follow that step in the email drafting. Please type `/draft-mail` to start over."
            
        return {
            "text": text_response,
            "tool_calls": tool_calls,
            "rich_data": rich_data
        }
    
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
        to_name = "Recipient"
        if "dean" in msg_lower:
            to_name = "Dean"
        elif "principal" in msg_lower:
            to_name = "Principal"
        elif "hod" in msg_lower:
            to_name = "HOD"
        elif "student" in msg_lower:
            to_name = "Student"
            
        purpose = "general reminder"
        if "marks" in msg_lower or "attendance" in msg_lower:
            purpose = "student reminder"
            to_name = "Student"
            
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

    # Interservice Delegation & Collaboration
    elif "mentee" in msg_lower and ("attendance" in msg_lower or "overdue" in msg_lower or "dropping" in msg_lower):
        tool_calls.append({"name": "delegate_to_mentor_wellbeing", "status": "success", "result": "Fetched overdue list: A. Kumar (last check-in 4 weeks ago), C. Dinesh (last check-in 2 weeks ago)"})
        tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Checked attendance trends: A. Kumar (40% - dipping), C. Dinesh (80% - stable)"})
        tool_calls.append({"name": "suggest_checkin_prompt", "status": "success", "result": "Generated conversation starter for A. Kumar"})
        
        rich_data = {
            "type": "collaboration_result",
            "flagged_mentees": [
                {
                    "name": "A. Kumar",
                    "roll_no": "24CC001",
                    "reason": "Overdue for check-in (4 weeks ago) and attendance has dropped to 40% (dipping trend).",
                    "prompt": "Hi Kumar, I noticed you missed a couple of DAA classes recently. I wanted to reach out and check if everything is okay with you. Let me know when you'd like to catch up."
                }
            ]
        }
    elif "workflow" in msg_lower or "attendance" in msg_lower or "assignment" in msg_lower:
        tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Redirected query to Academic Workflow Agent."})
        rich_data = {"type": "delegation", "agent": "Academic Workflow", "agent_id": "agent2"}
    elif "analytics" in msg_lower or "nba" in msg_lower or "accreditation" in msg_lower:
        tool_calls.append({"name": "delegate_to_analytics", "status": "success", "result": "Redirected query to Analytics & Accreditation Agent."})
        rich_data = {"type": "delegation", "agent": "Analytics & Accreditation", "agent_id": "agent3"}
    elif "research" in msg_lower or "grant" in msg_lower or "publication" in msg_lower:
        tool_calls.append({"name": "delegate_to_research_grants", "status": "success", "result": "Redirected query to Research & Grants Agent."})
        rich_data = {"type": "delegation", "agent": "Research & Grants", "agent_id": "agent4"}
    elif "exam" in msg_lower or "paper" in msg_lower or "assessment" in msg_lower:
        tool_calls.append({"name": "delegate_to_exam_assessment", "status": "success", "result": "Redirected query to Exam & Assessment Design Agent."})
        rich_data = {"type": "delegation", "agent": "Exam & Assessment Design", "agent_id": "agent5"}
    elif "mentor" in msg_lower or "wellbeing" in msg_lower:
        tool_calls.append({"name": "delegate_to_mentor_wellbeing", "status": "success", "result": "Redirected query to Mentor & Wellbeing Agent."})
        rich_data = {"type": "delegation", "agent": "Mentor & Wellbeing", "agent_id": "agent6"}

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
        subject = "Draft Notification"
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
