import json
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from core.models import QuestionBankItem, QuestionPaper, Rubric, SyllabusUnit
from core.llm import llm_client


def _co_distribution_from_questions(questions: List[Dict[str, Any]]) -> Dict[str, int]:
    distribution: Dict[str, int] = {}
    total_marks = sum(int(q.get("marks", 0)) for q in questions)
    if total_marks <= 0:
        return {"CO1": 100}

    for question in questions:
        co = question.get("co") or question.get("co_number") or "CO1"
        distribution[co] = distribution.get(co, 0) + int(question.get("marks", 0))

    for key in distribution:
        distribution[key] = int(round((distribution[key] / total_marks) * 100))

    return distribution


def _bloom_distribution_from_questions(questions: List[Dict[str, Any]]) -> Dict[str, int]:
    distribution: Dict[str, int] = {}
    total_marks = sum(int(q.get("marks", 0)) for q in questions)
    if total_marks <= 0:
        return {"Understand": 100}

    for question in questions:
        bloom = question.get("bloom_level") or "Understand"
        distribution[bloom] = distribution.get(bloom, 0) + int(question.get("marks", 0))

    for key in distribution:
        distribution[key] = int(round((distribution[key] / total_marks) * 100))

    return distribution


def _build_grounded_part_a_questions(db: Session, subject: str, target_count: int = 5) -> List[Dict[str, Any]]:
    syllabus_units = db.query(SyllabusUnit).filter(SyllabusUnit.subject == subject).all()
    questions: List[Dict[str, Any]] = []
    
    default_topics = [
        ("Asymptotic Notation", "CO1", "Remember", 1),
        ("Divide-and-Conquer strategy", "CO1", "Understand", 2),
        ("Greedy choice property", "CO2", "Remember", 2),
        ("Dynamic Programming overlap property", "CO2", "Understand", 3),
        ("NP-Completeness definition", "CO3", "Remember", 5),
    ]

    for index in range(1, target_count + 1):
        if syllabus_units and index <= len(syllabus_units):
            unit = syllabus_units[index - 1]
            topic_title = unit.title
            unit_num = unit.unit_number
            co = f"CO{min(index, 3)}"
        else:
            topic, co, _, unit_num = default_topics[(index - 1) % len(default_topics)]
            topic_title = topic

        q_templates = [
            f"Define {topic_title} and state its main applications.",
            f"List two key characteristics of {topic_title}.",
            f"Differentiate between primary components of {topic_title}.",
            f"What is the significance of {topic_title} in algorithm efficiency?",
            f"Briefly explain the basic principle behind {topic_title}."
        ]
        
        questions.append({
            "id": -index,
            "section": "Part A",
            "question_number": index,
            "question_text": q_templates[(index - 1) % len(q_templates)],
            "marks": 2,
            "co": co,
            "co_number": co,
            "bloom_level": "Remember" if index % 2 == 1 else "Understand",
            "unit": unit_num,
            "difficulty": "Easy",
            "source": "generated_part_a"
        })
    return questions


def _build_grounded_part_b_questions(db: Session, subject: str, target_count: int = 4) -> List[Dict[str, Any]]:
    syllabus_units = db.query(SyllabusUnit).filter(SyllabusUnit.subject == subject).all()
    questions: List[Dict[str, Any]] = []

    for index in range(1, target_count + 1):
        unit_num = index if index <= 5 else 1
        co = f"CO{min(index, 3)}"
        
        if syllabus_units and index <= len(syllabus_units):
            unit = syllabus_units[index - 1]
            q_text = f"Explain in detail the concept of {unit.title}. Derive its algorithmic steps and analyze its time complexity with a concrete example."
        else:
            q_texts = [
                "Explain the Divide-and-Conquer strategy. Write the algorithm for Quick Sort and analyze its best and worst-case time complexities.",
                "Describe Prim's and Kruskal's algorithms for finding the Minimum Spanning Tree. Compare their performance on dense versus sparse graphs.",
                "Solve the 0/1 Knapsack problem using Dynamic Programming for a given set of weights and values. Discuss its time-space efficiency.",
                "Explain the Backtracking approach for the 8-Queens problem. Draw the state space tree and describe the bounding function."
            ]
            q_text = q_texts[(index - 1) % len(q_texts)]

        bloom_levels = ["Apply", "Analyze", "Evaluate", "Apply"]
        questions.append({
            "id": -(index + 100),
            "section": "Part B",
            "question_number": index + 5,
            "question_text": q_text,
            "marks": 10,
            "co": co,
            "co_number": co,
            "bloom_level": bloom_levels[(index - 1) % len(bloom_levels)],
            "unit": unit_num,
            "difficulty": "Medium",
            "source": "generated_part_b"
        })
    return questions


