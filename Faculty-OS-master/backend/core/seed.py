from sqlalchemy.orm import Session
from .models import (
    Faculty, Timetable, SyllabusUnit, PolicyDocument, Student,
    AttendanceRecord, Assignment, Submission, InternalMark,
    COAttainment, FacultyWorkload, Publication, GrantOpportunity,
    ResearchDeadline, QuestionBankItem, QuestionPaper, Rubric,
    Mentee, CheckIn, Escalation, MentorTask, TaskAcknowledgement,
    FutureNote, PlacementDrive, Internship, Alumni, DonationLedger,
    Event, CommitteeTask, LabAsset, SoftwareLicense, BookRequisition
)
from .database import engine, Base
from .auth import get_password_hash
from rag.rag_pipeline import rag_pipeline
import datetime

def seed_database(db: Session):
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)

    # Check if demo faculty exists
    demo_email = "demo@faculty.edu"
    faculty = db.query(Faculty).filter(Faculty.email == demo_email).first()
    
    if faculty:
        # Check if student is seeded, if yes, skip main seed but do RAG
        student_count = db.query(Student).count()
        if student_count > 0:
            print("Database already seeded with student data.")
            seed_rag_policies(db)
            return

    print("Seeding database with full 6-agent MVP data...")
    
    # Clean-up to prevent duplicates if partially seeded
    db.query(Escalation).delete()
    db.query(CheckIn).delete()
    db.query(Mentee).delete()
    db.query(Rubric).delete()
    db.query(QuestionPaper).delete()
    db.query(QuestionBankItem).delete()
    db.query(ResearchDeadline).delete()
    db.query(GrantOpportunity).delete()
    db.query(Publication).delete()
    db.query(FacultyWorkload).delete()
    db.query(COAttainment).delete()
    db.query(InternalMark).delete()
    db.query(Submission).delete()
    db.query(Assignment).delete()
    db.query(AttendanceRecord).delete()
    db.query(Student).delete()
    db.query(SyllabusUnit).delete()
    db.query(Timetable).delete()
    db.query(PolicyDocument).delete()
    if not faculty:
        db.query(Faculty).delete()
    db.commit()
    
    # 1. Create Faculty (if not exists)
    if not faculty:
        faculty = Faculty(
            name="Preethi R",
            email=demo_email,
            department="Computer Science & Engineering",
            designation="Professor & Head",
            password_hash=get_password_hash("demo1234")
        )
        db.add(faculty)
        db.commit()
        db.refresh(faculty)

    # 2. Create Timetable
    timetable_entries = [
        # Monday
        Timetable(faculty_id=faculty.id, day_of_week="Monday", period="09:00 - 10:00", subject="Design & Analysis of Algorithms", class_section="CSE-A", room="LH-201"),
        Timetable(faculty_id=faculty.id, day_of_week="Monday", period="11:30 - 12:30", subject="Machine Learning", class_section="CSE-B", room="LH-302"),
        # Tuesday
        Timetable(faculty_id=faculty.id, day_of_week="Tuesday", period="10:00 - 11:00", subject="Design & Analysis of Algorithms", class_section="CSE-A", room="LH-201"),
        Timetable(faculty_id=faculty.id, day_of_week="Tuesday", period="14:00 - 15:30", subject="Machine Learning Lab", class_section="CSE-B", room="Lab-3"),
        # Wednesday
        Timetable(faculty_id=faculty.id, day_of_week="Wednesday", period="09:00 - 10:00", subject="Compiler Design", class_section="CSE-A", room="LH-203"),
        Timetable(faculty_id=faculty.id, day_of_week="Wednesday", period="11:30 - 12:30", subject="Design & Analysis of Algorithms", class_section="CSE-A", room="LH-201"),
        # Thursday
        Timetable(faculty_id=faculty.id, day_of_week="Thursday", period="10:00 - 11:00", subject="Machine Learning", class_section="CSE-B", room="LH-302"),
        Timetable(faculty_id=faculty.id, day_of_week="Thursday", period="14:00 - 15:00", subject="Compiler Design", class_section="CSE-A", room="LH-203"),
        # Friday
        Timetable(faculty_id=faculty.id, day_of_week="Friday", period="09:00 - 10:00", subject="Compiler Design", class_section="CSE-A", room="LH-203"),
        Timetable(faculty_id=faculty.id, day_of_week="Friday", period="11:30 - 12:30", subject="Machine Learning", class_section="CSE-B", room="LH-302"),
    ]
    
    for entry in timetable_entries:
        db.add(entry)

    # 3. Create Syllabus Units
    syllabus_units = [
        SyllabusUnit(
            subject="Design & Analysis of Algorithms",
            unit_number=1,
            title="Introduction to Algorithms",
            topics="Algorithm specification, asymptotic notations (Big O, Omega, Theta), mathematical analysis of non-recursive and recursive algorithms, recurrence relations, Master Theorem.",
            pdf_url="/syllabus/daa_unit1.pdf"
        ),
        SyllabusUnit(
            subject="Design & Analysis of Algorithms",
            unit_number=2,
            title="Divide-and-Conquer and Greedy Method",
            topics="Binary search, Merge sort, Quick sort, Strassen's matrix multiplication. Greedy Method: General method, Knapsack problem, Job sequencing with deadlines, Minimum cost spanning trees (Prim's and Kruskal's), Optimal merge patterns, Single source shortest paths (Dijkstra's).",
            pdf_url="/syllabus/daa_unit2.pdf"
        ),
        SyllabusUnit(
            subject="Design & Analysis of Algorithms",
            unit_number=3,
            title="Dynamic Programming",
            topics="General method, Multistage graphs, All pairs shortest paths (Floyd-Warshall), Single source shortest paths (Bellman-Ford), Optimal binary search trees, 0/1 Knapsack problem, Reliability design, Traveling salesperson problem.",
            pdf_url="/syllabus/daa_unit3.pdf"
        ),
        SyllabusUnit(
            subject="Design & Analysis of Algorithms",
            unit_number=4,
            title="Backtracking and Branch-and-Bound",
            topics="Backtracking: General method, 8-Queens problem, Sum of subsets, Graph coloring, Hamiltonian cycles. Branch-and-Bound: General method, 0/1 Knapsack problem, Traveling salesperson problem.",
            pdf_url="/syllabus/daa_unit4.pdf"
        ),
        SyllabusUnit(
            subject="Design & Analysis of Algorithms",
            unit_number=5,
            title="NP-Hard and NP-Complete Problems",
            topics="Basic concepts: Non-deterministic algorithms, NP-Hard and NP-Complete classes, Cook's theorem. Decision and Optimization problems, approximation algorithms for Knapsack and TSP.",
            pdf_url="/syllabus/daa_unit5.pdf"
        ),
        SyllabusUnit(
            subject="Machine Learning",
            unit_number=1,
            title="Introduction & Supervised Learning",
            topics="Definition of learning systems, goals and applications, aspects of supervised learning. Linear Regression, Logistic Regression, Gradient Descent optimization, Regularization (L1, L2).",
            pdf_url="/syllabus/ml_unit1.pdf"
        ),
        SyllabusUnit(
            subject="Machine Learning",
            unit_number=2,
            title="Decision Trees & Naive Bayes",
            topics="Decision tree representation, entropy, information gain, ID3 and C4.5 algorithms. Generative vs Discriminative models, Naive Bayes classifier, Laplace smoothing, Bayesian networks.",
            pdf_url="/syllabus/ml_unit2.pdf"
        ),
        SyllabusUnit(
            subject="Machine Learning",
            unit_number=3,
            title="Neural Networks & Deep Learning",
            topics="Perceptron learning rule, Multilayer Perceptrons, Backpropagation algorithm. Activation functions (ReLU, Sigmoid, Tanh). Introduction to Convolutional Neural Networks (CNNs).",
            pdf_url="/syllabus/ml_unit3.pdf"
        ),
    ]

    for unit in syllabus_units:
        db.add(unit)

    # 4. Create Policy Documents
    policies = [
        PolicyDocument(
            title="Faculty Leave Policy Guidelines 2026",
            category="Leave",
            file_path="policies/leave_policy_2026.txt"
        ),
        PolicyDocument(
            title="Internal Assessment Grading Policy",
            category="Academic",
            file_path="policies/grading_policy.txt"
        ),
        PolicyDocument(
            title="Student Attendance and Exam Policy",
            category="Exam",
            file_path="policies/attendance_policy.txt"
        )
    ]

    for policy in policies:
        db.add(policy)

    # 5. Create Students
    students_data = [
        {"roll_no": "24CC001", "name": "A. Kumar", "class_section": "CSE-A", "email": "kumar.a@student.edu"},
        {"roll_no": "24CC002", "name": "B. Priya", "class_section": "CSE-A", "email": "priya.b@student.edu"},
        {"roll_no": "24CC003", "name": "C. Dinesh", "class_section": "CSE-A", "email": "dinesh.c@student.edu"},
        {"roll_no": "24CC004", "name": "D. Ezhil", "class_section": "CSE-A", "email": "ezhil.d@student.edu"},
        {"roll_no": "24CC005", "name": "E. Farhan", "class_section": "CSE-A", "email": "farhan.e@student.edu"},
        {"roll_no": "24CC006", "name": "F. Gowri", "class_section": "CSE-B", "email": "gowri.f@student.edu"},
        {"roll_no": "24CC007", "name": "G. Hari", "class_section": "CSE-B", "email": "hari.g@student.edu"},
        {"roll_no": "24CC008", "name": "H. Indhu", "class_section": "CSE-B", "email": "indhu.h@student.edu"},
    ]
    
    students = []
    for s in students_data:
        student = Student(
            roll_no=s["roll_no"],
            name=s["name"],
            class_section=s["class_section"],
            mentor_faculty_id=faculty.id,
            email=s["email"]
        )
        db.add(student)
        students.append(student)
    db.commit()

    # Refresh students to get IDs
    for s in students:
        db.refresh(s)

    # 6. Create Assignments
    assignments = [
        Assignment(title="Assignment 1: Divide & Conquer Analysis", subject="Design & Analysis of Algorithms", class_section="CSE-A", due_date="2026-07-20", max_marks=10, status="Graded"),
        Assignment(title="Assignment 2: Greedy Knapsack & Prim's", subject="Design & Analysis of Algorithms", class_section="CSE-A", due_date="2026-08-05", max_marks=10, status="Open"),
        Assignment(title="Assignment 3: Neural Net Backpropagation", subject="Machine Learning", class_section="CSE-B", due_date="2026-08-10", max_marks=20, status="Open"),
    ]
    for a in assignments:
        db.add(a)
    db.commit()
    for a in assignments:
        db.refresh(a)

    # 7. Create Submissions and Attendance records
    dates = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"]
    
    # Ingesting mock attendance for CSE-A DAA (Preethi R teaches it)
    for s in students:
        if s.class_section == "CSE-A":
            # Graded submissions for Assignment 1
            sub1 = Submission(
                assignment_id=assignments[0].id,
                student_id=s.id,
                submitted_at="2026-07-19 14:32:00",
                marks_obtained=8 if s.roll_no == "24CC001" else (10 if s.roll_no == "24CC002" else 7),
                status="Graded"
            )
            db.add(sub1)
            
            # Pending or submitted for Assignment 2
            if s.roll_no != "24CC001":  # Kumar hasn't submitted yet
                sub2 = Submission(
                    assignment_id=assignments[1].id,
                    student_id=s.id,
                    submitted_at="2026-07-26 10:15:00",
                    marks_obtained=None,
                    status="Submitted"
                )
                db.add(sub2)

            # Attendance records
            # Kumar (24CC001) is absent on 23rd, 24th, and 26th to represent low attendance (40% attendance)
            # Dinesh (24CC003) is absent on 25th (80%)
            # Others have 100%
            for d in dates:
                status = "Present"
                if s.roll_no == "24CC001" and d in ["2026-07-23", "2026-07-24", "2026-07-26"]:
                    status = "Absent"
                elif s.roll_no == "24CC003" and d == "2026-07-25":
                    status = "Absent"
                
                rec = AttendanceRecord(
                    student_id=s.id,
                    date=d,
                    status=status,
                    period="09:00 - 10:00",
                    subject="Design & Analysis of Algorithms",
                    class_section="CSE-A"
                )
                db.add(rec)
        else:
            # CSE-B ML
            for d in dates:
                rec = AttendanceRecord(
                    student_id=s.id,
                    date=d,
                    status="Present",
                    period="11:30 - 12:30",
                    subject="Machine Learning",
                    class_section="CSE-B"
                )
                db.add(rec)

    # 8. Create Internal Marks
    # Let's seed internal marks for CSE-A students in DAA
    for s in students:
        if s.class_section == "CSE-A":
            cat1 = 11 if s.roll_no == "24CC001" else (14 if s.roll_no == "24CC002" else 10)
            cat2 = 9 if s.roll_no == "24CC001" else (15 if s.roll_no == "24CC002" else 11)
            assignment = 8 if s.roll_no == "24CC001" else (10 if s.roll_no == "24CC002" else 7)
            lab = 9 if s.roll_no == "24CC001" else (10 if s.roll_no == "24CC002" else 8)
            attendance_pct = 40 if s.roll_no == "24CC001" else (80 if s.roll_no == "24CC003" else 100)
            
            mark = InternalMark(
                student_id=s.id,
                subject="Design & Analysis of Algorithms",
                cat1_marks=cat1,
                cat2_marks=cat2,
                assignment_marks=assignment,
                lab_marks=lab,
                total_marks=cat1 + cat2 + assignment + lab,
                attendance_percentage=attendance_pct
            )
            db.add(mark)

    # 9. Create CO Attainment & Workload
    co_attainments = [
        COAttainment(subject="Design & Analysis of Algorithms", co_number="CO1", target_percentage=75, attained_percentage=80),
        COAttainment(subject="Design & Analysis of Algorithms", co_number="CO2", target_percentage=75, attained_percentage=60),
        COAttainment(subject="Design & Analysis of Algorithms", co_number="CO3", target_percentage=75, attained_percentage=95),
        COAttainment(subject="Machine Learning", co_number="CO1", target_percentage=80, attained_percentage=82),
        COAttainment(subject="Machine Learning", co_number="CO2", target_percentage=80, attained_percentage=78),
    ]
    for co in co_attainments:
        db.add(co)

    workloads = [
        FacultyWorkload(faculty_id=faculty.id, subject="Design & Analysis of Algorithms", weekly_hours=4, role="Lecture"),
        FacultyWorkload(faculty_id=faculty.id, subject="Machine Learning", weekly_hours=3, role="Lecture"),
        FacultyWorkload(faculty_id=faculty.id, subject="Machine Learning Lab", weekly_hours=3, role="Lab"),
    ]
    for w in workloads:
        db.add(w)

    # 10. Create Publications, Grants & Research Deadlines
    publications = [
        Publication(
            faculty_id=faculty.id,
            title="An Efficient Deep Learning Framework for Brain Tumor Segmentation",
            venue="IEEE Transactions on Medical Imaging",
            type="journal",
            year=2026,
            co_authors="S. Ram, V. Krish",
            doi_or_link="10.1109/TMI.2026.123456",
            citation_count=4
        ),
        Publication(
            faculty_id=faculty.id,
            title="Distributed Consensus Protocols in Wireless Sensor Networks",
            venue="International Journal of Computer Networks",
            type="journal",
            year=2025,
            co_authors="R. Kapoor",
            doi_or_link="10.1016/j.comnet.2025.04.12",
            citation_count=12
        ),
    ]
    for p in publications:
        db.add(p)
    db.commit()
    for p in publications:
        db.refresh(p)

    grants = [
        GrantOpportunity(
            title="Research Promotion Scheme (RPS) in AI/ML",
            funding_body="AICTE",
            amount="8 Lakhs",
            eligibility="Full-time faculty with Ph.D. degree & 5 years experience.",
            deadline="2026-08-15",
            focus_area="Machine Learning, Robotics, Computer Vision"
        ),
        GrantOpportunity(
            title="Core Research Grant (CRG)",
            funding_body="SERB",
            amount="35 Lakhs",
            eligibility="Ph.D. degree, regular academic position in India.",
            deadline="2026-09-30",
            focus_area="Data Science, Quantum Computing, IoT"
        ),
    ]
    for g in grants:
        db.add(g)

    deadlines = [
        ResearchDeadline(faculty_id=faculty.id, type="submission", title="AICTE RPS Grant Application", due_date="2026-08-15"),
        ResearchDeadline(faculty_id=faculty.id, type="review", title="IEEE Cloud Computing Conference Camera-Ready", due_date="2026-07-30", related_publication_id=publications[0].id),
        ResearchDeadline(faculty_id=faculty.id, type="renewal", title="Patent Renewal: Smart Microgrid Controller", due_date="2026-08-27"),
    ]
    for d in deadlines:
        db.add(d)

    # 11. Create Question Bank Items
    questions = [
        QuestionBankItem(subject="Design & Analysis of Algorithms", unit=1, co_number="CO1", bloom_level="Remember", question_text="Define Asymptotic Notation and list the three primary types used in algorithm analysis.", marks=5, difficulty="Easy"),
        QuestionBankItem(subject="Design & Analysis of Algorithms", unit=1, co_number="CO1", bloom_level="Understand", question_text="Explain the Master Theorem for solving recurrence relations. Under what conditions is it not applicable?", marks=10, difficulty="Medium"),
        QuestionBankItem(subject="Design & Analysis of Algorithms", unit=2, co_number="CO2", bloom_level="Apply", question_text="Trace the execution of Quick Sort on the array [24, 9, 29, 14, 19, 27]. Show the array after each partitioning step.", marks=10, difficulty="Medium"),
        QuestionBankItem(subject="Design & Analysis of Algorithms", unit=2, co_number="CO2", bloom_level="Analyze", question_text="Compare the greedy Knapsack problem with the 0/1 Knapsack problem. Prove why the greedy approach fails to yield the optimal solution for the 0/1 Knapsack problem.", marks=10, difficulty="Hard"),
        QuestionBankItem(subject="Design & Analysis of Algorithms", unit=3, co_number="CO3", bloom_level="Evaluate", question_text="Given a chain of matrices [10x20, 20x30, 30x40, 40x30], evaluate the optimal parenthesization that minimizes the total multiplication cost using dynamic programming.", marks=15, difficulty="Hard"),
    ]
    for q in questions:
        db.add(q)

    # 12. Create Mentees
    mentees = []
    # Seed A. Kumar, B. Priya, C. Dinesh, D. Ezhil, E. Farhan as mentees under Dr. Preethi R
    for s in students[:5]:
        last_checkin = "2026-06-29" if s.roll_no == "24CC001" else ("2026-07-24" if s.roll_no == "24CC002" else ("2026-07-13" if s.roll_no == "24CC003" else None))
        mentee = Mentee(
            student_id=s.id,
            mentor_faculty_id=faculty.id,
            class_section=s.class_section,
            last_checkin_date=last_checkin
        )
        db.add(mentee)
        mentees.append(mentee)
    db.commit()
    for m in mentees:
        db.refresh(m)

    # 13. Create Check-ins & Escalations
    checkins = [
        CheckIn(
            mentee_id=mentees[2].id, # Dinesh
            date="2026-07-13",
            mode="in-person",
            notes="Expressed difficulty in understanding Dynamic Programming and asymptotic analysis in DAA. Advised him to attend remedial sessions. Seems moderately anxious about the upcoming CAT-2 exam.",
            mood_tag="needs attention"
        ),
        CheckIn(
            mentee_id=mentees[1].id, # Priya
            date="2026-07-24",
            mode="chat",
            notes="Doing exceptionally well. Preparing for CAT-2. Enquired about research internship opportunities in medical imaging.",
            mood_tag="doing well"
        ),
    ]
    for c in checkins:
        db.add(c)
        
    escalations = [
        Escalation(
            mentee_id=mentees[2].id, # Dinesh
            raised_by=faculty.id,
            reason="Student shows high anxiety levels and has missed consecutive tutorial classes due to reported health stress.",
            escalated_to="counselor",
            status="open"
        )
    ]
    for e in escalations:
        db.add(e)

    # 14. Create MentorTasks & FutureNotes
    task1 = MentorTask(faculty_id=faculty.id, title="Register for NPTEL Exam", description="Please complete the registration for the upcoming NPTEL certification by end of the week.")
    task2 = MentorTask(faculty_id=faculty.id, title="Form Mini-Project Teams", description="Form groups of 3 for the upcoming mini-project review.")
    db.add(task1)
    db.add(task2)
    db.commit()
    db.refresh(task1)
    db.refresh(task2)

    # Acknowledge some tasks
    for i, m in enumerate(mentees):
        # 3 out of 5 complete task 1
        db.add(TaskAcknowledgement(task_id=task1.id, mentee_id=m.id, status="completed" if i < 3 else "pending"))
        # 1 out of 5 complete task 2
        db.add(TaskAcknowledgement(task_id=task2.id, mentee_id=m.id, status="completed" if i == 0 else "pending"))

    db.add(FutureNote(mentee_id=mentees[0].id, note="Ask about his progress in the ML course he started online."))
    db.add(FutureNote(mentee_id=mentees[2].id, note="Check if he is still facing health stress issues and if the counselor visit helped."))

    db.commit()

    # --- Phase 7: Placement & Internships ---
    drives = [
        PlacementDrive(company_name="TechCorp India", role="SDE-1", date="2026-08-15", eligibility="B.E. CSE > 7.5 CGPA"),
        PlacementDrive(company_name="DataSystems LLC", role="Data Engineer", date="2026-08-22", eligibility="B.E. CSE, IT > 7.0 CGPA"),
        PlacementDrive(company_name="Innovate AI", role="ML Intern", date="2026-09-01", eligibility="All branches > 8.0 CGPA")
    ]
    db.add_all(drives)
    
    internships = [
        Internship(student_name="Kumar A.", company="TechCorp India", duration_months=3, stipend="15000 INR/mo"),
        Internship(student_name="Priya M.", company="GlobalSoft", duration_months=6, stipend="20000 INR/mo")
    ]
    db.add_all(internships)

    # --- Phase 8: Alumni Relations ---
    alumni_list = [
        Alumni(name="Ramesh R.", graduation_year=2021, company="Amazon", role="SDE-2", email="ramesh.r@alumni.edu"),
        Alumni(name="Sita V.", graduation_year=2019, company="Google", role="Product Manager", email="sita.v@alumni.edu")
    ]
    db.add_all(alumni_list)
    db.commit()

    donations = [
        DonationLedger(alumni_id=alumni_list[0].id, amount=50000.0, purpose="Lab Equipment Fund", date="2026-05-10"),
        DonationLedger(alumni_id=alumni_list[1].id, amount=25000.0, purpose="Scholarship Fund", date="2026-06-15")
    ]
    db.add_all(donations)

    # --- Phase 9: Event Management ---
    events = [
        Event(name="National Symposium on AI", type="Symposium", date="2026-10-12", budget_allocated=150000.0, budget_spent=25000.0),
        Event(name="FDP on Cloud Computing", type="FDP", date="2026-08-20", budget_allocated=50000.0, budget_spent=0.0)
    ]
    db.add_all(events)
    db.commit()

    committee_tasks = [
        CommitteeTask(event_id=events[0].id, description="Book auditorium and arrange PA system", assigned_to="Dr. Rajesh"),
        CommitteeTask(event_id=events[0].id, description="Send invites to keynote speakers", assigned_to="Dr. Preethi", status="done")
    ]
    db.add_all(committee_tasks)

    # --- Phase 10: Inventory & Resources ---
    assets = [
        LabAsset(name="Oscilloscope Pro X", type="Equipment", last_maintenance_date="2026-01-15"),
        LabAsset(name="Dell Workstation OptiPlex", type="Computer", status="repair", last_maintenance_date="2025-11-10")
    ]
    db.add_all(assets)

    licenses = [
        SoftwareLicense(software_name="MATLAB 2025", keys_total=50, keys_used=45, expiry_date="2026-12-31"),
        SoftwareLicense(software_name="Adobe Creative Cloud", keys_total=10, keys_used=10, expiry_date="2026-09-15")
    ]
    db.add_all(licenses)

    books = [
        BookRequisition(book_title="Deep Learning", author="Ian Goodfellow", copies_needed=5),
        BookRequisition(book_title="Introduction to Algorithms", author="Thomas H. Cormen", copies_needed=10, status="ordered")
    ]
    db.add_all(books)

    db.commit()
    print("Database seeded successfully with all tables!")
    # Ingest text into RAG
    seed_rag_policies(db)

