import os
import re

# 1. Placement Internships
placement_code = """from sqlalchemy.orm import Session
from core.models import PlacementDrive, Internship
from core.llm import llm_client
import json

def handle_placement_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello there! 👋 I am your dedicated AI Assistant for Placement & Internships. How can I help you today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    # Interservice Delegation & Collaboration (Top Priority to avoid false positives)
    if any(k in msg_lower for k in ["schedule", "timetable", "class", "syllabus", "unit", "policy", "leave", "draft", "email", "lesson plan"]):
        tool_calls.append({"name": "delegate_to_faculty_assistant", "status": "success", "result": "Redirected query to Faculty Assistant."})
        rich_data = {"type": "delegation", "agent": "Faculty Assistant", "agent_id": "agent1"}
        text_response = "I have delegated this request to the Faculty Assistant."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["attendance", "assignment", "workflow", "grade"]):
        tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Redirected query to Academic Workflow Agent."})
        rich_data = {"type": "delegation", "agent": "Academic Workflow", "agent_id": "agent2"}
        text_response = "I have delegated this request to the Academic Workflow Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["analytics", "nba", "accreditation", "at-risk"]):
        tool_calls.append({"name": "delegate_to_analytics", "status": "success", "result": "Redirected query to Analytics & Accreditation Agent."})
        rich_data = {"type": "delegation", "agent": "Analytics & Accreditation", "agent_id": "agent3"}
        text_response = "I have delegated this request to the Analytics Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["research", "grant", "publication", "paper"]):
        tool_calls.append({"name": "delegate_to_research", "status": "success", "result": "Redirected query to Research & Grants Agent."})
        rich_data = {"type": "delegation", "agent": "Research & Grants", "agent_id": "agent4"}
        text_response = "I have delegated this request to the Research & Grants Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["exam", "assessment", "question", "rubric"]):
        tool_calls.append({"name": "delegate_to_exam", "status": "success", "result": "Redirected query to Exam & Assessment Agent."})
        rich_data = {"type": "delegation", "agent": "Exam & Assessment Design", "agent_id": "agent5"}
        text_response = "I have delegated this request to the Exam Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["mentor", "wellbeing", "checkin", "escalation", "student issue"]):
        tool_calls.append({"name": "delegate_to_mentor", "status": "success", "result": "Redirected query to Mentor & Wellbeing Agent."})
        rich_data = {"type": "delegation", "agent": "Mentor & Wellbeing", "agent_id": "agent6"}
        text_response = "I have delegated this request to the Mentor Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}

    # Core Features
    if any(word in msg_lower for word in ["stat", "summary", "report", "overview"]):
        drives = db.query(PlacementDrive).all()
        interns = db.query(Internship).all()
        tool_calls.append({"name": "fetch_placement_stats", "status": "success", "result": f"{len(drives)} drives, {len(interns)} interns"})
        
        text_response = f"### 📊 Placement & Internship Overview\\n\\n"
        text_response += f"Here is the current status of your placement pipeline:\\n"
        text_response += f"- **Total Scheduled Drives:** {len(drives)}\\n"
        text_response += f"- **Active Internships:** {len(interns)}\\n\\n"
        
        if drives:
            upcoming = [d for d in drives if d.status.lower() in ["scheduled", "upcoming", "planned"]]
            text_response += f"**Upcoming Drives ({len(upcoming)}):**\\n"
            for d in upcoming[:3]:
                text_response += f"- {d.company_name} (Roles: {d.role})\\n"
        
    elif "company" in msg_lower or "visit" in msg_lower or "drive" in msg_lower or "placement" in msg_lower:
        drives = db.query(PlacementDrive).all()
        matched_drive = next((d for d in drives if d.company_name.lower() in msg_lower), None)
                
        if matched_drive:
            tool_calls.append({"name": "search_drive", "status": "success", "result": f"Found {matched_drive.company_name}"})
            text_response = f"### 🏢 {matched_drive.company_name} Drive Details\\n\\n"
            text_response += f"- **Date:** {matched_drive.date}\\n"
            text_response += f"- **Roles:** {matched_drive.role}\\n"
            text_response += f"- **Eligible:** {matched_drive.eligibility}\\n"
            text_response += f"- **Status:** `{matched_drive.status}`\\n"
        else:
            tool_calls.append({"name": "fetch_all_drives", "status": "success", "result": f"Found {len(drives)} drives"})
            if drives:
                companies = "\\n".join([f"- **{d.company_name}**: {d.role} ({d.date})" for d in drives])
                text_response = f"Here are the companies currently in our database:\\n\\n{companies}"
            else:
                text_response = "There are no placement drives scheduled at the moment."
            
    elif "internship" in msg_lower or "intern" in msg_lower or "student" in msg_lower:
        interns = db.query(Internship).all()
        matched_intern = next((i for i in interns if i.student_name.lower() in msg_lower or i.company.lower() in msg_lower), None)
        
        if matched_intern:
            tool_calls.append({"name": "search_intern", "status": "success", "result": f"Found {matched_intern.student_name}"})
            text_response = f"### 🎓 Internship Details: {matched_intern.student_name}\\n\\n"
            text_response += f"- **Company:** {matched_intern.company}\\n"
            text_response += f"- **Duration (Months):** {matched_intern.duration_months}\\n"
            text_response += f"- **Stipend:** {matched_intern.stipend}\\n"
            text_response += f"- **Status:** {matched_intern.status}\\n"
        else:
            tool_calls.append({"name": "fetch_all_interns", "status": "success", "result": f"Found {len(interns)} interns"})
            if interns:
                students = "\\n".join([f"- **{i.student_name}** at {i.company}" for i in interns])
                text_response = f"Here is the list of active internships:\\n\\n{students}"
            else:
                text_response = "No students are currently logged as active interns."
                
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI buttons"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "I noticed you want to modify the data. You can manage records directly through the UI!\\n\\n"
            "- Use the **+ Add** button at the top right to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )

    else:
        # Deep Search Fallback
        drives = db.query(PlacementDrive).all()
        interns = db.query(Internship).all()
        
        # Search all string fields
        found_drives = [d for d in drives if any(word in f"{d.company_name} {d.role}".lower() for word in msg_lower.split() if len(word) > 3)]
        found_interns = [i for i in interns if any(word in f"{i.student_name} {i.company}".lower() for word in msg_lower.split() if len(word) > 3)]
        
        if found_drives or found_interns:
            tool_calls.append({"name": "deep_search", "status": "success", "result": "Found matches across database"})
            text_response = "I found some records that might match your query:\\n\\n"
            for d in found_drives:
                text_response += f"- **Drive:** {d.company_name} ({d.role})\\n"
            for i in found_interns:
                text_response += f"- **Intern:** {i.student_name} at {i.company}\\n"
        else:
            text_response = (
                "👋 **Hello! I am your Placement & Internships Assistant.**\\n\\n"
                "I'm here to help you track campus drives, student internships, and recruiter pipelines. "
                "Try asking me things like:\\n"
                "- *\\"Show me a summary of all placements\\"*\\n"
                "- *\\"What companies are visiting?\\"*\\n"
                "- *\\"Give me details about student internships\\"*\\n"
            )

    # LLM Enhancement Layer
    system_prompt = (
        "You are EduPilot's Placement & Internships Assistant. "
        "Use markdown formatting. Based on the tool results below, provide a helpful and accurate response to the user."
    )
    if tool_calls:
        system_prompt += "\\n\\nTool Results:\\n" + "\\n".join([f"- {t['name']}: {t['result']}" for t in tool_calls])
        
    llm_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])
    
    # If it's the generic fallback from llm.py, stick to our crafted text_response
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/placement_internships/agent.py', 'w', encoding='utf-8') as f:
    f.write(placement_code)

print("Updated placement")
