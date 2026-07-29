import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

try:
    import anthropic
    anthropic_available = True if ANTHROPIC_API_KEY else False
except ImportError:
    anthropic_available = False

class LLMClient:
    def __init__(self):
        self.api_key = ANTHROPIC_API_KEY
        if anthropic_available:
            try:
                self.client = anthropic.Anthropic(api_key=self.api_key)
                print("Anthropic Client initialized successfully.")
            except Exception as e:
                print(f"Failed to initialize Anthropic Client: {e}. Running in mock mode.")
                self.client = None
        else:
            print("Anthropic API key not found or anthropic library not installed. Running LLM in Mock Mode.")
            self.client = None

    def get_chat_response(self, system_prompt: str, messages: list, tools: list = None) -> str:
        """
        Get a chat response from Claude or fallback mock logic.
        """
        if self.client:
            try:
                # Format messages for Anthropic
                # Anthropic API expects role: "user" / "assistant"
                formatted_messages = []
                for msg in messages:
                    role = msg.get("role")
                    content = msg.get("content")
                    # Claude only permits user and assistant roles
                    if role == "system":
                        continue
                    formatted_messages.append({"role": role, "content": content})

                # Simple non-streamed check first
                response = self.client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=4000,
                    system=system_prompt,
                    messages=formatted_messages,
                )
                return response.content[0].text
            except Exception as e:
                print(f"Error calling Claude: {e}. Falling back to mock generator.")

        # Fallback Mock logic
        return self._generate_mock_response(messages)

    def get_chat_response_stream(self, system_prompt: str, messages: list):
        """
        Stream a chat response from Claude or fallback mock logic.
        Yields text chunks.
        """
        if self.client:
            try:
                formatted_messages = []
                for msg in messages:
                    role = msg.get("role")
                    if role == "system":
                        continue
                    formatted_messages.append({"role": role, "content": msg.get("content")})

                with self.client.messages.stream(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=4000,
                    system=system_prompt,
                    messages=formatted_messages,
                ) as stream:
                    for text in stream.text_stream:
                        yield text
                return
            except Exception as e:
                print(f"Error streaming from Claude: {e}. Falling back to mock generator.")

        # Streamed mock generator
        mock_response = self._generate_mock_response(messages)
        # Yield in chunks
        chunk_size = 8
        for i in range(0, len(mock_response), chunk_size):
            yield mock_response[i:i + chunk_size]

    def _generate_mock_response(self, messages: list) -> str:
        last_message = messages[-1]["content"].lower()
        
        if "schedule" in last_message or "today" in last_message:
            return "Based on your timetable database, you have the following classes today:\n\n1. **09:00 - 10:00**: Design & Analysis of Algorithms for **CCE** in **LH-201**\n2. **11:30 - 12:30**: Machine Learning for **CSE-B** in **LH-302**\n\nI have rendered today's schedule in your dashboard panel to the right."
        
        elif "draft" in last_message or "email" in last_message:
            return """Here is a drafted reminder email for you:

```subject
Urgent: Low Attendance Warning
```

```body
Dear Student,

Our records show your attendance is currently below 75%. Please ensure you attend the remaining lectures to maintain exam eligibility.

Sincerely,
Faculty Office
```
I've also rendered this below as a Draft Card so you can copy or edit it easily!"""

        elif "syllabus" in last_message or "daa" in last_message or "machine learning" in last_message:
            return "According to the syllabus database, here is the syllabus info for **Design & Analysis of Algorithms**:\n\n* **Unit 1: Introduction to Algorithms**: Covers asymptotic notations, complexity analysis, and recurrences (Master Theorem).\n* **Unit 2: Divide-and-Conquer and Greedy**: Covers Merge/Quick Sort, Knapsack, Dijkstra, Prim/Kruskal.\n\nYou can click on 'Show syllabus' or view the right side panels to see more units."

        elif "lesson plan" in last_message or "plan" in last_message:
            return """Here is a detailed lesson plan structure for **Design & Analysis of Algorithms, Unit 1 (Introduction to Algorithms)**:

* **Objective:** Understand how to calculate time complexity of simple loops and recursive algorithms using Big-O notation.
* **Duration:** 50 Minutes
* **Activities:**
  - **10 min:** Recap of algorithmic specifications and loop structures.
  - **20 min:** Step-by-step math proof of a nested loop (quadratic time).
  - **15 min:** Student quiz on simple loops.
  - **5 min:** Q&A and assignment distribution.
* **Assessment:** Give students 3 sample code snippets to analyze for homework.

I've rendered this as a Lesson Plan Card below for you to review!"""

        elif "policy" in last_message or "cl" in last_message or "attendance" in last_message:
            return "According to the **Student Attendance and Exam Policy**:\n- Students need a minimum of **75% attendance** to be eligible to write exams.\n- Condonation is permitted between **65% and 74%** for medical reasons with HOD approval.\n- Below **65%**, they are strictly detained.\n\nAccording to the **Faculty Leave Policy 2026**:\n- You are entitled to **12 days of Casual Leave (CL)** per calendar year.\n- A maximum of **3 days** can be taken consecutively with HOD approval 24 hours in advance."

        else:
            return "Hello! I am your Faculty Assistant. I can help you retrieve today's schedule, search institutional policies, draft emails, look up syllabus details, or create lesson plans. How can I assist you today?"

llm_client = LLMClient()
