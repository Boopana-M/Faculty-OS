import json
from sqlalchemy.orm import Session
from core.models import QuestionBankItem, QuestionPaper, Rubric, SyllabusUnit
from core.llm import llm_client

def handle_exam_assessment_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    text_response = ""

    if "question paper" in msg_lower or "generate paper" in msg_lower or "generate a paper" in msg_lower:
        tool_calls.append({"name": "generate_question_paper", "status": "running"})
        try:
            # Let's pull some questions from QuestionBankItem to simulate generation
            qb_items = db.query(QuestionBankItem).all()
            selected = []
            co_distribution = {}
            bloom_distribution = {}
            
            for q in qb_items:
                selected.append({
                    "id": q.id,
                    "question_text": q.question_text,
                    "marks": q.marks,
                    "co": q.co_number,
                    "bloom_level": q.bloom_level
                })
                # compute co distribution
                co_distribution[q.co_number] = co_distribution.get(q.co_number, 0) + q.marks
                # compute bloom distribution
                bloom_distribution[q.bloom_level] = bloom_distribution.get(q.bloom_level, 0) + q.marks

            # Normalize distributions to percentage
            total_marks_sum = sum(q["marks"] for q in selected)
            if total_marks_sum > 0:
                for k in co_distribution:
                    co_distribution[k] = int((co_distribution[k] / total_marks_sum) * 100)
                for k in bloom_distribution:
                    bloom_distribution[k] = int((bloom_distribution[k] / total_marks_sum) * 100)
            
            # Save generated paper to database
            paper = QuestionPaper(
                subject="Design & Analysis of Algorithms",
                exam_type="CAT2",
                total_marks=50,
                duration=90,
                co_coverage=json.dumps(co_distribution),
                bloom_distribution=json.dumps(bloom_distribution),
                status="draft",
                questions_json=json.dumps(selected)
            )
            db.add(paper)
            db.commit()
            db.refresh(paper)
            
            tool_calls[-1].update({"status": "success", "result": f"Generated CAT2 paper (ID: {paper.id}) hitting requested targets."})
            text_response = (
                f"I have drafted a new **CAT-2 Question Paper** for **Design & Analysis of Algorithms**:\n"
                f"- Total Marks: **50 Marks** | Duration: **90 Mins**\n"
                f"- Status: **Draft** (ID: {paper.id})\n\n"
                f"**Bloom Taxonomy Coverage:**\n"
            )
            for level, pct in bloom_distribution.items():
                text_response += f"- {level}: **{pct}%**\n"
            text_response += "\nThe drafted paper is loaded in the workspace. You can edit, remove questions, or moderate it above."
            
            rich_data = {
                "type": "question_paper_draft",
                "paper_id": paper.id,
                "subject": paper.subject,
                "exam_type": paper.exam_type,
                "total_marks": paper.total_marks,
                "duration": paper.duration,
                "co_coverage": co_distribution,
                "bloom_distribution": bloom_distribution,
                "questions": selected
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to generate question paper draft: {str(e)}"
            
    elif "rubric" in msg_lower:
        tool_calls.append({"name": "generate_rubric", "status": "running"})
        try:
            # Create a simple rubric
            rubric_criteria = [
                {"criterion": "Correctness & Logic", "max_marks": 5, "descriptor": "Complete mathematical proof of algorithm correctness."},
                {"criterion": "Asymptotic Analysis", "max_marks": 3, "descriptor": "Correct identification of worst-case and best-case runtimes."},
                {"criterion": "Formatting & Code Style", "max_marks": 2, "descriptor": "Clear pseudocode with appropriate indentation and variable names."}
            ]
            
            tool_calls[-1].update({"status": "success", "result": "Generated rubric criteria."})
            text_response = "Here is the drafted grading rubric for your assignment / question:\n\n"
            for r in rubric_criteria:
                text_response += f"- **{r['criterion']}** (Max: **{r['max_marks']} Marks**): {r['descriptor']}\n"
            
            rich_data = {
                "type": "rubric_draft",
                "criteria": rubric_criteria
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to generate rubric draft: {str(e)}"
            
    elif "moderate" in msg_lower or "approve" in msg_lower:
        tool_calls.append({"name": "moderate_paper", "status": "running"})
        try:
            paper = db.query(QuestionPaper).order_by(QuestionPaper.id.desc()).first()
            if paper:
                paper.status = "moderated"
                db.commit()
                tool_calls[-1].update({"status": "success", "result": f"Moderated paper {paper.id} successfully."})
                text_response = f"The status of Question Paper (ID: **{paper.id}**) has been updated to **Moderated**. It is ready for the department audit."
                rich_data = {
                    "type": "paper_moderation",
                    "paper_id": paper.id,
                    "status": "moderated"
                }
            else:
                tool_calls[-1].update({"status": "success", "result": "No draft paper found."})
                text_response = "I couldn't find any draft question papers in the system to moderate. Please generate a paper first!"
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to moderate question paper: {str(e)}"
            
    else:
        system_prompt = (
            "You are EduPilot's Exam & Assessment Design Agent. You help the faculty member design question papers aligned to Bloom's taxonomy and CO/PO metrics. "
            "Respond in a detailed, structured, academic tone. Focus on compliance, question banking, and rubrics."
        )
        text_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data
    }
