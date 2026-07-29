import os

# Replacements for PlacementInternships
path1 = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/placement_internships/agent.py'
with open(path1, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('d.job_roles', 'd.role')
c = c.replace('d.visit_date', 'd.date')
c = c.replace('d.eligible_branches', 'd.eligibility')
c = c.replace('text_response += f"- **CTC:** {matched_drive.expected_ctc}\\n"', '')
c = c.replace('text_response += f"- **Role:** {matched_intern.role}\\n"', '')
c = c.replace('text_response += f"- **Duration:** {matched_intern.start_date} to {matched_intern.end_date}\\n"', 'text_response += f"- **Duration (Months):** {matched_intern.duration_months}\\n"')
c = c.replace('({i.role})', '')
with open(path1, 'w', encoding='utf-8') as f: f.write(c)

# Replacements for AlumniRelations
path2 = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/alumni_relations/agent.py'
with open(path2, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('a.designation', 'a.role')
c = c.replace('a.batch', 'a.graduation_year')
c = c.replace('a.branch', 'a.email')
c = c.replace('text_response += f"- **Location:** {matched.current_city}\\n"', '')
c = c.replace('d.alumni_name', 'f"Alumni #{d.alumni_id}"')
c = c.replace(' ({d.status})', '')
c = c.replace('({a.batch})', '({a.graduation_year})')
with open(path2, 'w', encoding='utf-8') as f: f.write(c)

# Replacements for EventManagement
path3 = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/event_management/agent.py'
with open(path3, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('text_response += f"- **Venue:** {matched_event.venue}\\n"', '')
c = c.replace('text_response += f"- **Organizer:** {matched_event.organizer}\\n"', 'text_response += f"- **Budget Spent:** ${matched_event.budget_spent}\\n"')
c = c.replace('t.event_name', 'f"Event #{t.event_id}"')
c = c.replace('t.task_description', 't.description')
c = c.replace(' ({t.deadline})', '')
with open(path3, 'w', encoding='utf-8') as f: f.write(c)

# Replacements for InventoryResources
path4 = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/backend/agents/inventory_resources/agent.py'
with open(path4, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('a.asset_type', 'a.type')
c = c.replace('text_response += f"- **Serial Number:** {matched_asset.serial_number}\\n"', '')
c = c.replace('text_response += f"- **Purchase Date:** {matched_asset.purchase_date}\\n"', 'text_response += f"- **Last Maintenance:** {matched_asset.last_maintenance_date}\\n"')
c = c.replace('text_response += f"- **Location:** {matched_asset.location}\\n"', '')
c = c.replace('l.name', 'l.software_name')
c = c.replace('text_response += f"- **Vendor:** {matched_license.vendor}\\n"', '')
c = c.replace('text_response += f"- **License Key:** {matched_license.license_key}\\n"', '')
c = c.replace('l.seats_total', 'l.keys_total')
c = c.replace('l.seats_used', 'l.keys_used')
c = c.replace('l.expiration_date', 'l.expiry_date')
c = c.replace('b.title', 'b.book_title')
c = c.replace('text_response += f"- **Edition:** {matched_book.edition}\\n"', '')
c = c.replace('text_response += f"- **Requested By:** {matched_book.requested_by}\\n"', 'text_response += f"- **Copies Needed:** {matched_book.copies_needed}\\n"')
with open(path4, 'w', encoding='utf-8') as f: f.write(c)

print('Attribute access fixed in all 4 agents!')
