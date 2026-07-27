import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
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
