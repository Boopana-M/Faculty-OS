import React, { useState, useEffect, useRef } from 'react';
import { Heart, Plus, Calendar, Clock, AlertCircle, MessageSquare, Send, CheckCircle2, ChevronRight, UserCheck } from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface MentorWellbeingProps {
  user: UserType;
}

export const MentorWellbeing: React.FC<MentorWellbeingProps> = ({ user }) => {
  const [mentees, setMentees] = useState<any[]>([]);
  const [activeMentee, setActiveMentee] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string>('');

  // Check-in Form States
  const [checkinMode, setCheckinMode] = useState('in-person');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinMood, setCheckinMood] = useState('doing well');

  // Escalation Form States
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateTo, setEscalateTo] = useState('counselor');

  // Chat Panel States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    try {
      const mData = await api.getMentees();
      setMentees(mData);
      if (mData.length > 0 && !activeMentee) {
        handleSelectMentee(mData[0]);
      } else if (activeMentee) {
        // Refresh active mentee
        const updated = mData.find((m: any) => m.id === activeMentee.id);
        if (updated) {
          handleSelectMentee(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectMentee = async (mentee: any) => {
    setActiveMentee(mentee);
    try {
      const timelineData = await api.getMenteeTimeline(mentee.student_id);
      setTimeline(timelineData);
      
      const promptData = await api.getSuggestedWellbeingPrompt(mentee.student_id);
      setSuggestedPrompt(promptData.prompt);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !checkinNotes) return;
    try {
      await api.logCheckin(activeMentee.student_id, checkinMode, checkinNotes, checkinMood);
      setIsCheckinModalOpen(false);
      setCheckinNotes('');
      setCheckinMood('doing well');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRaiseEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !escalateReason) return;
    try {
      await api.escalateMentee(activeMentee.student_id, escalateReason, escalateTo);
      setIsEscalateModalOpen(false);
      setEscalateReason('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

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
      'agent6',
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
        loadData();
      },
      (err) => {
        console.error(err);
        setIsLoading(false);
      }
    );
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  return (
    <div className="h-full flex flex-col relative bg-paper text-ink overflow-hidden font-ui">
      
      {/* Header Row */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent6" icon={Heart} size="md" className="bg-rose-500" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Mentor & Wellbeing</h1>
            <p className="text-xs text-ink-muted">Human relationship: track mentee check-in schedules, log qualitative feedback, and manage counseling escalation paths.</p>
          </div>
        </div>
      </div>

      {/* Main layout - Split: calm list of mentees left, selected mentee details/history right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-6 overflow-hidden pb-20">
        
        {/* Left Column: Mentees List (40%) */}
        <div className="lg:col-span-4 flex flex-col space-y-4 overflow-y-auto pr-1">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block">My Assigned Mentees</span>
          
          <div className="space-y-3">
            {mentees.map((m) => (
              <div 
                key={m.id}
                onClick={() => handleSelectMentee(m)}
                className={`p-4 bg-surface rounded-radius-md border cursor-pointer transition-all duration-200 text-left ${
                  activeMentee?.id === m.id 
                    ? 'border-rose-500 bg-rose-500/5' 
                    : (m.is_overdue ? 'border-l-4 border-l-rose-500 border-border' : 'border-border hover:border-rose-500/40')
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-ink">{m.name} ({m.roll_no})</span>
                  {m.is_overdue && (
                    <Badge variant="danger" className="text-[8px] bg-rose-500/10 text-rose-400 border-none">
                      OVERDUE
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-ink-muted font-mono block">Class: {m.class_section}</span>
                <span className="text-[10px] text-ink-muted font-mono block mt-1">Last Check-in: {m.last_checkin_date}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Right Column: Suggested prompt + checkin log (60%) */}
        <div className="lg:col-span-6 flex flex-col space-y-6 overflow-y-auto pr-1">
          
          {activeMentee ? (
            <div className="space-y-6">
              
              {/* Suggested Check-in Prompt */}
              {suggestedPrompt && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-radius-md">
                  <div className="text-[10px] font-mono text-rose-400 uppercase mb-2 flex items-center gap-1.5">
                    <UserCheck size={12} /> Suggested check-in starting conversation starter
                  </div>
                  <p className="text-xs italic leading-relaxed text-ink-muted">
                    "{suggestedPrompt}"
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => setIsCheckinModalOpen(true)}
                      className="bg-rose-500 hover:bg-rose-600 text-black text-[10px] py-1 px-3"
                    >
                      Start Check-in
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setIsEscalateModalOpen(true)}
                      className="text-[10px] py-1 px-3 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      Escalate Case
                    </Button>
                  </div>
                </div>
              )}

              {/* Check-in Log Timeline */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block">Check-in Log History</span>
                <div className="space-y-4">
                  {timeline.map((item) => (
                    <Card key={item.id} className="p-4 border-border space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-rose-400">{item.date}</span>
                        <Badge 
                          variant={
                            item.mood_tag === 'doing well' ? 'success' : (item.mood_tag === 'needs attention' ? 'warning' : 'danger')
                          }
                          className="text-[8px] border-none"
                        >
                          {item.mood_tag.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-[10px] font-mono text-ink-muted uppercase">Mode: {item.mode}</div>
                      <p className="text-xs text-ink-muted font-ui whitespace-pre-wrap select-none leading-relaxed bg-paper/30 p-2.5 rounded border border-border/40">
                        {item.notes}
                      </p>
                    </Card>
                  ))}
                  {timeline.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-border rounded-radius-md text-ink-muted text-xs">
                      No check-in session entries logged.
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Heart className="text-rose-500/20 mb-4 animate-pulse" size={48} />
              <div className="text-xs text-ink font-semibold">Select a mentee to view timeline</div>
              <p className="text-[10px] text-ink-muted mt-1 max-w-xs">Qualitative check-ins, logs, and prompt generators will load here.</p>
            </Card>
          )}

        </div>

      </div>

      {/* Log Check-in Modal */}
      {isCheckinModalOpen && activeMentee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-surface border-rose-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-mono font-bold text-rose-400">LOG WELLBEING CHECK-IN: {activeMentee.name}</span>
              <button onClick={() => setIsCheckinModalOpen(false)} className="text-ink-muted hover:text-ink text-xs font-mono">[X]</button>
            </div>
            
            <form onSubmit={handleLogCheckin} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Check-in Mode</label>
                  <select 
                    value={checkinMode} 
                    onChange={e => setCheckinMode(e.target.value)}
                    className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none"
                  >
                    <option value="in-person">In-Person Meeting</option>
                    <option value="call">Phone Call</option>
                    <option value="chat">Chat / Message</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Mood Tag</label>
                  <select 
                    value={checkinMood} 
                    onChange={e => setCheckinMood(e.target.value)}
                    className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none"
                  >
                    <option value="doing well">Doing Well</option>
                    <option value="needs attention">Needs Attention</option>
                    <option value="concerning">Concerning</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Meeting Conversation Notes (Sensitive data)</label>
                <textarea 
                  rows={4} 
                  required
                  placeholder="Record summary of conversations. Notes are encrypted and visible only to assigned mentor."
                  value={checkinNotes}
                  onChange={e => setCheckinNotes(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none focus:border-rose-500"
                />
              </div>

              <Button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-black font-mono">
                SUBMIT CHECK-IN LOG
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Escalate Case Modal */}
      {isEscalateModalOpen && activeMentee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-surface border-rose-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-mono font-bold text-rose-400">ESCALATE WELLBEING CASE: {activeMentee.name}</span>
              <button onClick={() => setIsEscalateModalOpen(false)} className="text-ink-muted hover:text-ink text-xs font-mono">[X]</button>
            </div>
            
            <form onSubmit={handleRaiseEscalation} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Escalate To</label>
                <select 
                  value={escalateTo} 
                  onChange={e => setEscalateTo(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none"
                >
                  <option value="counselor">Institutional Counselor</option>
                  <option value="HOD">Head of Department (HOD)</option>
                  <option value="Dean">Dean of Student Affairs</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Reason for Escalation</label>
                <textarea 
                  rows={4} 
                  required
                  placeholder="State academic, attendance, health, or emotional concerns justifying counselor review."
                  value={escalateReason}
                  onChange={e => setEscalateReason(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none focus:border-rose-500"
                />
              </div>

              <Button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-black font-mono">
                SUBMIT ESCALATION REQUEST
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Floating Chat drawer bottom-right */}
      <div className="absolute bottom-6 right-6 w-full max-w-sm px-4 z-30">
        <Card className="shadow-2xl border-rose-500/40 border bg-surface/95 backdrop-blur p-4">
          <div className="text-[10px] font-mono text-rose-400 mb-2 uppercase tracking-wider flex items-center gap-1">
            <Heart size={12} /> Wellbeing Advisor Chat
          </div>
          
          {chatMessages.length > 0 && (
            <div className="mb-3 max-h-36 overflow-y-auto border-b border-border/80 pb-2 text-xs">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-rose-600/30' : 'bg-paper border border-border'}`}>
                    {m.content}
                  </span>
                </div>
              ))}
              {streamingText && (
                <div className="text-left">
                  <span className="inline-block p-2 rounded bg-paper border border-border">
                    {streamingText}
                  </span>
                </div>
              )}
            </div>
          )}

          {streamingTraces.map((t, idx) => (
            <div key={idx} className="text-[8px] font-mono text-rose-500 mb-1">
              {t.name}... ({t.status})
            </div>
          ))}

          <div className="flex gap-2">
            <Input 
              placeholder="Ask about check-in prompts, overdue mentees..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              className="text-xs border-rose-500/20 focus:border-rose-500"
            />
            <Button onClick={handleSendChat} size="sm" className="bg-rose-500 hover:bg-rose-600 text-black">
              <Send size={10} />
            </Button>
          </div>
        </Card>
      </div>

    </div>
  );
};
