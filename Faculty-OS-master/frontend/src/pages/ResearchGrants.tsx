import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Calendar, Plus, Clock, Search, BookOpen, ExternalLink, Send, ArrowRight } from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface ResearchGrantsProps {
  user: UserType;
}

export const ResearchGrants: React.FC<ResearchGrantsProps> = ({ user }) => {
  const [publications, setPublications] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Forms
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [newPubTitle, setNewPubTitle] = useState('');
  const [newPubVenue, setNewPubVenue] = useState('');
  const [newPubType, setNewPubType] = useState('journal');
  const [newPubYear, setNewPubYear] = useState(2026);
  const [newPubAuthors, setNewPubAuthors] = useState('');
  const [newPubDoi, setNewPubDoi] = useState('');

  // Ask Chat panel
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const pubData = await api.getPublications();
      const grantData = await api.getGrants();
      const deadlineData = await api.getResearchDeadlines();
      setPublications(pubData);
      setGrants(grantData);
      setDeadlines(deadlineData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPubTitle || !newPubVenue) return;
    try {
      await api.logPublication(newPubTitle, newPubVenue, newPubType, newPubYear, newPubAuthors, newPubDoi);
      setIsPubModalOpen(false);
      setNewPubTitle('');
      setNewPubVenue('');
      setNewPubAuthors('');
      setNewPubDoi('');
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
      'agent4',
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
    if (chatMessages.length > 1 || streamingText) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages, streamingText]);

  // Group publications by year
  const pubsByYear: Record<number, any[]> = {};
  publications.forEach(p => {
    pubsByYear[p.year] = pubsByYear[p.year] || [];
    pubsByYear[p.year].push(p);
  });
  const yearsSorted = Object.keys(pubsByYear).map(Number).sort((a, b) => b - a);

  // Helper to count days between today and target date
  const getDaysLeft = (targetStr: string) => {
    const today = new Date("2026-07-27"); // locked MVP calendar date
    const target = new Date(targetStr);
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  return (
    <div className="h-full flex flex-col relative bg-paper text-ink overflow-hidden font-ui">
      
      {/* Header Row */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent4" icon={GraduationCap} size="md" className="bg-sky-500" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Research & Grants</h1>
            <p className="text-xs text-ink-muted">Career & growth: log academic publications, view funding call timelines, and identify co-authors.</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsPubModalOpen(true)}
          className="bg-sky-500 hover:bg-sky-700 text-black text-xs font-mono py-2 flex items-center gap-1"
        >
          <Plus size={14} /> LOG PUBLICATION
        </Button>
      </div>

      {/* Split Layout: Deadlines Left (35%), Publications Right (65%) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-6 overflow-hidden pb-20">
        
        {/* Left Column: Deadlines & Grants (35%) */}
        <div className="lg:col-span-4 flex flex-col space-y-6 overflow-y-auto pr-1">
          
          {/* Deadlines Section */}
          <div className="space-y-3">
            <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block">Upcoming Deadlines</span>
            <div className="space-y-3">
              {deadlines.map((d) => {
                const daysLeft = getDaysLeft(d.due_date);
                let borderClass = 'border-l-sky-500';
                if (daysLeft < 7) borderClass = 'border-l-status-bad';
                else if (daysLeft < 30) borderClass = 'border-l-status-warn';

                return (
                  <div key={d.id} className={`p-3 bg-surface border border-border border-l-4 ${borderClass} rounded-radius-md flex items-center justify-between`}>
                    <div>
                      <div className="text-xs font-semibold">{d.title}</div>
                      <div className="text-[9px] text-ink-muted mt-0.5 uppercase font-mono">{d.type} • {d.due_date}</div>
                    </div>
                    <Badge variant={daysLeft < 7 ? 'danger' : (daysLeft < 30 ? 'warning' : 'accent')}>
                      {daysLeft} DAYS
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grants Section */}
          <div className="space-y-3">
            <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block">Matching Grants</span>
            <div className="space-y-3">
              {grants.map((g) => {
                const fitReason = (g.title.includes("AI") || g.focus_area.includes("AI") || g.title.includes("ML")) ? "Matches your current ML research on medical segmentation." : "Matches your advanced computing research background.";
                return (
                  <Card key={g.id} className="p-4 border-l-4 border-l-sky-500/50 hover:border-l-sky-500 transition duration-200">
                    <div className="flex justify-between items-start">
                      <div className="text-xs font-bold">{g.title}</div>
                      <span className="text-[10px] font-mono text-sky-400 font-semibold">{g.amount}</span>
                    </div>
                    <div className="text-[9px] text-ink-muted font-mono mt-1 uppercase">{g.funding_body} • Due: {g.deadline}</div>
                    <p className="text-[10px] italic text-sky-300 mt-2 bg-sky-500/5 p-1.5 rounded">
                      Fit: {fitReason}
                    </p>
                    <a href="#" className="inline-flex items-center gap-1 text-[9px] font-mono text-sky-400 hover:text-sky-300 underline mt-2">
                      View full call <ExternalLink size={8} />
                    </a>
                  </Card>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Publications List (65%) */}
        <div className="lg:col-span-6 flex flex-col overflow-y-auto pr-1">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block mb-3">Publications Timeline</span>
          
          {publications.length === 0 ? (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Seal agentId="agent4" icon={GraduationCap} size="lg" className="bg-sky-600/20 mb-4" />
              <div className="text-xs text-ink font-semibold">No publications logged yet</div>
              <p className="text-[10px] text-ink-muted mt-1 max-w-xs">Log your first publication to start building your research timeline.</p>
              <Button size="sm" onClick={() => setIsPubModalOpen(true)} className="bg-sky-500 hover:bg-sky-600 text-black text-xs font-mono mt-4">
                Log publication
              </Button>
            </Card>
          ) : (
            <Card className="flex-1 p-6 space-y-6">
              {yearsSorted.map((year) => (
                <div key={year} className="relative pl-6 border-l border-border/80 last:border-transparent pb-4">
                  {/* Timeline bullet */}
                  <div className="absolute -left-[4.5px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500 border-2 border-paper" />
                  
                  <div className="font-display text-sm font-semibold text-sky-400 mb-2 font-mono">{year}</div>
                  
                  <div className="space-y-4">
                    {pubsByYear[year].map((p) => (
                      <div key={p.id} className="pb-3 border-b border-border/40 last:border-none">
                        <div className="text-xs font-medium text-ink leading-snug">{p.title}</div>
                        <div className="text-[10px] text-ink-muted mt-1">Authors: {p.co_authors || user.name}</div>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-sky-400/80 mt-1">
                          <span className="uppercase">{p.type}</span>
                          <span>•</span>
                          <span className="truncate">{p.venue}</span>
                          <span>•</span>
                          <Badge variant="accent" className="px-1 py-0 px-1 bg-sky-500/10 text-sky-400 border-none text-[8px]">
                            {p.citation_count} CITATIONS
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

        </div>

      </div>

      {/* Publications Logging Modal */}
      {isPubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-surface border-sky-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-mono font-bold text-sky-400">LOG NEW PUBLICATION</span>
              <button onClick={() => setIsPubModalOpen(false)} className="text-ink-muted hover:text-ink text-xs font-mono">[X]</button>
            </div>
            
            <form onSubmit={handleAddPublication} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Paper Title</label>
                <Input placeholder="Enter title of publication" required value={newPubTitle} onChange={e => setNewPubTitle(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Venue (Journal/Conference)</label>
                  <Input placeholder="e.g. IEEE Transactions" required value={newPubVenue} onChange={e => setNewPubVenue(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Type</label>
                  <select 
                    value={newPubType} 
                    onChange={e => setNewPubType(e.target.value)}
                    className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none"
                  >
                    <option value="journal">Journal</option>
                    <option value="conference">Conference</option>
                    <option value="patent">Patent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Year</label>
                  <Input type="number" required value={newPubYear} onChange={e => setNewPubYear(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">DOI / Link (Optional)</label>
                  <Input placeholder="e.g. doi.org/10.11" value={newPubDoi} onChange={e => setNewPubDoi(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Co-Authors (comma-separated)</label>
                <Input placeholder="e.g. S. Ram, V. Krish" value={newPubAuthors} onChange={e => setNewPubAuthors(e.target.value)} />
              </div>

              <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-black font-mono">
                SUBMIT PUBLICATION
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Floating Query/Ask drawer bottom-right */}
      <div className="absolute bottom-6 right-6 w-full max-w-sm px-4 z-30">
        <Card className="shadow-2xl border-sky-500/40 border bg-surface/95 backdrop-blur p-4">
          <div className="text-[10px] font-mono text-sky-400 mb-2 uppercase tracking-wider flex items-center gap-1">
            <GraduationCap size={12} /> Research Agent Chat
          </div>
          
          {chatMessages.length > 0 && (
            <div className="mb-3 max-h-36 overflow-y-auto border-b border-border/80 pb-2 text-xs">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-sky-600/30' : 'bg-paper border border-border'}`}>
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
            <div key={idx} className="text-[8px] font-mono text-sky-500 mb-1">
              {t.name}... ({t.status})
            </div>
          ))}

          <div className="flex gap-2">
            <Input 
              placeholder="Ask about grants fitting AI, co-authors..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              className="text-xs border-sky-500/20 focus:border-sky-500"
            />
            <Button onClick={handleSendChat} size="sm" className="bg-sky-500 hover:bg-sky-600 text-black">
              <Send size={10} />
            </Button>
          </div>
        </Card>
      </div>

    </div>
  );
};
