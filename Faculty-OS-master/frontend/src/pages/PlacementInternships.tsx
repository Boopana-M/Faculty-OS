import { SharedChatInterface } from '../components/SharedChatInterface';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from '../components/Common';
import { Briefcase, Send, Users, TrendingUp, Building2, Calendar, FileText, Edit2, Plus, User } from 'lucide-react';
import { api, type ChatMessage } from '../services/api';

export const PlacementInternships: React.FC<{ user: any }> = ({ user }) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [drives, setDrives] = useState<any[]>([]);
  const [internships, setInternships] = useState<any[]>([]);
  
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [editingDriveId, setEditingDriveId] = useState<number | null>(null);
  const [driveForm, setDriveForm] = useState({ company_name: '', job_roles: '', eligible_branches: '', expected_ctc: '', visit_date: '' });

  const [isInternshipModalOpen, setIsInternshipModalOpen] = useState(false);
  const [editingInternshipId, setEditingInternshipId] = useState<number | null>(null);
  const [internshipForm, setInternshipForm] = useState({ student_name: '', company: '', duration: '' });

  const loadData = async () => {
    try {
      const d = await api.getPlacementDrives();
      const i = await api.getInternships();
      setDrives(d);
      setInternships(i);
    } catch (error) {
      console.error("Failed to fetch placement data", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        'agent7',
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  const handleDriveSubmit = async () => {
    if (editingDriveId) {
      await api.editPlacementDrive(editingDriveId, driveForm);
    } else {
      await api.addPlacementDrive(driveForm);
    }
    setIsDriveModalOpen(false);
    loadData();
  };

  const handleInternshipSubmit = async () => {
    if (editingInternshipId) {
      await api.editInternship(editingInternshipId, internshipForm);
    } else {
      await api.addInternship(internshipForm);
    }
    setIsInternshipModalOpen(false);
    loadData();
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
          <h2 className="text-xl font-display font-bold text-ink">Placement & Internships</h2>
          <p className="text-xs text-ink-muted">Manage campus drives, student internships, and career readiness.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Left/Middle Content */}
        <div className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[ 
              { label: 'Upcoming Drives', value: '3', icon: Building2 },
              { label: 'Placed Students', value: '45/60', icon: Users },
              { label: 'Active Internships', value: '12', icon: Briefcase },
              { label: 'Placement Rate', value: '75%', icon: TrendingUp }
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

          {/* Drive & Internships lists */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Building2 size={14} className="text-accent-500" /> Upcoming Placement Drives</h3>
                <Button size="sm" onClick={() => { setEditingDriveId(null); setDriveForm({ company_name: '', job_roles: '', eligible_branches: '', expected_ctc: '', visit_date: '' }); setIsDriveModalOpen(true); }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={12} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {drives.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No placement drives found
                  </div>
                ) : (
                  drives.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-ink">{d.company || 'Unknown Company'}</div>
                        <div className="text-xs text-ink-muted">{d.date || 'TBD'} | {d.role || 'SDE'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-semibold text-accent-500 bg-accent-500/10 px-2 py-1 rounded">
                          {d.status || 'Scheduled'}
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 text-ink-muted hover:text-accent-500" onClick={() => {
                          setEditingDriveId(d.id);
                          setDriveForm({ company_name: d.company_name || d.company || '', job_roles: d.job_roles || d.role || '', eligible_branches: d.eligible_branches || '', expected_ctc: d.expected_ctc || '', visit_date: d.visit_date || d.date || '' });
                          setIsDriveModalOpen(true);
                        }}>
                          <Edit2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
            
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Briefcase size={14} className="text-accent-500" /> Ongoing Internships</h3>
                <Button size="sm" onClick={() => { setEditingInternshipId(null); setInternshipForm({ student_name: '', company: '', duration: '' }); setIsInternshipModalOpen(true); }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={12} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {internships.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No ongoing internships found
                  </div>
                ) : (
                  internships.map((inv, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-ink">{inv.student_name || 'Student'}</div>
                        <div className="text-xs text-ink-muted">{inv.company || 'Company'} | {inv.duration || '6 months'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-6 w-6 text-ink-muted hover:text-accent-500" onClick={() => {
                          setEditingInternshipId(inv.id);
                          setInternshipForm({ student_name: inv.student_name || '', company: inv.company || '', duration: inv.duration || '' });
                          setIsInternshipModalOpen(true);
                        }}>
                          <Edit2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Side Chat */}
        <Card className="xl:col-span-1 flex flex-col border border-accent-500/30 bg-surface/96 overflow-hidden p-0">
          <div className="bg-gradient-to-r from-accent-900/50 to-orange-900/50 px-4 py-3 flex items-center gap-3 border-b border-accent-500/30">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center shadow-lg">
              <Briefcase size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Career Advisor AI</div>
              <div className="text-[9px] text-accent-300 font-mono">Ready to assist</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex gap-2 w-[85%]">
              <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                <Briefcase size={10} className="text-white" />
              </div>
              <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                Hello! I am your Placement & Career AI. I can help you draft company invites, track student readiness, or prepare mock interview questions.
              </div>
            </div>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary-500' : 'bg-accent-500'}`}>
                  {msg.role === 'user' ? <User size={10} className="text-white" /> : <Briefcase size={10} className="text-white" />}
                </div>
                <div className={`text-xs p-2.5 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-primary-500/10 text-ink rounded-tr-sm border border-primary-500/20' 
                    : 'bg-accent-500/10 text-ink rounded-tl-sm border border-accent-500/20'
                }`}>
                  <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {(isLoading && (streamingText || streamingTraces.length > 0)) && (
              <div className="flex gap-2 w-[85%]">
                <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                  <Briefcase size={10} className="text-white" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  {streamingTraces.map((trace, i) => (
                    <div key={i} className="text-[10px] text-accent-400 font-mono bg-accent-950/30 p-1.5 rounded border border-accent-900/50 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />
                      {trace.action || 'Processing...'}
                    </div>
                  ))}
                  {streamingText && (
                    <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                      <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">
                        {streamingText}
                      </div>
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
                placeholder="Ask Career Advisor..."
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
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl w-96 p-4 flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingDriveId ? 'Edit Drive' : 'Add Drive'}</h3>
            <Input placeholder="Company Name" value={driveForm.company_name} onChange={e => setDriveForm({...driveForm, company_name: e.target.value})} />
            <Input placeholder="Job Roles" value={driveForm.job_roles} onChange={e => setDriveForm({...driveForm, job_roles: e.target.value})} />
            <Input placeholder="Eligible Branches" value={driveForm.eligible_branches} onChange={e => setDriveForm({...driveForm, eligible_branches: e.target.value})} />
            <Input placeholder="Expected CTC" value={driveForm.expected_ctc} onChange={e => setDriveForm({...driveForm, expected_ctc: e.target.value})} />
            <Input placeholder="Visit Date" value={driveForm.visit_date} onChange={e => setDriveForm({...driveForm, visit_date: e.target.value})} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsDriveModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleDriveSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {isInternshipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl w-96 p-4 flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingInternshipId ? 'Edit Internship' : 'Add Internship'}</h3>
            <Input placeholder="Student Name" value={internshipForm.student_name} onChange={e => setInternshipForm({...internshipForm, student_name: e.target.value})} />
            <Input placeholder="Company" value={internshipForm.company} onChange={e => setInternshipForm({...internshipForm, company: e.target.value})} />
            <Input placeholder="Duration" value={internshipForm.duration} onChange={e => setInternshipForm({...internshipForm, duration: e.target.value})} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsInternshipModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleInternshipSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
