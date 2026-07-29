import os
import re

base_path = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents'
agents = ['placement_internships', 'alumni_relations', 'event_management', 'inventory_resources']

for agent in agents:
    filepath = os.path.join(base_path, agent, 'agent.py')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    import_stmt = "from core.shared_intents import process_shared_intents\n"
    if "process_shared_intents" not in content:
        content = content.replace("from core.llm import llm_client", f"from core.llm import llm_client\n{import_stmt}")

    hook_code = f"""
    # 0. CHECK SHARED ADVANCED INTENTS (Drafting, RAG, Lesson Plans)
    t_calls, t_resp, r_data = process_shared_intents(message, history, "{agent}")
    if t_calls is not None or t_resp is not None:
        return {{"text": t_resp, "tool_calls": t_calls, "rich_data": r_data}}
    """
    
    # Inject right after `rich_data = None` inside the handle function
    if "# 0. CHECK SHARED ADVANCED INTENTS" not in content:
        content = content.replace("rich_data = None", f"rich_data = None\n{hook_code}", 1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Domain agents patched to use shared_intents!")
