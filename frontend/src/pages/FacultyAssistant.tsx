import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Calendar, Mail, BookOpen, FileText, Search, Copy, Check, ChevronDown, ChevronUp, Clock, MapPin, ArrowRight, Edit, Trash2, Plus, Upload, X, AlertTriangle } from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User } from '../services/api';

interface FacultyAssistantProps {
  user: User;
}

export const FacultyAssistant: React.FC<FacultyAssistantProps> = ({ user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [policyQuery, setPolicyQuery] = useState('');
  const [policyResults, setPolicyResults] = useState<any[] | null>(null);
  
  // States for interactive draft editing
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  
  // State for expanded lesson plans / cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  // State for copied status
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Schedule Management States
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedViewDay, setSelectedViewDay] = useState(() => {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    return ['Saturday', 'Sunday'].includes(day) ? 'Monday' : day;
  });
  
  // Schedule Form State
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [slotDay, setSlotDay] = useState('Monday');
  const [slotSubject, setSlotSubject] = useState('');
  const [slotPeriod, setSlotPeriod] = useState('');
  const [slotClass, setSlotClass] = useState('');
  const [slotRoom, setSlotRoom] = useState('');
  
  // Bulk upload state
  const [bulkText, setBulkText] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'bulk'>('list');


  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSchedules = async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data);
    } catch (e) {
      console.error("Failed to load schedules", e);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingTraces]);

  const handleAddOrUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotSubject || !slotPeriod || !slotClass || !slotRoom) {
      alert("Please fill in all fields.");
      return;
    }
    
    const data = {
      day_of_week: slotDay,
      period: slotPeriod,
      subject: slotSubject,
      class_section: slotClass,
      room: slotRoom
    };
    
    try {
      if (editingSlotId !== null) {
        await api.updateSchedule(editingSlotId, data);
      } else {
        await api.createSchedule(data);
      }
      
      setSlotSubject('');
      setSlotPeriod('');
      setSlotClass('');
      setSlotRoom('');
      setEditingSlotId(null);
      setActiveTab('list');
      
      await fetchSchedules();
    } catch (err) {
      console.error(err);
      alert("Failed to save schedule slot.");
    }
  };

  const handleEditClick = (slot: any) => {
    setEditingSlotId(slot.id);
    setSlotDay(slot.day_of_week);
    setSlotSubject(slot.subject);
    setSlotPeriod(slot.period);
    setSlotClass(slot.class_section);
    setSlotRoom(slot.room);
    setActiveTab('add');
  };

  const handleDeleteClick = async (slotId: number) => {
    if (!confirm("Are you sure you want to delete this class slot?")) return;
    try {
      await api.deleteSchedule(slotId);
      await fetchSchedules();
    } catch (err) {
      console.error(err);
      alert("Failed to delete slot.");
    }
  };

  const handleBulkSubmit = async () => {
    setBulkError(null);
    setBulkSuccess(null);
    
    if (!bulkText.trim()) {
      setBulkError("Please paste some CSV or JSON data.");
      return;
    }
    
    let slots: any[] = [];
    try {
      if (bulkText.trim().startsWith('[') || bulkText.trim().startsWith('{')) {
        const parsed = JSON.parse(bulkText);
        slots = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const lines = bulkText.split('\n');
        if (lines.length < 2) {
          setBulkError("Invalid CSV format. Need header and at least one data row.");
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',').map(v => v.trim());
          const slot: any = {};
          
          headers.forEach((header, index) => {
            if (header === 'day' || header === 'day_of_week') slot.day_of_week = values[index];
            else if (header === 'period' || header === 'time') slot.period = values[index];
            else if (header === 'subject') slot.subject = values[index];
            else if (header === 'class' || header === 'class_section' || header === 'section') slot.class_section = values[index];
            else if (header === 'room') slot.room = values[index];
          });
          
          if (slot.day_of_week && slot.period && slot.subject && slot.class_section && slot.room) {
            slots.push(slot);
          }
        }
      }
      
      if (slots.length === 0) {
        setBulkError("No valid slots parsed. Check your format and headers.");
        return;
      }
      
      const res = await api.bulkUploadSchedule(slots, bulkOverwrite);
      setBulkSuccess(`Successfully uploaded ${res.count || slots.length} slots!`);
      setBulkText('');
      await fetchSchedules();
      setTimeout(() => {
        setActiveTab('list');
        setBulkSuccess(null);
      }, 1500);
    } catch (err: any) {
      setBulkError(`Parsing/upload failed: ${err.message || err}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBulkText(text);
    };
    reader.readAsText(file);
  };


  const handleSendMessage = (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsgId = Math.random().toString(36).substring(7);
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setStreamingText('');
    streamingTextRef.current = '';
    setStreamingTraces([]);

    const assistantMsgId = Math.random().toString(36).substring(7);

    // Call the streaming API
    api.streamChat(
      text,
      // onChunk
      (chunk) => {
        streamingTextRef.current += chunk;
        setStreamingText(streamingTextRef.current);
      },
      // onTrace
      (trace) => {
        setStreamingTraces(prev => {
          // If already exists, update status
          const idx = prev.findIndex(t => t.name === trace.name);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = trace;
            return copy;
          }
          return [...prev, trace];
        });
      },
      // onDone
      (toolCalls, richData) => {
        const content = streamingTextRef.current;
        setMessages(prev => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            toolCalls: toolCalls,
            richData: richData
          }
        ]);
        setStreamingText('');
        streamingTextRef.current = '';
        setStreamingTraces([]);
        setIsLoading(false);
      },
      // onError
      (error) => {
        console.error('Chat stream error:', error);
        setMessages(prev => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: 'I encountered an error connecting to the orchestrator. Please verify the backend is running.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setStreamingText('');
        streamingTextRef.current = '';
        setStreamingTraces([]);
        setIsLoading(false);
      }
    );
  };

  const handleQuickAction = (action: string) => {
    let prompt = '';
    if (action === 'schedule') prompt = "What's my class schedule today?";
    else if (action === 'leave') prompt = "Draft a casual leave request for tomorrow";
    else if (action === 'syllabus') prompt = "Show syllabus details for DAA";
    else if (action === 'lesson') prompt = "Make a lesson plan for DAA Unit 1";
    
    handleSendMessage(prompt);
  };

  const handleSearchPolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyQuery.trim()) return;
    
    // Simulate/Call RAG policy search on the side panel
    try {
      // Direct call to fetch policy stubs or we hit /agents/chat with policy keyword
      setPolicyResults([
        {
          title: "Faculty Leave Policy 2026",
          source: "policies/leave_policy_2026.txt",
          snippet: "Casual Leave (CL): 12 days per calendar year. Maximum 3 consecutive days. Prior HOD approval required 24 hours in advance."
        },
        {
          title: "Student Attendance Policy",
          source: "policies/attendance_policy.txt",
          snippet: "Minimum 75% attendance mandatory for exam eligibility. Condonation permitted between 65-74% for medical reasons with HOD consent."
        }
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Rendering Functions for Rich Cards
  const renderScheduleCard = (data: any) => {
    if (!data || !data.schedule || data.schedule.length === 0) return null;
    return (
      <Card className="mt-3 border-l-4 border-l-agent1-500 overflow-hidden bg-surface/40">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display font-medium text-ink flex items-center gap-2">
            <Calendar className="text-agent1-500" size={16} /> 
            {data.day}'s Timetable
          </span>
          <Badge variant="success">Active Ledger</Badge>
        </div>
        <div className="divide-y divide-border/60">
          {data.schedule.map((slot: any, idx: number) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-agent1-100 flex flex-col items-center justify-center text-agent1-500 font-mono font-semibold text-xs border border-agent1-500/10">
                  <Clock size={12} className="mb-0.5" />
                  Slot
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-ink">{slot.subject}</h4>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <MapPin size={11} /> Room {slot.room} • {slot.class_section}
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-accent-500 bg-accent-100/50 py-1 px-2.5 rounded-radius-sm">
                {slot.period}
              </span>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const renderEmailDraftCard = (data: any, messageId: string) => {
    const isEditing = editingDraftId === messageId;
    const currentSubject = isEditing ? editSubject : data.subject;
    const currentBody = isEditing ? editBody : data.body;

    const startEditing = () => {
      setEditingDraftId(messageId);
      setEditSubject(data.subject);
      setEditBody(data.body);
    };

    const saveEdit = () => {
      data.subject = editSubject;
      data.body = editBody;
      setEditingDraftId(null);
    };

    return (
      <Card className="mt-3 border-l-4 border-l-indigo-500 bg-surface/50 p-4">
        <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
          <span className="text-sm font-semibold text-ink flex items-center gap-2">
            <Mail size={15} className="text-indigo-400" /> Draft Leave Application
          </span>
          <div className="flex gap-1.5">
            {isEditing ? (
              <Button size="sm" variant="primary" onClick={saveEdit} className="py-1 px-2 text-xs">
                Save
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={startEditing} className="py-1 px-2 text-xs">
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copyToClipboard(`Subject: ${currentSubject}\n\n${currentBody}`, messageId)}
              className="py-1 px-2 text-xs flex items-center gap-1"
            >
              {copiedId === messageId ? (
                <>
                  <Check size={12} /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted">Subject</label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="font-mono text-xs py-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted">Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 text-xs font-mono h-40 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/50"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 font-mono text-xs text-ink/90">
            <div className="bg-surface/50 p-2 rounded border border-border/40">
              <span className="text-ink-muted font-semibold">Subject:</span> {currentSubject}
            </div>
            <div className="bg-surface/50 p-3 rounded border border-border/40 whitespace-pre-wrap leading-relaxed h-44 overflow-y-auto">
              {currentBody}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderLessonPlanCard = (data: any, messageId: string) => {
    const isExpanded = expandedCards[messageId] ?? true;
    return (
      <Card className="mt-3 border-l-4 border-l-amber-500 bg-surface/50 p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleCard(messageId)}
        >
          <span className="text-sm font-semibold text-ink flex items-center gap-2">
            <BookOpen size={15} className="text-amber-400" /> 
            Lesson Plan: {data.subject}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="accent">Unit {data.unit}</Badge>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-3.5 pt-3.5 border-t border-border/60">
            <div>
              <h5 className="text-xs uppercase font-mono font-bold text-ink-muted tracking-wider mb-1">Learning Objective</h5>
              <p className="text-sm text-ink">{data.objectives}</p>
            </div>

            <div>
              <h5 className="text-xs uppercase font-mono font-bold text-ink-muted tracking-wider mb-2">Classroom Activities (50 mins)</h5>
              <div className="space-y-2">
                {data.activities.map((act: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 bg-surface/40 p-2.5 rounded border border-border/40">
                    <span className="font-mono text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                      {act.duration}
                    </span>
                    <div>
                      <h6 className="text-xs font-bold text-ink">{act.name}</h6>
                      <p className="text-xs text-ink-muted mt-0.5">{act.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface/60 p-2.5 rounded border border-border/60">
              <h5 className="text-xs uppercase font-mono font-bold text-ink-muted tracking-wider mb-1">Assessment & Homework</h5>
              <p className="text-xs text-ink">{data.assessment}</p>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderPolicyCitationsCard = (data: any) => {
    if (!data || !data.citations || data.citations.length === 0) return null;
    return (
      <Card className="mt-3 border-l-4 border-l-emerald-500 bg-surface/50 p-4">
        <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-2 font-mono">
          Cited Policy Documents
        </span>
        <div className="space-y-2">
          {data.citations.map((cite: any, idx: number) => (
            <div key={idx} className="bg-surface/60 p-2.5 rounded border border-border/60 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <FileText size={12} className="text-emerald-400" /> {cite.title}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">{cite.source}</span>
              </div>
              <p className="text-ink-muted italic leading-relaxed">"{cite.snippet}"</p>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full font-ui">
      
      {/* LEFT COLUMN: CHAT INTERFACE (Takes 2 columns in large layout) */}
      <div className="lg:col-span-2 flex flex-col h-[calc(100vh-140px)] border border-border/60 rounded-radius-md bg-surface/10 backdrop-blur-md overflow-hidden relative">
        
        {/* Chat Log Header */}
        <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Seal agentId="agent1" icon={Bot} size="sm" />
            <div>
              <h2 className="text-sm font-semibold text-ink">Personal Faculty Assistant</h2>
              <span className="text-xs text-status-good flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-status-good animate-ping" /> Online
              </span>
            </div>
          </div>
          <Badge variant="neutral">System 1.0</Badge>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none max-w-md mx-auto">
              <Seal agentId="agent1" icon={Bot} size="lg" className="mb-4 bg-indigo-600/80 animate-bounce" />
              <h3 className="font-display text-2xl text-ink font-medium">Good morning, {user.name}.</h3>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                You have <span className="text-accent-500 font-bold font-mono">2</span> classes scheduled for today. How can I assist you with your class records, syllabus data, or administrative tasks?
              </p>
              
              <div className="mt-8 grid grid-cols-2 gap-2.5 w-full">
                <button
                  onClick={() => handleQuickAction('schedule')}
                  className="bg-surface border border-border hover:border-accent-500 rounded p-3 text-left hover:bg-accent-100/10 transition group"
                >
                  <Calendar size={15} className="text-accent-500 mb-1 group-hover:scale-110 transition" />
                  <div className="text-xs font-semibold text-ink">What's on today?</div>
                  <div className="text-[10px] text-ink-muted mt-0.5">Check schedule & classes</div>
                </button>

                <button
                  onClick={() => handleQuickAction('leave')}
                  className="bg-surface border border-border hover:border-accent-500 rounded p-3 text-left hover:bg-accent-100/10 transition group"
                >
                  <Mail size={15} className="text-accent-500 mb-1 group-hover:scale-110 transition" />
                  <div className="text-xs font-semibold text-ink">Draft leave letter</div>
                  <div className="text-[10px] text-ink-muted mt-0.5">Write Casual Leave request</div>
                </button>

                <button
                  onClick={() => handleQuickAction('syllabus')}
                  className="bg-surface border border-border hover:border-accent-500 rounded p-3 text-left hover:bg-accent-100/10 transition group"
                >
                  <BookOpen size={15} className="text-accent-500 mb-1 group-hover:scale-110 transition" />
                  <div className="text-xs font-semibold text-ink">Show syllabus</div>
                  <div className="text-[10px] text-ink-muted mt-0.5">Lookup DAA units/topics</div>
                </button>

                <button
                  onClick={() => handleQuickAction('lesson')}
                  className="bg-surface border border-border hover:border-accent-500 rounded p-3 text-left hover:bg-accent-100/10 transition group"
                >
                  <FileText size={15} className="text-accent-500 mb-1 group-hover:scale-110 transition" />
                  <div className="text-xs font-semibold text-ink">Make lesson plan</div>
                  <div className="text-[10px] text-ink-muted mt-0.5">Build study plan structures</div>
                </button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <Seal agentId="agent1" icon={Bot} size="sm" className="mt-1" />
              )}
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                <div
                  className={`p-3.5 rounded-radius-md text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-agent1-100 text-ink border border-agent1-500/20'
                      : 'bg-surface border border-border text-ink shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-ui">{msg.content}</div>
                </div>

                {/* Render Rich Cards if data is attached */}
                {msg.role === 'assistant' && msg.richData && (
                  <>
                    {msg.richData.type === 'schedule' && renderScheduleCard(msg.richData)}
                    {msg.richData.type === 'email_draft' && renderEmailDraftCard(msg.richData, msg.id)}
                    {msg.richData.type === 'lesson_plan' && renderLessonPlanCard(msg.richData, msg.id)}
                    {msg.richData.type === 'policy' && renderPolicyCitationsCard(msg.richData)}
                  </>
                )}
                
                <span className="text-[10px] text-ink-muted font-mono mt-1 block px-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {/* Streaming Assistant Response */}
          {(streamingText || streamingTraces.length > 0) && (
            <div className="flex gap-3 justify-start">
              <Seal agentId="agent1" icon={Bot} size="sm" className="mt-1 animate-pulse" />
              <div className="max-w-[85%]">
                {/* Visual Handoff Trace Strip */}
                {streamingTraces.map((trace, idx) => (
                  <div 
                    key={idx} 
                    className="mb-2 bg-accent-100/50 border border-accent-500/10 rounded py-1.5 px-3 flex items-center justify-between text-xs font-mono text-accent-500"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-ping" />
                      Calling `{trace.name}()`...
                    </span>
                    <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-500 text-white">
                      {trace.status}
                    </span>
                  </div>
                ))}

                {streamingText && (
                  <div className="p-3.5 rounded-radius-md text-sm bg-surface border border-border text-ink shadow-sm">
                    <div className="whitespace-pre-wrap font-ui">{streamingText}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Action input panel */}
        <div className="p-4 border-t border-border bg-surface/30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            <Input
              type="text"
              placeholder="Ask me to show schedule, draft an email, lookup policy, or lesson plan..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="py-3 px-4 text-sm"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !inputText.trim()}
              className="px-5 py-3 h-[42px] flex items-center gap-2"
            >
              <Send size={14} /> Send
            </Button>
          </form>
          
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleQuickAction('schedule')}
              className="text-[10px] font-mono text-ink-muted hover:text-accent-500 bg-surface/60 border border-border px-2 py-1 rounded hover:border-accent-500 transition"
            >
              /schedule
            </button>
            <button
              onClick={() => handleQuickAction('leave')}
              className="text-[10px] font-mono text-ink-muted hover:text-accent-500 bg-surface/60 border border-border px-2 py-1 rounded hover:border-accent-500 transition"
            >
              /leave-draft
            </button>
            <button
              onClick={() => handleQuickAction('syllabus')}
              className="text-[10px] font-mono text-ink-muted hover:text-accent-500 bg-surface/60 border border-border px-2 py-1 rounded hover:border-accent-500 transition"
            >
              /syllabus-lookup
            </button>
            <button
              onClick={() => handleQuickAction('lesson')}
              className="text-[10px] font-mono text-ink-muted hover:text-accent-500 bg-surface/60 border border-border px-2 py-1 rounded hover:border-accent-500 transition"
            >
              /lesson-plan
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: TODAY AT A GLANCE & COMPACT POLICY SEARCH */}
      <div className="space-y-6">
        
        {/* Daily Schedule Card */}
        <Card className="border border-border/80 bg-surface shadow-soft">
          <div className="border-b border-border pb-3 mb-4 flex items-center justify-between">
            <h3 className="font-display font-medium text-lg text-ink flex items-center gap-2">
              <Calendar className="text-accent-500" size={18} /> Daily Schedule
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('list');
                setIsScheduleModalOpen(true);
              }}
              className="py-1 px-2 text-xs flex items-center gap-1 border-accent-500/30 text-accent-400 hover:bg-accent-500/10 hover:border-accent-500"
            >
              <Edit size={11} /> Manage
            </Button>
          </div>

          <div className="space-y-4">
            {/* Days Selector */}
            <div className="flex gap-1 bg-surface/50 p-1 rounded border border-border/40">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedViewDay(day)}
                  className={`flex-1 text-center py-1 rounded text-[11px] font-mono font-bold transition ${
                    selectedViewDay === day
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-ink-muted hover:text-ink hover:bg-surface/30'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Timetable Slots for Selected Day */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {schedules.filter(s => s.day_of_week === selectedViewDay).length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border/60 rounded">
                  <Clock className="mx-auto text-ink-muted mb-2 opacity-50" size={24} />
                  <p className="text-xs text-ink-muted">No classes scheduled for {selectedViewDay}</p>
                </div>
              ) : (
                schedules
                  .filter(s => s.day_of_week === selectedViewDay)
                  .sort((a, b) => a.period.localeCompare(b.period))
                  .map((slot) => (
                    <div key={slot.id} className="relative group bg-surface/40 hover:bg-surface/80 border border-border/40 hover:border-accent-500/30 rounded p-3 transition">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-ink">{slot.subject}</h4>
                          <span className="text-[10px] text-ink-muted block mt-1">
                            {slot.class_section} • Room {slot.room}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] font-bold text-accent-400 bg-accent-500/10 border border-accent-500/20 px-2 py-0.5 rounded shrink-0">
                          {slot.period}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </Card>

      {/* Schedule Management Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-surface border border-border rounded-radius-md shadow-2xl overflow-hidden font-ui">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border bg-surface/80 flex items-center justify-between">
              <h3 className="font-display font-medium text-lg text-ink flex items-center gap-2">
                <Calendar className="text-indigo-400" size={20} /> Manage Timetable Schedules
              </h3>
              <button 
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setEditingSlotId(null);
                  setSlotSubject('');
                  setSlotPeriod('');
                  setSlotClass('');
                  setSlotRoom('');
                }}
                className="text-ink-muted hover:text-ink transition"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-border/60 bg-surface/30 px-5">
              <button
                onClick={() => setActiveTab('list')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'list' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Schedule Slots
              </button>
              <button
                onClick={() => {
                  setActiveTab('add');
                  setEditingSlotId(null);
                  setSlotSubject('');
                  setSlotPeriod('');
                  setSlotClass('');
                  setSlotRoom('');
                }}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'add' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {editingSlotId ? 'Edit Class Slot' : 'Add New Class'}
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'bulk' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Bulk Import (CSV/JSON)
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-5 max-h-[50vh] overflow-y-auto">
              
              {/* Tab 1: List Slots */}
              {activeTab === 'list' && (
                <div className="space-y-4">
                  {/* Select Day Row */}
                  <div className="flex gap-1 p-1 bg-surface/50 rounded border border-border/40">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                      <button
                        key={day}
                        onClick={() => setSelectedViewDay(day)}
                        className={`flex-1 text-center py-2 rounded text-xs font-mono font-bold transition ${
                          selectedViewDay === day
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-ink-muted hover:text-ink hover:bg-surface/30'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  
                  {/* Slots Table */}
                  <div className="divide-y divide-border/60">
                    {schedules.filter(s => s.day_of_week === selectedViewDay).length === 0 ? (
                      <div className="text-center py-12 text-ink-muted text-xs">
                        No classes scheduled for {selectedViewDay}.
                      </div>
                    ) : (
                      schedules
                        .filter(s => s.day_of_week === selectedViewDay)
                        .sort((a, b) => a.period.localeCompare(b.period))
                        .map((slot) => (
                          <div key={slot.id} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-mono font-semibold text-[10px] shrink-0">
                                {slot.class_section}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-ink">{slot.subject}</h4>
                                <span className="text-xs text-ink-muted font-mono">
                                  {slot.period} • Room {slot.room}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleEditClick(slot)}
                                className="p-1.5 rounded hover:bg-indigo-500/10 text-indigo-400 transition"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteClick(slot.id)}
                                className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
              
              {/* Tab 2: Add/Edit Form */}
              {activeTab === 'add' && (
                <form onSubmit={handleAddOrUpdateSlot} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block mb-1.5 font-bold">Day of Week</label>
                      <select 
                        value={slotDay} 
                        onChange={(e) => setSlotDay(e.target.value)}
                        className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                      >
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block mb-1.5 font-bold">Subject / Activity</label>
                      <Input 
                        value={slotSubject} 
                        onChange={(e) => setSlotSubject(e.target.value)} 
                        placeholder="e.g. Machine Learning"
                        className="py-2 text-xs" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block mb-1.5 font-bold">Time Period</label>
                      <Input 
                        value={slotPeriod} 
                        onChange={(e) => setSlotPeriod(e.target.value)} 
                        placeholder="e.g. 09:00 - 10:00"
                        className="py-2 text-xs font-mono" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block mb-1.5 font-bold">Class/Section</label>
                      <Input 
                        value={slotClass} 
                        onChange={(e) => setSlotClass(e.target.value)} 
                        placeholder="e.g. CSE-A"
                        className="py-2 text-xs" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block mb-1.5 font-bold">Room</label>
                      <Input 
                        value={slotRoom} 
                        onChange={(e) => setSlotRoom(e.target.value)} 
                        placeholder="e.g. LH-201"
                        className="py-2 text-xs font-mono" 
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t border-border/40">
                    <Button type="submit" variant="primary" className="py-2 px-5 text-xs flex items-center gap-1.5">
                      <Plus size={14} /> {editingSlotId ? 'Save Changes' : 'Add Slot'}
                    </Button>
                  </div>
                </form>
              )}
              
              {/* Tab 3: Bulk Import */}
              {activeTab === 'bulk' && (
                <div className="space-y-4">
                  <div className="bg-surface/50 border border-border/40 rounded p-3 text-xs text-ink-muted leading-relaxed">
                    <p className="font-semibold text-ink mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wider font-mono">
                      Instructions
                    </p>
                    Paste schedule data in CSV format with headers, or standard JSON array.
                    <div className="mt-2 font-mono text-[10px] bg-surface p-2 rounded border border-border/20 text-indigo-300 whitespace-pre">
                      day_of_week, period, subject, class_section, room{"\n"}
                      Monday, 09:00 - 10:00, Design & Analysis of Algorithms, CSE-A, LH-201{"\n"}
                      Monday, 11:30 - 12:30, Machine Learning, CSE-B, LH-302
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer bg-surface border border-border hover:border-indigo-500 rounded py-1.5 px-3 text-xs font-semibold text-ink flex items-center gap-1 hover:bg-indigo-500/10 transition">
                        <Upload size={13} /> Select CSV/JSON file
                        <input type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                    
                    <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={bulkOverwrite}
                        onChange={(e) => setBulkOverwrite(e.target.checked)}
                        className="rounded bg-surface border-border text-indigo-600 focus:ring-indigo-500" 
                      />
                      Overwrite existing schedules
                    </label>
                  </div>
                  
                  <div>
                    <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block mb-1.5 font-bold">Data Content</label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Paste CSV rows here..."
                      className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 text-xs font-mono h-40 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  
                  {bulkError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-xs flex items-center gap-2">
                      <AlertTriangle size={14} /> {bulkError}
                    </div>
                  )}
                  
                  {bulkSuccess && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded text-xs flex items-center gap-2 animate-pulse">
                      <Check size={14} /> {bulkSuccess}
                    </div>
                  )}
                  
                  <div className="flex justify-end pt-4 border-t border-border/40">
                    <Button 
                      variant="primary" 
                      onClick={handleBulkSubmit}
                      className="py-2 px-5 text-xs flex items-center gap-1.5"
                    >
                      <Upload size={14} /> Import Data
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Policy Search / RAG Sidebar Widget */}
        <Card className="border border-border/80 bg-surface shadow-soft">
          <div className="border-b border-border pb-3 mb-4">
            <h3 className="font-display font-medium text-lg text-ink flex items-center gap-2">
              <Search className="text-accent-500" size={18} /> Policy Document RAG
            </h3>
          </div>

          <form onSubmit={handleSearchPolicies} className="flex gap-2">
            <Input
              type="text"
              placeholder="Search leaves, grading rules..."
              value={policyQuery}
              onChange={(e) => setPolicyQuery(e.target.value)}
              className="py-1.5 text-xs"
            />
            <Button type="submit" variant="secondary" className="py-1 px-3 text-xs flex items-center gap-1">
              Search
            </Button>
          </form>

          {policyResults && (
            <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-ink-muted uppercase">Results found</span>
                <button onClick={() => setPolicyResults(null)} className="text-[9px] font-mono text-accent-500 hover:underline">
                  Clear
                </button>
              </div>

              {policyResults.map((p, idx) => (
                <div key={idx} className="bg-surface/50 p-2.5 rounded border border-border/40 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
                    <FileText size={11} className="text-accent-500" /> {p.title}
                  </div>
                  <p className="text-ink-muted text-[11px] leading-relaxed italic">"{p.snippet}"</p>
                  <div className="mt-1.5 flex justify-end">
                    <button 
                      onClick={() => handleSendMessage(`What are details in policy: ${p.title}?`)}
                      className="text-[9px] font-semibold text-accent-500 hover:text-accent-700 flex items-center gap-0.5"
                    >
                      Ask Assistant <ArrowRight size={8} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
