import os
import re

filepath = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/FacultyAssistant.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

import_stmt = "import { SharedChatInterface } from '../components/SharedChatInterface';\n"
if import_stmt not in content:
    content = content.replace("import React", f"{import_stmt}import React", 1)

chat_start = '{/* LEFT COLUMN: CHAT INTERFACE (Takes 2 columns in large layout) */}'
chat_end = '{/* RIGHT COLUMN: QUICK ACTIONS & CONTEXT */}'

pattern = re.escape(chat_start) + r'.*?' + r'(?=' + re.escape(chat_end) + r')'
replacement = f"""{{/* LEFT COLUMN: CHAT INTERFACE (Takes 2 columns in large layout) */}}
        <div className="lg:col-span-2 h-[calc(100vh-140px)]">
          <SharedChatInterface agentId="agent1" agentTitle="Personal Faculty Assistant" agentSubtitle="System 1.0" />
        </div>\n\n        """
        
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("FacultyAssistant.tsx patched safely!")
