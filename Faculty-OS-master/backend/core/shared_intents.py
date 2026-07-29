from sqlalchemy.orm import Session
from core.llm import llm_client
from rag.rag_pipeline import rag_pipeline

def process_shared_intents(message: str, history: list = None, domain_context: str = ""):
    msg_lower = message.lower()
    tool_calls = []
    
    last_assistant_content = ""
    if history:
        for h in reversed(history):
            if h.get("role") == "assistant":
                last_assistant_content = h.get("content", "")
                break

    # 1. EMAIL DRAFTING INTENT
    is_draft_flow = False
    if "/draft-mail" in msg_lower or "draft a mail" in msg_lower or "draft mail" in msg_lower or "draft an email" in msg_lower:
        is_draft_flow = True
    elif last_assistant_content and any(k in last_assistant_content for k in [
        "Please type how many days and the reason for your leave",
        "details of the instruction/announcement for students",
        "recipient is and what you would like to inquire about",
        "type the subject of the email",
        "Who is the recipient, and what is the main content/purpose"
    ]):
        is_draft_flow = True
        
    if is_draft_flow:
        if "/draft-mail-type leave" in msg_lower:
            text_response = "Great! Let's draft a **Leave Permission** email.\n\nHow many days of leave do you need, and what is the reason? Please select an option below or write your own details in the chat."
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "1 day, personal work", "value": "/draft-mail-leave-details 1 day, personal urgent work at home" },
                    { "label": "2 days, personal work", "value": "/draft-mail-leave-details 2 days, personal urgent work at home" },
                    { "label": "3 days, medical reasons", "value": "/draft-mail-leave-details 3 days, medical reason (fever)" },
                    { "label": "Write my own details...", "value": "/draft-mail-leave-custom", "action": "custom" }
                ]
            }
        elif "/draft-mail-leave-custom" in msg_lower:
            text_response = "Please type how many days and the reason for your leave: (e.g. '2 days for personal work')"
        elif "/draft-mail-leave-details" in msg_lower or "Please type how many days and the reason for your leave" in last_assistant_content:
            details = message.replace("/draft-mail-leave-details", "").strip()
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is a drafted leave request email for you:\n\n**Subject:** Application for Casual Leave\n\n**Body:**\nDear Head of Department,\n\nI am writing to formally request leave for {details}.\n\nI have arranged for my classes to be handled during this period and will be reachable via phone and email if anything urgent arises.\n\nThank you for your consideration."
            rich_data = {
                "type": "email_draft",
                "to_name": "HOD",
                "purpose": "Leave Request",
                "subject": "Application for Casual Leave",
                "body": f"Dear Head of Department,\n\nI am writing to formally request leave for {details}.\n\nI have arranged for my classes to be handled during this period and will be reachable via phone and email if anything urgent arises.\n\nThank you for your consideration."
            }
        elif "/draft-mail-type instruction" in msg_lower:
            text_response = "Great! Let's draft an **Instruction to Students** email.\n\nWhat is the instruction/announcement? Please select a recommendation below or write your own details."
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "Class cancelled tomorrow", "value": "/draft-mail-instruction-details Class is cancelled tomorrow due to faculty development program" },
                    { "label": "Assignment due next week", "value": "/draft-mail-instruction-details Homework assignment 4 is due next Tuesday at 5 PM" },
                    { "label": "Exam schedule reminder", "value": "/draft-mail-instruction-details The mid-term exam will be held on Monday at LH-201 at 10 AM" },
                    { "label": "Write my own details...", "value": "/draft-mail-instruction-custom", "action": "custom" }
                ]
            }
        elif "/draft-mail-instruction-custom" in msg_lower:
            text_response = "Please type the details of the instruction/announcement for students:"
        elif "/draft-mail-instruction-details" in msg_lower or "details of the instruction/announcement for students" in last_assistant_content:
            details = message.replace("/draft-mail-instruction-details", "").strip()
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is a drafted reminder email for your students:\n\n**Subject:** Important Class Update for Students\n\n**Body:**\nDear Students,\n\nPlease note the following update regarding our course:\n\n{details}.\n\nPlease plan accordingly and reach out if you have any questions."
            rich_data = {
                "type": "email_draft",
                "to_name": "Students",
                "purpose": "Class Update",
                "subject": "Important Class Update for Students",
                "body": f"Dear Students,\n\nPlease note the following update regarding our course:\n\n{details}.\n\nPlease plan accordingly and reach out if you have any questions."
            }
        elif "/draft-mail-type custom" in msg_lower:
            text_response = "Please type the subject of the email you would like to draft:"
        elif "type the subject of the email" in last_assistant_content:
            text_response = f'Got it. Subject will be: "{message}".\n\nWho is the recipient, and what is the main content/purpose of this email? (e.g. \'To Dean, discussing the new syllabus changes\')'
        elif "Who is the recipient, and what is the main content/purpose" in last_assistant_content:
            def find_custom_subject():
                if not history:
                    return "General Draft"
                reversed_history = list(reversed(history))
                for idx, h in enumerate(reversed_history):
                    if h.get("role") == "assistant" and "type the subject of the email" in h.get("content", ""):
                        user_msg = reversed_history[idx - 1] if idx - 1 >= 0 else {}
                        if user_msg.get("role") == "user":
                            return user_msg.get("content", "General Draft")
                return "General Draft"
            subject = find_custom_subject()
            to_name = message.split(',')[0].replace('To ', '').strip() if message.startswith('To') else 'Recipient'
            body_text = message.split(',')[1].strip() if ',' in message else message
            tool_calls.append({"name": "draft_email", "status": "success", "result": "Configured email draft helper."})
            text_response = f"Here is your custom drafted email:\n\n**Subject:** {subject}\n\n**Body:**\nDear {to_name},\n\nI hope this email finds you well.\n\nRegarding: {subject}\n\n{body_text}.\n\nThank you."
            rich_data = {
                "type": "email_draft",
                "to_name": to_name,
                "purpose": "Custom Draft",
                "subject": subject,
                "body": f"Dear {to_name},\n\nI hope this email finds you well.\n\nRegarding: {subject}\n\n{body_text}.\n\nThank you."
            }
        elif "/draft-mail" in msg_lower or msg_lower == "draft a mail" or msg_lower == "draft mail" or msg_lower == "draft an email":
            text_response = "I can help you draft a professional email. Please select one of the common subjects below or write your own subject:\n\n1. ✈️ **Leave Permission**\n2. 📢 **Instruction to Students**\n3. ✍️ **Write my own subject...**"
            rich_data = {
                "type": "interactive_choices",
                "choices": [
                    { "label": "Leave Permission", "value": "/draft-mail-type leave", "icon": "✈️" },
                    { "label": "Instruction to Students", "value": "/draft-mail-type instruction", "icon": "📢" },
                    { "label": "Write my own subject...", "value": "/draft-mail-type custom", "icon": "✍️" }
                ]
            }
        else:
            text_response = "Sorry, I couldn't follow that step in the email drafting. Please type `/draft-mail` to start over."
            
        return tool_calls, text_response, rich_data

    # 2. LESSON PLAN INTENT
    if "lesson plan" in msg_lower or "make a plan" in msg_lower:
        tool_calls.append({"name": "generate_lesson_plan", "status": "running"})
        subject_match = "Topic"
        unit_match = "1"
        try:
            llm_payload = f"Generate a detailed 50-minute lesson plan for a university level class on: {message}. Return ONLY valid JSON with keys: 'objectives' (string), 'activities' (list of dicts with 'duration', 'name', 'description'), and 'assessment' (string)."
            llm_response = llm_client.get_chat_response(llm_payload, system_prompt="You are an expert curriculum designer. Output strictly JSON.", fallback_json=True)
            plan_data = json.loads(llm_response)
            
            tool_calls[-1].update({"status": "success", "result": "Generated lesson plan."})
            text_response = f"Here is a suggested 50-minute lesson plan for **{subject_match}**."
            rich_data = {
                "type": "lesson_plan",
                "subject": subject_match,
                "unit": unit_match,
                "topic": message,
                "objectives": plan_data.get("objectives", "Understand the core concepts."),
                "activities": plan_data.get("activities", []),
                "assessment": plan_data.get("assessment", "Q&A session at the end.")
            }
            return tool_calls, text_response, rich_data
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})

    # 3. POLICY RAG INTENT
    policy_keywords = ['policy', 'rule', 'leave', 'cl', 'attendance criteria', 'condonation', 'rules', 'regulations']
    if any(k in msg_lower for k in policy_keywords):
        tool_calls.append({"name": "query_vector_db", "status": "running"})
        try:
            results = rag_pipeline.query(message, n_results=2)
            if results['documents'] and len(results['documents'][0]) > 0:
                tool_calls[-1].update({"status": "success", "result": f"Found {len(results['documents'][0])} citations."})
                citations = []
                for idx, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][idx]
                    citations.append({
                        "title": metadata.get('filename', 'Faculty Policy'),
                        "source": metadata.get('category', 'Administrative'),
                        "snippet": doc
                    })
                
                context_str = "\n\n".join([f"Source: {c['title']}\nExcerpt: {c['snippet']}" for c in citations])
                llm_payload = f"Answer the user's question based strictly on the provided policy excerpts.\n\nQuestion: {message}\n\nExcerpts:\n{context_str}"
                answer = llm_client.get_chat_response(llm_payload, system_prompt="You are an administrative policy assistant. Answer accurately based on the excerpts.")
                
                text_response = answer
                rich_data = {
                    "type": "policy",
                    "citations": citations
                }
                return tool_calls, text_response, rich_data
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})

    return None, None, None
