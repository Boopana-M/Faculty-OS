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
            name: 'Preethi R',
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
          name: 'Preethi R',
          email: 'demo@faculty.edu',
          department: 'Computer Science & Engineering',
          designation: 'Professor & Head',
        }
      };
    }
  },

  streamChat(
    agentId: string,
    message: string,
    history: any[],
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
      
      const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant');
      const lastAssistantContent = lastAssistantMsg ? lastAssistantMsg.content : '';

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
      } else if (msgLower.includes('/draft-mail-type leave')) {
        mockReply = "Great! Let's draft a **Leave Permission** email.\n\nHow many days of leave do you need, and what is the reason? Please select an option below or write your own details in the chat.";
        richData = {
          type: 'interactive_choices',
          choices: [
            { label: '1 day, personal work', value: '/draft-mail-leave-details 1 day, personal urgent work at home' },
            { label: '2 days, personal work', value: '/draft-mail-leave-details 2 days, personal urgent work at home' },
            { label: '3 days, medical reasons', value: '/draft-mail-leave-details 3 days, medical reason (fever)' },
            { label: 'Write my own details...', value: '/draft-mail-leave-custom', action: 'custom' }
          ]
        };
      } else if (msgLower.includes('/draft-mail-leave-custom')) {
        mockReply = "Please type how many days and the reason for your leave: (e.g. '2 days for personal work')";
      } else if (msgLower.includes('/draft-mail-leave-details') || (lastAssistantContent && lastAssistantContent.includes('Please type how many days and the reason for your leave'))) {
        const details = msgLower.includes('/draft-mail-leave-details')
          ? message.replace('/draft-mail-leave-details', '').trim()
          : message.trim();
        toolCalls = [{ name: 'draft_email', status: 'success', result: 'Configured email draft helper.' }];
        mockReply = `Here is a drafted leave request email for you:\n\n**Subject:** Application for Casual Leave - Preethi R\n\n**Body:**\nDear Head of Department,\n\nI am writing to formally request leave for ${details}.\n\nI have arranged for my classes to be handled during this period and will be reachable via phone and email if anything urgent arises.\n\nThank you for your consideration.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept.`;
        richData = {
          type: 'email_draft',
          to_name: 'HOD',
          purpose: 'Leave Request',
          subject: 'Application for Casual Leave - Preethi R',
          body: `Dear Head of Department,\n\nI am writing to formally request leave for ${details}.\n\nI have arranged for my classes to be handled during this period and will be reachable via phone and email if anything urgent arises.\n\nThank you for your consideration.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept.`
        };
      } else if (msgLower.includes('/draft-mail-type instruction')) {
        mockReply = "Great! Let's draft an **Instruction to Students** email.\n\nWhat is the instruction/announcement? Please select a recommendation below or write your own details.";
        richData = {
          type: 'interactive_choices',
          choices: [
            { label: 'Class cancelled tomorrow', value: '/draft-mail-instruction-details Class is cancelled tomorrow due to faculty development program' },
            { label: 'Assignment due next week', value: '/draft-mail-instruction-details Homework assignment 4 is due next Tuesday at 5 PM' },
            { label: 'Exam schedule reminder', value: '/draft-mail-instruction-details The mid-term exam will be held on Monday at LH-201 at 10 AM' },
            { label: 'Write my own details...', value: '/draft-mail-instruction-custom', action: 'custom' }
          ]
        };
      } else if (msgLower.includes('/draft-mail-instruction-custom')) {
        mockReply = "Please type the details of the instruction/announcement for students:";
      } else if (msgLower.includes('/draft-mail-instruction-details') || (lastAssistantContent && lastAssistantContent.includes('details of the instruction/announcement for students'))) {
        const details = msgLower.includes('/draft-mail-instruction-details')
          ? message.replace('/draft-mail-instruction-details', '').trim()
          : message.trim();
        toolCalls = [{ name: 'draft_email', status: 'success', result: 'Configured email draft helper.' }];
        mockReply = `Here is a drafted reminder email for your students:\n\n**Subject:** Important Class Update for Students\n\n**Body:**\nDear Students,\n\nPlease note the following update regarding our course:\n\n${details}.\n\nPlease plan accordingly and reach out if you have any questions.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept.`;
        richData = {
          type: 'email_draft',
          to_name: 'Students',
          purpose: 'Class Update',
          subject: 'Important Class Update for Students',
          body: `Dear Students,\n\nPlease note the following update regarding our course:\n\n${details}.\n\nPlease plan accordingly and reach out if you have any questions.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept.`
        };
      } else if (msgLower.includes('/draft-mail-type inquiry')) {
        mockReply = "Great! Let's draft a **General Inquiry** email.\n\nWho is the recipient, and what is the inquiry? Please select an option below or write your own details.";
        richData = {
          type: 'interactive_choices',
          choices: [
            { label: 'To HOD: Room allocation', value: '/draft-mail-inquiry-details To HOD, inquiry about seminar hall availability this Friday' },
            { label: 'To Admin: Salary status', value: '/draft-mail-inquiry-details To Admin, inquiry about salary disbursement status' },
            { label: 'Write my own details...', value: '/draft-mail-inquiry-custom', action: 'custom' }
          ]
        };
      } else if (msgLower.includes('/draft-mail-inquiry-custom')) {
        mockReply = "Please type who the recipient is and what you would like to inquire about: (e.g. 'To HOD, asking for syllabus copy')";
      } else if (msgLower.includes('/draft-mail-inquiry-details') || (lastAssistantContent && lastAssistantContent.includes('recipient is and what you would like to inquire about'))) {
        const details = msgLower.includes('/draft-mail-inquiry-details')
          ? message.replace('/draft-mail-inquiry-details', '').trim()
          : message.trim();
        const to_name = details.startsWith('To') ? details.split(',')[0].replace('To ', '').trim() : 'Recipient';
        const inquiryText = details.split(',')[1]?.trim() || details;
        toolCalls = [{ name: 'draft_email', status: 'success', result: 'Configured email draft helper.' }];
        mockReply = `Here is a drafted inquiry email for you:\n\n**Subject:** Inquiry: ${inquiryText}\n\n**Body:**\nDear ${to_name},\n\nI hope this email finds you well.\n\nI am writing to inquire about the following:\n${inquiryText}.\n\nKindly let me know the status at your earliest convenience.\n\nThank you,\nPreethi R\nProfessor & Head, CSE Dept.`;
        richData = {
          type: 'email_draft',
          to_name: to_name,
          purpose: 'General Inquiry',
          subject: `Inquiry: ${inquiryText}`,
          body: `Dear ${to_name},\n\nI hope this email finds you well.\n\nI am writing to inquire about the following:\n${inquiryText}.\n\nKindly let me know the status at your earliest convenience.\n\nThank you,\nPreethi R\nProfessor & Head, CSE Dept.`
        };
      } else if (msgLower.includes('/draft-mail-type custom')) {
        mockReply = "Please type the subject of the email you would like to draft:";
      } else if (lastAssistantContent && lastAssistantContent.includes('type the subject of the email')) {
        mockReply = `Got it. Subject will be: "${message}".\n\nWho is the recipient, and what is the main content/purpose of this email? (e.g. 'To Dean, discussing the new syllabus changes')`;
      } else if (lastAssistantContent && lastAssistantContent.includes('Who is the recipient, and what is the main content/purpose')) {
        const findCustomSubject = () => {
          const reversedHistory = [...history].reverse();
          for (let i = 0; i < reversedHistory.length; i++) {
            if (reversedHistory[i].role === 'assistant' && reversedHistory[i].content.includes('type the subject of the email')) {
              const userMsg = reversedHistory[i - 1];
              if (userMsg && userMsg.role === 'user') {
                return userMsg.content;
              }
            }
          }
          return 'General Draft';
        };
        const subject = findCustomSubject();
        const to_name = message.startsWith('To') ? message.split(',')[0].replace('To ', '').trim() : 'Recipient';
        const bodyText = message.split(',')[1]?.trim() || message;
        toolCalls = [{ name: 'draft_email', status: 'success', result: 'Configured email draft helper.' }];
        mockReply = `Here is your custom drafted email:\n\n**Subject:** ${subject}\n\n**Body:**\nDear ${to_name},\n\nI hope this email finds you well.\n\nRegarding: ${subject}\n\n${bodyText}.\n\nThank you.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept.`;
        richData = {
          type: 'email_draft',
          to_name: to_name,
          purpose: 'Custom Draft',
          subject: subject,
          body: `Dear ${to_name},\n\nI hope this email finds you well.\n\nRegarding: ${subject}\n\n${bodyText}.\n\nThank you.\n\nSincerely,\nPreethi R\nProfessor & Head, CSE Dept.`
        };
      } else if (msgLower.includes('/draft-mail') || msgLower === 'draft a mail' || msgLower === 'draft mail') {
        mockReply = "I can help you draft a professional email. Please select one of the common subjects below or write your own subject:\n\n1. 📝 **Leave Permission**\n2. 🎓 **Instruction to Students**\n3. 📋 **General Inquiry**\n4. ✍️ **Write my own subject...**";
        richData = {
          type: 'interactive_choices',
          choices: [
            { label: 'Leave Permission', value: '/draft-mail-type leave', icon: '📝' },
            { label: 'Instruction to Students', value: '/draft-mail-type instruction', icon: '🎓' },
            { label: 'General Inquiry', value: '/draft-mail-type inquiry', icon: '📋' },
            { label: 'Write my own subject...', value: '/draft-mail-type custom', icon: '✍️' }
          ]
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
    fetch(`${API_BASE_URL}/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history, faculty_id: 1 })
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
  },

  // ==========================================
  // ACADEMIC WORKFLOW API WRAPPERS
  // ==========================================
  async getAttendance(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return await response.json();
    } catch (error) {
      console.warn('Backend getAttendance failed, returning mock data.', error);
      return [
        { id: 1, roll_no: "24CC001", name: "A. Kumar", date: "2026-07-27", status: "Absent", period: "09:00 - 10:00", subject: "Design & Analysis of Algorithms", class_section: "CSE-A" },
        { id: 2, roll_no: "24CC002", name: "B. Priya", date: "2026-07-27", status: "Present", period: "09:00 - 10:00", subject: "Design & Analysis of Algorithms", class_section: "CSE-A" },
        { id: 3, roll_no: "24CC003", name: "C. Dinesh", date: "2026-07-27", status: "Present", period: "09:00 - 10:00", subject: "Design & Analysis of Algorithms", class_section: "CSE-A" }
      ];
    }
  },

  async markAttendance(roll_no: string, date: string, status: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no, date, status })
      });
      if (!response.ok) throw new Error('Failed to mark attendance');
      return await response.json();
    } catch (error) {
      console.warn('Backend markAttendance failed.', error);
      return { status: 'success' };
    }
  },

  async getAssignments(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return await response.json();
    } catch (error) {
      console.warn('Backend getAssignments failed, returning mock data.', error);
      return [
        { id: 1, title: "Assignment 1: Divide & Conquer Analysis", subject: "Design & Analysis of Algorithms", class_section: "CSE-A", due_date: "2026-07-20", max_marks: 10, status: "Graded", submissions_count: 5, graded_count: 5 },
        { id: 2, title: "Assignment 2: Greedy Knapsack & Prim's", subject: "Design & Analysis of Algorithms", class_section: "CSE-A", due_date: "2026-08-05", max_marks: 10, status: "Open", submissions_count: 4, graded_count: 0 }
      ];
    }
  },

  async scheduleAssignment(title: string, due_date: string, class_section: string, max_marks: number): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, due_date, class_section, max_marks })
      });
      if (!response.ok) throw new Error('Failed to schedule assignment');
      return await response.json();
    } catch (error) {
      console.warn('Backend scheduleAssignment failed.', error);
      return { status: 'success' };
    }
  },

  async getMarks(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marks`);
      if (!response.ok) throw new Error('Failed to fetch marks');
      return await response.json();
    } catch (error) {
      console.warn('Backend getMarks failed, returning mock data.', error);
      return [
        { id: 1, roll_no: "24CC001", name: "A. Kumar", subject: "Design & Analysis of Algorithms", cat1_marks: 11, cat2_marks: 9, assignment_marks: 8, lab_marks: 9, total_marks: 37, attendance_percentage: 40 },
        { id: 2, roll_no: "24CC002", name: "B. Priya", subject: "Design & Analysis of Algorithms", cat1_marks: 14, cat2_marks: 15, assignment_marks: 10, lab_marks: 10, total_marks: 49, attendance_percentage: 100 }
      ];
    }
  },

  async calculateMarks(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marks/calculate`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to calculate marks');
      return await response.json();
    } catch (error) {
      return { status: 'success' };
    }
  },

  // ==========================================
  // ANALYTICS & ACCREDITATION API WRAPPERS
  // ==========================================
  async getAnalyticsKpis(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/kpis`);
      if (!response.ok) throw new Error('Failed to fetch analytics KPIs');
      return await response.json();
    } catch (error) {
      return {
        total_students: 8,
        avg_attendance: 87,
        avg_internal_marks: '34/50',
        co_attainment_rate: '60%'
      };
    }
  },

  async getAnalyticsCharts(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/charts`);
      if (!response.ok) throw new Error('Failed to fetch charts');
      return await response.json();
    } catch (error) {
      return {
        performance_chart: [
          { range: '0-10', count: 0 },
          { range: '10-20', count: 2 },
          { range: '20-30', count: 3 },
          { range: '30-40', count: 2 },
          { range: '40-50', count: 1 }
        ],
        attendance_chart: [
          { date: '07-23', rate: 90 },
          { date: '07-24', rate: 85 },
          { date: '07-25', rate: 88 },
          { date: '07-26', rate: 84 },
          { date: '07-27', rate: 87 }
        ],
        co_chart: [
          { co: 'CO1', target: 75, attained: 80 },
          { co: 'CO2', target: 75, attained: 60 },
          { co: 'CO3', target: 75, attained: 95 }
        ]
      };
    }
  },

  async getAtRiskAnalytics(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/at-risk`);
      if (!response.ok) throw new Error('Failed to fetch at-risk analytics');
      return await response.json();
    } catch (error) {
      return [
        { roll_no: "24CC001", name: "A. Kumar", attendance: 40, marks: 37, risk_level: "High" }
      ];
    }
  },

  async getAnalyticsPDF(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/report/pdf`);
      return await response.json();
    } catch (error) {
      return { status: 'success', message: 'Styled Draft PDF report generated on Letterhead.' };
    }
  },

  // ==========================================
  // RESEARCH & GRANTS API WRAPPERS
  // ==========================================
  async getPublications(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/research/publications`);
      if (!response.ok) throw new Error('Failed to fetch publications');
      return await response.json();
    } catch (error) {
      return [
        { id: 1, title: "An Efficient Deep Learning Framework for Brain Tumor Segmentation", venue: "IEEE Transactions on Medical Imaging", type: "journal", year: 2026, co_authors: "S. Ram, V. Krish", doi_or_link: "10.1109/TMI.2026.123456", citation_count: 4 },
        { id: 2, title: "Distributed Consensus Protocols in Wireless Sensor Networks", venue: "International Journal of Computer Networks", type: "journal", year: 2025, co_authors: "R. Kapoor", doi_or_link: "10.1016/j.comnet.2025.04.12", citation_count: 12 }
      ];
    }
  },

  async logPublication(title: string, venue: string, type: string, year: number, co_authors?: string, doi_or_link?: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/research/publications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, venue, type, year, co_authors, doi_or_link })
      });
      if (!response.ok) throw new Error('Failed to log publication');
      return await response.json();
    } catch (error) {
      return { status: 'success' };
    }
  },

  async getGrants(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/research/grants`);
      if (!response.ok) throw new Error('Failed to fetch grants');
      return await response.json();
    } catch (error) {
      return [
        { id: 1, title: "Research Promotion Scheme (RPS) in AI/ML", funding_body: "AICTE", amount: "8 Lakhs", eligibility: "Full-time faculty with Ph.D.", deadline: "2026-08-15", focus_area: "Machine Learning, Computer Vision" },
        { id: 2, title: "Core Research Grant (CRG)", funding_body: "SERB", amount: "35 Lakhs", eligibility: "Ph.D. degree, regular position", deadline: "2026-09-30", focus_area: "Data Science, IoT" }
      ];
    }
  },

  async getResearchDeadlines(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/research/deadlines`);
      if (!response.ok) throw new Error('Failed to fetch research deadlines');
      return await response.json();
    } catch (error) {
      return [
        { id: 1, title: "AICTE RPS Grant Application", type: "submission", due_date: "2026-08-15" },
        { id: 2, title: "IEEE Cloud Computing Conference Camera-Ready", type: "review", due_date: "2026-07-30" },
        { id: 3, title: "Patent Renewal: Smart Microgrid Controller", type: "renewal", due_date: "2026-08-27" }
      ];
    }
  },

  // ==========================================
  // EXAM & ASSESSMENT API WRAPPERS
  // ==========================================
  async getQuestionsBank(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exam/questions`);
      if (!response.ok) throw new Error('Failed to fetch questions');
      return await response.json();
    } catch (error) {
      return [
        { id: 1, subject: "Design & Analysis of Algorithms", unit: 1, co_number: "CO1", bloom_level: "Remember", question_text: "Define Asymptotic Notation and list the three primary types.", marks: 5, difficulty: "Easy" }
      ];
    }
  },

  async generatePaper(data: any): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exam/generate-paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to generate paper');
      return await response.json();
    } catch (error) {
      return {
        status: 'success',
        paper_id: 1,
        questions: [
          { id: 1, question_text: "Define Asymptotic Notation and list the three primary types.", marks: 5, co: "CO1", bloom_level: "Remember" }
        ]
      };
    }
  },

  async getGeneratedPapers(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exam/papers`);
      if (!response.ok) throw new Error('Failed to fetch papers');
      return await response.json();
    } catch (error) {
      return [];
    }
  },

  async moderateQuestionPaper(paperId: number, status: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exam/papers/${paperId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to moderate paper');
      return await response.json();
    } catch (error) {
      return { status: 'success' };
    }
  },

  async getRubricSchema(data: any): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exam/generate-rubric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to fetch rubric');
      return await response.json();
    } catch (error) {
      return [
        { criterion: "Technical Correctness", max_marks: 5, descriptor: "Algorithm correctly solves all edge cases." }
      ];
    }
  },

  // ==========================================
  // MENTOR & WELLBEING API WRAPPERS
  // ==========================================
  async getMentees(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mentor/mentees`);
      if (!response.ok) throw new Error('Failed to fetch mentees');
      return await response.json();
    } catch (error) {
      return [
        { id: 1, student_id: 1, roll_no: "24CC001", name: "A. Kumar", class_section: "CSE-A", last_checkin_date: "2026-06-29", is_overdue: true },
        { id: 2, student_id: 2, roll_no: "24CC002", name: "B. Priya", class_section: "CSE-A", last_checkin_date: "2026-07-24", is_overdue: false }
      ];
    }
  },

  async getMenteeTimeline(studentId: number): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mentor/timeline/${studentId}`);
      if (!response.ok) throw new Error('Failed to fetch timelines');
      return await response.json();
    } catch (error) {
      return [
        { id: 1, date: "2026-07-13", mode: "in-person", notes: "Expressed difficulty in understanding DAA.", mood_tag: "needs attention" }
      ];
    }
  },

  async logCheckin(studentId: number, mode: string, notes: string, mood_tag: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mentor/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, mode, notes, mood_tag })
      });
      if (!response.ok) throw new Error('Failed to log checkin');
      return await response.json();
    } catch (error) {
      return { status: 'success' };
    }
  },

  async escalateMentee(studentId: number, reason: string, escalated_to: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mentor/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, reason, escalated_to })
      });
      if (!response.ok) throw new Error('Failed to escalate mentee');
      return await response.json();
    } catch (error) {
      return { status: 'success' };
    }
  },

  async getSuggestedWellbeingPrompt(studentId: number): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mentor/suggest-prompt/${studentId}`);
      if (!response.ok) throw new Error('Failed to suggest prompt');
      return await response.json();
    } catch (error) {
      return { prompt: "Hi, I wanted to check in on how you're feeling lately and if you're facing any academic issues." };
    }
  }
};

