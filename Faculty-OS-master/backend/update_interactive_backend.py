import os
import re

agents = {
    'placement_internships': [
        { "label": "📊 View Stats", "value": "Show me a summary of all placements" },
        { "label": "🏢 Upcoming Drives", "value": "What companies are visiting?" },
        { "label": "🎓 Active Internships", "value": "Give me details about student internships" }
    ],
    'alumni_relations': [
        { "label": "💰 View Donations", "value": "Show me all donations" },
        { "label": "👤 Search Directory", "value": "Who is in the directory?" },
        { "label": "📊 Network Summary", "value": "Give me a summary of our alumni funds" }
    ],
    'event_management': [
        { "label": "🎉 All Events", "value": "Show me an overview of all events" },
        { "label": "📋 Pending Tasks", "value": "What committee tasks are pending?" }
    ],
    'inventory_resources': [
        { "label": "📦 View Assets", "value": "Show me an overview of all assets" },
        { "label": "🔑 Software Licenses", "value": "What software licenses do we have?" }
    ]
}

base_path = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents'

for agent_name, choices in agents.items():
    filepath = os.path.join(base_path, agent_name, 'agent.py')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    choices_str = ",\n            ".join([f'{{ "label": "{c["label"]}", "value": "{c["value"]}" }}' for c in choices])

    replacement = f"""
    rich_data = None
    if "I am your Faculty Assistant" not in llm_response:
        text_response = llm_response
        rich_data = {{
            "type": "interactive_choices",
            "choices": [
            {choices_str}
            ]
        }}

    return {{
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }}"""

    # We want to replace from `if "I am your Faculty Assistant"` down to the end of the file.
    import re
    # We replace the old block:
    old_block_pattern = r'if "I am your Faculty Assistant" not in llm_response:.*?return \{\s*"text": text_response,\s*"tool_calls": tool_calls,\s*"rich_data": None\s*\}'
    
    content = re.sub(old_block_pattern, replacement.strip(), content, flags=re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Backend agents updated!")
