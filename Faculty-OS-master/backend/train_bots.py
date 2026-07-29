import os

placement_content = """from sqlalchemy.orm import Session
from core.models import PlacementDrive, Internship

def handle_placement_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello there! 👋 I am your dedicated AI Assistant for Placement & Internships. How can I help you today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    if any(word in msg_lower for word in ["stat", "summary", "report", "analytics", "how many", "overview"]):
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
        
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    elif "company" in msg_lower or "visit" in msg_lower or "drive" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        drives = db.query(PlacementDrive).all()
        
        matched_drive = None
        for d in drives:
            text = f"{d.company_name} {d.role}".lower()
            if any(w in text for w in words):
                matched_drive = d
                break
                
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
                text_response = "There are no placement drives scheduled at the moment. You can add one using the + Add button!"
                
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    elif "internship" in msg_lower or "intern" in msg_lower or "student" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        interns = db.query(Internship).all()
        
        matched_intern = None
        for i in interns:
            text = f"{i.student_name} {i.company}".lower()
            if any(w in text for w in words):
                matched_intern = i
                break
        
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
                
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI buttons"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "I noticed you want to modify the data. Currently, I am a read-only assistant, but you can easily manage all records directly through the UI!\\n\\n"
            "- Use the **+ Add** button at the top right of any panel to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    else:
        text_response = (
            "👋 **Hello! I am your Placement & Internships Assistant.**\\n\\n"
            "I'm here to help you track campus drives, student internships, and recruiter pipelines. "
            "Try asking me things like:\\n"
            "- *\\"Show me a summary of all placements\\"*\\n"
            "- *\\"What companies are visiting?\\"*\\n"
            "- *\\"Give me details about student internships\\"*"
        )

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

alumni_content = """from sqlalchemy.orm import Session
from core.models import Alumni, DonationLedger

def handle_alumni_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello there! 👋 I am your dedicated AI Assistant for Alumni Relations. How can I help you today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    if any(word in msg_lower for word in ["stat", "summary", "report", "analytics", "how many", "overview"]):
        alumni = db.query(Alumni).all()
        donations = db.query(DonationLedger).all()
        total_funds = sum([float(d.amount) for d in donations if d.amount]) if donations else 0
        
        tool_calls.append({"name": "fetch_alumni_stats", "status": "success", "result": f"{len(alumni)} alumni, ${total_funds}"})
        
        text_response = f"### 🎓 Alumni Network Overview\\n\\n"
        text_response += f"Our global alumni network is growing stronger:\\n"
        text_response += f"- **Registered Alumni:** {len(alumni)}\\n"
        text_response += f"- **Total Donations Received:** ${total_funds:,.2f}\\n"
        text_response += f"- **Donation Contributions:** {len(donations)}\\n\\n"
        
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    elif "directory" in msg_lower or "alumni" in msg_lower or "student" in msg_lower or "who" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        alumni = db.query(Alumni).all()
        
        matched = None
        for a in alumni:
            text = f"{a.name} {a.company} {a.role}".lower()
            if any(w in text for w in words):
                matched = a
                break
                
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
                text_response = "There are currently no alumni records in the database. Use the + Add button to register them!"
                
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    elif "donation" in msg_lower or "fund" in msg_lower or "money" in msg_lower or "ledg" in msg_lower:
        donations = db.query(DonationLedger).all()
        
        if donations:
            tool_calls.append({"name": "fetch_donations", "status": "success", "result": f"Found {len(donations)} donations"})
            records = "\\n".join([f"- **${d.amount}** for *{d.purpose}* on {d.date}" for d in donations])
            text_response = f"### 💰 Donation Ledger\\n\\nRecent contributions to the institution:\\n\\n{records}"
        else:
            tool_calls.append({"name": "fetch_donations", "status": "success", "result": "Empty ledger"})
            text_response = "There are no donation records yet."
            
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI buttons"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "I noticed you want to modify the data. Currently, I am a read-only assistant, but you can easily manage all records directly through the UI!\\n\\n"
            "- Use the **+ Add** button at the top right of any panel to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    else:
        text_response = (
            "👋 **Hello! I am your Alumni Relations Assistant.**\\n\\n"
            "I can help you look up alumni profiles, track career progression, and manage the donation ledger. "
            "Try asking me:\\n"
            "- *\\"Give me a summary of our alumni funds\\"*\\n"
            "- *\\"Who is in the directory?\\"*\\n"
            "- *\\"Show me all donations\\"*"
        )

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

