import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, Send, Calendar, Clock, AlertCircle, MessageSquare, CheckCircle2,
  ChevronRight, UserCheck, X, Plus, Search, Shield, TrendingUp, Users,
  Sparkles, AlertTriangle, PhoneCall, MessageCircle, User, ListTodo, StickyNote, Edit2
} from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface MentorWellbeingProps { user: UserType; }

const MOOD_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'doing well': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  'needs attention': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  'concerning': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  'in-person': <User size={11} />,
  'call': <PhoneCall size={11} />,
  'chat': <MessageCircle size={11} />,
};

export const MentorWellbeing: React.FC<MentorWellbeingProps> = ({ user }) => {
  // ─── Core State ───────────────────────────────────────────────
  const [mentees, setMentees] = useState<any[]>([]);
  const [activeMentee, setActiveMentee] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_mentees: 0, overdue_count: 0, open_escalations: 0, checkins_this_month: 0 });
  const [tasks, setTasks] = useState<any[]>([]);
  const [futureNotes, setFutureNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'active'>('all');

  // ─── Modal State ──────────────────────────────────────────────
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [checkinMode, setCheckinMode] = useState('in-person');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinMood, setCheckinMood] = useState('doing well');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateTo, setEscalateTo] = useState('counselor');

  // ─── Loading/Feedback State ───────────────────────────────────
  const [isLoadingMentees, setIsLoadingMentees] = useState(false);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // ─── Chat State ───────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome', role: 'assistant',
      content: '🌸 Hello! I\'m your **Wellbeing Advisor**. I can help you:\n\n• 📋 View overdue check-in schedules\n• 💬 Suggest gentle conversation starters\n• 📝 Log check-in sessions\n• 🚨 Raise escalation cases\n• 📊 View mentee timelines\n\nTry one of the quick actions below!',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const streamingRef = useRef('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load Data ────────────────────────────────────────────────
  const loadData = async () => {
    setIsLoadingMentees(true);
    try {
      const [mData, escData, statsData, tasksData] = await Promise.all([
        api.getMentees(),
        api.getMentorEscalations(),
        api.getMentorStats(),
        api.getMentorTasks(),
      ]);
      setMentees(mData);
      setEscalations(escData);
      setStats(statsData);
      setTasks(tasksData);
      if (mData.length > 0 && !activeMentee) {
        await handleSelectMentee(mData[0]);
      } else if (activeMentee) {
        const updated = mData.find((m: any) => m.id === activeMentee.id);
        if (updated) await handleSelectMentee(updated);
      }
    } catch (e) {
      console.error(e);
      setFeedbackMessage('Could not refresh mentor roster.');
    } finally {
      setIsLoadingMentees(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { 
    if (chatMessages.length > 1 || streamingText) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
    }
  }, [chatMessages, streamingText]);

  // Auto-clear feedback
  useEffect(() => {
    if (feedbackMessage) {
      const t = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedbackMessage]);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleSelectMentee = async (mentee: any) => {
    setActiveMentee(mentee);
    setSuggestedPrompt('');
    setTimeline([]);
    setFutureNotes([]);
    setNewNote('');
    try {
      const [timelineData, promptData, notesData] = await Promise.all([
        api.getMenteeTimeline(mentee.student_id),
        api.getSuggestedWellbeingPrompt(mentee.student_id),
        api.getFutureNotes(mentee.student_id),
      ]);
      setTimeline(timelineData);
      setSuggestedPrompt(promptData.prompt || promptData);
      setFutureNotes(notesData);
    } catch (e) {
      console.error(e);
      setSuggestedPrompt('I can help you craft a gentle starting point for your next check-in.');
    }
  };

  const handleAddFutureNote = async () => {
    if (!activeMentee || !newNote.trim()) return;
    try {
      await api.addFutureNote(activeMentee.student_id, newNote);
      setNewNote('');
      const notesData = await api.getFutureNotes(activeMentee.student_id);
      setFutureNotes(notesData);
    } catch (e) {
      setFeedbackMessage('Could not save note.');
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => { e.preventDefault(); };
  const handleLogCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !checkinNotes) return;
    setIsSubmittingCheckin(true);
    try {
      await api.logCheckin(activeMentee.student_id, checkinMode, checkinNotes, checkinMood);
      setIsCheckinModalOpen(false);
      setCheckinNotes('');
      setCheckinMood('doing well');
      setFeedbackMessage(`✅ Check-in logged for ${activeMentee.name}.`);
      await loadData();
    } catch { setFeedbackMessage('Could not save check-in.'); } finally { setIsSubmittingCheckin(false); }
  };

  const handleRaiseEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !escalateReason) return;
    setIsSubmittingEscalation(true);
    try {
      await api.escalateMentee(activeMentee.student_id, escalateReason, escalateTo);
      setIsEscalateModalOpen(false);
      setEscalateReason('');
      setFeedbackMessage(`🚨 Escalation raised for ${activeMentee.name}.`);
      await loadData();
    } catch { setFeedbackMessage('Could not raise escalation.'); } finally { setIsSubmittingEscalation(false); }
  };

  const handleUpdateEscalation = async (id: number, newStatus: string) => {
    try {
      await api.updateEscalationStatus(id, newStatus);
      setFeedbackMessage(`Escalation status updated to ${newStatus}.`);
      await loadData();
    } catch { setFeedbackMessage('Could not update escalation.'); }
  };

  // ─── Chat ─────────────────────────────────────────────────────
  const handleSendChat = (preset?: string) => {
    const msg = preset || chatInput;
    if (!msg.trim()) return;
    const userMsg: ChatMessage = {
      id: Math.random().toString(), role: 'user', content: msg,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    if (!preset) setChatInput('');
    setStreamingText('');
    streamingRef.current = '';
    setStreamingTraces([]);
    setIsLoading(true);

    const context = activeMentee
      ? `[Context: Viewing mentee "${activeMentee.name}" (${activeMentee.roll_no}), last check-in: ${activeMentee.last_checkin_date}, status: ${activeMentee.is_overdue ? 'OVERDUE' : 'active'}]`
      : '[Context: No mentee selected]';

    api.streamChat(
      'agent6',
      `${context}\n\nUser: ${msg}`,
      chatMessages.filter(m => m.id !== 'welcome').slice(-6),
      (chunk) => {
        streamingRef.current += chunk;
        setStreamingText(streamingRef.current);
      },
      (trace) => {
        setStreamingTraces(prev => {
          const idx = prev.findIndex(t => t.name === trace.name);
          if (idx >= 0) { const u = [...prev]; u[idx] = trace; return u; }
          return [...prev, trace];
        });
      },
      async (_toolCalls, _richData) => {
        const finalText = streamingRef.current;
        setChatMessages(prev => [...prev, {
          id: Math.random().toString(), role: 'assistant',
          content: finalText || 'I processed your request. Please check the updated mentee view.',
          timestamp: new Date().toLocaleTimeString(),
        }]);
        setStreamingText('');
        streamingRef.current = '';
        setIsLoading(false);
        await loadData();
      },
      (err) => { console.error(err); setIsLoading(false); }
    );
  };

  // ─── Quick Actions ────────────────────────────────────────────
  const QUICK_ACTIONS = [
    { icon: '📋', label: 'Overdue List', msg: 'Show me all overdue mentees' },
    { icon: '💬', label: 'Suggest Prompt', msg: activeMentee ? `Suggest a check-in prompt for ${activeMentee.name}` : 'Suggest a check-in prompt' },
    { icon: '📝', label: 'Note for future', msg: 'Help me write a note for our future meeting' },
    { icon: '🚨', label: 'Escalate', msg: 'Help me raise an escalation for the current mentee' },
  ];

  // ─── Filtered Mentees ─────────────────────────────────────────
  const filteredMentees = mentees.filter(m => {
    const matchSearch = searchQuery === '' || m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.roll_no?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterStatus === 'all' || (filterStatus === 'overdue' && m.is_overdue) || (filterStatus === 'active' && !m.is_overdue);
    return matchSearch && matchFilter;
  });

  // ─── Mood Dots for Timeline ───────────────────────────────────
  const MoodDots = ({ entries }: { entries: any[] }) => {
    const recent = entries.slice(0, 6);
    return (
      <div className="flex items-center gap-1">
        {recent.map((e, i) => {
          const cfg = MOOD_CONFIG[e.mood_tag] || MOOD_CONFIG['doing well'];
          return <div key={i} className={`w-2 h-2 rounded-full ${cfg.dot}`} title={`${e.date}: ${e.mood_tag}`} />;
        })}
        {recent.length === 0 && <span className="text-[9px] text-ink-muted font-mono">No history</span>}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-paper text-ink overflow-hidden font-ui">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent6" icon={Heart} size="md" className="bg-pink-500" />
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Mentor & Wellbeing</h1>
            <p className="text-[10px] text-ink-muted">Track mentee check-ins, log qualitative feedback, and manage counseling escalations with care.</p>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Total Mentees', value: stats.total_mentees, icon: Users, accent: 'text-pink-400' },
          { label: 'Overdue', value: stats.overdue_count, icon: Clock, accent: 'text-amber-400' },
          { label: 'Open Escalations', value: stats.open_escalations, icon: AlertTriangle, accent: 'text-red-400' },
          { label: 'Check-ins This Month', value: stats.checkins_this_month, icon: CheckCircle2, accent: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className="p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center ${accent}`}>
              <Icon size={16} />
            </div>
            <div>
              <div className="text-lg font-bold font-mono text-ink">{value}</div>
              <div className="text-[9px] font-mono text-ink-muted uppercase">{label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Main 3-Column Layout ───────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3 overflow-hidden">

        {/* ── Left: Mentee List ─────────────────────────────────── */}
        <div className="xl:col-span-3 flex flex-col gap-2 overflow-hidden">
          {/* Tasks & Polling */}
          <div className="mb-2">
            <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5"><ListTodo size={11} /> Tasks & Polling</span>
              <Button size="sm" variant="ghost" onClick={() => { setEditingTask(null); setTaskTitle(''); setTaskDescription(''); setIsTaskModalOpen(true); }} className="hover:text-pink-400">
                <Plus size={12} />
              </Button>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-[10px] text-ink-muted bg-surface p-2 rounded border border-dashed border-border text-center">No pending tasks</div>
              ) : (
                tasks.map(t => (
                  <Card key={t.id} className="p-2 border border-border bg-surface group relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-ink flex items-center gap-1">
                        {t.title}
                        <button onClick={() => { setEditingTask(t); setTaskTitle(t.title); setTaskDescription(t.description || ''); setIsTaskModalOpen(true); }} className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-pink-400 transition-opacity ml-1">
                          <Edit2 size={10} />
                        </button>
                      </span>
                      {t.status === 'completed' ? (
                        <CheckCircle2 size={12} className="text-emerald-400" />
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-mono">Pending</span>
                      )}
                    </div>
                    <p className="text-[9px] text-ink-muted mt-1">{t.description}</p>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider flex items-center gap-1.5 mt-2">
            <Users size={11} /> My Assigned Mentees
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                placeholder="Search…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border text-ink rounded pl-7 pr-2 py-1.5 outline-none text-[10px] focus:border-pink-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="bg-surface border border-border text-ink rounded px-2 py-1.5 text-[10px] outline-none"
            >
              <option value="all">All</option>
              <option value="overdue">Overdue</option>
              <option value="active">Active</option>
            </select>
          </div>

          {/* Mentee Cards */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoadingMentees ? (
              <div className="p-4 bg-surface rounded border border-border text-[11px] text-ink-muted text-center">Loading roster…</div>
            ) : filteredMentees.length === 0 ? (
              <div className="p-4 bg-surface rounded border border-dashed border-border text-[11px] text-ink-muted text-center">No mentees found.</div>
            ) : filteredMentees.map(m => (
              <div
                key={m.id}
                onClick={() => handleSelectMentee(m)}
                className={`p-3 bg-surface rounded border cursor-pointer transition-all duration-200 ${
                  activeMentee?.id === m.id
                    ? 'border-pink-500 bg-pink-500/5 shadow-sm shadow-pink-500/10'
                    : m.is_overdue
                      ? 'border-l-4 border-l-pink-400 border-border hover:border-pink-500/40'
                      : 'border-border hover:border-pink-500/30'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-ink">{m.name}</span>
                  {m.is_overdue ? (
                    <Badge variant="danger" className="text-[8px] bg-pink-500/10 text-pink-400 border-none">OVERDUE</Badge>
                  ) : (
                    <Badge variant="neutral" className="text-[8px] border-none">ACTIVE</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-ink-muted font-mono block">{m.roll_no} • {m.class_section}</span>
                    <span className="text-[9px] text-ink-muted font-mono block mt-0.5">
                      Last: {m.last_checkin_date || 'Never'}
                      {m.days_since_checkin !== undefined && <span className="ml-1 text-pink-400/70">({m.days_since_checkin}d ago)</span>}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Center: Mentee Detail ────────────────────────────── */}
        <div className="xl:col-span-6 flex flex-col gap-3 overflow-y-auto pr-1 pb-4">
          {activeMentee ? (
            <div className="space-y-3">
              {/* Feedback Toast */}
              {feedbackMessage && (
                <div className="rounded border border-pink-500/20 bg-pink-500/10 px-3 py-2 text-xs text-pink-300 flex items-center justify-between">
                  {feedbackMessage}
                  <button onClick={() => setFeedbackMessage(null)}><X size={12} className="text-pink-300/60" /></button>
                </div>
              )}

              {/* Mentee Profile Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-sm">
                      {activeMentee.name?.[0] || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-ink">{activeMentee.name}</div>
                      <div className="text-[10px] font-mono text-ink-muted">{activeMentee.roll_no} • {activeMentee.class_section}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setIsCheckinModalOpen(true)}
                      className="bg-pink-500 hover:bg-pink-600 text-black text-[10px] py-1 px-3 flex items-center gap-1 font-mono font-bold">
                      <Plus size={11} /> Log Check-in
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEscalateModalOpen(true)}
                      className="text-[10px] py-1 px-3 border-pink-500/30 text-pink-400 hover:bg-pink-500/10 flex items-center gap-1">
                      <AlertCircle size={11} /> Escalate
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="bg-surface-raised rounded p-2 text-center">
                    <div className="text-sm font-bold font-mono text-ink">{activeMentee.days_since_checkin ?? '—'}</div>
                    <div className="text-[8px] font-mono text-ink-muted uppercase">Days Since Check-in</div>
                  </div>
                  <div className="bg-surface-raised rounded p-2 text-center">
                    <div className="text-sm font-bold font-mono text-ink">{timeline.length}</div>
                    <div className="text-[8px] font-mono text-ink-muted uppercase">Total Check-ins</div>
                  </div>
                  <div className="bg-surface-raised rounded p-2 text-center">
                    <div className="text-[8px] font-mono text-ink-muted uppercase mb-1">Mood Trend</div>
                    <MoodDots entries={timeline} />
                  </div>
                </div>
              </Card>

              {/* Suggested Prompt Card */}
              <div className="p-4 bg-pink-500/5 border border-pink-500/20 rounded">
                <div className="text-[10px] font-mono text-pink-400 uppercase mb-2 flex items-center gap-1.5">
                  <UserCheck size={12} /> Suggested This Week
                </div>
                <p className="text-xs leading-relaxed text-ink italic">
                  "{suggestedPrompt || 'A gentle, human-toned check-in prompt will appear here when a mentee is selected.'}"
                </p>
                <div className="mt-2 text-[9px] text-ink-muted font-mono flex items-center gap-1">
                  <Shield size={9} /> Notes stay scoped to this mentor — never surfaced into analytics.
                </div>
              </div>

              {/* Future Notes (Scratchpad) */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote size={11} /> Future Notes (Scratchpad)
                </div>
                <Card className="p-3 border-border bg-surface">
                  <div className="flex gap-2 mb-3">
                    <input
                      placeholder="Add a bullet point for future meetings..."
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddFutureNote()}
                      className="flex-1 bg-paper border border-border text-ink text-xs rounded px-2 py-1 outline-none focus:border-pink-500"
                    />
                    <Button size="sm" onClick={handleAddFutureNote} className="bg-pink-500 hover:bg-pink-600 text-black px-2 py-1 flex items-center gap-1">
                      <Plus size={12} /> Add
                    </Button>
                  </div>
                  {futureNotes.length === 0 ? (
                    <div className="text-[10px] text-ink-muted text-center py-2 italic">No scratchpad notes for {activeMentee.name}</div>
                  ) : (
                    <ul className="space-y-1.5 pl-4 list-disc text-[11px] text-ink">
                      {futureNotes.map(n => (
                        <li key={n.id}>
                          {n.note} <span className="text-[9px] text-ink-muted ml-1">({n.created_at})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* Check-in Timeline */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={11} /> Check-in History
                </div>
                {timeline.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded text-ink-muted text-xs">
                    No check-in sessions logged yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timeline.map(item => {
                      const mood = MOOD_CONFIG[item.mood_tag] || MOOD_CONFIG['doing well'];
                      return (
                        <Card key={item.id} className="p-3 border-border space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-pink-400 font-semibold">{item.date}</span>
                              <span className="flex items-center gap-1 text-[9px] font-mono text-ink-muted">
                                {MODE_ICONS[item.mode] || <User size={11} />} {item.mode}
                              </span>
                            </div>
                            <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border ${mood.bg} ${mood.border} ${mood.color}`}>
                              {item.mood_tag?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted leading-relaxed bg-paper/30 p-2 rounded border border-border/40 select-none whitespace-pre-wrap">
                            {item.notes}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Escalation History */}
              {escalations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={11} /> Escalation History
                  </div>
                  <div className="space-y-2">
                    {escalations.map(esc => (
                      <Card key={esc.id} className="p-3 border-border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-ink">{esc.student_name || 'Student'}</span>
                              <span className="text-[9px] font-mono text-ink-muted">{esc.roll_no}</span>
                              <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border ${
                                esc.status === 'open' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : esc.status === 'in-progress' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              }`}>{esc.status?.toUpperCase()}</span>
                            </div>
                            <p className="text-[10px] text-ink-muted">{esc.reason}</p>
                            <div className="text-[9px] font-mono text-ink-muted mt-1">
                              Escalated to: <span className="text-pink-400">{esc.escalated_to}</span>
                              {esc.created_at && <span className="ml-2">• {new Date(esc.created_at).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          {esc.status !== 'resolved' && (
                            <div className="flex flex-col gap-1 shrink-0">
                              {esc.status === 'open' && (
                                <button onClick={() => handleUpdateEscalation(esc.id, 'in-progress')}
                                  className="text-[8px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/20 transition-colors">
                                  In Progress
                                </button>
                              )}
                              <button onClick={() => handleUpdateEscalation(esc.id, 'resolved')}
                                className="text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition-colors">
                                Resolve
                              </button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="flex-1 min-h-48 flex flex-col items-center justify-center text-center p-8">
              <Heart className="text-pink-500/20 mb-4 animate-pulse" size={48} />
              <div className="text-sm text-ink font-semibold">Select a mentee</div>
              <p className="text-[11px] text-ink-muted mt-1 max-w-xs">Choose a mentee from the list to view their timeline, log check-ins, or manage escalations.</p>
            </Card>
          )}
        </div>

        {/* ── Right: Wellbeing Advisor Chat ─────────────────────── */}
        <div className="xl:col-span-3 flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col border border-pink-500/40 bg-surface/96 backdrop-blur-md p-0 overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-pink-900/50 to-pink-900/50 px-4 py-3 flex items-center justify-between border-b border-pink-500/30">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-pink-500 flex items-center justify-center">
                  <Sparkles size={14} className="text-black" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Wellbeing Advisor</div>
                  <div className="text-[9px] text-pink-300 font-mono">Empathetic • Private</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-mono text-green-300">Live</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1 border-b border-border/40">
              {QUICK_ACTIONS.map((a, i) => (
                <button key={i} onClick={() => handleSendChat(a.msg)}
                  disabled={isLoading}
                  className="text-[9px] font-mono bg-pink-500/10 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50">
                  {a.icon} {a.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="px-3 py-2 flex-1 overflow-y-auto space-y-2">
              {chatMessages.map((m, i) => (
                <div key={`${m.id}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                      <Sparkles size={10} className="text-black" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-line
                    ${m.role === 'user'
                      ? 'bg-pink-600 text-white rounded-br-sm'
                      : 'bg-surface border border-border text-ink rounded-bl-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {streamingText && (
                <div className="flex justify-start">
                  <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                    <Sparkles size={10} className="text-black animate-pulse" />
                  </div>
                  <div className="max-w-[85%] bg-surface border border-border text-ink rounded-xl rounded-bl-sm px-3 py-2 text-[11px] leading-relaxed whitespace-pre-line">
                    {streamingText}
                    <span className="inline-block w-1 h-3 bg-pink-400 ml-0.5 animate-pulse rounded" />
                  </div>
                </div>
              )}

              {isLoading && !streamingText && streamingTraces.length === 0 && (
                <div className="flex justify-start">
                  <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center shrink-0 mr-1.5">
                    <Sparkles size={10} className="text-black animate-pulse" />
                  </div>
                  <div className="bg-surface border border-border rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              {streamingTraces.map((t, i) => (
                <div key={i} className="text-[8px] font-mono text-pink-400 pl-7">⚙ {t.name}… ({t.status})</div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-border/40 flex gap-2">
              <input
                className="flex-1 bg-surface border border-border/60 text-ink text-xs rounded-xl px-3 py-2 outline-none focus:border-pink-500 placeholder-ink-muted transition-colors"
                placeholder="Ask about check-ins, prompts, escalations…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                disabled={isLoading}
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isLoading || !chatInput.trim()}
                className="w-9 h-9 rounded-xl bg-pink-500 hover:bg-pink-600 text-black flex items-center justify-center transition-colors disabled:opacity-50 shrink-0">
                <Send size={14} />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Log Check-in Modal ────────────────────────────────── */}
      {isCheckinModalOpen && activeMentee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-surface border-pink-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-mono font-bold text-pink-400 flex items-center gap-1.5">
                <Plus size={12} /> LOG CHECK-IN: {activeMentee.name}
              </span>
              <button onClick={() => setIsCheckinModalOpen(false)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>

            <form onSubmit={handleLogCheckin} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Check-in Mode</label>
                  <select value={checkinMode} onChange={e => setCheckinMode(e.target.value)}
                    className="w-full bg-surface border border-border text-ink rounded py-2 px-3 outline-none focus:border-pink-500">
                    <option value="in-person">In-Person Meeting</option>
                    <option value="call">Phone Call</option>
                    <option value="chat">Chat / Message</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Mood Tag</label>
                  <div className="flex gap-1.5">
                    {(['doing well', 'needs attention', 'concerning'] as const).map(mood => {
                      const cfg = MOOD_CONFIG[mood];
                      return (
                        <button key={mood} type="button"
                          onClick={() => setCheckinMood(mood)}
                          className={`flex-1 text-[8px] font-mono px-1 py-2 rounded border transition-all ${
                            checkinMood === mood
                              ? `${cfg.bg} ${cfg.border} ${cfg.color} font-bold ring-1 ring-current`
                              : 'bg-surface border-border text-ink-muted hover:border-pink-500/30'
                          }`}>
                          {mood === 'doing well' ? '😊' : mood === 'needs attention' ? '😐' : '😟'}
                          <div className="mt-0.5">{mood.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1 flex items-center gap-1">
                  <Shield size={9} /> Meeting Notes (Sensitive — visible only to assigned mentor)
                </label>
                <textarea rows={4} required placeholder="Record a summary of your conversation…"
                  value={checkinNotes} onChange={e => setCheckinNotes(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded py-2 px-3 outline-none focus:border-pink-500 resize-none" />
              </div>

              <Button type="submit" disabled={isSubmittingCheckin} className="w-full bg-pink-500 hover:bg-pink-600 text-black font-mono font-bold disabled:opacity-60">
                {isSubmittingCheckin ? 'SAVING…' : '✓ SUBMIT CHECK-IN LOG'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* ── Escalate Modal ────────────────────────────────────── */}
      {isEscalateModalOpen && activeMentee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-surface border-pink-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-mono font-bold text-pink-400 flex items-center gap-1.5">
                <AlertCircle size={12} /> ESCALATE: {activeMentee.name}
              </span>
              <button onClick={() => setIsEscalateModalOpen(false)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>

            <form onSubmit={handleRaiseEscalation} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Escalate To</label>
                <select value={escalateTo} onChange={e => setEscalateTo(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded py-2 px-3 outline-none focus:border-pink-500">
                  <option value="counselor">Institutional Counselor</option>
                  <option value="HOD">Head of Department (HOD)</option>
                  <option value="Dean">Dean of Student Affairs</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Reason for Escalation</label>
                <textarea rows={4} required
                  placeholder="Describe the academic, attendance, health, or emotional concerns…"
                  value={escalateReason} onChange={e => setEscalateReason(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded py-2 px-3 outline-none focus:border-pink-500 resize-none" />
              </div>
              <Button type="submit" disabled={isSubmittingEscalation} className="w-full bg-pink-500 hover:bg-pink-600 text-black font-mono font-bold disabled:opacity-60">
                {isSubmittingEscalation ? 'RAISING CASE…' : '🚨 SUBMIT ESCALATION'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-paper border-border shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ListTodo size={16} className="text-pink-400" />
                <h3 className="font-semibold text-ink text-sm">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsTaskModalOpen(false)}>
                <X size={14} className="text-ink-muted" />
              </Button>
            </div>
            <form onSubmit={handleSaveTask} className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1.5 block">Task Title</label>
                <Input
                  autoFocus
                  placeholder="e.g. Register for NPTEL"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea
                  placeholder="Provide any additional details or links..."
                  value={taskDescription}
                  onChange={e => setTaskDescription(e.target.value)}
                  className="w-full h-24 bg-surface border border-border rounded-md p-3 text-ink text-xs focus:border-pink-500 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)} className="text-xs">Cancel</Button>
                <Button type="submit" className="bg-pink-500 hover:bg-pink-600 text-black text-xs">
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
