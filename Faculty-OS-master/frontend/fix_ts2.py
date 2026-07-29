import os
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert my bad global regex that changed error states
    content = content.replace("const [error, setError] = useState<number | null>(null)", "const [error, setError] = useState<string | null>(null)")
    content = content.replace("const [statusMessage, setStatusMessage] = useState<number | null>(null)", "const [statusMessage, setStatusMessage] = useState<string | null>(null)")
    content = content.replace("const [deleteError, setDeleteError] = useState<number | null>(null)", "const [deleteError, setDeleteError] = useState<string | null>(null)")
    content = content.replace("const [uploadError, setUploadError] = useState<number | null>(null)", "const [uploadError, setUploadError] = useState<string | null>(null)")

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
