from sqlalchemy.orm import Session
from .models import Faculty, Timetable, SyllabusUnit, PolicyDocument
from .database import engine, Base
from .auth import get_password_hash
from rag.rag_pipeline import rag_pipeline

def seed_database(db: Session):
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)

    # Check if demo faculty exists
    demo_email = "demo@faculty.edu"
    faculty = db.query(Faculty).filter(Faculty.email == demo_email).first()
    
    if faculty:
        print("Database already seeded.")
        # Re-ingest policies into RAG just in case Chroma data is cleared
        seed_rag_policies(db)
        return

    print("Seeding database...")
    
    # 1. Create Faculty
    demo_faculty = Faculty(
        name="Preethi R",
        email=demo_email,
        department="Computer Science & Engineering",
        designation="Professor & Head",
        password_hash=get_password_hash("demo1234")
    )
    db.add(demo_faculty)
    db.commit()
    db.refresh(demo_faculty)

    # 2. Create Timetable
    timetable_entries = [
        # Monday
        Timetable(faculty_id=demo_faculty.id, day_of_week="Monday", period="09:00 - 10:00", subject="Design & Analysis of Algorithms", class_section="CSE-A", room="LH-201"),
        Timetable(faculty_id=demo_faculty.id, day_of_week="Monday", period="11:30 - 12:30", subject="Machine Learning", class_section="CSE-B", room="LH-302"),
        # Tuesday
        Timetable(faculty_id=demo_faculty.id, day_of_week="Tuesday", period="10:00 - 11:00", subject="Design & Analysis of Algorithms", class_section="CSE-A", room="LH-201"),
        Timetable(faculty_id=demo_faculty.id, day_of_week="Tuesday", period="14:00 - 15:30", subject="Machine Learning Lab", class_section="CSE-B", room="Lab-3"),
        # Wednesday
        Timetable(faculty_id=demo_faculty.id, day_of_week="Wednesday", period="09:00 - 10:00", subject="Compiler Design", class_section="CSE-A", room="LH-203"),
        Timetable(faculty_id=demo_faculty.id, day_of_week="Wednesday", period="11:30 - 12:30", subject="Design & Analysis of Algorithms", class_section="CSE-A", room="LH-201"),
        # Thursday
        Timetable(faculty_id=demo_faculty.id, day_of_week="Thursday", period="10:00 - 11:00", subject="Machine Learning", class_section="CSE-B", room="LH-302"),
        Timetable(faculty_id=demo_faculty.id, day_of_week="Thursday", period="14:00 - 15:00", subject="Compiler Design", class_section="CSE-A", room="LH-203"),
        # Friday
        Timetable(faculty_id=demo_faculty.id, day_of_week="Friday", period="09:00 - 10:00", subject="Compiler Design", class_section="CSE-A", room="LH-203"),
        Timetable(faculty_id=demo_faculty.id, day_of_week="Friday", period="11:30 - 12:30", subject="Machine Learning", class_section="CSE-B", room="LH-302"),
    ]
    
    for entry in timetable_entries:
        db.add(entry)

    # 3. Create Syllabus Units
    syllabus_units = [
        # DAA Syllabus
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
        
        # Machine Learning Syllabus
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

    # 4. Create Policy Documents and Ingest to RAG
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

    db.commit()
    print("Database seeded successfully.")

    # Ingest text into RAG
    seed_rag_policies(db)

def seed_rag_policies(db: Session):
    print("Ingesting policies into RAG pipeline...")
    # Get raw texts to seed RAG
    # We will write some sample policies and ingest them
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