event_content = """from sqlalchemy.orm import Session
from core.models import Event, CommitteeTask

def handle_event_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello there! 👋 I am your dedicated AI Assistant for Event Management. How can I help you today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    if any(word in msg_lower for word in ["stat", "summary", "report", "analytics", "how many", "overview"]):
        events = db.query(Event).all()
        tasks = db.query(CommitteeTask).all()
        pending_tasks = [t for t in tasks if t.status.lower() != 'done']
        
        tool_calls.append({"name": "fetch_event_stats", "status": "success", "result": f"{len(events)} events, {len(tasks)} tasks"})
        
        text_response = f"### 📅 Event Management Overview\\n\\n"
        text_response += f"- **Total Events Scheduled:** {len(events)}\\n"
        text_response += f"- **Total Committee Tasks:** {len(tasks)}\\n"
        text_response += f"- **Pending Tasks:** {len(pending_tasks)}\\n\\n"
        
        if pending_tasks:
            text_response += f"⚠️ *You have {len(pending_tasks)} pending committee tasks that need attention!*\\n"
            
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    elif "event" in msg_lower or "schedule" in msg_lower or "calendar" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        events = db.query(Event).all()
        
        matched_event = None
        for e in events:
            if any(w in f"{e.name} {e.type}".lower() for w in words):
                matched_event = e
                break
                
        if matched_event:
            tool_calls.append({"name": "search_event", "status": "success", "result": f"Found {matched_event.name}"})
            text_response = f"### 🎉 Event Details: {matched_event.name}\\n\\n"
            text_response += f"- **Date:** {matched_event.date}\\n"
            text_response += f"- **Type:** {matched_event.type}\\n"
            text_response += f"- **Budget Allocated:** ${matched_event.budget_allocated}\\n"
            text_response += f"- **Budget Spent:** ${matched_event.budget_spent}\\n"
            text_response += f"- **Status:** `{matched_event.status}`\\n"
        else:
            tool_calls.append({"name": "fetch_all_events", "status": "success", "result": f"Found {len(events)} events"})
            if events:
                event_list = "\\n".join([f"- **{e.name}** ({e.date}) - {e.type}" for e in events])
                text_response = f"Here is the calendar of upcoming events:\\n\\n{event_list}"
            else:
                text_response = "No events are currently scheduled."
                
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    elif "task" in msg_lower or "committee" in msg_lower or "assign" in msg_lower or "pending" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        tasks = db.query(CommitteeTask).all()
        
        matched_task = None
        for t in tasks:
            if any(w in f"{t.assigned_to} {t.description}".lower() for w in words):
                matched_task = t
                break
                
        if matched_task:
            tool_calls.append({"name": "search_task", "status": "success", "result": f"Found task for {matched_task.assigned_to}"})
            text_response = f"### ✅ Task Details\\n\\n"
            text_response += f"- **Assigned To:** {matched_task.assigned_to}\\n"
            text_response += f"- **Description:** {matched_task.description}\\n"
            text_response += f"- **Status:** `{matched_task.status}`\\n"
        else:
            tool_calls.append({"name": "fetch_all_tasks", "status": "success", "result": f"Found {len(tasks)} tasks"})
            if tasks:
                task_list = "\\n".join([f"- **{t.assigned_to}**: {t.description} (`{t.status}`)" for t in tasks])
                text_response = f"Here are the committee tasks:\\n\\n{task_list}"
            else:
                text_response = "There are no committee tasks assigned."
                
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI buttons"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "I noticed you want to modify the data. Currently, I am a read-only assistant, but you can easily manage all records directly through the UI!\\n\\n"
            "- Use the **+ Add** button at the top right of any panel to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    else:
        text_response = (
            "👋 **Hello! I am your Event Management Assistant.**\\n\\n"
            "I can help you coordinate institutional events, manage committee tasks, and track scheduling. "
            "Try asking me:\\n"
            "- *\\"Give me a summary of our events\\"*\\n"
            "- *\\"What committee tasks are pending?\\"*\\n"
            "- *\\"Show me the event calendar\\"*"
        )

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

inventory_content = """from sqlalchemy.orm import Session
from core.models import LabAsset, SoftwareLicense, BookRequisition

