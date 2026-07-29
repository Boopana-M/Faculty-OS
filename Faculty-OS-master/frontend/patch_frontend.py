import re
import os

files_to_patch = {
    'FacultyAssistant.tsx': {
        'agentId': 'agent1',
        'agentTitle': 'Personal Faculty Assistant',
        'agentSubtitle': 'System 1.0',
        'chat_start': '{/* LEFT COLUMN: CHAT INTERFACE (Takes 2 columns in large layout) */}',
        'chat_end': '{/* RIGHT COLUMN: QUICK ACTIONS & CONTEXT */}'
    },
    'PlacementInternships.tsx': {
        'agentId': 'agent7',
        'agentTitle': 'Placement & Career AI',
        'agentSubtitle': 'Ready to assist',
        'chat_start': '{/* Right Side Chat */}',
        'chat_end': '</div>\n    </div>\n  );\n};\n'
    },
    'AlumniRelations.tsx': {
        'agentId': 'agent8',
        'agentTitle': 'Alumni Relations AI',
        'agentSubtitle': 'Ready to assist',
        'chat_start': '{/* Right Side Chat */}',
        'chat_end': '</div>\n    </div>\n  );\n};\n'
    },
    'EventManagement.tsx': {
        'agentId': 'agent9',
        'agentTitle': 'Event Manager AI',
        'agentSubtitle': 'Ready to assist',
        'chat_start': '{/* Right Side Chat */}',
        'chat_end': '</div>\n    </div>\n  );\n};\n'
    },
    'InventoryResources.tsx': {
        'agentId': 'agent10',
        'agentTitle': 'Inventory & Lab AI',
        'agentSubtitle': 'Ready to assist',
        'chat_start': '{/* Right Side Chat */}',
        'chat_end': '</div>\n    </div>\n  );\n};\n'
    }
}

base_dir = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages'

for filename, config in files_to_patch.items():
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add import statement
    import_stmt = "import { SharedChatInterface } from '../components/SharedChatInterface';\n"
    if import_stmt not in content:
        content = content.replace("import React", f"{import_stmt}import React", 1)

    # 2. Replace chat UI block
    if filename == 'FacultyAssistant.tsx':
        pattern = re.escape(config['chat_start']) + r'.*?' + r'(?=' + re.escape(config['chat_end']) + r')'
        replacement = f"""{{/* LEFT COLUMN: CHAT INTERFACE (Takes 2 columns in large layout) */}}
        <div className="lg:col-span-2 h-[calc(100vh-140px)]">
          <SharedChatInterface agentId="{config['agentId']}" agentTitle="{config['agentTitle']}" agentSubtitle="{config['agentSubtitle']}" />
        </div>\n\n        """
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        # 3. Clean up the old unused states and render functions from FacultyAssistant
        # Delete from `const [messages` up to `const messagesEndRef`
        state_pattern = r'const \[messages.*?const messagesEndRef = useRef<HTMLDivElement>\(null\);'
        content = re.sub(state_pattern, '', content, flags=re.DOTALL)
        
        # Delete from `useEffect(() => {\n    messagesEndRef` down to just before `return (`
        render_pattern = r'useEffect\(\(\) => \{\s*messagesEndRef\.current\?\.scrollIntoView.*?return \('
        content = re.sub(render_pattern, 'return (', content, flags=re.DOTALL)

    else:
        # For the 4 new bots
        pattern = re.escape(config['chat_start']) + r'.*?' + r'(?=' + re.escape('</div>\n    </div>\n  );\n};\n') + r')'
        replacement = f"""{{/* Right Side Chat */}}
        <div className="xl:col-span-1 h-[calc(100vh-140px)]">
          <SharedChatInterface agentId="{config['agentId']}" agentTitle="{config['agentTitle']}" agentSubtitle="{config['agentSubtitle']}" />
        </div>\n      """
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Frontend TSX files patched successfully!")
