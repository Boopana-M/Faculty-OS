import os
import re

frontend_files = [
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/PlacementInternships.tsx',
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/AlumniRelations.tsx',
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/EventManagement.tsx',
    'c:/Users/GURU GAYATHRI/Downloads/Faculty-OS-master/Faculty-OS-master/frontend/src/pages/InventoryResources.tsx'
]

for filepath in frontend_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update handleSendChat signature
    content = content.replace(
        "const handleSendChat = async () => {\n    if (!chatInput.trim() || isLoading) return;\n    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };",
        "const handleSendChat = async (directMessage?: string) => {\n    const msgContent = directMessage || chatInput.trim();\n    if (!msgContent || isLoading) return;\n    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msgContent, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };"
    )

    # 2. Update onDone callback to include richData
    content = content.replace(
        "(toolCalls, richData) => {\n          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: fullText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);",
        "(toolCalls, richData) => {\n          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: fullText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), richData }]);"
    )

    # 3. Add renderInteractiveChoices
    render_func = """
  const renderInteractiveChoices = (data: any) => {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {data.choices.map((choice: any, idx: number) => (
          <button
            key={idx}
            onClick={() => handleSendChat(choice.value)}
            className="text-xs bg-surface border border-border hover:border-accent-500 hover:text-accent-500 transition py-1.5 px-3 rounded flex items-center gap-1.5 shadow-sm text-ink font-medium"
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  };
"""
    if "const renderInteractiveChoices" not in content:
        content = content.replace("return (", render_func + "\n  return (", 1)

    # 4. Add richData rendering
    if "{msg.richData?.type === 'interactive_choices'" not in content:
        content = content.replace(
            "<ReactMarkdown className=\"prose prose-sm dark:prose-invert max-w-none\">{msg.content}</ReactMarkdown>",
            "<ReactMarkdown className=\"prose prose-sm dark:prose-invert max-w-none\">{msg.content}</ReactMarkdown>\n                  {msg.richData?.type === 'interactive_choices' && renderInteractiveChoices(msg.richData)}"
        )

    # 5. Fix user content parsing in handleSendChat
    content = content.replace(
        "userMsg.content,\n        newHistory,",
        "msgContent,\n        newHistory,"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Frontend TSX updated!")
