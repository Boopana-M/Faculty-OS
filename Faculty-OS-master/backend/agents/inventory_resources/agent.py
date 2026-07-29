from sqlalchemy.orm import Session
from core.models import LabAsset, SoftwareLicense, BookRequisition
from core.llm import llm_client
from core.shared_intents import process_shared_intents


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
        
        text_response = f"### 📦 Inventory & Resources Overview\n\n"
        text_response += f"- **Lab Assets:** {len(assets)}\n"
        text_response += f"- **Software Licenses:** {len(licenses)}\n"
        text_response += f"- **Book Requisitions:** {len(books)}\n\n"

    elif "asset" in msg_lower or "equipment" in msg_lower or "lab" in msg_lower:
        assets = db.query(LabAsset).all()
        matched = next((a for a in assets if a.name.lower() in msg_lower), None)
                
        if matched:
            tool_calls.append({"name": "search_asset", "status": "success", "result": f"Found {matched.name}"})
            text_response = f"### 🖥️ {matched.name} Details\n\n"
            text_response += f"- **Type:** {matched.asset_type}\n"
            text_response += f"- **Location:** {matched.location}\n"
            text_response += f"- **Status:** `{matched.status}`\n"
        else:
            tool_calls.append({"name": "fetch_assets", "status": "success", "result": f"Found {len(assets)} assets"})
            if assets:
                names = "\n".join([f"- **{a.name}** ({a.location}) - Status: {a.status}" for a in assets])
                text_response = f"Here is the lab equipment list:\n\n{names}"
            else:
                text_response = "There are no lab assets recorded."
            
    elif "software" in msg_lower or "license" in msg_lower or "key" in msg_lower:
        licenses = db.query(SoftwareLicense).all()
        
        if licenses:
            tool_calls.append({"name": "fetch_licenses", "status": "success", "result": f"Found {len(licenses)} licenses"})
            records = "\n".join([f"- **{l.name}** ({l.vendor}): {l.seats_used}/{l.seats_total} seats used" for l in licenses])
            text_response = f"### 🔑 Software Licenses\n\n{records}"
        else:
            tool_calls.append({"name": "fetch_licenses", "status": "success", "result": "No licenses"})
            text_response = "There are no software licenses recorded."
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI"})
        text_response = (
            "### 💡 Managing Records\n\n"
            "- Use the **+ Add** button at the top right to create new records.\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )

    else:
        # Deep Search Fallback
        assets = db.query(LabAsset).all()
        licenses = db.query(SoftwareLicense).all()
        
        found_assets = [a for a in assets if any(word in f"{a.name} {a.asset_type}".lower() for word in msg_lower.split() if len(word) > 3)]
        
        if found_assets:
            tool_calls.append({"name": "deep_search", "status": "success", "result": "Found matches"})
            text_response = "I found some records that might match your query:\n\n"
            for a in found_assets:
                text_response += f"- **Asset:** {a.name} in {a.location}\n"
        else:
            text_response = (
                "👋 **Hello! I am your Inventory & Resources Assistant.**\n\n"
                "I can help you track lab equipment, software licenses, and book requisitions. "
                "Try asking me:\n"
                "- *\"Show me an overview of all assets\"*\n"
                "- *\"What software licenses do we have?\"*\n"
                "- *\"Find the details for the Oscilloscope\"*\n"
            )

    # LLM Enhancement Layer
    system_prompt = (
        "You are EduPilot's Inventory & Resources Assistant. "
        "Use markdown formatting. Based on the tool results below, provide a helpful and accurate response to the user."
    )
    if tool_calls:
        system_prompt += "\n\nTool Results:\n" + "\n".join([f"- {t['name']}: {t['result']}" for t in tool_calls])
        
    llm_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])
    rich_data = None

    # 0. CHECK SHARED ADVANCED INTENTS (Drafting, RAG, Lesson Plans)
    t_calls, t_resp, r_data = process_shared_intents(message, history, "inventory_resources")
    if t_calls is not None or t_resp is not None:
        return {"text": t_resp, "tool_calls": t_calls, "rich_data": r_data}
    
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response
        rich_data = {
            "type": "interactive_choices",
            "choices": [
            { "label": "📦 View Assets", "value": "Show me an overview of all assets" },
            { "label": "🔑 Software Licenses", "value": "What software licenses do we have?" }
            ]
        }

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
