import os
import json
import asyncio
from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db, engine, Base
from core.models import Faculty
from core.auth import verify_password, create_access_token, verify_token
from core.seed import seed_database
from agents.faculty_assistant.agent import handle_faculty_assistant_chat

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EduPilot Backend", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, allow all origins. Can narrow in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed database on startup
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        seed_database(db)
    finally:
        db.close()

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "EduPilot API"}

# Auth API
@app.post("/auth/login")
def login(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required"
        )
        
    faculty = db.query(Faculty).filter(Faculty.email == email).first()
    if not faculty or not verify_password(password, faculty.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    access_token = create_access_token(data={"sub": faculty.email, "id": faculty.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": faculty.id,
            "name": faculty.name,
            "email": faculty.email,
            "department": faculty.department,
            "designation": faculty.designation
        }
    }

@app.get("/auth/me")
def get_current_user(token: str = Depends(verify_token), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    email = token.get("sub")
    faculty = db.query(Faculty).filter(Faculty.email == email).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty member not found"
        )
    return {
        "id": faculty.id,
        "name": faculty.name,
        "email": faculty.email,
        "department": faculty.department,
        "designation": faculty.designation
    }

# Agent Chat endpoints

@app.post("/agents/chat")
def general_agent_chat(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    General agent chat stub for phase 0.
    Accepts: { agent_id, message, session_id }
    """
    agent_id = payload.get("agent_id")
    message = payload.get("message", "")
    
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id is required")
        
    if agent_id == "agent1":
        # Faculty Assistant logic
        res = handle_faculty_assistant_chat(message, 1, db)
        return res
    elif agent_id == "agent2":
        return {
            "text": "Academic Workflow Agent stub response. I handle attendance, assignments, and marks. (Available in Phase 2)",
            "tool_calls": [{"name": "workflow_stub", "status": "success", "result": "Academic Workflow Agent is active in Phase 2."}],
            "rich_data": None
        }
    elif agent_id == "agent3":
        return {
            "text": "Analytics & Accreditation Agent stub response. I handle performance insights and accreditation reports. (Available in Phase 3)",
            "tool_calls": [{"name": "analytics_stub", "status": "success", "result": "Analytics Agent is active in Phase 3."}],
            "rich_data": None
        }
    else:
        raise HTTPException(status_code=404, detail="Agent not found")

@app.post("/agents/faculty-assistant/chat")
def faculty_assistant_chat_stream(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Streamed chat for the Faculty Assistant via Server-Sent Events (SSE)
    """
    message = payload.get("message", "")
    # Default to first faculty if not authenticated in MVP session
    faculty_id = payload.get("faculty_id", 1) 

    async def event_generator():
        # Retrieve the full agent output structure
        # (Since we are local, we process it synchronously and then stream the characters/words
        # to simulate typing effect or stream model outputs sequentially)
        try:
            # Get the fully parsed response
            agent_result = handle_faculty_assistant_chat(message, faculty_id, db)
            text_response = agent_result["text"]
            tool_calls = agent_result["tool_calls"]
            rich_data = agent_result["rich_data"]

            # Stream the tool invocation first to show visual handoff/trace
            if tool_calls:
                for tc in tool_calls:
                    yield f"data: {json.dumps({'type': 'trace', 'name': tc['name'], 'status': 'running'})}\n\n"
                    await asyncio.sleep(0.3)
                    yield f"data: {json.dumps({'type': 'trace', 'name': tc['name'], 'status': tc['status'], 'result': tc.get('result', '')})}\n\n"
                    await asyncio.sleep(0.2)

            # Stream the response text character by character / word by word
            words = text_response.split(" ")
            for i, word in enumerate(words):
                space = " " if i < len(words) - 1 else ""
                yield f"data: {json.dumps({'type': 'content', 'delta': word + space})}\n\n"
                # Control typing speed
                await asyncio.sleep(0.02)

            # Yield final payload containing rich details for cards
            yield f"data: {json.dumps({'type': 'done', 'tool_calls': tool_calls, 'rich_data': rich_data})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
