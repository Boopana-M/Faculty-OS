import re
import os

# Fix SharedChatInterface.tsx
shared_path = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/components/SharedChatInterface.tsx'
with open(shared_path, 'r', encoding='utf-8') as f:
    shared = f.read()

shared = shared.replace('<Badge variant="outline"', '<Badge variant="neutral"')
shared = shared.replace('<Seal agentId={agentId as any}', '<Seal icon={Bot} agentId={agentId as any}')
shared = shared.replace('<ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">', '<div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>')
shared = shared.replace('</ReactMarkdown>', '</ReactMarkdown></div>')

with open(shared_path, 'w', encoding='utf-8') as f:
    f.write(shared)

# Fix the 4 agents
agents = ['PlacementInternships.tsx', 'AlumniRelations.tsx', 'EventManagement.tsx', 'InventoryResources.tsx']
base_dir = 'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages'

for agent in agents:
    filepath = os.path.join(base_dir, agent)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # The error is `onClick={handleSendChat}` somewhere. Probably in a modal or form?
    # Wait, the error is in the old chat input which I DID NOT REPLACE fully?
    # Let's check what I replaced in PlacementInternships.tsx!
    # chat_start was '{/* Right Side Chat */}', chat_end was '</div>\n    </div>\n  );\n};\n'
    # That means I successfully replaced the chat UI! So where is `onClick={handleSendChat}`?
    # Ah! Did the old script also inject `renderInteractiveChoices` which has `onClick={() => handleSendChat(choice.value)}`?
    # No, `() => handleSendChat(choice.value)` does NOT cause the Event mismatch!
    # The mismatch is caused by `onClick={handleSendChat}`!
    # Let me just replace `onClick={handleSendChat}` with `onClick={() => handleSendChat()}`
    
    content = content.replace("onClick={handleSendChat}", "onClick={() => handleSendChat()}")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Fixed TS errors")