def build_question_paper(db: Session, payload: Dict[str, Any]) -> QuestionPaper:
    subject = payload.get("subject") or "Design & Analysis of Algorithms"
    exam_type = payload.get("exam_type") or "CAT2"
    total_marks = int(payload.get("total_marks") or 50)
    duration = int(payload.get("duration") or 90)
    bloom_targets = payload.get("bloom_targets") or {}
    co_targets = payload.get("co_targets") or {"CO1": 40, "CO2": 40, "CO3": 20}

    part_a_only = payload.get("part_a_only", False)
    part_b_only = payload.get("part_b_only", False)

    if part_a_only:
        part_a_marks_target = total_marks
        part_b_marks_target = 0
    elif part_b_only:
        part_a_marks_target = 0
        part_b_marks_target = total_marks
    else:
        part_a_marks_target = 10 if total_marks <= 50 else 20
        part_b_marks_target = total_marks - part_a_marks_target

    part_a_questions_count = part_a_marks_target // 2
    part_b_questions_count = max(1, part_b_marks_target // 10) if part_b_marks_target > 0 else 0

    # Fetch bank questions for subject
    bank_items = db.query(QuestionBankItem).filter(QuestionBankItem.subject == subject).all()
    if not bank_items:
        bank_items = db.query(QuestionBankItem).all()

    selected_part_a: List[Dict[str, Any]] = []
    selected_part_b: List[Dict[str, Any]] = []

    def score_item(item: QuestionBankItem) -> int:
        return int(co_targets.get(item.co_number, 0)) + int(bloom_targets.get(item.bloom_level, 0))

    sorted_bank = sorted(bank_items, key=score_item, reverse=True)

    if part_a_marks_target > 0:
        for item in sorted_bank:
            if item.marks == 2 and len(selected_part_a) < part_a_questions_count:
                selected_part_a.append({
                    "id": item.id,
                    "section": "Part A",
                    "question_number": len(selected_part_a) + 1,
                    "question_text": item.question_text,
                    "marks": 2,
                    "co": item.co_number,
                    "co_number": item.co_number,
                    "bloom_level": item.bloom_level,
                    "unit": item.unit,
                    "difficulty": item.difficulty,
                    "source": "bank"
                })
        if len(selected_part_a) < part_a_questions_count:
            needed_a = part_a_questions_count - len(selected_part_a)
            generated_a = _build_grounded_part_a_questions(db, subject, target_count=needed_a)
            for q in generated_a:
                q["question_number"] = len(selected_part_a) + 1
                selected_part_a.append(q)

    if part_b_marks_target > 0:
        for item in sorted_bank:
            if item.marks >= 10 and len(selected_part_b) < part_b_questions_count:
                selected_part_b.append({
                    "id": item.id,
                    "section": "Part B",
                    "question_number": len(selected_part_b) + 1,
                    "question_text": item.question_text,
                    "marks": int(item.marks),
                    "co": item.co_number,
                    "co_number": item.co_number,
                    "bloom_level": item.bloom_level,
                    "unit": item.unit,
                    "difficulty": item.difficulty,
                    "source": "bank"
                })
        if len(selected_part_b) < part_b_questions_count:
            needed_b = part_b_questions_count - len(selected_part_b)
            generated_b = _build_grounded_part_b_questions(db, subject, target_count=needed_b)
            for q in generated_b:
                q["question_number"] = len(selected_part_b) + 1
                selected_part_b.append(q)

    # Re-index all question numbers sequentially
    all_questions = []
    q_num = 1
    for q in selected_part_a:
        q["question_number"] = q_num
        q["section"] = "Part A"
        all_questions.append(q)
        q_num += 1

    for q in selected_part_b:
        q["question_number"] = q_num
        q["section"] = "Part B"
        all_questions.append(q)
        q_num += 1

    co_distribution = _co_distribution_from_questions(all_questions)
    bloom_distribution = _bloom_distribution_from_questions(all_questions)

    paper = QuestionPaper(
        subject=subject,
        exam_type=exam_type,
        total_marks=total_marks,
        duration=duration,
        co_coverage=json.dumps(co_distribution),
        bloom_distribution=json.dumps(bloom_distribution),
        status="draft",
        questions_json=json.dumps(all_questions),
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    return paper


def build_rubric(db: Session, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    paper_id = payload.get("paper_id")
    paper = None
    if paper_id:
        paper = db.query(QuestionPaper).filter(QuestionPaper.id == paper_id).first()

    total_marks = int((paper.total_marks if paper else payload.get("total_marks") or 50))
    criteria = [
        {
            "criterion": "Conceptual Accuracy (Part A & B)",
            "max_marks": max(2, int(round(total_marks * 0.35))),
            "descriptor": "Correct interpretation of question definitions, principles, and accurate academic framing.",
        },
        {
            "criterion": "Application & Analytical Reasoning",
            "max_marks": max(2, int(round(total_marks * 0.30))),
            "descriptor": "Clear problem-solving steps, algorithmic derivation, and evidence of applied knowledge.",
        },
        {
            "criterion": "Structure & Technical Presentation",
            "max_marks": max(2, int(round(total_marks * 0.20))),
            "descriptor": "Well-structured answers, diagrams, mathematical formulas, and readable organization.",
        },
        {
            "criterion": "Completeness & CO Compliance",
            "max_marks": max(2, int(round(total_marks * 0.15))),
            "descriptor": "Addresses all parts of questions and aligns with stated CO and Bloom taxonomy levels.",
        },
    ]

    rubric_record = Rubric(
        question_paper_id=paper.id if paper else None,
        assignment_id=None,
        criteria=json.dumps(criteria),
    )
    db.add(rubric_record)
    db.commit()
    return criteria


def update_question_paper_status(db: Session, paper_id: int, status: str) -> QuestionPaper:
    paper = db.query(QuestionPaper).filter(QuestionPaper.id == paper_id).first()
    if not paper:
        raise ValueError("Question paper not found")
    paper.status = status
    db.commit()
    db.refresh(paper)
    return paper


def create_question_bank_item(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
    item = QuestionBankItem(
        subject=payload.get("subject") or "Design & Analysis of Algorithms",
        unit=int(payload.get("unit") or 1),
        co_number=payload.get("co_number") or "CO1",
        bloom_level=payload.get("bloom_level") or "Understand",
        question_text=payload.get("question_text") or "New assessment question",
        marks=int(payload.get("marks") or 10),
        difficulty=payload.get("difficulty") or "Medium",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "subject": item.subject,
        "unit": item.unit,
        "co_number": item.co_number,
        "bloom_level": item.bloom_level,
        "question_text": item.question_text,
        "marks": item.marks,
        "difficulty": item.difficulty,
    }


def update_question_bank_item(db: Session, question_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    item = db.query(QuestionBankItem).filter(QuestionBankItem.id == question_id).first()
    if not item:
        raise ValueError("Question not found")

    item.subject = payload.get("subject", item.subject)
    item.unit = int(payload.get("unit", item.unit))
    item.co_number = payload.get("co_number", item.co_number)
    item.bloom_level = payload.get("bloom_level", item.bloom_level)
    item.question_text = payload.get("question_text", item.question_text)
    item.marks = int(payload.get("marks", item.marks))
    item.difficulty = payload.get("difficulty", item.difficulty)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "subject": item.subject,
        "unit": item.unit,
        "co_number": item.co_number,
        "bloom_level": item.bloom_level,
        "question_text": item.question_text,
        "marks": item.marks,
        "difficulty": item.difficulty,
    }


def delete_question_bank_item(db: Session, question_id: int) -> None:
    item = db.query(QuestionBankItem).filter(QuestionBankItem.id == question_id).first()
    if item:
        db.delete(item)
        db.commit()


def serialize_paper(paper: QuestionPaper) -> Dict[str, Any]:
    questions = []
    if paper.questions_json:
        try:
            questions = json.loads(paper.questions_json)
        except json.JSONDecodeError:
            questions = []

    part_a = [q for q in questions if q.get("section") == "Part A"]
    part_b = [q for q in questions if q.get("section") == "Part B"]
    
    # Fallback categorization if section tag is missing
    if not part_a and not part_b:
        part_a = [q for q in questions if q.get("marks", 0) <= 5]
        part_b = [q for q in questions if q.get("marks", 0) > 5]

    return {
        "id": paper.id,
        "subject": paper.subject,
        "exam_type": paper.exam_type,
        "total_marks": paper.total_marks,
        "duration": paper.duration,
        "co_coverage": json.loads(paper.co_coverage) if paper.co_coverage else {},
        "bloom_distribution": json.loads(paper.bloom_distribution) if paper.bloom_distribution else {},
        "status": paper.status,
        "questions": questions,
        "part_a": part_a,
        "part_b": part_b,
    }


def validate_co_po_mapping(db: Session, paper_id: int) -> Dict[str, Any]:
    paper = db.query(QuestionPaper).filter(QuestionPaper.id == paper_id).first()
    if not paper:
        raise ValueError("Question paper not found")

    coverage = json.loads(paper.co_coverage or "{}")
    required = {"CO1": 40, "CO2": 40, "CO3": 20}
    gaps = []
    for co, target in required.items():
        attained = coverage.get(co, 0)
        if attained < target:
            gaps.append({"co": co, "target": target, "attained": attained})

    return {
        "paper_id": paper.id,
        "subject": paper.subject,
        "status": "pass" if not gaps else "needs-review",
        "required": required,
        "attained": coverage,
        "gaps": gaps,
    }


def moderate_paper(db: Session, paper_id: int, moderator_notes: str | None = None, status: str = "moderated") -> QuestionPaper:
    paper = db.query(QuestionPaper).filter(QuestionPaper.id == paper_id).first()
    if not paper:
        raise ValueError("Question paper not found")
    paper.status = status
    if moderator_notes:
        paper.moderator_notes = moderator_notes
    db.commit()
    db.refresh(paper)
    return paper


def update_question_paper(db: Session, paper_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    paper = db.query(QuestionPaper).filter(QuestionPaper.id == paper_id).first()
    if not paper:
        raise ValueError("Question paper not found")

    if "questions" in payload:
        paper.questions_json = json.dumps(payload["questions"])
        # Update CO and Bloom distributions
        paper.co_coverage = json.dumps(_co_distribution_from_questions(payload["questions"]))
        paper.bloom_distribution = json.dumps(_bloom_distribution_from_questions(payload["questions"]))
    if "status" in payload:
        paper.status = payload["status"]
    if "subject" in payload:
        paper.subject = payload["subject"]
    if "exam_type" in payload:
        paper.exam_type = payload["exam_type"]
    if "total_marks" in payload:
        paper.total_marks = int(payload["total_marks"])
    if "duration" in payload:
        paper.duration = int(payload["duration"])
    if "moderator_notes" in payload:
        paper.moderator_notes = payload["moderator_notes"]

    db.commit()
    db.refresh(paper)
    return serialize_paper(paper)


def handle_exam_assessment_chat(message: str, faculty_id: int, db: Session, history: list = None):
    msg_lower = message.lower()
    tool_calls = []
    rich_data = None
    text_response = ""

    if any(k in msg_lower for k in ["question paper", "generate paper", "generate a paper", "exam paper", "create paper", "part a", "part b"]):
        tool_calls.append({"name": "generate_question_paper", "status": "running"})
        try:
            subject = "Machine Learning" if ("ml" in msg_lower or "machine learning" in msg_lower) else "Design & Analysis of Algorithms"
            exam_type = "CAT1" if "cat1" in msg_lower or "cat 1" in msg_lower else ("Semester" if "semester" in msg_lower or "end sem" in msg_lower else "CAT2")
            total_marks = 100 if "100" in msg_lower else 50
            duration = 180 if total_marks == 100 else 90

            part_a_only = "part a only" in msg_lower or "only part a" in msg_lower or "part-a only" in msg_lower
            part_b_only = "part b only" in msg_lower or "only part b" in msg_lower or "part-b only" in msg_lower

            paper = build_question_paper(db, {
                "subject": subject,
                "exam_type": exam_type,
                "total_marks": total_marks,
                "duration": duration,
                "part_a_only": part_a_only,
                "part_b_only": part_b_only,
                "co_targets": {"CO1": 40, "CO2": 40, "CO3": 20},
                "bloom_targets": {"Remember": 20, "Understand": 30, "Apply": 30, "Analyze": 20},
            })

            serialized = serialize_paper(paper)
            tool_calls[-1].update({"status": "success", "result": f"Generated official {exam_type} paper (ID: {paper.id}) for {subject}."})

            part_a_list = serialized["part_a"]
            part_b_list = serialized["part_b"]

            text_response = (
                f"### 🎓 Assessment Advisor Response — Question Paper Created\n"
                f"**SRI ESHWAR COLLEGE OF ENGINEERING (AUTONOMOUS)**\n"
                f"Department of Computer Science and Engineering\n\n"
                f"Drafted **{exam_type} Question Paper** for **{subject}** ({paper.total_marks} Marks, {paper.duration} Mins):\n\n"
            )

            if part_a_list:
                sum_a = sum(int(q.get("marks", 2)) for q in part_a_list)
                text_response += f"#### **PART A — ({len(part_a_list)} Questions: Total {sum_a} Marks)**\n"
                for idx, q in enumerate(part_a_list, start=1):
                    text_response += f"{idx}. {q['question_text']} `[{q.get('marks', 2)} Marks]` `[{q.get('co', 'CO1')}]` `[{q.get('bloom_level', 'Remember')}]`\n"

            if part_b_list:
                sum_b = sum(int(q.get("marks", 10)) for q in part_b_list)
                text_response += f"\n#### **PART B — ({len(part_b_list)} Questions: Total {sum_b} Marks)**\n"
                start_b_idx = len(part_a_list) + 1 if part_a_list else 1
                for idx, q in enumerate(part_b_list, start=start_b_idx):
                    text_response += f"{idx}. {q['question_text']} `[{q.get('marks', 10)} Marks]` `[{q.get('co', 'CO2')}]` `[{q.get('bloom_level', 'Apply')}]`\n"

            text_response += (
                "\n---\n"
                "✅ The Question Paper is now fully editable in your workspace! You can edit question text, marks, CO/Bloom levels, add/remove questions, and print."
            )
            rich_data = {
                "type": "question_paper_draft",
                "paper_id": paper.id,
                "subject": paper.subject,
                "exam_type": paper.exam_type,
                "total_marks": paper.total_marks,
                "duration": paper.duration,
                "co_coverage": json.loads(paper.co_coverage or "{}"),
                "bloom_distribution": json.loads(paper.bloom_distribution or "{}"),
                "questions": serialized["questions"],
                "part_a": part_a_list,
                "part_b": part_b_list,
            }
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to generate question paper draft: {str(e)}"

    elif "rubric" in msg_lower:
        tool_calls.append({"name": "generate_rubric", "status": "running"})
        try:
            rubric_criteria = build_rubric(db, {"total_marks": 50})
            tool_calls[-1].update({"status": "success", "result": "Generated rubric criteria."})
            text_response = "Here is the Assessment Advisor drafted grading rubric for Part A and Part B evaluation:\n\n"
            for criterion in rubric_criteria:
                text_response += f"- **{criterion['criterion']}** (Max: **{criterion['max_marks']} Marks**): {criterion['descriptor']}\n"
            rich_data = {"type": "rubric_draft", "criteria": rubric_criteria}
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to generate rubric draft: {str(e)}"

    elif "moderate" in msg_lower or "approve" in msg_lower:
        tool_calls.append({"name": "moderate_paper", "status": "running"})
        try:
            paper = db.query(QuestionPaper).order_by(QuestionPaper.id.desc()).first()
            if paper:
                note_text = "Moderated through the exam assessment workflow."
                if "notes" in msg_lower:
                    note_text = message.split("notes", 1)[-1].strip() or note_text
                paper = moderate_paper(db, paper.id, note_text, "moderated")
                tool_calls[-1].update({"status": "success", "result": f"Moderated paper {paper.id} successfully."})
                text_response = f"The status of Question Paper (ID: **{paper.id}**) has been updated to **MODERATED**. It is ready for NBA accreditation audit."
                rich_data = {"type": "paper_moderation", "paper_id": paper.id, "status": "moderated", "moderator_notes": paper.moderator_notes}
            else:
                tool_calls[-1].update({"status": "success", "result": "No draft paper found."})
                text_response = "I couldn't find any draft question papers in the system to moderate. Please generate a paper first!"
        except Exception as e:
            tool_calls[-1].update({"status": "error", "error": str(e)})
            text_response = f"Failed to moderate question paper: {str(e)}"

    else:
        system_prompt = (
            "You are EduPilot's Assessment Advisor Chat Agent for Sri Eshwar College of Engineering. You advise faculty members on setting high-quality, Bloom's-aligned question papers, CO/PO mapping, rubrics, and moderation. "
            "Respond in a helpful, structured, academic tone. Format question paper suggestions with clear Part A (Short Answer) and Part B (Descriptive) sections."
        )
        text_response = llm_client.get_chat_response(system_prompt, [{"role": "user", "content": message}])

    return {
        "text": text_response,
        "tool_calls": tool_calls,
        "rich_data": rich_data,
    }
