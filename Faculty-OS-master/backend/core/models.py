import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from .database import Base

class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)

    timetables = relationship("Timetable", back_populates="faculty")

class Timetable(Base):
    __tablename__ = "timetable"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    day_of_week = Column(String, nullable=False)  # Monday, Tuesday, etc.
    period = Column(String, nullable=False)        # 9:00 - 10:00, 10:00 - 11:00, etc.
    subject = Column(String, nullable=False)
    class_section = Column(String, nullable=False)  # CSE-A, CSE-B, etc.
    room = Column(String, nullable=False)

    faculty = relationship("Faculty", back_populates="timetables")

class SyllabusUnit(Base):
    __tablename__ = "syllabus_unit"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, index=True, nullable=False)
    unit_number = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    topics = Column(Text, nullable=False)
    pdf_url = Column(String, nullable=True)

class PolicyDocument(Base):
    __tablename__ = "policy_document"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Academic, Leave, Exam, etc.
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

class Student(Base):
    __tablename__ = "student"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True, nullable=True)
    roll_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    class_section = Column(String, nullable=False)
    mentor_faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=True)
    email = Column(String, nullable=False)

class AttendanceRecord(Base):
    __tablename__ = "attendance_record"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False)
    date = Column(String, nullable=False)
    status = Column(String, nullable=False)  # "Present" or "Absent"
    period = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    class_section = Column(String, nullable=False)

class Assignment(Base):
    __tablename__ = "assignment"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    class_section = Column(String, nullable=False)
    due_date = Column(String, nullable=False)
    max_marks = Column(Integer, default=100)
    status = Column(String, default="Open")  # "Scheduled", "Open", "Grading", "Closed"

class Submission(Base):
    __tablename__ = "submission"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignment.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False)
    submitted_at = Column(String, nullable=False)
    marks_obtained = Column(Integer, nullable=True)
    status = Column(String, default="Submitted")  # "Submitted", "Graded"

class InternalMark(Base):
    __tablename__ = "internal_mark"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False)
    subject = Column(String, nullable=False)
    cat1_marks = Column(Integer, nullable=True)
    cat2_marks = Column(Integer, nullable=True)
    assignment_marks = Column(Integer, nullable=True)
    lab_marks = Column(Integer, nullable=True)
    total_marks = Column(Integer, nullable=True)
    attendance_percentage = Column(Integer, nullable=True)

class COAttainment(Base):
    __tablename__ = "co_attainment"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    co_number = Column(String, nullable=False)  # "CO1", "CO2", etc.
    target_percentage = Column(Integer, nullable=False)
    attained_percentage = Column(Integer, nullable=False)

class FacultyWorkload(Base):
    __tablename__ = "faculty_workload"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    subject = Column(String, nullable=False)
    weekly_hours = Column(Integer, nullable=False)
    role = Column(String, nullable=False)  # "Lecture", "Lab", "Coordinator"

class Publication(Base):
    __tablename__ = "publication"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    title = Column(String, nullable=False)
    venue = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "journal", "conference", "patent"
    year = Column(Integer, nullable=False)
    co_authors = Column(String, nullable=True)
    doi_or_link = Column(String, nullable=True)
    citation_count = Column(Integer, default=0)

class GrantOpportunity(Base):
    __tablename__ = "grant_opportunity"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    funding_body = Column(String, nullable=False)
    amount = Column(String, nullable=False)
    eligibility = Column(String, nullable=False)
    deadline = Column(String, nullable=False)
    focus_area = Column(String, nullable=False)

class ResearchDeadline(Base):
    __tablename__ = "research_deadline"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    type = Column(String, nullable=False)  # "submission", "review", "renewal"
    title = Column(String, nullable=False)
    due_date = Column(String, nullable=False)
    related_publication_id = Column(Integer, ForeignKey("publication.id"), nullable=True)

class QuestionBankItem(Base):
    __tablename__ = "question_bank_item"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    unit = Column(Integer, nullable=False)
    co_number = Column(String, nullable=False)
    bloom_level = Column(String, nullable=False)  # Remember, Understand, Apply, Analyze, Evaluate, Create
    question_text = Column(Text, nullable=False)
    marks = Column(Integer, nullable=False)
    difficulty = Column(String, nullable=False)  # Easy, Medium, Hard

class QuestionPaper(Base):
    __tablename__ = "question_paper"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    exam_type = Column(String, nullable=False)  # CAT1, CAT2, Semester
    total_marks = Column(Integer, nullable=False)
    duration = Column(Integer, nullable=False)
    co_coverage = Column(Text, nullable=True)  # JSON string
    bloom_distribution = Column(Text, nullable=True)  # JSON string
    status = Column(String, default="draft")  # draft, moderated, final
    questions_json = Column(Text, nullable=True)  # JSON string of questions
    moderator_notes = Column(Text, nullable=True)  # JSON/string notes for review

