import os

# 2. Alumni Relations
alumni_code = """from sqlalchemy.orm import Session
from core.models import Alumni, DonationLedger
from core.llm import llm_client

def handle_alumni_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello there! 👋 I am your dedicated AI Assistant for Alumni Relations. How can I help you today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    # Interservice Delegation & Collaboration
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
        alumni = db.query(Alumni).all()
        donations = db.query(DonationLedger).all()
        total_funds = sum([float(d.amount) for d in donations if d.amount]) if donations else 0
        
        tool_calls.append({"name": "fetch_alumni_stats", "status": "success", "result": f"{len(alumni)} alumni, ${total_funds}"})
        
        text_response = f"### 🎓 Alumni Network Overview\\n\\n"
        text_response += f"Our global alumni network is growing stronger:\\n"
        text_response += f"- **Registered Alumni:** {len(alumni)}\\n"
        text_response += f"- **Total Donations Received:** ${total_funds:,.2f}\\n"
        text_response += f"- **Donation Contributions:** {len(donations)}\\n\\n"

    elif "directory" in msg_lower or "alumni" in msg_lower or "student" in msg_lower or "who" in msg_lower:
        alumni = db.query(Alumni).all()
        matched = next((a for a in alumni if a.name.lower() in msg_lower or a.company.lower() in msg_lower), None)
                
        if matched:
            tool_calls.append({"name": "search_alumni", "status": "success", "result": f"Found {matched.name}"})
            text_response = f"### 👤 Profile: {matched.name}\\n\\n"
            text_response += f"- **Graduation Year:** {matched.graduation_year}\\n"
            text_response += f"- **Current Role:** {matched.role} at **{matched.company}**\\n"
            text_response += f"- **Email:** {matched.email}\\n"
        else:
            tool_calls.append({"name": "fetch_directory", "status": "success", "result": f"Found {len(alumni)} alumni"})
            if alumni:
                names = "\\n".join([f"- **{a.name}** - {a.role} at {a.company} ({a.graduation_year})" for a in alumni])
                text_response = f"Here are the notable alumni in our directory:\\n\\n{names}"
            else:
                text_response = "There are currently no alumni records in the database."
            
    elif "donation" in msg_lower or "fund" in msg_lower or "money" in msg_lower or "ledg" in msg_lower:
        donations = db.query(DonationLedger).all()
        if donations:
            tool_calls.append({"name": "fetch_donations", "status": "success", "result": f"Found {len(donations)} donations"})
            records = "\\n".join([f"- **${d.amount}** for *{d.purpose}* on {d.date}" for d in donations])
            text_response = f"### 💰 Donation Ledger\\n\\nRecent contributions to the institution:\\n\\n{records}"
        else:
            tool_calls.append({"name": "fetch_donations", "status": "success", "result": "Empty ledger"})
            text_response = "There are no donation records yet."
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI buttons"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "I noticed you want to modify the data. You can easily manage all records directly through the UI!\\n\\n"
            "- Use the **+ Add** button at the top right to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )

    else:
        # Deep Search Fallback
        alumni = db.query(Alumni).all()
        donations = db.query(DonationLedger).all()
        
        found_alumni = [a for a in alumni if any(word in f"{a.name} {a.company} {a.role}".lower() for word in msg_lower.split() if len(word) > 3)]
        
        if found_alumni:
            tool_calls.append({"name": "deep_search", "status": "success", "result": "Found matches across database"})
            text_response = "I found some records that might match your query:\\n\\n"
            for a in found_alumni:
                text_response += f"- **Alumni:** {a.name} - {a.role} at {a.company}\\n"
        else:
            text_response = (
                "👋 **Hello! I am your Alumni Relations Assistant.**\\n\\n"
                "I can help you look up alumni profiles, track career progression, and manage the donation ledger. "
                "Try asking me:\\n"
                "- *\\"Give me a summary of our alumni funds\\"*\\n"
                "- *\\"Who is in the directory?\\"*\\n"
                "- *\\"Show me all donations\\"*\\n"
            )

    # LLM Enhancement Layer
    system_prompt = (
        "You are EduPilot's Alumni Relations Assistant. "
        "Use markdown formatting. Based on the tool results below, provide a helpful and accurate response to the user."
    )
    if tool_calls:
        system_prompt += "\\n\\nTool Results:\\n" + "\\n".join([f"- {t['name']}: {t['result']}" for t in tool_calls])
        
    llm_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])
    
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/alumni_relations/agent.py', 'w', encoding='utf-8') as f:
    f.write(alumni_code)


# 3. Event Management
event_code = """from sqlalchemy.orm import Session
from core.models import Event, CommitteeTask
from core.llm import llm_client

