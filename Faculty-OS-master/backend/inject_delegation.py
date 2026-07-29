import os

delegation_code = """
    # Interservice Delegation & Collaboration
    elif any(k in msg_lower for k in ["schedule", "timetable", "class", "syllabus", "unit", "policy", "leave", "draft", "email", "lesson plan"]):
        tool_calls.append({"name": "delegate_to_faculty_assistant", "status": "success", "result": "Redirected query to Faculty Assistant."})
        rich_data = {"type": "delegation", "agent": "Faculty Assistant", "agent_id": "agent1"}
        text_response = "I have delegated this request to the Faculty Assistant."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["attendance", "assignment", "workflow", "grade"]):
        tool_calls.append({"name": "delegate_to_academic_workflow", "status": "success", "result": "Redirected query to Academic Workflow Agent."})
        rich_data = {"type": "delegation", "agent": "Academic Workflow", "agent_id": "agent2"}
        text_response = "I have delegated this request to the Academic Workflow Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["analytics", "nba", "accreditation", "report", "at-risk"]):
        tool_calls.append({"name": "delegate_to_analytics", "status": "success", "result": "Redirected query to Analytics & Accreditation Agent."})
        rich_data = {"type": "delegation", "agent": "Analytics & Accreditation", "agent_id": "agent3"}
        text_response = "I have delegated this request to the Analytics Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["research", "grant", "publication", "paper"]):
        tool_calls.append({"name": "delegate_to_research", "status": "success", "result": "Redirected query to Research & Grants Agent."})
        rich_data = {"type": "delegation", "agent": "Research & Grants", "agent_id": "agent4"}
        text_response = "I have delegated this request to the Research & Grants Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["exam", "assessment", "question", "paper", "rubric"]):
        tool_calls.append({"name": "delegate_to_exam", "status": "success", "result": "Redirected query to Exam & Assessment Agent."})
        rich_data = {"type": "delegation", "agent": "Exam & Assessment Design", "agent_id": "agent5"}
        text_response = "I have delegated this request to the Exam Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
        
    elif any(k in msg_lower for k in ["mentor", "wellbeing", "checkin", "escalation", "student issue"]):
        tool_calls.append({"name": "delegate_to_mentor", "status": "success", "result": "Redirected query to Mentor & Wellbeing Agent."})
        rich_data = {"type": "delegation", "agent": "Mentor & Wellbeing", "agent_id": "agent6"}
        text_response = "I have delegated this request to the Mentor Agent."
        return {"text": text_response, "tool_calls": tool_calls, "rich_data": rich_data}
"""

def inject_delegation(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to insert the delegation block right before the fallback intent.
    # The fallback intent starts with "elif any(word in msg_lower for word in ["add", "create", "new""
    
    target_str = 'elif any(word in msg_lower for word in ["add", "create", "new", "insert", "edit", "update", "delete", "remove"]):'
    
    if target_str in content and "delegate_to_faculty_assistant" not in content:
        content = content.replace(target_str, delegation_code.strip() + "\n\n    " + target_str)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            print(f"Injected delegation into {filepath}")
    else:
        print(f"Skipped {filepath}")

inject_delegation('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/placement_internships/agent.py')
inject_delegation('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/alumni_relations/agent.py')
inject_delegation('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/event_management/agent.py')
inject_delegation('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/inventory_resources/agent.py')