class Rubric(Base):
    __tablename__ = "rubric"

    id = Column(Integer, primary_key=True, index=True)
    question_paper_id = Column(Integer, ForeignKey("question_paper.id"), nullable=True)
    assignment_id = Column(Integer, ForeignKey("assignment.id"), nullable=True)
    criteria = Column(Text, nullable=False)  # JSON string

class Mentee(Base):
    __tablename__ = "mentee"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"), unique=True, nullable=False)
    mentor_faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    class_section = Column(String, nullable=False)
    last_checkin_date = Column(String, nullable=True)

class CheckIn(Base):
    __tablename__ = "check_in"

    id = Column(Integer, primary_key=True, index=True)
    mentee_id = Column(Integer, ForeignKey("mentee.id"), nullable=False)
    date = Column(String, nullable=False)
    mode = Column(String, nullable=False)  # in-person, call, chat
    notes = Column(Text, nullable=False)
    mood_tag = Column(String, nullable=False)  # doing well, needs attention, concerning

class Escalation(Base):
    __tablename__ = "escalation"

    id = Column(Integer, primary_key=True, index=True)
    mentee_id = Column(Integer, ForeignKey("mentee.id"), nullable=False)
    raised_by = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    reason = Column(Text, nullable=False)
    escalated_to = Column(String, nullable=False)
    status = Column(String, default="open")  # open, in-progress, resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MentorTask(Base):
    __tablename__ = "mentor_task"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="active") # active, closed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TaskAcknowledgement(Base):
    __tablename__ = "task_acknowledgement"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("mentor_task.id"), nullable=False)
    mentee_id = Column(Integer, ForeignKey("mentee.id"), nullable=False)
    status = Column(String, default="pending") # pending, completed
    completed_at = Column(DateTime, nullable=True)

class FutureNote(Base):
    __tablename__ = "future_note"

    id = Column(Integer, primary_key=True, index=True)
    mentee_id = Column(Integer, ForeignKey("mentee.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# ==========================================
# AGENT 7: PLACEMENT & INTERNSHIPS
# ==========================================
class PlacementDrive(Base):
    __tablename__ = "placement_drive"
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    date = Column(String, nullable=False)
    eligibility = Column(String, nullable=True)
    status = Column(String, default="upcoming") # upcoming, completed

class Internship(Base):
    __tablename__ = "internship"
    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    duration_months = Column(Integer, nullable=False)
    stipend = Column(String, nullable=True)
    status = Column(String, default="active") # active, completed

# ==========================================
# AGENT 8: ALUMNI RELATIONS
# ==========================================
class Alumni(Base):
    __tablename__ = "alumni"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    graduation_year = Column(Integer, nullable=False)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    email = Column(String, nullable=True)

class DonationLedger(Base):
    __tablename__ = "donation_ledger"
    id = Column(Integer, primary_key=True, index=True)
    alumni_id = Column(Integer, ForeignKey("alumni.id"), nullable=False)
    amount = Column(Float, nullable=False)
    purpose = Column(String, nullable=False)
    date = Column(String, nullable=False)

# ==========================================
# AGENT 9: EVENT & COMMITTEE MANAGEMENT
# ==========================================
class Event(Base):
    __tablename__ = "event"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # FDP, Symposium, Conference
    date = Column(String, nullable=False)
    budget_allocated = Column(Float, default=0.0)
    budget_spent = Column(Float, default=0.0)
    status = Column(String, default="planned") # planned, completed

class CommitteeTask(Base):
    __tablename__ = "committee_task"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("event.id"), nullable=False)
    description = Column(Text, nullable=False)
    assigned_to = Column(String, nullable=False)
    status = Column(String, default="pending") # pending, done

# ==========================================
# AGENT 10: INVENTORY & RESOURCES
# ==========================================
class LabAsset(Base):
    __tablename__ = "lab_asset"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # Equipment, Computer
    status = Column(String, default="active") # active, repair
    last_maintenance_date = Column(String, nullable=True)

class SoftwareLicense(Base):
    __tablename__ = "software_license"
    id = Column(Integer, primary_key=True, index=True)
    software_name = Column(String, nullable=False)
    keys_total = Column(Integer, default=1)
    keys_used = Column(Integer, default=0)
    expiry_date = Column(String, nullable=False)

class BookRequisition(Base):
    __tablename__ = "book_requisition"
    id = Column(Integer, primary_key=True, index=True)
    book_title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    copies_needed = Column(Integer, default=1)
    status = Column(String, default="pending") # pending, ordered