def handle_event_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello! 👋 I am your Event Management & Committees Assistant. How can I assist with your planning today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    # Interservice Delegation
    if any(k in msg_lower for k in ["schedule", "timetable", "class", "syllabus", "unit", "policy", "leave", "draft", "email", "lesson plan"]):
        tool_calls.append({"name": "delegate_to_faculty_assistant", "status": "success", "result": "Redirected query to Faculty Assistant."})
        rich_data = {"type": "delegation", "agent": "Faculty Assistant", "agent_id": "agent1"}
        return {"text": "I have delegated this request to the Faculty Assistant.", "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["attendance", "assignment", "workflow", "grade"]):
        tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Redirected query."})
        rich_data = {"type": "delegation", "agent": "Academic Workflow", "agent_id": "agent2"}
        return {"text": "I have delegated this request to the Academic Workflow Agent.", "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["analytics", "nba", "accreditation", "at-risk"]):
        tool_calls.append({"name": "delegate_to_analytics", "status": "success", "result": "Redirected query."})
        rich_data = {"type": "delegation", "agent": "Analytics & Accreditation", "agent_id": "agent3"}
        return {"text": "I have delegated this request to the Analytics Agent.", "tool_calls": tool_calls, "rich_data": rich_data}

    # Core Features
    if any(word in msg_lower for word in ["stat", "summary", "report", "overview"]):
        events = db.query(Event).all()
        tasks = db.query(CommitteeTask).all()
        
        tool_calls.append({"name": "fetch_event_stats", "status": "success", "result": f"{len(events)} events, {len(tasks)} tasks"})
        
        text_response = f"### 🎉 Events & Committees Overview\\n\\n"
        text_response += f"- **Total Events Planned:** {len(events)}\\n"
        text_response += f"- **Total Committee Tasks:** {len(tasks)}\\n\\n"
        
        if events:
            upcoming = events[:3]
            text_response += f"**Upcoming Events:**\\n"
            for e in upcoming:
                text_response += f"- {e.name} on {e.date} at {e.venue}\\n"
                
    elif "event" in msg_lower or "workshop" in msg_lower or "fdp" in msg_lower:
        events = db.query(Event).all()
        matched = next((e for e in events if e.name.lower() in msg_lower), None)
                
        if matched:
            tool_calls.append({"name": "search_event", "status": "success", "result": f"Found {matched.name}"})
            text_response = f"### 📅 {matched.name} Details\\n\\n"
            text_response += f"- **Type:** {matched.type}\\n"
            text_response += f"- **Date:** {matched.date}\\n"
            text_response += f"- **Venue:** {matched.venue}\\n"
            text_response += f"- **Budget:** ${matched.budget_allocated}\\n"
        else:
            tool_calls.append({"name": "fetch_events", "status": "success", "result": f"Found {len(events)} events"})
            if events:
                names = "\\n".join([f"- **{e.name}** ({e.date})" for e in events])
                text_response = f"Here are the scheduled events:\\n\\n{names}"
            else:
                text_response = "There are no events currently scheduled."
            
    elif "task" in msg_lower or "committee" in msg_lower or "duty" in msg_lower:
        tasks = db.query(CommitteeTask).all()
        
        if tasks:
            tool_calls.append({"name": "fetch_tasks", "status": "success", "result": f"Found {len(tasks)} tasks"})
            pending = [t for t in tasks if t.status.lower() != "completed"]
            records = "\\n".join([f"- **{t.event_name}**: {t.task_description} (Assigned to: {t.assigned_to})" for t in pending])
            text_response = f"### 📋 Committee Tasks (Pending)\\n\\n{records if pending else 'All tasks are completed!'}"
        else:
            tool_calls.append({"name": "fetch_tasks", "status": "success", "result": "No tasks"})
            text_response = "There are no active committee tasks."
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "- Use the **+ Add** button at the top right to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )

    else:
        # Deep Search Fallback
        events = db.query(Event).all()
        tasks = db.query(CommitteeTask).all()
        
        found_events = [e for e in events if any(word in f"{e.name} {e.venue}".lower() for word in msg_lower.split() if len(word) > 3)]
        
        if found_events:
            tool_calls.append({"name": "deep_search", "status": "success", "result": "Found matches"})
            text_response = "I found some records that might match your query:\\n\\n"
            for e in found_events:
                text_response += f"- **Event:** {e.name} at {e.venue}\\n"
        else:
            text_response = (
                "👋 **Hello! I am your Event Management Assistant.**\\n\\n"
                "I can help you coordinate FDPs, workshops, and track committee duties. "
                "Try asking me:\\n"
                "- *\\"Show me an overview of all events\\"*\\n"
                "- *\\"What committee tasks are pending?\\"*\\n"
                "- *\\"Details for the AI Workshop\\"*\\n"
            )

    # LLM Enhancement Layer
    system_prompt = (
        "You are EduPilot's Event Management Assistant. "
        "Use markdown formatting. Based on the tool results below, provide a helpful and accurate response to the user."
    )
    if tool_calls:
        system_prompt += "\\n\\nTool Results:\\n" + "\\n".join([f"- {t['name']}: {t['result']}" for t in tool_calls])
        
    llm_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/event_management/agent.py', 'w', encoding='utf-8') as f:
    f.write(event_code)


# 4. Inventory Resources
inventory_code = """from sqlalchemy.orm import Session
from core.models import LabAsset, SoftwareLicense, BookRequisition
from core.llm import llm_client

def handle_inventory_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello! 👋 I am your Inventory & Resources Assistant. How can I help you manage department assets today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    # Interservice Delegation
    if any(k in msg_lower for k in ["schedule", "timetable", "class", "syllabus", "unit", "policy", "leave", "draft", "email", "lesson plan"]):
        tool_calls.append({"name": "delegate_to_faculty_assistant", "status": "success", "result": "Redirected query to Faculty Assistant."})
        rich_data = {"type": "delegation", "agent": "Faculty Assistant", "agent_id": "agent1"}
        return {"text": "I have delegated this request to the Faculty Assistant.", "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["attendance", "assignment", "workflow", "grade"]):
        tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Redirected query."})
        rich_data = {"type": "delegation", "agent": "Academic Workflow", "agent_id": "agent2"}
        return {"text": "I have delegated this request to the Academic Workflow Agent.", "tool_calls": tool_calls, "rich_data": rich_data}

    # Core Features
    if any(word in msg_lower for word in ["stat", "summary", "report", "overview"]):
        assets = db.query(LabAsset).all()
        licenses = db.query(SoftwareLicense).all()
        books = db.query(BookRequisition).all()
        
        tool_calls.append({"name": "fetch_inventory_stats", "status": "success", "result": f"{len(assets)} assets, {len(licenses)} licenses"})
        
        text_response = f"### 📦 Inventory & Resources Overview\\n\\n"
        text_response += f"- **Lab Assets:** {len(assets)}\\n"
        text_response += f"- **Software Licenses:** {len(licenses)}\\n"
        text_response += f"- **Book Requisitions:** {len(books)}\\n\\n"

    elif "asset" in msg_lower or "equipment" in msg_lower or "lab" in msg_lower:
        assets = db.query(LabAsset).all()
        matched = next((a for a in assets if a.name.lower() in msg_lower), None)
                
        if matched:
            tool_calls.append({"name": "search_asset", "status": "success", "result": f"Found {matched.name}"})
            text_response = f"### 🖥️ {matched.name} Details\\n\\n"
            text_response += f"- **Type:** {matched.asset_type}\\n"
            text_response += f"- **Location:** {matched.location}\\n"
            text_response += f"- **Status:** `{matched.status}`\\n"
        else:
            tool_calls.append({"name": "fetch_assets", "status": "success", "result": f"Found {len(assets)} assets"})
            if assets:
                names = "\\n".join([f"- **{a.name}** ({a.location}) - Status: {a.status}" for a in assets])
                text_response = f"Here is the lab equipment list:\\n\\n{names}"
            else:
                text_response = "There are no lab assets recorded."
            
    elif "software" in msg_lower or "license" in msg_lower or "key" in msg_lower:
        licenses = db.query(SoftwareLicense).all()
        
        if licenses:
            tool_calls.append({"name": "fetch_licenses", "status": "success", "result": f"Found {len(licenses)} licenses"})
            records = "\\n".join([f"- **{l.name}** ({l.vendor}): {l.seats_used}/{l.seats_total} seats used" for l in licenses])
            text_response = f"### 🔑 Software Licenses\\n\\n{records}"
        else:
            tool_calls.append({"name": "fetch_licenses", "status": "success", "result": "No licenses"})
            text_response = "There are no software licenses recorded."
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "- Use the **+ Add** button at the top right to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )

    else:
        # Deep Search Fallback
        assets = db.query(LabAsset).all()
        licenses = db.query(SoftwareLicense).all()
        
        found_assets = [a for a in assets if any(word in f"{a.name} {a.asset_type}".lower() for word in msg_lower.split() if len(word) > 3)]
        
        if found_assets:
            tool_calls.append({"name": "deep_search", "status": "success", "result": "Found matches"})
            text_response = "I found some records that might match your query:\\n\\n"
            for a in found_assets:
                text_response += f"- **Asset:** {a.name} in {a.location}\\n"
        else:
            text_response = (
                "👋 **Hello! I am your Inventory & Resources Assistant.**\\n\\n"
                "I can help you track lab equipment, software licenses, and book requisitions. "
                "Try asking me:\\n"
                "- *\\"Show me an overview of all assets\\"*\\n"
                "- *\\"What software licenses do we have?\\"*\\n"
                "- *\\"Find the details for the Oscilloscope\\"*\\n"
            )

    # LLM Enhancement Layer
    system_prompt = (
        "You are EduPilot's Inventory & Resources Assistant. "
        "Use markdown formatting. Based on the tool results below, provide a helpful and accurate response to the user."
    )
    if tool_calls:
        system_prompt += "\\n\\nTool Results:\\n" + "\\n".join([f"- {t['name']}: {t['result']}" for t in tool_calls])
        
    llm_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/inventory_resources/agent.py', 'w', encoding='utf-8') as f:
    f.write(inventory_code)

print("Updated alumni, event, inventory")
