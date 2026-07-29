import React, { useState, useEffect, useRef } from 'react';
import { ClipboardSignature, Plus, Trash2, Edit2, Play, Check, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface ExamAssessmentProps {
  user: UserType;
}

export const ExamAssessment: React.FC<ExamAssessmentProps> = ({ user }) => {
  const [questionsBank, setQuestionsBank] = useState<any[]>([]);
  const [generatedPapers, setGeneratedPapers] = useState<any[]>([]);
  const [activePaper, setActivePaper] = useState<any | null>(null);
  
  // Paper Wizard inputs
  const [subject, setSubject] = useState('Design & Analysis of Algorithms');
  const [examType, setExamType] = useState('CAT2');
  const [totalMarks, setTotalMarks] = useState(50);
  const [duration, setDuration] = useState(90);
  const [bloomTargets, setBloomTargets] = useState<Record<string, number>>({
    Remember: 10,
    Understand: 20,
    Apply: 30,
    Analyze: 25,
    Evaluate: 10,
    Create: 5
  });

  // Rubric modal
  const [activeRubric, setActiveRubric] = useState<any[] | null>(null);
  const [isRubricLoading, setIsRubricLoading] = useState(false);

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    try {
      const qData = await api.getQuestionsBank();
      const pData = await api.getGeneratedPapers();
      setQuestionsBank(qData);
      setGeneratedPapers(pData);
      if (pData.length > 0 && !activePaper) {
        setActivePaper(pData[pData.length - 1]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBloomChange = (level: string, val: number) => {
    setBloomTargets(prev => ({
      ...prev,
      [level]: val
    }));
  };

  const bloomTotal = Object.values(bloomTargets).reduce((a, b) => a + b, 0);

  const handleGeneratePaper = async () => {
    if (bloomTotal !== 100) return;
    setIsLoading(true);
    try {
      const res = await api.generatePaper({
        subject,
        exam_type: examType,
        total_marks: totalMarks,
        duration,
        co_targets: { CO1: 40, CO2: 40, CO3: 20 },
        bloom_targets: bloomTargets
      });
      loadData();
      // reload papers
      const pData = await api.getGeneratedPapers();
      setGeneratedPapers(pData);
      const newPaper = pData.find((p: any) => p.id === res.paper_id);
      if (newPaper) {
        setActivePaper(newPaper);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeratePaper = async (paperId: number, status: string) => {
    try {
      await api.moderateQuestionPaper(paperId, status);
      setGeneratedPapers(prev => prev.map(p => p.id === paperId ? { ...p, status } : p));
      if (activePaper?.id === paperId) {
        setActivePaper((prev: any) => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateRubric = async (paperId: number) => {
    setIsRubricLoading(true);
    try {
      const rub = await api.getRubricSchema({});
      setActiveRubric(rub);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRubricLoading(false);
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
      'agent5',
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

  // Aggregate stats from active paper
  const coCoverage = activePaper?.co_coverage || { CO1: 40, CO2: 40, CO3: 20 };
  const paperBloom = activePaper?.bloom_distribution || { Remember: 10, Understand: 20, Apply: 30, Analyze: 20, Evaluate: 10, Create: 10 };

  return (
    <div className="h-full flex flex-col relative bg-paper text-ink overflow-hidden font-ui">
      
      {/* Header Row */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent5" icon={ClipboardSignature} size="md" className="bg-fuchsia-500" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Exam & Assessment Design</h1>
            <p className="text-xs text-ink-muted">Paper-setter: generate question papers aligned to Bloom's taxonomy levels and Course Outcomes (CO/PO).</p>
          </div>
        </div>
      </div>

      {/* Main split: Wizard left, charts/paper output right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-6 overflow-hidden pb-20">
        
        {/* Left column: Wizard & Parameters (40%) */}
        <div className="lg:col-span-4 flex flex-col space-y-6 overflow-y-auto pr-1">
          
          <Card className="space-y-4">
            <div className="text-xs font-semibold text-fuchsia-400 font-mono uppercase tracking-wider">Configure Paper Specifications</div>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Subject Course</label>
                <select 
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none focus:border-fuchsia-500"
                >
                  <option value="Design & Analysis of Algorithms">Design & Analysis of Algorithms</option>
                  <option value="Machine Learning">Machine Learning</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Exam Type</label>
                  <select 
                    value={examType}
                    onChange={e => setExamType(e.target.value)}
                    className="w-full bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 outline-none"
                  >
                    <option value="CAT1">CAT 1</option>
                    <option value="CAT2">CAT 2</option>
                    <option value="Semester">Semester</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Marks</label>
                  <Input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Duration (m)</label>
                  <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} />
                </div>
              </div>

              {/* Bloom levels sliders */}
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-ink-muted uppercase">Bloom's Taxonomy Target Weight (%)</span>
                  <Badge variant={bloomTotal === 100 ? 'accent' : 'danger'}>
                    Total: {bloomTotal}%
                  </Badge>
                </div>
                
                {Object.entries(bloomTargets).map(([level, val]) => (
                  <div key={level} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                      <span>{level}</span>
                      <span className="text-ink">{val}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="60" 
                      step="5"
                      value={val} 
                      onChange={e => handleBloomChange(level, Number(e.target.value))}
                      className="w-full h-1 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                    />
                  </div>
                ))}
              </div>

              <Button 
                onClick={handleGeneratePaper} 
                className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-black font-mono font-bold mt-4"
                disabled={bloomTotal !== 100 || isLoading}
              >
                GENERATE QUESTION PAPER
              </Button>
            </div>
          </Card>

        </div>

        {/* Right column: Target coverage visualization & Draft Paper Output (60%) */}
        <div className="lg:col-span-6 flex flex-col space-y-6 overflow-y-auto pr-1">
          
          {/* Target coverage cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* CO Attainment Target */}
            <Card className="p-4">
              <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-3">CO Coverage Target</div>
              <div className="space-y-3">
                {Object.entries(coCoverage).map(([co, pct]: any) => (
                  <div key={co} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-fuchsia-400 font-semibold">{co}</span>
                      <span className="text-ink-muted">{pct}%</span>
                    </div>
                    <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden border border-border/40">
                      <div className="bg-fuchsia-500 h-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bloom targets visualization */}
            <Card className="p-4">
              <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-3">Bloom's Levels Distribution</div>
              <div className="space-y-2">
                <div className="w-full h-5 rounded overflow-hidden flex">
                  {Object.entries(paperBloom).map(([level, val]: any, i) => {
                    const colors = ['bg-fuchsia-600', 'bg-fuchsia-500', 'bg-fuchsia-400', 'bg-purple-600', 'bg-purple-500', 'bg-pink-500'];
                    return (
                      <div 
                        key={level} 
                        className={`${colors[i % colors.length]}`} 
                        style={{ width: `${val}%` }} 
                        title={`${level}: ${val}%`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-ink-muted mt-2">
                  {Object.entries(paperBloom).map(([level, val]: any) => (
                    <div key={level} className="truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 inline-block" />
                      <span>{level.substring(0, 4)}: {val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

          </div>

          {/* Active Question Paper preview */}
          {activePaper ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase">{activePaper.subject}</h3>
                  <span className="text-[9px] font-mono text-ink-muted uppercase">{activePaper.exam_type} • {activePaper.total_marks} Marks • {activePaper.duration} Mins</span>
                </div>
                
                {/* Moderation actions & status */}
                <div className="flex items-center gap-2">
                  <Badge variant={activePaper.status === 'final' ? 'success' : (activePaper.status === 'moderated' ? 'warning' : 'neutral')}>
                    {activePaper.status.toUpperCase()}
                  </Badge>
                  {activePaper.status === 'draft' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleModeratePaper(activePaper.id, 'moderated')}
                      className="text-[9px] py-1 px-2 bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20"
                    >
                      Moderate
                    </Button>
                  )}
                  {activePaper.status === 'moderated' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleModeratePaper(activePaper.id, 'final')}
                      className="text-[9px] py-1 px-2 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                    >
                      Finalize
                    </Button>
                  )}
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-3">
                {activePaper.questions.map((q: any, idx: number) => (
                  <div key={idx} className="p-3 bg-surface border border-border/80 rounded hover:border-fuchsia-500/50 transition">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="text-xs leading-relaxed"><span className="font-mono text-fuchsia-400 font-semibold mr-1.5">Q{idx + 1}.</span>{q.question_text}</div>
                      <span className="text-[10px] font-mono text-ink-muted flex-shrink-0">{q.marks} Marks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="accent" className="text-[9px] border-none bg-fuchsia-500/15 text-fuchsia-400">{q.co}</Badge>
                      <Badge variant="neutral" className="text-[9px] border-none">{q.bloom_level}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border flex justify-between gap-4">
                <Button size="sm" variant="outline" onClick={() => handleGenerateRubric(activePaper.id)} className="text-[10px] py-1 px-2">
                  Generate Grading Rubric
                </Button>
              </div>

              {/* Rubric View */}
              {activeRubric && (
                <div className="mt-4 p-3 bg-surface-raised border border-border rounded text-[11px] space-y-2">
                  <div className="font-mono text-[9px] text-fuchsia-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Generated Rubric Criteria</span>
                    <button onClick={() => setActiveRubric(null)} className="text-ink-muted hover:text-ink font-mono">[CLOSE]</button>
                  </div>
                  {activeRubric.map((r, idx) => (
                    <div key={idx} className="pb-1.5 border-b border-border/40 last:border-none">
                      <div className="font-semibold">{r.criterion} ({r.max_marks} Marks)</div>
                      <div className="text-ink-muted text-[10px] mt-0.5">{r.descriptor}</div>
                    </div>
                  ))}
                </div>
              )}

            </Card>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <ClipboardSignature className="text-fuchsia-500/20 mb-4 animate-pulse" size={48} />
              <div className="text-xs text-ink font-semibold">No active question papers generated yet</div>
              <p className="text-[10px] text-ink-muted mt-1 max-w-xs">Select your Bloom's targets on the left wizard and click generate paper.</p>
            </Card>
          )}

        </div>

      </div>

      {/* Floating Query Chat drawer bottom-right */}
      <div className="absolute bottom-6 right-6 w-full max-w-sm px-4 z-30">
        <Card className="shadow-2xl border-fuchsia-500/40 border bg-surface/95 backdrop-blur p-4">
          <div className="text-[10px] font-mono text-fuchsia-400 mb-2 uppercase tracking-wider flex items-center gap-1">
            <ClipboardSignature size={12} /> Assessment Advisor Chat
          </div>
          
          {chatMessages.length > 0 && (
            <div className="mb-3 max-h-36 overflow-y-auto border-b border-border/80 pb-2 text-xs">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-fuchsia-600/30' : 'bg-paper border border-border'}`}>
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
            <div key={idx} className="text-[8px] font-mono text-fuchsia-500 mb-1">
              {t.name}... ({t.status})
            </div>
          ))}

          <div className="flex gap-2">
            <Input 
              placeholder="Ask to draft a question on dynamic programming..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              className="text-xs border-fuchsia-500/20 focus:border-fuchsia-500"
            />
            <Button onClick={handleSendChat} size="sm" className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black">
              <Send size={10} />
            </Button>
          </div>
        </Card>
      </div>

    </div>
  );
};
