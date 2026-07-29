import { SharedChatInterface } from '../components/SharedChatInterface';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from '../components/Common';
import { Network, Send, Users, DollarSign, Calendar, MessageSquare, Edit2, Plus } from 'lucide-react';
import { api, type ChatMessage } from '../services/api';

export const AlumniRelations: React.FC<{ user: any }> = ({ user }) => {
  const [chatInput, setChatInput] = useState('');
  const [alumni, setAlumni] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isAlumniModalOpen, setIsAlumniModalOpen] = useState(false);
  const [editingAlumniId, setEditingAlumniId] = useState<number | null>(null);
  const [alumniForm, setAlumniForm] = useState({ name: '', batch: '', branch: '', company: '', designation: '' });

  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [editingDonationId, setEditingDonationId] = useState<number | null>(null);
  const [donationForm, setDonationForm] = useState({ alumni_name: '', amount: '', purpose: '' });

  const loadData = async () => {
    try {
      const a = await api.getAlumniDirectory();
      const d = await api.getAlumniDonations();
      setAlumni(a);
      setDonations(d);
    } catch (error) {
      console.error("Failed to fetch alumni data", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText, streamingTraces]);

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
        'agent8',
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

  const handleAlumniSubmit = async () => {
    if (editingAlumniId) {
      await api.editAlumni(editingAlumniId, alumniForm);
    } else {
      await api.addAlumni(alumniForm);
    }
    setIsAlumniModalOpen(false);
    loadData();
  };

  const handleDonationSubmit = async () => {
    if (editingDonationId) {
      await api.editAlumniDonation(editingDonationId, donationForm);
    } else {
      await api.addAlumniDonation(donationForm);
    }
    setIsDonationModalOpen(false);
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
          <h2 className="text-xl font-display font-bold text-ink">Alumni Relations</h2>
          <p className="text-xs text-ink-muted">Manage alumni networks, donations, and guest lectures.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Left/Middle Content */}
        <div className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[ 
              { label: 'Registered Alumni', value: '1,240', icon: Users },
              { label: 'Active Mentors', value: '45', icon: MessageSquare },
              { label: 'Upcoming Lectures', value: '2', icon: Calendar },
              { label: 'Total Donations', value: '$12.5k', icon: DollarSign }
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

          {/* Directory & Funds */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Network size={14} className="text-accent-500" /> Alumni Directory</h3>
                <Button size="sm" onClick={() => { setEditingAlumniId(null); setAlumniForm({ name: '', batch: '', branch: '', company: '', designation: '' }); setIsAlumniModalOpen(true); }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={12} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {alumni.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No alumni found
                  </div>
                ) : (
                  alumni.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-ink">{a.name || 'Alumni Name'}</div>
                        <div className="text-xs text-ink-muted">{a.batch || 'Batch'} | {a.company || 'Company'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-6 w-6 text-ink-muted hover:text-accent-500" onClick={() => {
                          setEditingAlumniId(a.id);
                          setAlumniForm({ name: a.name || '', batch: a.batch || '', branch: a.branch || '', company: a.company || '', designation: a.designation || '' });
                          setIsAlumniModalOpen(true);
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
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><DollarSign size={14} className="text-accent-500" /> Donation Ledger</h3>
                <Button size="sm" onClick={() => { setEditingDonationId(null); setDonationForm({ alumni_name: '', amount: '', purpose: '' }); setIsDonationModalOpen(true); }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={12} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {donations.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No donations found
                  </div>
                ) : (
                  donations.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-ink">{d.donor_name || 'Donor'}</div>
                        <div className="text-xs text-ink-muted">{d.amount ? `$${d.amount}` : 'Amount'} | {d.purpose || 'General'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-6 w-6 text-ink-muted hover:text-accent-500" onClick={() => {
                          setEditingDonationId(d.id);
                          setDonationForm({ alumni_name: d.alumni_name || d.donor_name || '', amount: d.amount || '', purpose: d.purpose || '' });
                          setIsDonationModalOpen(true);
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
          <div className="bg-gradient-to-r from-accent-900/50 to-yellow-900/50 px-4 py-3 flex items-center gap-3 border-b border-accent-500/30">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center shadow-lg">
              <Network size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Alumni AI</div>
              <div className="text-[9px] text-accent-300 font-mono">Ready to assist</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex gap-2 w-[85%]">
              <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                <Network size={10} className="text-white" />
              </div>
              <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                Hello! I am your Alumni Relations AI. I can draft outreach emails, organize mentor matches, or analyze donation trends.
              </div>
            </div>
            
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary-500' : 'bg-accent-500'}`}>
                  {msg.role === 'user' ? <Users size={10} className="text-white" /> : <Network size={10} className="text-white" />}
                </div>
                <div className={`text-xs p-2.5 rounded-2xl border ${
                  msg.role === 'user' 
                    ? 'bg-primary-500/10 text-ink rounded-tr-sm border-primary-500/20' 
                    : 'bg-accent-500/10 text-ink rounded-tl-sm border-accent-500/20'
                }`}>
                  <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            
            {(isLoading || streamingText || streamingTraces.length > 0) && (
              <div className="flex gap-2 w-[85%]">
                <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                  <Network size={10} className="text-white" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {streamingTraces.map((trace, idx) => (
                    <div key={idx} className="bg-surface border border-border rounded p-2 text-[10px] font-mono text-ink-muted">
                      {JSON.stringify(trace)}
                    </div>
                  ))}
                  {streamingText && (
                    <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                      <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">
                        {streamingText}
                      </div>
                    </div>
                  )}
                  {isLoading && !streamingText && streamingTraces.length === 0 && (
                    <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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
                placeholder="Ask Alumni AI..."
                className="flex-1 bg-paper text-xs rounded-xl"
              />
              <Button size="sm" onClick={() => handleSendChat()} disabled={isLoading} className="bg-accent-500 text-black hover:bg-accent-600 rounded-xl">
                <Send size={14} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {isAlumniModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl w-96 p-4 flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingAlumniId ? 'Edit Alumni' : 'Add Alumni'}</h3>
            <Input placeholder="Name" value={alumniForm.name} onChange={e => setAlumniForm({...alumniForm, name: e.target.value})} />
            <Input placeholder="Batch" value={alumniForm.batch} onChange={e => setAlumniForm({...alumniForm, batch: e.target.value})} />
            <Input placeholder="Branch" value={alumniForm.branch} onChange={e => setAlumniForm({...alumniForm, branch: e.target.value})} />
            <Input placeholder="Company" value={alumniForm.company} onChange={e => setAlumniForm({...alumniForm, company: e.target.value})} />
            <Input placeholder="Designation" value={alumniForm.designation} onChange={e => setAlumniForm({...alumniForm, designation: e.target.value})} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsAlumniModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleAlumniSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {isDonationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl w-96 p-4 flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingDonationId ? 'Edit Donation' : 'Add Donation'}</h3>
            <Input placeholder="Alumni Name" value={donationForm.alumni_name} onChange={e => setDonationForm({...donationForm, alumni_name: e.target.value})} />
            <Input placeholder="Amount" type="number" value={donationForm.amount} onChange={e => setDonationForm({...donationForm, amount: e.target.value})} />
            <Input placeholder="Purpose" value={donationForm.purpose} onChange={e => setDonationForm({...donationForm, purpose: e.target.value})} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsDonationModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleDonationSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
