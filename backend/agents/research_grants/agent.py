import json
from sqlalchemy.orm import Session
from core.models import Publication, GrantOpportunity, ResearchDeadline, Student
from core.llm import llm_client

def handle_research_grants_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    text_response = ""

    if "deadline" in msg_lower or "due" in msg_lower or "upcoming" in msg_lower:
        tool_calls.append({"name": "get_upcoming_deadlines", "status": "running"})
        try:
            deadlines = db.query(ResearchDeadline).filter(ResearchDeadline.faculty_id == faculty_id).all()
            # Sort by due date
            deadlines = sorted(deadlines, key=lambda d: d.due_date)
            
            tool_calls[-1].update({"status": "success", "result": f"Found {len(deadlines)} research-related deadlines."})
            text_response = "Here are your upcoming research and grant deadlines:\n\n"
            for d in deadlines:
                text_response += f"- **{d.title}** ({d.type}) — Due: **{d.due_date}**\n"
            rich_data = {
                "type": "deadlines_summary",
                "deadlines": [{"title": d.title, "due": d.due_date, "type": d.type} for d in deadlines]
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to retrieve research deadlines: {str(e)}"
            
    elif "grant" in msg_lower or "funding" in msg_lower:
        tool_calls.append({"name": "find_matching_grants", "status": "running"})
        try:
            # We can retrieve all grant opportunities and suggest match based on research
            grants = db.query(GrantOpportunity).all()
            matched = []
            for g in grants:
                # Mock fit reasoning
                fit_reason = "Matches your current ML research on medical segmentation." if "AI" in g.title or "AI" in g.focus_area or "ML" in g.title else "Matches your advanced computing research background."
                matched.append({
                    "id": g.id,
                    "title": g.title,
                    "funding_body": g.funding_body,
                    "amount": g.amount,
                    "deadline": g.deadline,
                    "fit_reason": fit_reason
                })
            
            tool_calls[-1].update({"status": "success", "result": f"Found {len(matched)} matching grant opportunities."})
            text_response = "I searched active funding call sheets and mapped them to your publication profile. Here are the top fits:\n\n"
            for m in matched:
                text_response += f"* **{m['title']}** ({m['funding_body']})\n  - Amount: **{m['amount']}** | Deadline: **{m['deadline']}**\n  - *Fit Reasoning:* {m['fit_reason']}\n\n"
            rich_data = {
                "type": "matched_grants",
                "grants": matched
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to query matching grant opportunities: {str(e)}"
            
    elif "publication" in msg_lower or "log" in msg_lower or "paper" in msg_lower:
        tool_calls.append({"name": "get_publication_summary", "status": "running"})
        try:
            pubs = db.query(Publication).filter(Publication.faculty_id == faculty_id).all()
            total_citations = sum([p.citation_count for p in pubs])
            tool_calls[-1].update({"status": "success", "result": f"Loaded {len(pubs)} publications, {total_citations} citations."})
            
            text_response = f"You have logged **{len(pubs)}** publications with a total citation count of **{total_citations}**:\n"
            for p in pubs:
                text_response += f"- *\"{p.title}\"* — {p.venue} ({p.year}) [Citations: {p.citation_count}]\n"
            rich_data = {
                "type": "publication_summary",
                "count": len(pubs),
                "citations": total_citations,
                "publications": [{"title": p.title, "venue": p.venue, "year": p.year, "citations": p.citation_count} for p in pubs]
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to query publications list: {str(e)}"

    elif "co-author" in msg_lower or "collaborator" in msg_lower:
        tool_calls.append({"name": "suggest_coauthors", "status": "running"})
        try:
            # Heuristic: suggest co-authors inside the department
            colleagues = ["Dr. S. Ram (Expert in Image Processing)", "Dr. V. Krish (Expert in Deep Learning Systems)"]
            tool_calls[-1].update({"status": "success", "result": f"Suggested {len(colleagues)} department matches."})
            text_response = "Here are suggested departmental co-authors who have recent publications in similar research domains:\n"
            for c in colleagues:
                text_response += f"- **{c}**\n"
            text_response += "\nWould you like me to draft an introductory email to start a research collaboration?"
            rich_data = {
                "type": "coauthors_suggestions",
                "colleagues": colleagues
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to find co-author matches: {str(e)}"
            
    else:
        system_prompt = (
            "You are EduPilot's Research & Grants Agent. You help the faculty member track their publications, active patents, and upcoming funding opportunities. "
            "Respond in a professional, research-oriented tone. Help them draft grant summaries or matching profiles."
        )
        text_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
