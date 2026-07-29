import { SharedChatInterface } from '../components/SharedChatInterface';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from '../components/Common';
import { CalendarDays, Send, Users, DollarSign, Calendar, ListTodo, Edit2, Plus } from 'lucide-react';
import { api, type ChatMessage } from '../services/api';

export const EventManagement: React.FC<{ user: any }> = ({ user }) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventFormData, setEventFormData] = useState({ name: '', type: '', date: '', venue: '', organizer: '' });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskFormData, setTaskFormData] = useState({ task: '', assigned_to: '', status: '' });

  const loadData = async () => {
    try {
      const e = await api.getEvents();
      const t = await api.getCommitteeTasks();
      setEvents(e);
      setTasks(t);
    } catch (error) {
      console.error("Failed to fetch event data", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText, streamingTraces]);

  const handleEventSubmit = async () => {
    if (editingEventId) {
      await (api as any).editEvent(editingEventId, eventFormData);
    } else {
      await (api as any).addEvent(eventFormData);
    }
    await loadData();
    setIsEventModalOpen(false);
    setEditingEventId(null);
    setEventFormData({ name: '', type: '', date: '', venue: '', organizer: '' });
  };

  const handleTaskSubmit = async () => {
    if (editingTaskId) {
      await (api as any).editCommitteeTask(editingTaskId, taskFormData);
    } else {
      await (api as any).addCommitteeTask(taskFormData);
    }
    await loadData();
    setIsTaskModalOpen(false);
    setEditingTaskId(null);
    setTaskFormData({ task: '', assigned_to: '', status: '' });
  };

  const handleSendChat = async (directMessage?: string) => {
    const msgContent = directMessage || chatInput.trim();
    if (!msgContent || isLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msgContent, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setIsLoading(true);
    setStreamingText('');
    setStreamingTraces([]);
    
    let fullText = '';
    
    try {
      await api.streamChat(
        'agent9',
        msgContent,
        newHistory,
        (chunk) => {
          fullText += chunk;
          setStreamingText(fullText);
        },
        (trace) => {
          setStreamingTraces(prev => {
            const existing = prev.findIndex(t => t.name === trace.name);
            if (existing >= 0) {
              const newTraces = [...prev];
              newTraces[existing] = trace;
              return newTraces;
            }
            return [...prev, trace];
          });
        },
        (toolCalls, richData) => {
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: fullText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), richData }]);
          setStreamingText('');
          setStreamingTraces([]);
          setIsLoading(false);
          loadData();
        },
        (err) => {
          console.error(err);
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, there was an error processing your request.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  
  const renderInteractiveChoices = (data: any) => {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {data.choices.map((choice: any, idx: number) => (
          <button
            key={idx}
            onClick={() => handleSendChat(choice.value)}
            className="text-xs bg-surface border border-border hover:border-accent-500 hover:text-accent-500 transition py-1.5 px-3 rounded flex items-center gap-1.5 shadow-sm text-ink font-medium"
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-ink">Event & Committee Management</h2>
          <p className="text-xs text-ink-muted">Plan FDPs, track event budgets, and manage committee tasks.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Left/Middle Content */}
        <div className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[ 
              { label: 'Upcoming Events', value: '4', icon: Calendar },
              { label: 'Pending Tasks', value: '18', icon: ListTodo },
              { label: 'Expected Guests', value: '250', icon: Users },
              { label: 'Budget Utilized', value: '65%', icon: DollarSign }
            ].map((stat, i) => (
              <Card key={i} className="p-4 bg-surface border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className="text-2xl font-display font-bold text-ink">{stat.value}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent-500/10 flex items-center justify-center">
                  <stat.icon className="text-accent-500" size={16} />
                </div>
              </Card>
            ))}
          </div>

          {/* Calendar & Tasks */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><CalendarDays size={14} className="text-accent-500" /> Event Calendar</h3>
                <Button size="sm" onClick={() => {
                  setEditingEventId(null);
                  setEventFormData({ name: '', type: '', date: '', venue: '', organizer: '' });
                  setIsEventModalOpen(true);
                }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {events.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No events found
                  </div>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center group">
                      <div>
                        <div className="text-sm font-bold text-ink">{e.title || e.name || 'Event Title'}</div>
                        <div className="text-xs text-ink-muted">{e.date || 'Date'} | {e.location || e.venue || 'Location'}</div>
                      </div>
                      <Button size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 bg-transparent hover:bg-surface border-border" onClick={() => {
                        setEditingEventId(e.id);
                        setEventFormData({ name: e.name || e.title || '', type: e.type || '', date: e.date || '', venue: e.venue || e.location || '', organizer: e.organizer || '' });
                        setIsEventModalOpen(true);
                      }}>
                        <Edit2 size={12} className="text-ink" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
            
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><ListTodo size={14} className="text-accent-500" /> Committee Tasks</h3>
                <Button size="sm" onClick={() => {
                  setEditingTaskId(null);
                  setTaskFormData({ task: '', assigned_to: '', status: '' });
                  setIsTaskModalOpen(true);
                }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {tasks.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No tasks found
                  </div>
                ) : (
                  tasks.map((t, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center group">
                      <div>
                        <div className="text-sm font-bold text-ink">{t.task || 'Task'}</div>
                        <div className="text-xs text-ink-muted">Assigned to: {t.assigned_to || 'Someone'} | {t.status || 'Pending'}</div>
                      </div>
                      <Button size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 bg-transparent hover:bg-surface border-border" onClick={() => {
                        setEditingTaskId(t.id);
                        setTaskFormData({ task: t.task || '', assigned_to: t.assigned_to || '', status: t.status || '' });
                        setIsTaskModalOpen(true);
                      }}>
                        <Edit2 size={12} className="text-ink" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Side Chat */}
        <Card className="xl:col-span-1 flex flex-col border border-accent-500/30 bg-surface/96 overflow-hidden p-0">
          <div className="bg-gradient-to-r from-accent-900/50 to-lime-900/50 px-4 py-3 flex items-center gap-3 border-b border-accent-500/30">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center shadow-lg">
              <CalendarDays size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Event Planner AI</div>
              <div className="text-[9px] text-accent-300 font-mono">Ready to assist</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {chatMessages.length === 0 && !streamingText && streamingTraces.length === 0 && (
              <div className="flex gap-2 w-[85%]">
                <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                  <CalendarDays size={10} className="text-white" />
                </div>
                <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                  Hello! I am your Event & Committee AI. I can generate event schedules, allocate budgets, or take committee meeting minutes.
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                    <CalendarDays size={10} className="text-white" />
                  </div>
                )}
                <div className={`text-xs p-2.5 rounded-2xl border ${msg.role === 'user' ? 'bg-accent-500 text-black rounded-tr-sm border-accent-600' : 'bg-accent-500/10 text-ink rounded-tl-sm border-accent-500/20'}`}>
                  <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {(streamingText || streamingTraces.length > 0) && (
              <div className="flex gap-2 max-w-[85%] self-start">
                <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0 mt-1">
                  <CalendarDays size={10} className="text-white" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  {streamingTraces.map((trace, i) => (
                    <div key={i} className="text-[10px] text-accent-400 font-mono bg-accent-500/5 p-1.5 rounded border border-accent-500/10">
                      Running tool: {trace.action || 'processing'}...
                    </div>
                  ))}
                  {streamingText && (
                      <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">
                        {streamingText}
                      </div>
                  )}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-border/60 bg-surface">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask Event Planner..."
                className="flex-1 bg-paper text-xs rounded-xl"
                disabled={isLoading}
              />
              <Button size="sm" className="bg-accent-500 text-black hover:bg-accent-600 rounded-xl" onClick={() => handleSendChat()} disabled={isLoading}>
                <Send size={14} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingEventId ? 'Edit Event' : 'Add Event'}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="Event Name" value={eventFormData.name} onChange={e => setEventFormData({...eventFormData, name: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Event Type" value={eventFormData.type} onChange={e => setEventFormData({...eventFormData, type: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Date" value={eventFormData.date} onChange={e => setEventFormData({...eventFormData, date: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Venue" value={eventFormData.venue} onChange={e => setEventFormData({...eventFormData, venue: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Organizer" value={eventFormData.organizer} onChange={e => setEventFormData({...eventFormData, organizer: e.target.value})} className="bg-paper border-border" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsEventModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleEventSubmit}>Submit</Button>
            </div>
          </div>
        </div>
      )}

      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingTaskId ? 'Edit Task' : 'Add Task'}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="Task Name" value={taskFormData.task} onChange={e => setTaskFormData({...taskFormData, task: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Assigned To" value={taskFormData.assigned_to} onChange={e => setTaskFormData({...taskFormData, assigned_to: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Status" value={taskFormData.status} onChange={e => setTaskFormData({...taskFormData, status: e.target.value})} className="bg-paper border-border" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleTaskSubmit}>Submit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