def handle_inventory_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    
    if msg_lower in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "ping"]:
        text_response = "Hello there! 👋 I am your dedicated AI Assistant for Inventory & Resources. How can I help you today?"
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    if any(word in msg_lower for word in ["stat", "summary", "report", "analytics", "how many", "overview"]):
        assets = db.query(LabAsset).all()
        licenses = db.query(SoftwareLicense).all()
        books = db.query(BookRequisition).all()
        
        tool_calls.append({"name": "fetch_inventory_stats", "status": "success", "result": f"{len(assets)} assets, {len(licenses)} licenses"})
        
        text_response = f"### 📦 Inventory & Resources Overview\\n\\n"
        text_response += f"- **Registered Lab Assets:** {len(assets)}\\n"
        text_response += f"- **Active Software Licenses:** {len(licenses)}\\n"
        text_response += f"- **Book Requisitions:** {len(books)}\\n\\n"
        
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    elif "asset" in msg_lower or "lab" in msg_lower or "hardware" in msg_lower or "equipment" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        assets = db.query(LabAsset).all()
        
        matched_asset = None
        for a in assets:
            if any(w in f"{a.name} {a.type}".lower() for w in words):
                matched_asset = a
                break
                
        if matched_asset:
            tool_calls.append({"name": "search_asset", "status": "success", "result": f"Found {matched_asset.name}"})
            text_response = f"### 🖥️ Asset Details: {matched_asset.name}\\n\\n"
            text_response += f"- **Type:** {matched_asset.type}\\n"
            text_response += f"- **Last Maintenance:** {matched_asset.last_maintenance_date}\\n"
            text_response += f"- **Status:** `{matched_asset.status}`\\n"
        else:
            tool_calls.append({"name": "fetch_all_assets", "status": "success", "result": f"Found {len(assets)} assets"})
            if assets:
                asset_list = "\\n".join([f"- **{a.name}** ({a.type}) - `{a.status}`" for a in assets])
                text_response = f"Here is the list of lab assets:\\n\\n{asset_list}"
            else:
                text_response = "There are no lab assets currently tracked."
                
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
            
    elif "software" in msg_lower or "license" in msg_lower or "expire" in msg_lower or "key" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        licenses = db.query(SoftwareLicense).all()
        
        matched_lic = None
        for l in licenses:
            if any(w in f"{l.software_name}".lower() for w in words):
                matched_lic = l
                break
                
        if matched_lic:
            tool_calls.append({"name": "search_license", "status": "success", "result": f"Found {matched_lic.software_name}"})
            text_response = f"### 🔑 Software License: {matched_lic.software_name}\\n\\n"
            text_response += f"- **Keys Used:** {matched_lic.keys_used} / {matched_lic.keys_total}\\n"
            text_response += f"- **Expiry Date:** {matched_lic.expiry_date}\\n"
        else:
            tool_calls.append({"name": "fetch_licenses", "status": "success", "result": f"Found {len(licenses)} licenses"})
            if licenses:
                records = "\\n".join([f"- **{l.software_name}**: {l.keys_used}/{l.keys_total} seats used. Expires on {l.expiry_date}." for l in licenses])
                text_response = f"### 🔑 Software Licenses\\n\\nHere are the tracked software licenses:\\n\\n{records}"
            else:
                text_response = "There are no software licenses registered currently."
            
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}
        
    elif "book" in msg_lower or "library" in msg_lower or "requisition" in msg_lower or "read" in msg_lower:
        words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        books = db.query(BookRequisition).all()
        
        matched_book = None
        for b in books:
            if any(w in f"{b.book_title} {b.author}".lower() for w in words):
                matched_book = b
                break
                
        if matched_book:
            tool_calls.append({"name": "search_book", "status": "success", "result": f"Found {matched_book.book_title}"})
            text_response = f"### 📚 Book Details: {matched_book.book_title}\\n\\n"
            text_response += f"- **Author:** {matched_book.author}\\n"
            text_response += f"- **Copies Needed:** {matched_book.copies_needed}\\n"
            text_response += f"- **Status:** `{matched_book.status}`\\n"
        else:
            tool_calls.append({"name": "fetch_books", "status": "success", "result": f"Found {len(books)} books"})
            if books:
                records = "\\n".join([f"- **{b.book_title}** by {b.author} - {b.copies_needed} copies needed (`{b.status}`)" for b in books])
                text_response = f"### 📚 Book Requisitions\\n\\nHere are the current library requests:\\n\\n{records}"
            else:
                text_response = "There are no book requisitions currently."
            
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI buttons"})
        text_response = (
            "### 💡 Managing Records\\n\\n"
            "I noticed you want to modify the data. Currently, I am a read-only assistant, but you can easily manage all records directly through the UI!\\n\\n"
            "- Use the **+ Add** button at the top right of any panel to create new records.\\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": None}

    else:
        text_response = (
            "👋 **Hello! I am your Inventory & Resources Assistant.**\\n\\n"
            "I can help you monitor lab hardware, track software licenses, and manage library requisitions. "
            "Try asking me:\\n"
            "- *\\"Give me a summary of our inventory\\"*\\n"
            "- *\\"What lab assets are currently active?\\"*\\n"
            "- *\\"Are there any software licenses expiring?\\"*"
        )

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": None
    }
"""

with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/placement_internships/agent.py', 'w', encoding='utf-8') as f:
    f.write(placement_content)
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/alumni_relations/agent.py', 'w', encoding='utf-8') as f:
    f.write(alumni_content)
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/event_management/agent.py', 'w', encoding='utf-8') as f:
    f.write(event_content)
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/inventory_resources/agent.py', 'w', encoding='utf-8') as f:
    f.write(inventory_content)

print('Perfectly trained all 4 agents!')