def seed_rag_policies(db: Session):
    print("Ingesting policies into RAG pipeline...")
    policy_texts = {
        "Faculty Leave Policy Guidelines 2026": """
        FACULTY LEAVE POLICY GUIDELINES - 2026
        
        1. Casual Leave (CL): 
        All full-time faculty members are entitled to 12 days of Casual Leave per calendar year. 
        A maximum of 3 days of CL can be taken consecutively. Prior approval must be obtained from 
        the Head of the Department (HOD) at least 24 hours in advance. For emergency leaves, oral 
        or email notification is required by 8:30 AM on the day of the leave.
        
        2. Earned Leave (EL):
        Faculty members who have completed 1 year of continuous service are eligible for 10 days of 
        Earned Leave per year. EL can be accumulated up to a maximum of 60 days. Approval for EL 
        must be submitted to the Dean's office at least 15 days in advance through the HOD.
        
        3. Sick Leave (SL):
        Faculty are entitled to 8 days of Sick Leave per year. A medical certificate from a registered 
        medical practitioner is mandatory if Sick Leave extends beyond 2 consecutive days.
        
        4. Duty Leave (DL):
        Duty Leave is provided for academic activities such as attending conferences, workshops, acting as 
        an external examiner, or participating in university valuation. Faculty can avail up to 15 days 
        of Duty Leave per academic year. Written proof (e.g., invitation letter, attendance certificate) 
        must be submitted along with the DL request at least 5 days in advance.
        
        5. Academic Leave substitution:
        In all cases of leave, the faculty member must arrange for class adjustments/substitution with another 
        colleague. The timetable adjustment form signed by both faculty members must be submitted to the HOD.
        """,
        
        "Internal Assessment Grading Policy": """
        INTERNAL ASSESSMENT AND GRADING POLICY - B.TECH CSE
        
        1. Weightage Distribution:
        The total internal assessment marks for any course is 50 marks. This is split as follows:
        - Continuous Assessment Tests (CAT-1 & CAT-2): 30 Marks total (15 Marks each).
        - Assignments & Quizzes: 10 Marks.
        - Laboratory/Practical Work (where applicable) or Mini-Project: 10 Marks.
        If there is no practical component, the 10 marks are allocated to a course project and class participation.
        
        2. Continuous Assessment Tests (CAT):
        CAT-1 is conducted after 30 working days (covering Unit 1 and Unit 2). CAT-2 is conducted after 60 working 
        days (covering Unit 3 and Unit 4). Retest is only allowed in genuine cases (e.g., medical emergency, 
        representing the institution in sports/competitions) and must be approved by the Principal.
        
        3. Assignment Submissions:
        A minimum of 2 assignments must be given per course. Submissions must be graded on a scale of 10 and 
        averaged. Late submission penalty: 10% deduction per day of delay. No assignments are accepted after 
        5 days from the due date.
        
        4. Grade Boundaries:
        Relative grading is applied for classes with more than 30 students. The grades are assigned based on 
        the mean (M) and standard deviation (SD) of the class performance:
        - O (Outstanding): >= M + 1.5 * SD
        - A+ (Excellent): M + 1.0 * SD to M + 1.5 * SD
        - A (Very Good): M + 0.5 * SD to M + 1.0 * SD
        - B+ (Good): M to M + 0.5 * SD
        - B (Above Average): M - 0.5 * SD to M
        - C (Average): M - 1.0 * SD to M - 0.5 * SD
        - U (Re-appear): < M - 1.0 * SD (or less than 50% absolute marks)
        """,
        
        "Student Attendance and Exam Policy": """
        STUDENT ATTENDANCE AND EXAM ELIGIBILITY POLICY
        
        1. Minimum Attendance Requirement:
        Every student is expected to maintain 100% attendance in all courses. However, to accommodate 
        sickness, emergencies, and co-curricular activities, a minimum of 75% attendance is mandatory 
        to be eligible to write the End Semester Examinations.
        
        2. Attendance Condonation:
        Students having attendance between 65% and 74% due to medical reasons or authorized institute-level 
        deputation may apply for condonation. This requires submission of valid medical certificates/letters 
        and payment of the condonation fee. Condonation is limited to twice during the entire program duration.
        Students with less than 65% attendance in any course are strictly barred from writing the examination 
        for that course and must register for the course again (re-run) in subsequent semesters.
        
        3. Duty Attendance (DA):
        DA is granted for representing the department/institute in technical events, sports, or placements. 
        DA requests must be forwarded by the faculty coordinator and approved by the HOD within 3 days of 
        the activity. Late DA requests will not be processed.
        
        4. Detention:
        The detenu list (students ineligible to write exams) is published 5 days before the commencement 
        of the practical exams. No changes or appeals are permitted after the final publication of the detenu list.
        """
    }

    for title, text in policy_texts.items():
        policy_doc = db.query(PolicyDocument).filter(PolicyDocument.title == title).first()
        if policy_doc:
            # Ingest into RAG pipeline
            rag_pipeline.ingest_document(
                title=title,
                text=text,
                category=policy_doc.category,
                source_name=policy_doc.file_path
            )
    print("RAG seeding complete.")
