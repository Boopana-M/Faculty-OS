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
        let day = 'Monday';
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const d of days) {
          if (msgLower.includes(d)) {
            day = d.charAt(0).toUpperCase() + d.slice(1);
            break;
          }
        }
        
        let localSchedules = [];
        const localData = localStorage.getItem('mock_schedules');
        if (localData) {
          localSchedules = JSON.parse(localData);
        } else {
          localSchedules = [
            { id: 1, day_of_week: 'Monday', period: '09:00 - 10:00', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
            { id: 2, day_of_week: 'Monday', period: '11:30 - 12:30', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' },
            { id: 3, day_of_week: 'Tuesday', period: '10:00 - 11:00', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
            { id: 4, day_of_week: 'Tuesday', period: '14:00 - 15:30', subject: 'Machine Learning Lab', class_section: 'CSE-B', room: 'Lab-3' },
            { id: 5, day_of_week: 'Wednesday', period: '09:00 - 10:00', subject: 'Compiler Design', class_section: 'CSE-A', room: 'LH-203' },
            { id: 6, day_of_week: 'Wednesday', period: '11:30 - 12:30', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
            { id: 7, day_of_week: 'Thursday', period: '10:00 - 11:00', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' },
            { id: 8, day_of_week: 'Thursday', period: '14:00 - 15:00', subject: 'Compiler Design', class_section: 'CSE-A', room: 'LH-203' },
            { id: 9, day_of_week: 'Friday', period: '09:00 - 10:00', subject: 'Compiler Design', class_section: 'CSE-A', room: 'LH-203' },
            { id: 10, day_of_week: 'Friday', period: '11:30 - 12:30', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' },
          ];
          localStorage.setItem('mock_schedules', JSON.stringify(localSchedules));
        }
        
        const filtered = localSchedules.filter((s: any) => s.day_of_week === day);
        toolCalls = [{ name: 'get_todays_schedule', status: 'success', result: `Found ${filtered.length} classes for ${day}.` }];
        
        if (filtered.length === 0) {
          mockReply = `Based on your timetable database, you have no classes scheduled for **${day}**.`;
        } else {
          const listText = filtered.map((s: any, idx: number) => `${idx + 1}. **${s.period}**: ${s.subject} for **${s.class_section}** in **${s.room}**`).join('\n');
          mockReply = `Based on your timetable database, you have the following classes on **${day}**:\n\n${listText}\n\nI have rendered this schedule in your dashboard panel to the right.`;
        }
        
        richData = {
          type: 'schedule',
          day: day,
          schedule: filtered
        };
      } else if (msgLower.includes('draft') && !msgLower.includes('leave')) {
        toolCalls = [{ name: 'draft_email', status: 'success', result: 'Configured email draft helper.' }];
        mockReply = "Here is a drafted reminder email for you:\n\n**Subject:** Urgent: Low Attendance Warning\n\n**Body:**\nDear Student,\n\nOur records show your attendance is currently below 75%. Please ensure you attend the remaining lectures to maintain exam eligibility.\n\nSincerely,\nFaculty Office";
        richData = {
          type: 'email_draft',
          to_name: 'Student',
          purpose: 'attendance reminder',
          subject: 'Urgent: Low Attendance Warning',
          body: "Dear Student,\n\nOur records show your attendance is currently below 75%. Please ensure you attend the remaining lectures to maintain exam eligibility.\n\nSincerely,\nFaculty Office"
        };
      } else if (msgLower.includes('syllabus') || msgLower.includes('daa') || msgLower.includes('topics') || msgLower.includes('compiler') || msgLower.includes('learning')) {
        let subject = 'Design & Analysis of Algorithms';
        if (msgLower.includes('compiler') || msgLower.includes('cd')) {
          subject = 'Compiler Design';
        } else if (msgLower.includes('machine learning') || msgLower.includes('ml') || msgLower.includes('learning')) {
          subject = 'Machine Learning';
        } else if (msgLower.includes('lab')) {
          subject = 'Machine Learning Lab';
        }

        let units: any[] = [];
        const localData = localStorage.getItem(`mock_syllabus_${subject}`);
        if (localData) {
          units = JSON.parse(localData);
        } else {
          if (subject.includes('Algorithms') || subject.includes('DAA')) {
            units = [
              { id: 1, subject, unit_number: 1, title: 'Introduction to Algorithms', topics: 'Algorithm specification, asymptotic notations (Big O, Omega, Theta), mathematical analysis of non-recursive and recursive algorithms, recurrence relations, Master Theorem.', pdf_url: '/syllabus/daa_unit1.pdf' },
              { id: 2, subject, unit_number: 2, title: 'Divide-and-Conquer and Greedy Method', topics: "Binary search, Merge sort, Quick sort, Strassen's matrix multiplication. Greedy Method: General method, Knapsack, Minimum spanning trees (Prim's and Kruskal's), Single source shortest paths (Dijkstra's).", pdf_url: '/syllabus/daa_unit2.pdf' }
            ];
          } else if (subject.includes('Machine Learning') || subject.includes('ML')) {
            units = [
              { id: 1, subject, unit_number: 1, title: 'Introduction & Supervised Learning', topics: 'Definition of learning systems, goals and applications, supervised learning. Linear/Logistic Regression, Regularization.', pdf_url: '/syllabus/ml_unit1.pdf' },
              { id: 2, subject, unit_number: 2, title: 'Decision Trees & Naive Bayes', topics: 'ID3/C4.5 decision tree models, information gain, Naive Bayes classifier.', pdf_url: '/syllabus/ml_unit2.pdf' }
            ];
          }
          localStorage.setItem(`mock_syllabus_${subject}`, JSON.stringify(units));
        }

        toolCalls = [{ name: 'get_syllabus', status: 'success', result: `Found ${units.length} units matching query.` }];
        
        if (units.length === 0) {
          mockReply = `According to the syllabus database, there is no syllabus details registered for **${subject}**. You can upload the syllabus units using the Syllabus Manager panel on the right side.`;
        } else {
          const listText = units.map((u: any) => `* **Unit ${u.unit_number}: ${u.title}**: ${u.topics.substring(0, 100)}...`).join('\n');
          mockReply = `According to the syllabus database, here is the syllabus info for **${subject}**:\n\n${listText}\n\nI have rendered this as a Syllabus Card below for your detailed view.`;
        }

        richData = {
          type: 'syllabus',
          subject: subject,
          units: units
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
      } else if (msgLower.includes('policy') || msgLower.includes('rule') || msgLower.includes('cl') || msgLower.includes('leave') || msgLower.includes('attendance')) {
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
        mockReply = "Hello! I am your Faculty Assistant. I can help you retrieve today's schedule, search institutional policies, draft emails, look up syllabus details, or create lesson plans. How can I assist you today?";
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
  },

  async getSchedules(): Promise<any[]> {
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch schedules');
      return await response.json();
    } catch (error) {
      console.warn('Backend getSchedules failed, using mock schedule data.', error);
      const localMockSchedules = localStorage.getItem('mock_schedules');
      if (localMockSchedules) {
        return JSON.parse(localMockSchedules);
      }
      const defaultMock = [
        { id: 1, day_of_week: 'Monday', period: '09:00 - 10:00', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
        { id: 2, day_of_week: 'Monday', period: '11:30 - 12:30', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' },
        { id: 3, day_of_week: 'Tuesday', period: '10:00 - 11:00', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
        { id: 4, day_of_week: 'Tuesday', period: '14:00 - 15:30', subject: 'Machine Learning Lab', class_section: 'CSE-B', room: 'Lab-3' },
        { id: 5, day_of_week: 'Wednesday', period: '09:00 - 10:00', subject: 'Compiler Design', class_section: 'CSE-A', room: 'LH-203' },
        { id: 6, day_of_week: 'Wednesday', period: '11:30 - 12:30', subject: 'Design & Analysis of Algorithms', class_section: 'CSE-A', room: 'LH-201' },
        { id: 7, day_of_week: 'Thursday', period: '10:00 - 11:00', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' },
        { id: 8, day_of_week: 'Thursday', period: '14:00 - 15:00', subject: 'Compiler Design', class_section: 'CSE-A', room: 'LH-203' },
        { id: 9, day_of_week: 'Friday', period: '09:00 - 10:00', subject: 'Compiler Design', class_section: 'CSE-A', room: 'LH-203' },
        { id: 10, day_of_week: 'Friday', period: '11:30 - 12:30', subject: 'Machine Learning', class_section: 'CSE-B', room: 'LH-302' },
      ];
      localStorage.setItem('mock_schedules', JSON.stringify(defaultMock));
      return defaultMock;
    }
  },

  async createSchedule(data: { day_of_week: string; period: string; subject: string; class_section: string; room: string }): Promise<any> {
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create schedule slot');
      return await response.json();
    } catch (error) {
      console.warn('Backend createSchedule failed, using mock schedule data.', error);
      const current = await this.getSchedules();
      const newSlot = { id: Math.max(0, ...current.map((s: any) => s.id)) + 1, ...data };
      const updated = [...current, newSlot];
      localStorage.setItem('mock_schedules', JSON.stringify(updated));
      return newSlot;
    }
  },

  async updateSchedule(slotId: number, data: Partial<{ day_of_week: string; period: string; subject: string; class_section: string; room: string }>): Promise<any> {
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/${slotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update schedule slot');
      return await response.json();
    } catch (error) {
      console.warn('Backend updateSchedule failed, using mock schedule data.', error);
      const current = await this.getSchedules();
      const updated = current.map((s: any) => s.id === slotId ? { ...s, ...data } : s);
      localStorage.setItem('mock_schedules', JSON.stringify(updated));
      return updated.find((s: any) => s.id === slotId);
    }
  },

  async deleteSchedule(slotId: number): Promise<any> {
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/${slotId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to delete schedule slot');
      return await response.json();
    } catch (error) {
      console.warn('Backend deleteSchedule failed, using mock schedule data.', error);
      const current = await this.getSchedules();
      const updated = current.filter((s: any) => s.id !== slotId);
      localStorage.setItem('mock_schedules', JSON.stringify(updated));
      return { status: 'success' };
    }
  },

  async bulkUploadSchedule(slots: any[], overwrite: boolean = false): Promise<any> {
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ slots, overwrite })
      });
      if (!response.ok) throw new Error('Failed to bulk upload schedules');
      return await response.json();
    } catch (error) {
      console.warn('Backend bulkUploadSchedule failed, using mock schedule data.', error);
      let updated = [];
      if (!overwrite) {
        updated = await this.getSchedules();
      }
      let startId = Math.max(0, ...updated.map((s: any) => s.id)) + 1;
      const formattedSlots = slots.map((s, idx) => ({ id: startId + idx, ...s }));
      updated = [...updated, ...formattedSlots];
      localStorage.setItem('mock_schedules', JSON.stringify(updated));
      return { status: 'success', count: slots.length };
    }
  },

  async uploadPolicy(title: string, category: string, file: File): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE_URL}/api/policy`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload policy document');
      return await response.json();
    } catch (error) {
      console.warn('Backend uploadPolicy failed, simulating local RAG ingestion.', error);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            resolve({
              status: 'success',
              id: Math.floor(Math.random() * 1000) + 100,
              title: title,
              category: category,
              file_path: `policies/${file.name}`,
              message: "Policy successfully uploaded locally (mockup mode)."
            });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
      });
    }
  },

  async getSubjects(): Promise<string[]> {
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_BASE_URL}/api/subjects`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch subjects');
      return await response.json();
    } catch (error) {
      console.warn('Backend getSubjects failed, extracting unique subjects from mock schedules.', error);
      const schedules = await this.getSchedules();
      const uniqueSubjects = Array.from(new Set(schedules.map((s: any) => s.subject)));
      return uniqueSubjects.filter(Boolean);
    }
  },

  async getSyllabus(subject: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/syllabus/${encodeURIComponent(subject)}`);
      if (!response.ok) throw new Error('Failed to fetch syllabus');
      return await response.json();
    } catch (error) {
      console.warn(`Backend getSyllabus failed for ${subject}, using mock syllabus data.`, error);
      const localMockSyllabi = localStorage.getItem(`mock_syllabus_${subject}`);
      if (localMockSyllabi) {
        return JSON.parse(localMockSyllabi);
      }
      if (subject.includes('Algorithms') || subject.includes('DAA')) {
        return [
          { id: 1, subject, unit_number: 1, title: 'Introduction to Algorithms', topics: 'Algorithm specification, asymptotic notations (Big O, Omega, Theta), mathematical analysis of non-recursive and recursive algorithms, recurrence relations, Master Theorem.', pdf_url: '/syllabus/daa_unit1.pdf' },
          { id: 2, subject, unit_number: 2, title: 'Divide-and-Conquer and Greedy Method', topics: "Binary search, Merge sort, Quick sort, Strassen's matrix multiplication. Greedy Method: General method, Knapsack, Minimum spanning trees (Prim's and Kruskal's), Single source shortest paths (Dijkstra's).", pdf_url: '/syllabus/daa_unit2.pdf' }
        ];
      } else if (subject.includes('Machine Learning') || subject.includes('ML')) {
        return [
          { id: 1, subject, unit_number: 1, title: 'Introduction & Supervised Learning', topics: 'Definition of learning systems, goals and applications, supervised learning. Linear/Logistic Regression, Regularization.', pdf_url: '/syllabus/ml_unit1.pdf' },
          { id: 2, subject, unit_number: 2, title: 'Decision Trees & Naive Bayes', topics: 'ID3/C4.5 decision tree models, information gain, Naive Bayes classifier.', pdf_url: '/syllabus/ml_unit2.pdf' }
        ];
      }
      return [];
    }
  },

  async createSyllabusUnit(data: { subject: string; unit_number: number; title: string; topics: string; pdf_url?: string }): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/syllabus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create syllabus unit');
      return await response.json();
    } catch (error) {
      console.warn('Backend createSyllabusUnit failed, saving locally.', error);
      const current = await this.getSyllabus(data.subject);
      const newUnit = { id: Math.max(0, ...current.map((u: any) => u.id)) + 1, ...data };
      const updated = [...current, newUnit];
      localStorage.setItem(`mock_syllabus_${data.subject}`, JSON.stringify(updated));
      return newUnit;
    }
  },

  async bulkUploadSyllabus(subject: string, units: any[], overwrite: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/syllabus/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, units, overwrite })
      });
      if (!response.ok) throw new Error('Failed to bulk upload syllabus');
      return await response.json();
    } catch (error) {
      console.warn('Backend bulkUploadSyllabus failed, saving locally.', error);
      let updated = [];
      if (!overwrite) {
        updated = await this.getSyllabus(subject);
      }
      let startId = Math.max(0, ...updated.map((u: any) => u.id)) + 1;
      const formatted = units.map((u, idx) => ({ id: startId + idx, subject, ...u }));
      updated = [...updated, ...formatted];
      localStorage.setItem(`mock_syllabus_${subject}`, JSON.stringify(updated));
      return { status: 'success', count: units.length };
    }
  }
};

