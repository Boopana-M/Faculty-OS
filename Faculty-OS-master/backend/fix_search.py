import os

def rewrite_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)


robust_match = """
        search_words = [w for w in msg_lower.replace('?','').replace('.','').split() if len(w) > 2]
        {var_name} = None
        for {item} in {lst}:
            text = " ".join([str(getattr({item}, f) or "").lower() for f in {fields}])
            if any(sw in text for sw in search_words):
                {var_name} = {item}
                break
"""

# 1. Placement
rewrite_file(
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/placement_internships/agent.py',
    [
        (
            'matched_drive = next((d for d in drives if d.company_name.lower() in msg_lower), None)',
            robust_match.format(var_name='matched_drive', item='d', lst='drives', fields="['company_name', 'role']")
        ),
        (
            'matched_intern = next((i for i in interns if i.student_name.lower() in msg_lower), None)',
            robust_match.format(var_name='matched_intern', item='i', lst='interns', fields="['student_name', 'company']")
        )
    ]
)

# 2. Alumni
rewrite_file(
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/alumni_relations/agent.py',
    [
        (
            'matched = next((a for a in alumni if a.name.lower() in msg_lower or a.company.lower() in msg_lower), None)',
            robust_match.format(var_name='matched', item='a', lst='alumni', fields="['name', 'company', 'role']")
        )
    ]
)

# 3. Events
rewrite_file(
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/event_management/agent.py',
    [
        (
            'matched_event = next((e for e in events if e.name.lower() in msg_lower), None)',
            robust_match.format(var_name='matched_event', item='e', lst='events', fields="['name', 'type']")
        ),
        (
            'matched_task = next((t for t in tasks if t.assigned_to.lower() in msg_lower), None)',
            robust_match.format(var_name='matched_task', item='t', lst='tasks', fields="['assigned_to', 'description']")
        )
    ]
)

# 4. Inventory
rewrite_file(
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/inventory_resources/agent.py',
    [
        (
            'matched_asset = next((a for a in assets if a.name.lower() in msg_lower), None)',
            robust_match.format(var_name='matched_asset', item='a', lst='assets', fields="['name', 'type']")
        )
    ]
)

print('Search logic fixed in all 4 agents!')
