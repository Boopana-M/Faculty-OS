import os
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # REVERT everything back to string | null
    content = content.replace("useState<number | null>(null)", "useState<string | null>(null)")

    # RE-APPLY to only the ID fields!
    for field in [
        'editingDriveId', 'editingInternshipId',
        'editingAlumniId', 'editingDonationId',
        'editingEventId', 'editingTaskId',
        'editingAssetId', 'editingLicenseId', 'editingRequisitionId'
    ]:
        regex = f"const \\[{field}, set{field[0].upper() + field[1:]}\\] = useState<string \\| null>\\(null\\);"
        replacement = f"const [{field}, set{field[0].upper() + field[1:]}] = useState<number | null>(null);"
        content = re.sub(regex, replacement, content)

    # AlumniRelations.tsx
    if "AlumniRelations.tsx" in filepath:
        content = content.replace("api.addDonation", "api.addAlumniDonation")
        content = content.replace("api.editDonation", "api.editAlumniDonation")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Fixed {filepath}")

for f in os.listdir('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages'):
    if f.endswith('.tsx'):
        fix_file(os.path.join('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages', f))

