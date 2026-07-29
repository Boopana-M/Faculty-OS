from sqlalchemy.orm import Session
from core.models import Event, CommitteeTask
from core.llm import llm_client
from core.shared_intents import process_shared_intents


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
        
        text_response = f"### 🎉 Events & Committees Overview\n\n"
        text_response += f"- **Total Events Planned:** {len(events)}\n"
        text_response += f"- **Total Committee Tasks:** {len(tasks)}\n\n"
        
        if events:
            upcoming = events[:3]
            text_response += f"**Upcoming Events:**\n"
            for e in upcoming:
                text_response += f"- {e.name} on {e.date} at {e.venue}\n"
                
    elif "event" in msg_lower or "workshop" in msg_lower or "fdp" in msg_lower:
        events = db.query(Event).all()
        matched = next((e for e in events if e.name.lower() in msg_lower), None)
                
        if matched:
            tool_calls.append({"name": "search_event", "status": "success", "result": f"Found {matched.name}"})
            text_response = f"### 📅 {matched.name} Details\n\n"
            text_response += f"- **Type:** {matched.type}\n"
            text_response += f"- **Date:** {matched.date}\n"
            text_response += f"- **Venue:** {matched.venue}\n"
            text_response += f"- **Budget:** ${matched.budget_allocated}\n"
        else:
            tool_calls.append({"name": "fetch_events", "status": "success", "result": f"Found {len(events)} events"})
            if events:
                names = "\n".join([f"- **{e.name}** ({e.date})" for e in events])
                text_response = f"Here are the scheduled events:\n\n{names}"
            else:
                text_response = "There are no events currently scheduled."
            
    elif "task" in msg_lower or "committee" in msg_lower or "duty" in msg_lower:
        tasks = db.query(CommitteeTask).all()
        
        if tasks:
            tool_calls.append({"name": "fetch_tasks", "status": "success", "result": f"Found {len(tasks)} tasks"})
            pending = [t for t in tasks if t.status.lower() != "completed"]
            records = "\n".join([f"- **{t.event_name}**: {t.task_description} (Assigned to: {t.assigned_to})" for t in pending])
            text_response = f"### 📋 Committee Tasks (Pending)\n\n{records if pending else 'All tasks are completed!'}"
        else:
            tool_calls.append({"name": "fetch_tasks", "status": "success", "result": "No tasks"})
            text_response = "There are no active committee tasks."
            
    elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):
        tool_calls.append({"name": "guide_user", "status": "success", "result": "Guided to UI"})
        text_response = (
            "### 💡 Managing Records\n\n"
            "- Use the **+ Add** button at the top right to create new records.\n"
            "- Click the **✏️ Edit** icon next to any item to update its details."
        )

    else:
        # Deep Search Fallback
        events = db.query(Event).all()
        tasks = db.query(CommitteeTask).all()
        
        found_events = [e for e in events if any(word in f"{e.name} {e.venue}".lower() for word in msg_lower.split() if len(word) > 3)]
        
        if found_events:
            tool_calls.append({"name": "deep_search", "status": "success", "result": "Found matches"})
            text_response = "I found some records that might match your query:\n\n"
            for e in found_events:
                text_response += f"- **Event:** {e.name} at {e.venue}\n"
        else:
            text_response = (
                "👋 **Hello! I am your Event Management Assistant.**\n\n"
                "I can help you coordinate FDPs, workshops, and track committee duties. "
                "Try asking me:\n"
                "- *\"Show me an overview of all events\"*\n"
                "- *\"What committee tasks are pending?\"*\n"
                "- *\"Details for the AI Workshop\"*\n"
            )

    # LLM Enhancement Layer
    system_prompt = (
        "You are EduPilot's Event Management Assistant. "
        "Use markdown formatting. Based on the tool results below, provide a helpful and accurate response to the user."
    )
    if tool_calls:
        system_prompt += "\n\nTool Results:\n" + "\n".join([f"- {t['name']}: {t['result']}" for t in tool_calls])
        
    llm_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])
    rich_data = None

    # 0. CHECK SHARED ADVANCED INTENTS (Drafting, RAG, Lesson Plans)
    t_calls, t_resp, r_data = process_shared_intents(message, history, "event_management")
    if t_calls is not None or t_resp is not None:
        return {"text": t_resp, "tool_calls": t_calls, "rich_data": r_data}
    
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response
        rich_data = {
            "type": "interactive_choices",
            "choices": [
            { "label": "🎉 All Events", "value": "Show me an overview of all events" },
            { "label": "📋 Pending Tasks", "value": "What committee tasks are pending?" }
            ]
        }

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
