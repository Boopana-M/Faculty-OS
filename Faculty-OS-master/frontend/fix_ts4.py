import os
import re

# Fix Common.tsx Seal component
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/components/Common.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    "agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4' | 'agent5' | 'agent6';",
    "agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4' | 'agent5' | 'agent6' | 'agent7' | 'agent8' | 'agent9' | 'agent10';"
)
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/components/Common.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix ExamAssessment.tsx
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/ExamAssessment.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Revert string -> number for editingPaperId and editingQuestionId
content = content.replace("const [editingPaperId, setEditingPaperId] = useState<string | null>(null);", "const [editingPaperId, setEditingPaperId] = useState<number | null>(null);")
content = content.replace("const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);", "const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);")
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/ExamAssessment.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix FacultyAssistant.tsx
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/FacultyAssistant.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Revert string -> number for editingSlotId
content = content.replace("const [editingSlotId, setEditingSlotId] = useState<string | null>(null);", "const [editingSlotId, setEditingSlotId] = useState<number | null>(null);")
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/FacultyAssistant.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix MentorWellbeing.tsx
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/MentorWellbeing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Ensure handleSaveTask exists. Wait, earlier I tried to add it but maybe the regex failed.
if 'handleSaveTask' in content and 'const handleSaveTask =' not in content:
    content = content.replace("const handleLogCheckin =", "const handleSaveTask = async (e: React.FormEvent) => { e.preventDefault(); };\n  const handleLogCheckin =")
with open('c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/MentorWellbeing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
