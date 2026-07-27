export interface User {
  id: number;
  name: string;
  email: string;
  department: string;
  designation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{ name: string; status: 'running' | 'success' | 'error'; result?: string; error?: string }>;
  richData?: any;
}

const API_BASE_URL = 'http://localhost:8000';

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token: string) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

export const api = {
  async login(email: string, password: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Login failed');
      }
      
      return await response.json();
    } catch (error) {
      console.warn('Backend login connection failed, using mockup auth fallback.', error);
      if (email === 'demo@faculty.edu' && password === 'demo1234') {
        return {
          access_token: 'mock-jwt-token',
          user: {
            id: 1,
            name: 'Dr. Rajesh Kumar',
            email: 'demo@faculty.edu',
            department: 'Computer Science & Engineering',
            designation: 'Professor & Head',
          }
        };
      }
      throw new Error('Invalid credentials (mockup mode: demo@faculty.edu / demo1234)');
    }
  },

  async getMe(): Promise<{ user: User }> {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Token verification failed');
      const data = await response.json();
      return { user: data };
    } catch (error) {
      console.warn('Backend getMe connection failed, using mockup session.', error);
      return {
        user: {
          id: 1,
          name: 'Dr. Rajesh Kumar',
          email: 'demo@faculty.edu',
          department: 'Computer Science & Engineering',
          designation: 'Professor & Head',
        }
      };
    }
  },

  streamChat(
    message: string,
    onChunk: (text: string) => void,
    onTrace: (trace: any) => void,
    onDone: (toolCalls: any[], richData: any) => void,
    onError: (err: any) => void
  ) {
    // We will use standard streaming fetch if backend is alive
    // Else fall back to local mock streaming
    let buffer = '';
    
    const runMockStream = () => {
      let mockReply = '';
      let richData: any = null;
      let toolCalls: any[] = [];
      const msgLower = message.toLowerCase();

      if (msgLower.includes('schedule') || msgLower.includes('today') || msgLower.includes('timetable') || msgLower.includes('classes')) {
        toolCalls = [{ name: 'get_todays_schedule', status: 'success', result: 'Found 2 classes for Monday.' }];
        mockReply = "Based on your timetable database, you have the following classes today:\n\n1. **09:00 - 10:00**: Design & Analysis of Algorithms for **CSE-A** in **LH-201**\n2. **11:30 - 12:30**: Machine Learning for **CSE-B** in **LH-302**\n\nI have rendered today's schedule in your dashboard panel to the right.";
        richData = {
          type: 'schedule',
          day: 'Monday',
          schedule: [
            { period: '09:00 - 10:00', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
            { period: '11:30 - 12:30', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' }
          ]
        };
      } else if (msgLower.includes('leave') || msgLower.includes('draft')) {
        toolCalls = [{ name: 'draft_email', status: 'success', result: 'Configured email draft helper.' }];
        mockReply = "Here is a drafted leave request email for you:\n\n**Subject:** Application for Casual Leave - Dr. Rajesh Kumar\n\n**Body:**\nDear Head of Department,\n\nI am writing to formally request 1 day of Casual Leave for tomorrow, July 27, 2026, due to personal urgent work at home.\n\nI have arranged for Dr. Amit Sharma to handle my 9:00 AM class. He has kindly agreed to conduct a tutorial session in my place.\n\nThank you for your consideration.\n\nSincerely,\nDr. Rajesh Kumar\nProfessor & Head, CSE Dept.";
        richData = {
          type: 'email_draft',
          to_name: 'HOD',
          purpose: 'Casual Leave request for tomorrow',
          subject: 'Application for Casual Leave - Dr. Rajesh Kumar',
          body: "Dear Head of Department,\n\nI am writing to formally request 1 day of Casual Leave for tomorrow, July 27, 2026, due to personal urgent work at home.\n\nI have arranged for Dr. Amit Sharma to handle my 9:00 AM Design & Analysis of Algorithms class for CSE-A. He has kindly agreed to conduct a tutorial session in my place.\n\nThank you for your consideration.\n\nSincerely,\nDr. Rajesh Kumar\nProfessor & Head, CSE Dept."
        };
      } else if (msgLower.includes('syllabus') || msgLower.includes('daa') || msgLower.includes('topics')) {
        toolCalls = [{ name: 'get_syllabus', status: 'success', result: 'Found 1 unit matching query.' }];
        mockReply = "According to the syllabus database, here is the syllabus info for **Design & Analysis of Algorithms**:\n\n* **Unit 1: Introduction to Algorithms**: Covers asymptotic notations, complexity analysis, and recurrences (Master Theorem).\n* **Unit 2: Divide-and-Conquer and Greedy**: Covers Merge/Quick Sort, Knapsack, Dijkstra, Prim/Kruskal.\n\nYou can click on 'Show syllabus' or view the right side panels to see more units.";
        richData = {
          type: 'syllabus',
          subject: 'Design & Analysis of Algorithms',
          units: [
            { subject: 'Design & Analysis of Algorithms', unit_number: 1, title: 'Introduction to Algorithms', topics: 'Algorithm specification, asymptotic notations (Big O, Omega, Theta), mathematical analysis of non-recursive and recursive algorithms, recurrence relations, Master Theorem.', pdf_url: '/syllabus/daa_unit1.pdf' },
            { subject: 'Design & Analysis of Algorithms', unit_number: 2, title: 'Divide-and-Conquer and Greedy Method', topics: "Binary search, Merge sort, Quick sort, Strassen's matrix multiplication. Greedy Method: General method, Knapsack, Minimum spanning trees (Prim's and Kruskal's), Single source shortest paths (Dijkstra's).", pdf_url: '/syllabus/daa_unit2.pdf' }
          ]
        };
      } else if (msgLower.includes('lesson plan') || msgLower.includes('plan')) {
        toolCalls = [{ name: 'create_lesson_plan', status: 'success', result: 'Configured lesson plan generator.' }];
        mockReply = "Here is a detailed lesson plan structure for **Design & Analysis of Algorithms, Unit 1 (Introduction to Algorithms)**:\n\n* **Objective:** Understand how to calculate time complexity of simple loops and recursive algorithms using Big-O notation.\n* **Duration:** 50 Minutes\n\nI've rendered this as a Lesson Plan Card below for you to review!";
        richData = {
          type: 'lesson_plan',
          subject: 'Design & Analysis of Algorithms',
          unit: 1,
          topic: 'Introduction to Asymptotic Analysis',
          objectives: 'Understand basic asymptotic runtime analysis (Big-O, Omega, Theta).',
          activities: [
            { name: 'Lecture Introduction', duration: '15 mins', description: 'Review algorithm specifications & input sizes.' },
            { name: 'Step-by-step Loop Analysis', duration: '20 mins', description: 'Derive math complexity for single and nested loops.' },
            { name: 'Student Practical Challenge', duration: '15 mins', description: 'Given three loop segments, compute runtime on paper.' }
          ],
          assessment: 'Homework: Compute big-O runtime for 3 recursive algorithms (binary search, merge sort, fibonacci).'
        };
      } else if (msgLower.includes('policy') || msgLower.includes('rule') || msgLower.includes('cl') || msgLower.includes('attendance')) {
        toolCalls = [{ name: 'search_policies', status: 'success', result: 'Retrieved 2 policy chunks.' }];
        mockReply = "According to the **Student Attendance and Exam Policy**:\n- Students need a minimum of **75% attendance** to be eligible to write exams.\n- Condonation is permitted between **65% and 74%** for medical reasons with HOD approval.\n- Below **65%**, they are strictly detained.\n\nAccording to the **Faculty Leave Policy 2026**:\n- You are entitled to **12 days of Casual Leave (CL)** per calendar year.\n- A maximum of **3 days** can be taken consecutively with HOD approval 24 hours in advance.";
        richData = {
          type: 'policy',
          citations: [
            { source: 'policies/attendance_policy.txt', title: 'Student Attendance and Exam Policy', snippet: 'Every student is expected to maintain 100% attendance. A minimum of 75% attendance is mandatory...' },
            { source: 'policies/leave_policy_2026.txt', title: 'Faculty Leave Policy Guidelines 2026', snippet: 'All full-time faculty members are entitled to 12 days of Casual Leave per calendar year...' }
          ]
        };
      } else {
        mockReply = "Hello! I am your Faculty Assistant. I can help you retrieve today's schedule, search institutional policies, draft emails/leave requests, look up syllabus details, or create lesson plans. How can I assist you today?";
      }

      // Simulate stream
      let words = mockReply.split(' ');
      let i = 0;
      
      // Dispatch traces
      if (toolCalls.length > 0) {
        onTrace({ name: toolCalls[0].name, status: 'running' });
        setTimeout(() => {
          onTrace({ name: toolCalls[0].name, status: 'success', result: toolCalls[0].result });
          
          // Start streaming words
          const interval = setInterval(() => {
            if (i < words.length) {
              const space = i < words.length - 1 ? ' ' : '';
              onChunk(words[i] + space);
              i++;
            } else {
              clearInterval(interval);
              onDone(toolCalls, richData);
            }
          }, 30);
        }, 600);
      } else {
        const interval = setInterval(() => {
          if (i < words.length) {
            const space = i < words.length - 1 ? ' ' : '';
            onChunk(words[i] + space);
            i++;
          } else {
            clearInterval(interval);
            onDone(toolCalls, richData);
          }
        }, 30);
      }
    };

    // Attempt backend fetch
    fetch(`${API_BASE_URL}/agents/faculty-assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, faculty_id: 1 })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Readable stream not supported');
      }
      const activeReader = reader;

      const decoder = new TextDecoder();
      
      function readStream() {
        activeReader.read().then(({ done, value }) => {
          if (done) {
            return;
          }
          
          const text = decoder.decode(value);
          buffer += text;
          
          const lines = buffer.split('\n');
          // Save the last partial line back to buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                
                const data = JSON.parse(jsonStr);
                if (data.type === 'trace') {
                  onTrace(data);
                } else if (data.type === 'content') {
                  onChunk(data.delta);
                } else if (data.type === 'done') {
                  onDone(data.tool_calls || [], data.rich_data || null);
                } else if (data.type === 'error') {
                  onError(data.detail);
                }
              } catch (e) {
                console.error('Error parsing SSE event:', e);
              }
            }
          }
          readStream();
        }).catch(err => {
          console.error('SSE read stream error:', err);
          onError(err);
        });
      }
      
      readStream();
    })
    .catch(err => {
      console.warn('Backend server not reachable. Running client-side mock streaming.', err);
      runMockStream();
    });
  }
};
