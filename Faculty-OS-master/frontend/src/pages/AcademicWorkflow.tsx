import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Calendar, CheckSquare, Layers, Send, Sparkles, User, AlertCircle, ChevronRight, Play, MessageSquare, Plus, Save } from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface AcademicWorkflowProps {
  user: UserType;
}

export const AcademicWorkflow: React.FC<AcademicWorkflowProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'assignments' | 'marks' | 'reminders'>('attendance');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Chat drawer states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Form states
  const [newAssignTitle, setNewAssignTitle] = useState('');
  const [newAssignDate, setNewAssignDate] = useState('');
  const [newAssignClass, setNewAssignClass] = useState('CSE-A');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const attData = await api.getAttendance();
      const assData = await api.getAssignments();
      const markData = await api.getMarks();
      // fetch reminders
      const remData = await fetch('http://localhost:8000/api/reminders').then(r => r.json()).catch(() => [
        {id: 1, task: "Grade DAA Assignment 2 (Greedy)", due: "2026-08-05", urgency: "high"},
        {id: 2, task: "Syllabus mapping validation for CAT2 papers", "due": "2026-08-06", "urgency": "medium"},
        {id: 3, task: "Mentee check-in with A. Kumar (overdue)", "due": "2026-07-30", "urgency": "high"}
      ]);
      
      setAttendance(attData);
      setAssignments(assData);
      setMarks(markData);
      setReminders(remData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleAttendance = async (roll_no: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present';
    try {
      await api.markAttendance(roll_no, "2026-07-27", newStatus);
      // update state
      setAttendance(prev => prev.map(a => a.roll_no === roll_no ? { ...a, status: newStatus } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignTitle || !newAssignDate) return;
    try {
      await api.scheduleAssignment(newAssignTitle, newAssignDate, newAssignClass, 10);
      setNewAssignTitle('');
      setNewAssignDate('');
      const assData = await api.getAssignments();
      setAssignments(assData);
    } catch (e) {
      console.error(e);
    }
  };

  // Chat handling
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setStreamingText('');
    setStreamingTraces([]);
    setIsLoading(true);

    api.streamChat(
      'agent2',
      chatInput,
      chatMessages,
      (chunk) => {
        setStreamingText(prev => prev + chunk);
      },
      (trace) => {
        setStreamingTraces(prev => {
          const idx = prev.findIndex(t => t.name === trace.name);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = trace;
            return updated;
          }
          return [...prev, trace];
        });
      },
      (toolCalls, richData) => {
        setChatMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            role: 'assistant',
            content: streamingText,
            timestamp: new Date().toLocaleTimeString(),
            toolCalls,
            richData
          }
        ]);
        setStreamingText('');
        setIsLoading(false);
        loadData(); // reload dashboard data in case database changed
      },
      (err) => {
        console.error(err);
        setIsLoading(false);
      }
    );
  };

  useEffect(() => {
    if (chatMessages.length > 1 || streamingText) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages, streamingText]);

  // Attendance summary metrics
  const totalStudents = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'Present').length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 100;

  return (
    <div className="h-full flex flex-col relative bg-paper text-ink overflow-hidden font-ui">
      
      {/* Top Header Row with Accent Wash */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent2" icon={BookOpen} size="md" className="bg-emerald-600" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Academic Workflow</h1>
            <p className="text-xs text-ink-muted">Daily operations: Attendance grid, assignments, marks register, and checklists.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20 text-emerald-400">
          <span className="text-xs font-mono font-semibold uppercase">ACTIVE: CSE-A (DAA)</span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border/60 mb-6 gap-2">
        {(['attendance', 'assignments', 'marks', 'reminders'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2.5 px-4 text-xs font-mono uppercase tracking-wider border-b-2 transition-all ${
              activeTab === tab 
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-ink-muted hover:text-ink hover:bg-surface/30'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 overflow-y-auto pr-1 pb-16">
        
        {/* Tab 1: Attendance Grid */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* KPI Summary Block */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-ink-muted uppercase">Today's Class</div>
                  <div className="font-display text-3xl font-bold text-ink mt-1">CSE-A</div>
                </div>
                <Badge variant="accent">09:00 - 10:00</Badge>
              </Card>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-ink-muted uppercase">Total Strength</div>
                  <div className="font-display text-3xl font-bold text-ink mt-1">{totalStudents}</div>
                </div>
                <User className="text-emerald-500" size={24} />
              </Card>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-ink-muted uppercase">Present Rate</div>
                  <div className="font-display text-4xl font-bold text-emerald-400 mt-1">{attendanceRate}%</div>
                </div>
                <div className="text-xs text-ink-muted">Target: 75% min</div>
              </Card>
            </div>

            {/* Attendance Spreadsheet Grid */}
            <Card>
              <div className="text-xs font-semibold text-ink-muted uppercase font-mono mb-4">Roll Call Grid</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border pb-2 text-ink-muted">
                      <th className="py-2.5 font-mono">ROLL NO</th>
                      <th className="py-2.5">STUDENT NAME</th>
                      <th className="py-2.5">DATE</th>
                      <th className="py-2.5 text-center">STATUS</th>
                      <th className="py-2.5 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 hover:bg-surface/20 transition">
                        <td className="py-3 font-mono font-medium text-emerald-400">{row.roll_no}</td>
                        <td className="py-3 font-semibold">{row.name}</td>
                        <td className="py-3 text-ink-muted font-mono">{row.date}</td>
                        <td className="py-3 text-center">
                          <Badge variant={row.status === 'Present' ? 'success' : 'danger'}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-[10px] py-1 px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleToggleAttendance(row.roll_no, row.status)}
                          >
                            Toggle
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Assignments (Kanban columns) */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            
            {/* Quick schedule form */}
            <Card className="p-4 bg-surface/50 border-dashed">
              <form onSubmit={handleCreateAssignment} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Assignment Title</label>
                  <Input 
                    placeholder="e.g. Assignment 4: Greedy Huffman coding" 
                    value={newAssignTitle}
                    onChange={e => setNewAssignTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Due Date</label>
                  <Input 
                    type="date" 
                    value={newAssignDate}
                    onChange={e => setNewAssignDate(e.target.value)}
                  />
                </div>
                <Button variant="primary" type="submit" className="bg-emerald-500 hover:bg-emerald-700 text-black">
                  <Plus size={14} className="mr-1.5" /> Schedule
                </Button>
              </form>
            </Card>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(['Scheduled', 'Open', 'Grading', 'Closed'] as const).map((col) => {
                const colTasks = assignments.filter(a => a.status === col);
                return (
                  <div key={col} className="bg-surface/40 rounded-radius-md p-4 border border-border/80 flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                      <span className="text-xs font-semibold uppercase tracking-wider font-mono text-ink">{col}</span>
                      <span className="bg-border text-ink-muted text-[10px] px-1.5 py-0.5 rounded font-mono">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3">
                      {colTasks.map((t) => (
                        <Card key={t.id} className="p-3 border-border hover:border-emerald-500/50 transition duration-200">
                          <div className="text-xs font-bold mb-2 line-clamp-2">{t.title}</div>
                          <div className="flex items-center justify-between text-[10px] text-ink-muted font-mono mt-2">
                            <span>Due: {t.due_date}</span>
                            <Badge variant="neutral">Sub: {t.submissions_count}</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Marks Grid */}
        {activeTab === 'marks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-ink-muted uppercase">Continuous Evaluation Sheet (DAA)</span>
              <Button size="sm" variant="secondary" onClick={() => api.calculateMarks().then(loadData)} className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                Recalculate Totals
              </Button>
            </div>
            
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface/30">
                      <th className="py-3 px-4 font-mono">ROLL NO</th>
                      <th className="py-3 px-4">STUDENT NAME</th>
                      <th className="py-3 px-4 font-mono text-center">CAT-1 (15)</th>
                      <th className="py-3 px-4 font-mono text-center">CAT-2 (15)</th>
                      <th className="py-3 px-4 font-mono text-center">ASSG (10)</th>
                      <th className="py-3 px-4 font-mono text-center">LAB (10)</th>
                      <th className="py-3 px-4 font-mono text-center bg-emerald-500/10 text-emerald-400">TOTAL (50)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 hover:bg-surface/20 transition">
                        <td className="py-3 px-4 font-mono text-ink-muted">{row.roll_no}</td>
                        <td className="py-3 px-4 font-bold">{row.name}</td>
                        <td className="py-3 px-4 text-center font-mono">{row.cat1_marks}</td>
                        <td className="py-3 px-4 text-center font-mono">{row.cat2_marks}</td>
                        <td className="py-3 px-4 text-center font-mono">{row.assignment_marks}</td>
                        <td className="py-3 px-4 text-center font-mono">{row.lab_marks}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold bg-emerald-500/5 text-emerald-400">{row.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 4: Reminders */}
        {activeTab === 'reminders' && (
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="text-sm font-semibold font-mono text-ink-muted uppercase">Pending Faculty Action Tasks</h2>
            <div className="space-y-3">
              {reminders.map((r) => (
                <div 
                  key={r.id} 
                  className={`flex items-center justify-between p-4 bg-surface rounded-radius-md border border-border border-l-4 ${
                    r.urgency === 'high' ? 'border-l-status-bad' : 'border-l-status-warn'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className="text-emerald-500" size={18} />
                    <div>
                      <div className="text-xs font-semibold">{r.task}</div>
                      <div className="text-[10px] text-ink-muted mt-0.5">Due: {r.due}</div>
                    </div>
                  </div>
                  <Badge variant={r.urgency === 'high' ? 'danger' : 'warning'}>
                    {r.urgency}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Floating Chat Drawer */}
      <div className={`fixed bottom-6 right-6 z-40 flex flex-col transition-all duration-300 ${
        isChatOpen ? 'w-96 h-[500px]' : 'w-12 h-12'
      }`}>
        {isChatOpen ? (
          <Card className="h-full flex flex-col shadow-2xl border-emerald-500/30 overflow-hidden bg-surface">
            {/* Drawer Header */}
            <div className="p-3 bg-paper border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Seal agentId="agent2" icon={BookOpen} size="sm" className="bg-emerald-600" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">Workflow Chat</span>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-ink-muted hover:text-ink text-xs font-mono">
                [CLOSE]
              </button>
            </div>
            
            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {chatMessages.length === 0 && (
                <div className="text-ink-muted text-center py-12">
                  <BookOpen size={24} className="mx-auto mb-2 text-emerald-500/40" />
                  Ask me questions about attendance rates, assignment submission counts, or internal mark grades.
                </div>
              )}
              {chatMessages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-radius-md p-2.5 ${
                    m.role === 'user' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-paper border border-border text-ink'
                  }`}>
                    {m.content}
                  </div>
                  <span className="text-[8px] text-ink-muted mt-1 font-mono">{m.timestamp}</span>
                </div>
              ))}
              
              {/* Tool Traces */}
              {streamingTraces.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2 font-mono text-[9px] text-emerald-400/80 bg-emerald-500/5 px-2.5 py-1 rounded">
                  <Play size={8} className="animate-pulse" />
                  <span>Executing {t.name}... Status: {t.status}</span>
                </div>
              ))}

              {streamingText && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[85%] rounded-radius-md p-2.5 bg-paper border border-border text-ink whitespace-pre-wrap">
                    {streamingText}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Row */}
            <div className="p-3 bg-paper border-t border-border flex gap-2">
              <Input 
                placeholder="Ask about marks or attendance..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                className="text-xs"
              />
              <Button onClick={handleSendChat} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-black">
                <Send size={12} />
              </Button>
            </div>
          </Card>
        ) : (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 active:scale-95 transition"
            title="Open Workflow Assistant"
          >
            <MessageSquare size={20} />
          </button>
        )}
      </div>

    </div>
  );
};
