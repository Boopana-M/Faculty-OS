import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardSignature, Send, Trash2, Edit2, Printer, X, Plus, Save,
  FileText, Sparkles, ChevronRight, RefreshCw, BookOpen, BarChart2, Pen
} from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface ExamAssessmentProps { user: UserType; }

// Bloom taxonomy colours
const BLOOM_COLORS: Record<string, string> = {
  Remember: 'bg-blue-500', Understand: 'bg-teal-500',
  Apply: 'bg-fuchsia-500', Analyze: 'bg-purple-500',
  Evaluate: 'bg-orange-500', Create: 'bg-red-500',
};

export const ExamAssessment: React.FC<ExamAssessmentProps> = ({ user }) => {
  // ─── Builder state ────────────────────────────────────────────
  const [questionsBank, setQuestionsBank] = useState<any[]>([]);
  const [generatedPapers, setGeneratedPapers] = useState<any[]>([]);
  const [activePaper, setActivePaper] = useState<any | null>(null);
  const [subject, setSubject] = useState('Design & Analysis of Algorithms');
  const [examType, setExamType] = useState('CAT2');
  const [totalMarks, setTotalMarks] = useState(50);
  const [duration, setDuration] = useState(90);

  // Bloom allocation in MARKS (not %)
  const [bloomMarks, setBloomMarks] = useState<Record<string, number>>({
    Remember: 10, Understand: 15, Apply: 15, Analyze: 10,
  });
  // CO allocation in MARKS (not %)
  const [coMarks, setCoMarks] = useState<Record<string, number>>({
    CO1: 20, CO2: 20, CO3: 10,
  });

  // ─── Paper Header Editing State ───────────────────────────────
  const [paperMeta, setPaperMeta] = useState({
    degree: 'B.E. / Computer Science and Engineering',
    semester: 'V / III Year',
    courseCode: 'CS8501',
    courseTitle: 'Design & Analysis of Algorithms',
    date: new Date().toLocaleDateString('en-GB'),
    session: 'FN',
    duration: 90,
    maxMarks: 50,
    examTitle: 'Continuous Assessment Test',
    department: 'Department of Computer Science and Engineering',
    instructions: 'Answer ALL questions in Part A and Part B. Diagrams and algorithms must be neatly presented. Mobile phones are not allowed.',
  });
  const [editingMetaField, setEditingMetaField] = useState<string | null>(null);
  const [editingMetaValue, setEditingMetaValue] = useState('');

  // ─── Inline Question Editing State ───────────────────────────
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<any>({
    question_text: '', section: 'Part A', marks: 2, co: 'CO1', bloom_level: 'Remember',
  });
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [paperNewQuestion, setPaperNewQuestion] = useState({
    question_text: '', section: 'Part A', marks: 2, co: 'CO1', bloom_level: 'Remember',
  });

  // ─── Question Bank Add Form ───────────────────────────────────
  const [newQuestion, setNewQuestion] = useState({
    question_text: '', marks: 10, co_number: 'CO1',
    bloom_level: 'Understand', unit: 1, difficulty: 'Medium',
  });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // ─── Misc State ───────────────────────────────────────────────
  const [activeRubric, setActiveRubric] = useState<any[] | null>(null);
  const [isRubricLoading, setIsRubricLoading] = useState(false);
  const [validationSummary, setValidationSummary] = useState<any | null>(null);
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ─── Chat State ───────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 Hi! I\'m your **Assessment Advisor**. I can help you:\n\n• 📄 Generate official question papers (Part A + Part B)\n• 🎯 Design Bloom\'s taxonomy aligned questions\n• 📊 Build grading rubrics (NBA compliant)\n• ✅ Validate CO/PO mapping\n• 🖊️ Suggest question improvements\n\nTry one of the quick actions below or type your request!',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load Data ────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [qData, pData] = await Promise.all([api.getQuestionsBank(), api.getGeneratedPapers()]);
      setQuestionsBank(qData);
      setGeneratedPapers(pData);
      if (pData.length > 0 && !activePaper) {
        const paper = pData[0];
        setActivePaper(paper);
        setPaperMeta(prev => ({
          ...prev,
          courseTitle: paper.subject || prev.courseTitle,
          duration: paper.duration || prev.duration,
          maxMarks: paper.total_marks || prev.maxMarks,
          examTitle: paper.exam_type || prev.examTitle,
        }));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { 
    if (chatMessages.length > 1 || streamingText) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
    }
  }, [chatMessages, streamingText]);

  // Sync paper meta when active paper changes
  useEffect(() => {
    if (activePaper) {
      setPaperMeta(prev => ({
        ...prev,
        courseTitle: activePaper.subject || prev.courseTitle,
        duration: activePaper.duration || prev.duration,
        maxMarks: activePaper.total_marks || prev.maxMarks,
        examTitle: activePaper.exam_type || prev.examTitle,
      }));
    }
  }, [activePaper?.id]);

  // ─── Derived ─────────────────────────────────────────────────
  const bloomAllocTotal = Object.values(bloomMarks).reduce((s, v) => s + v, 0);
  const coAllocTotal = Object.values(coMarks).reduce((s, v) => s + v, 0);
  const bloomOverBudget = bloomAllocTotal > totalMarks;
  const coOverBudget = coAllocTotal > totalMarks;

  const coCoverage = activePaper?.co_coverage || { CO1: 40, CO2: 40, CO3: 20 };
  const paperBloom = activePaper?.bloom_distribution || { Remember: 20, Understand: 30, Apply: 30, Analyze: 20 };
  const questionsList = activePaper?.questions || [];
  const partAQuestions = questionsList.filter((q: any) => q.section === 'Part A' || (q.marks !== undefined && Number(q.marks) <= 5));
  const partBQuestions = questionsList.filter((q: any) => q.section === 'Part B' || (q.marks !== undefined && Number(q.marks) > 5));
  const partATotalMarks = partAQuestions.reduce((s: number, q: any) => s + Number(q.marks || 2), 0);
  const partBTotalMarks = partBQuestions.reduce((s: number, q: any) => s + Number(q.marks || 10), 0);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleBloomMarkChange = (level: string, val: number) => {
    setBloomMarks(prev => ({ ...prev, [level]: Math.max(0, val) }));
  };
  const handleCoMarkChange = (co: string, val: number) => {
    setCoMarks(prev => ({ ...prev, [co]: Math.max(0, val) }));
  };

  const handleGeneratePaper = async () => {
    setIsLoading(true);
    try {
      const bloomPct: Record<string, number> = {};
      const coPct: Record<string, number> = {};
      const btTotal = Object.values(bloomMarks).reduce((s, v) => s + v, 0) || 1;
      const ctTotal = Object.values(coMarks).reduce((s, v) => s + v, 0) || 1;
      Object.entries(bloomMarks).forEach(([k, v]) => { bloomPct[k] = Math.round((v / btTotal) * 100); });
      Object.entries(coMarks).forEach(([k, v]) => { coPct[k] = Math.round((v / ctTotal) * 100); });

      const res = await api.generatePaper({
        subject, exam_type: examType, total_marks: totalMarks, duration,
        co_targets: coPct, bloom_targets: bloomPct,
      });
      const paper = res.paper || res;
      const paperList = await api.getGeneratedPapers();
      setGeneratedPapers(paperList);
      const newPaper = paperList[0] || paper;
      setActivePaper(newPaper);
      setPaperMeta(prev => ({
        ...prev,
        courseTitle: newPaper.subject || prev.courseTitle,
        duration: newPaper.duration || prev.duration,
        maxMarks: newPaper.total_marks || prev.maxMarks,
        examTitle: newPaper.exam_type || prev.examTitle,
      }));
      setActiveRubric(null);
      addAdvisorMessage(`✅ Question paper generated! **${newPaper.subject}** — ${newPaper.exam_type} (${newPaper.total_marks} Marks). You can click any question to edit it inline, or add more questions using the + button.`);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleModeratePaper = async (paperId: number, status: string) => {
    try {
      await api.moderateQuestionPaper(paperId, status, moderatorNotes || 'Moderated through exam workflow.');
      setGeneratedPapers(prev => prev.map(p => p.id === paperId ? { ...p, status } : p));
      if (activePaper?.id === paperId) setActivePaper((prev: any) => ({ ...prev, status }));
      addAdvisorMessage(`Paper status updated to **${status.toUpperCase()}**. ${status === 'final' ? 'It is now ready for NBA audit!' : 'Awaiting final approval.'}`);
    } catch (e) { console.error(e); }
  };

  const handleValidatePaper = async () => {
    if (!activePaper?.id) return;
    const result = await api.validatePaper(activePaper.id);
    setValidationSummary(result);
    addAdvisorMessage(result.status === 'pass'
      ? '✅ CO/PO mapping is **compliant** with NBA guidelines. You can finalize this paper.'
      : `⚠️ CO/PO mapping needs review. Gaps found in: ${(result.gaps || []).map((g: any) => g.co).join(', ')}.`);
  };

  const persistPaperEdits = async (updatedQuestions: any[]) => {
    if (!activePaper) return;
    const newTotal = updatedQuestions.reduce((s: number, q: any) => s + Number(q.marks || 0), 0);
    const payload = { questions: updatedQuestions, total_marks: newTotal || activePaper.total_marks, status: activePaper.status };
    if (activePaper.id) {
      try {
        const updated = await api.updateQuestionPaper(activePaper.id, payload);
        setActivePaper(updated);
        setGeneratedPapers(prev => prev.map(p => p.id === activePaper.id ? updated : p));
        setPaperMeta(prev => ({ ...prev, maxMarks: updated.total_marks || prev.maxMarks }));
      } catch {
        setActivePaper((prev: any) => ({ ...prev, questions: updatedQuestions, total_marks: newTotal || prev.total_marks }));
      }
    } else {
      setActivePaper((prev: any) => ({ ...prev, questions: updatedQuestions, total_marks: newTotal || prev.total_marks }));
    }
  };

  const handleRemoveQuestion = async (idx: number) => {
    if (!activePaper) return;
    await persistPaperEdits(activePaper.questions.filter((_: any, i: number) => i !== idx));
  };

  const startEditing = (idx: number) => {
    const q = activePaper.questions[idx];
    setEditingQuestionIndex(idx);
    setEditingData({
      question_text: q.question_text || '',
      section: q.section || (Number(q.marks) <= 5 ? 'Part A' : 'Part B'),
      marks: q.marks || 2, co: q.co || q.co_number || 'CO1', bloom_level: q.bloom_level || 'Remember',
    });
  };

  const saveEditing = async (idx: number) => {
    if (!activePaper) return;
    const updated = activePaper.questions.map((q: any, i: number) => i === idx
      ? { ...q, question_text: editingData.question_text, section: editingData.section, marks: Number(editingData.marks), co: editingData.co, co_number: editingData.co, bloom_level: editingData.bloom_level }
      : q);
    await persistPaperEdits(updated);
    setEditingQuestionIndex(null);
  };

  const handleAddQuestionToActivePaper = async () => {
    if (!paperNewQuestion.question_text.trim() || !activePaper) return;
    const newQ = {
      id: Date.now(), section: paperNewQuestion.section,
      question_text: paperNewQuestion.question_text,
      marks: Number(paperNewQuestion.marks), co: paperNewQuestion.co,
      co_number: paperNewQuestion.co, bloom_level: paperNewQuestion.bloom_level, unit: 1,
    };
    await persistPaperEdits([...(activePaper.questions || []), newQ]);
    setPaperNewQuestion({ question_text: '', section: 'Part A', marks: 2, co: 'CO1', bloom_level: 'Remember' });
    setShowAddQuestionForm(false);
  };

  const handleAddQuestionToBank = async () => {
    if (!newQuestion.question_text.trim()) { setFeedbackMessage('Please enter question text.'); return; }
    try {
      await api.createQuestionBankItem({ ...newQuestion, subject, marks: Number(newQuestion.marks) });
      setFeedbackMessage('Question saved to bank successfully.');
      await loadData();
      setNewQuestion({ question_text: '', marks: 10, co_number: 'CO1', bloom_level: 'Understand', unit: 1, difficulty: 'Medium' });
    } catch { setFeedbackMessage('Could not save question. Please try again.'); }
  };

  const handleGenerateRubric = async () => {
    if (!activePaper) return;
    setIsRubricLoading(true);
    try {
      const rub = await api.getRubricSchema({ paper_id: activePaper.id, total_marks: activePaper.total_marks });
      setActiveRubric(rub);
      addAdvisorMessage('📊 Evaluation rubric generated! It follows **NBA standard** criteria for Part A and Part B grading.');
    } catch { } finally { setIsRubricLoading(false); }
  };

  // ─── Paper Meta Editing ───────────────────────────────────────
  const startMetaEdit = (field: string, value: string) => {
    setEditingMetaField(field);
    setEditingMetaValue(value);
  };
  const saveMetaEdit = () => {
    if (!editingMetaField) return;
    const updated = { ...paperMeta, [editingMetaField]: editingMetaValue };
    setPaperMeta(updated);
    // If duration/marks changed, sync to activePaper too
    if (activePaper && (editingMetaField === 'duration' || editingMetaField === 'maxMarks')) {
      if (activePaper.id) {
        api.updateQuestionPaper(activePaper.id, {
          questions: activePaper.questions,
          duration: Number(updated.duration),
          total_marks: Number(updated.maxMarks),
        }).then(res => setActivePaper(res)).catch(() => {});
      }
    }
    setEditingMetaField(null);
  };

  const EditableMetaCell: React.FC<{ field: string; label: string; value: string; wide?: boolean }> = ({ field, label, value, wide }) => {
    const isEdit = editingMetaField === field;
    return (
      <div className={wide ? 'col-span-2' : ''}>
        <span className="font-bold text-gray-800">{label}: </span>
        {isEdit ? (
          <span className="inline-flex items-center gap-1">
            <input
              className="border border-fuchsia-400 rounded px-1 py-0.5 text-xs bg-white text-gray-900 outline-none"
              value={editingMetaValue}
              onChange={e => setEditingMetaValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveMetaEdit(); if (e.key === 'Escape') setEditingMetaField(null); }}
              autoFocus
            />
            <button onClick={saveMetaEdit} className="text-fuchsia-700 hover:text-fuchsia-900"><Save size={11} /></button>
            <button onClick={() => setEditingMetaField(null)} className="text-gray-400 hover:text-gray-700"><X size={11} /></button>
          </span>
        ) : (
          <span
            className="cursor-pointer hover:bg-fuchsia-100 hover:text-fuchsia-800 rounded px-1 transition-colors group inline-flex items-center gap-1"
            onClick={() => startMetaEdit(field, value)}
          >
            {value}
            <Pen size={9} className="text-fuchsia-300 group-hover:text-fuchsia-600" />
          </span>
        )}
      </div>
    );
  };

  // ─── Assessment Advisor Chat ──────────────────────────────────
  const addAdvisorMessage = (content: string) => {
    setChatMessages(prev => [...prev, {
      id: Math.random().toString(), role: 'assistant', content,
      timestamp: new Date().toLocaleTimeString(),
    }]);
  };

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
    setStreamingTraces([]);
    setIsLoading(true);

    // Build context string for the AI
    const context = activePaper
      ? `[Context: Active paper is "${activePaper.subject}" ${activePaper.exam_type}, ${activePaper.total_marks} Marks, ${partAQuestions.length} Part A questions (${partATotalMarks}M), ${partBQuestions.length} Part B questions (${partBTotalMarks}M). Status: ${activePaper.status}]`
      : `[Context: No active paper. Subject: ${subject}, Exam: ${examType}, Total Marks: ${totalMarks}]`;

    api.streamChat(
      'agent5',
      `${context}\n\nUser: ${msg}`,
      chatMessages.filter(m => m.id !== 'welcome').slice(-6),
      (chunk) => { setStreamingText(prev => prev + chunk); },
      (trace) => {
        setStreamingTraces(prev => {
          const idx = prev.findIndex(t => t.name === trace.name);
          if (idx >= 0) { const u = [...prev]; u[idx] = trace; return u; }
          return [...prev, trace];
        });
      },
      async (_toolCalls, richData) => {
        setStreamingText('');
        setIsLoading(false);
        if (richData?.questions) {
          const newP = {
            id: richData.paper_id || 1,
            subject: richData.subject || subject,
            exam_type: richData.exam_type || examType,
            total_marks: richData.total_marks || totalMarks,
            duration: richData.duration || duration,
            co_coverage: richData.co_coverage || {},
            bloom_distribution: richData.bloom_distribution || {},
            status: 'draft',
            questions: richData.questions,
          };
          setActivePaper(newP);
          setPaperMeta(prev => ({
            ...prev, courseTitle: newP.subject, duration: newP.duration,
            maxMarks: newP.total_marks, examTitle: newP.exam_type,
          }));
        }
        await loadData();
      },
      (err) => { console.error(err); setIsLoading(false); }
    );
  };

  // ─── Quick Actions ────────────────────────────────────────────
  const QUICK_ACTIONS = [
    { icon: '📜', label: 'Generate Full Paper', msg: `Generate a ${totalMarks} mark ${examType} question paper for ${subject} with Part A and Part B` },
    { icon: '⚡', label: 'Part A Only', msg: `Generate Part A only short answer questions for ${subject}` },
    { icon: '🔥', label: 'Part B Only', msg: `Generate Part B only descriptive questions for ${subject}` },
    { icon: '📊', label: 'Build Rubric', msg: `Generate a grading rubric for the current paper` },
    { icon: '✅', label: 'Validate CO/PO', msg: `Validate the CO/PO mapping and suggest improvements` },
    { icon: '💡', label: 'Improve Questions', msg: `Review the current questions and suggest improvements for Bloom's taxonomy alignment` },
  ];

  // ─── Question Row ─────────────────────────────────────────────
  const QuestionRow = ({ q, idx, overallIdx, qNum }: { q: any; idx: number; overallIdx: number; qNum: number }) => {
    const isEditing = editingQuestionIndex === overallIdx;
    const bloomColor = BLOOM_COLORS[q.bloom_level] || 'bg-gray-400';

    if (isEditing) {
      return (
        <div className="p-4 bg-fuchsia-50 border-2 border-fuchsia-400 rounded-lg font-sans text-xs space-y-3 my-1">
          <div className="flex items-center gap-2 mb-1">
            <Pen size={14} className="text-fuchsia-600" />
            <span className="font-bold text-fuchsia-700 text-sm">Editing Question {qNum}</span>
            <span className="ml-auto text-[10px] text-gray-500">Press Enter or click Save</span>
          </div>
          <textarea
            value={editingData.question_text}
            onChange={e => setEditingData((p: any) => ({ ...p, question_text: e.target.value }))}
            rows={3}
            className="w-full p-2.5 border-2 border-gray-300 rounded-lg bg-white font-serif text-sm text-gray-900 outline-none focus:border-fuchsia-400 resize-none"
            placeholder="Enter question text..."
          />
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Section', field: 'section', type: 'select', opts: ['Part A', 'Part B'] },
              { label: 'Marks', field: 'marks', type: 'number' },
              { label: 'CO Number', field: 'co', type: 'text' },
              { label: 'Bloom Level', field: 'bloom_level', type: 'select', opts: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] },
            ].map(({ label, field, type, opts }) => (
              <div key={field}>
                <label className="text-[9px] font-mono uppercase text-gray-500 block mb-1">{label}</label>
                {type === 'select' ? (
                  <select value={editingData[field]} onChange={e => setEditingData((p: any) => ({ ...p, [field]: e.target.value }))}
                    className="w-full p-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs">
                    {opts!.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={type} value={editingData[field]} onChange={e => setEditingData((p: any) => ({ ...p, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full p-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={() => saveEditing(overallIdx)} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-xs flex items-center gap-1.5 px-4">
              <Save size={13} /> Save Question
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingQuestionIndex(null)} className="text-xs px-3">Cancel</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-b-0 group hover:bg-gray-50/80 rounded px-1 transition-colors cursor-pointer" onClick={() => startEditing(overallIdx)}>
        <span className="font-bold font-mono text-gray-700 min-w-[28px] text-sm pt-0.5">Q{qNum}.</span>
        <div className="flex-1">
          <p className="text-gray-900 font-serif text-sm leading-relaxed group-hover:text-fuchsia-800 transition-colors">{q.question_text}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-full">{q.marks || 2} Marks</span>
            <span className="text-[10px] font-mono bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 px-2 py-0.5 rounded-full">{q.co || q.co_number || 'CO1'}</span>
            <span className={`text-[10px] font-mono text-white px-2 py-0.5 rounded-full ${bloomColor}`}>{q.bloom_level || 'Understand'}</span>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 shrink-0 text-gray-400 pt-1 transition-opacity">
          <button onClick={e => { e.stopPropagation(); startEditing(overallIdx); }} className="hover:text-fuchsia-600 p-0.5 transition-colors" title="Edit">
            <Edit2 size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); handleRemoveQuestion(overallIdx); }} className="hover:text-red-600 p-0.5 transition-colors" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-paper text-ink overflow-hidden font-ui">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent5" icon={ClipboardSignature} size="md" className="bg-fuchsia-500" />
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Exam & Assessment Design</h1>
            <p className="text-[10px] text-ink-muted">Design editable, Bloom's-aligned papers. Click any text on the paper to edit it.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3 overflow-hidden">
        {/* ── Left: Builder Wizard ──────────────────────────────── */}
        <div className="xl:col-span-3 flex flex-col gap-3 overflow-y-auto pr-1 pb-4">
          <Card className="space-y-4">
            <div className="text-xs font-semibold text-fuchsia-400 font-mono uppercase tracking-wider flex items-center gap-2">
              <FileText size={13} /> Paper Builder Wizard
            </div>
            <div className="space-y-3 text-xs">
              {/* Subject */}
              <div>
                <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">Subject Course</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full bg-surface border border-border text-ink rounded py-2 px-3 outline-none focus:border-fuchsia-500">
                  <option value="Design & Analysis of Algorithms">Design &amp; Analysis of Algorithms</option>
                  <option value="Machine Learning">Machine Learning</option>
                  <option value="Data Structures">Data Structures</option>
                  <option value="Operating Systems">Operating Systems</option>
                  <option value="Computer Networks">Computer Networks</option>
                </select>
              </div>

              {/* Exam Type / Marks / Duration */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Exam Type', el: <select value={examType} onChange={e => setExamType(e.target.value)} className="w-full bg-surface border border-border text-ink rounded py-2 px-3 outline-none focus:border-fuchsia-500"><option value="CAT1">CAT 1</option><option value="CAT2">CAT 2</option><option value="Semester">Semester</option><option value="Model">Model Exam</option></select> },
                  { label: 'Total Marks', el: <Input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} /> },
                  { label: 'Duration (m)', el: <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /> },
                ].map(({ label, el }) => (
                  <div key={label}>
                    <label className="text-[10px] font-mono text-ink-muted uppercase block mb-1">{label}</label>
                    {el}
                  </div>
                ))}
              </div>

              {/* Bloom Allocation in Marks */}
              <div className="border border-border/70 rounded-lg p-3 space-y-2 bg-surface/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-ink-muted uppercase flex items-center gap-1"><BarChart2 size={11} /> Bloom Level Marks Allocation</span>
                  <Badge variant={bloomOverBudget ? 'danger' : bloomAllocTotal === totalMarks ? 'success' : 'neutral'} className="text-[9px]">
                    {bloomAllocTotal} / {totalMarks} M
                  </Badge>
                </div>
                {Object.entries(bloomMarks).map(([level, marks]) => (
                  <div key={level} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${BLOOM_COLORS[level] || 'bg-gray-400'} shrink-0`} />
                    <span className="text-[10px] font-mono text-ink-muted w-20 shrink-0">{level}</span>
                    <input type="range" min={0} max={totalMarks} step={1} value={marks}
                      onChange={e => handleBloomMarkChange(level, Number(e.target.value))}
                      className="flex-1 accent-fuchsia-500" />
                    <span className="w-14 text-right">
                      <input type="number" value={marks} min={0} max={totalMarks}
                        onChange={e => handleBloomMarkChange(level, Number(e.target.value))}
                        className="w-14 text-right bg-surface border border-border/60 rounded px-1 py-0.5 text-xs text-ink outline-none focus:border-fuchsia-500" />
                      <span className="text-[9px] text-ink-muted ml-0.5">M</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* CO Allocation in Marks */}
              <div className="border border-border/70 rounded-lg p-3 space-y-2 bg-surface/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-ink-muted uppercase flex items-center gap-1"><BookOpen size={11} /> CO Marks Allocation (NBA)</span>
                  <Badge variant={coOverBudget ? 'danger' : coAllocTotal === totalMarks ? 'success' : 'neutral'} className="text-[9px]">
                    {coAllocTotal} / {totalMarks} M
                  </Badge>
                </div>
                {Object.entries(coMarks).map(([co, marks]) => (
                  <div key={co} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-fuchsia-400 font-bold w-8 shrink-0">{co}</span>
                    <input type="range" min={0} max={totalMarks} step={1} value={marks}
                      onChange={e => handleCoMarkChange(co, Number(e.target.value))}
                      className="flex-1 accent-fuchsia-500" />
                    <span className="flex items-center gap-0.5">
                      <input type="number" value={marks} min={0} max={totalMarks}
                        onChange={e => handleCoMarkChange(co, Number(e.target.value))}
                        className="w-14 text-right bg-surface border border-border/60 rounded px-1 py-0.5 text-xs text-ink outline-none focus:border-fuchsia-500" />
                      <span className="text-[9px] text-ink-muted">M</span>
                    </span>
                  </div>
                ))}
                {/* Add CO button */}
                <button onClick={() => {
                  const nextCo = `CO${Object.keys(coMarks).length + 1}`;
                  setCoMarks(prev => ({ ...prev, [nextCo]: 0 }));
                }} className="text-[10px] font-mono text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 mt-1">
                  <Plus size={11} /> Add CO
                </button>
              </div>

              {(bloomOverBudget || coOverBudget) && (
                <div className="text-[10px] text-status-warn border border-status-warn/30 bg-status-warn/10 rounded px-2 py-1.5">
                  ⚠️ {bloomOverBudget ? 'Bloom marks exceed total. ' : ''}{coOverBudget ? 'CO marks exceed total.' : ''}
                </div>
              )}

              <Button onClick={handleGeneratePaper}
                className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-black font-mono font-bold py-2.5 text-sm"
                disabled={isLoading}>
                {isLoading ? <><RefreshCw size={14} className="animate-spin inline mr-2" />Generating…</> : '🎓 Generate Question Paper'}
              </Button>
            </div>
          </Card>

          {/* Question Bank */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-fuchsia-400 font-mono uppercase tracking-wider flex items-center gap-1.5"><BookOpen size={12} />Question Bank</div>
              <Badge variant="neutral">{questionsBank.length} items</Badge>
            </div>
            <div className="max-h-44 overflow-y-auto pr-1 space-y-2">
              {questionsBank.length === 0 ? (
                <div className="rounded border border-dashed border-border/60 bg-surface/40 p-3 text-[11px] text-ink-muted text-center">
                  No questions saved yet.
                </div>
              ) : (
                [...questionsBank].reverse().map(item => (
                  <div key={item.id} className="rounded border border-border/60 bg-surface/70 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[11px] text-ink leading-snug">{item.question_text}</div>
                      <Badge variant="accent" className="text-[9px] shrink-0">{item.marks}M</Badge>
                    </div>
                    <div className="mt-1 flex gap-2 text-[9px] font-mono text-ink-muted">
                      <span>{item.co_number}</span><span>•</span>
                      <span>{item.bloom_level}</span><span>•</span>
                      <span>Unit {item.unit ?? 1}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Add to bank form */}
            <div className="space-y-2 border-t border-border/60 pt-3">
              <Input placeholder="New question text…" value={newQuestion.question_text}
                onChange={e => setNewQuestion(p => ({ ...p, question_text: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] font-mono text-ink-muted uppercase block mb-1">Marks</label>
                  <Input type="number" value={newQuestion.marks} onChange={e => setNewQuestion(p => ({ ...p, marks: Number(e.target.value) }))} /></div>
                <div><label className="text-[9px] font-mono text-ink-muted uppercase block mb-1">CO Number</label>
                  <Input value={newQuestion.co_number} onChange={e => setNewQuestion(p => ({ ...p, co_number: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={newQuestion.bloom_level} onChange={e => setNewQuestion(p => ({ ...p, bloom_level: e.target.value }))} className="w-full bg-surface border border-border text-ink rounded py-2 px-2 outline-none text-xs">
                  {['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].map(o => <option key={o}>{o}</option>)}
                </select>
                <select value={newQuestion.difficulty} onChange={e => setNewQuestion(p => ({ ...p, difficulty: e.target.value }))} className="w-full bg-surface border border-border text-ink rounded py-2 px-2 outline-none text-xs">
                  {['Easy', 'Medium', 'Hard'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {feedbackMessage && (
                <div className={`rounded border px-2 py-1.5 text-[10px] ${feedbackMessage.includes('success') ? 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300' : 'border-status-warn/30 bg-status-warn/10 text-status-warn'}`}>
                  {feedbackMessage}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={handleAddQuestionToBank} className="w-full text-xs">+ Add to Question Bank</Button>
            </div>
          </Card>
        </div>

        {/* ── Center: White Exam Paper Workspace ────────────────── */}
        <div className="xl:col-span-6 flex flex-col gap-3 overflow-y-auto pr-1 pb-4">
          {/* CO/Bloom Analytics */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="text-[10px] font-mono text-ink-muted uppercase mb-2">CO Coverage</div>
              <div className="space-y-2">
                {Object.entries(coCoverage).map(([co, pct]: any) => (
                  <div key={co}>
                    <div className="flex justify-between text-[10px] font-mono mb-0.5">
                      <span className="text-fuchsia-400 font-semibold">{co}</span>
                      <span className="text-ink-muted">{pct}%</span>
                    </div>
                    <div className="w-full bg-surface/70 h-1.5 rounded-full overflow-hidden border border-border/40">
                      <div className="h-full bg-fuchsia-500" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] font-mono text-ink-muted uppercase mb-2">Bloom Distribution</div>
              <div className="w-full h-4 rounded overflow-hidden flex mb-2">
                {Object.entries(paperBloom).map(([level, value]: any, i) => (
                  <div key={level} className={`${BLOOM_COLORS[level] || 'bg-gray-400'}`}
                    style={{ width: `${Math.max(4, value)}%` }} title={`${level}: ${value}%`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {Object.entries(paperBloom).map(([level, value]: any) => (
                  <div key={level} className="flex items-center gap-1 text-[9px] font-mono text-ink-muted">
                    <span className={`w-1.5 h-1.5 rounded-full ${BLOOM_COLORS[level] || 'bg-gray-400'} inline-block`} />
                    {level.substring(0, 4)}: {value}%
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {activePaper ? (
            <div className="space-y-3">
              {/* Toolbar */}
              <Card className="flex items-center justify-between p-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={activePaper.status === 'final' ? 'success' : activePaper.status === 'moderated' ? 'warning' : 'neutral'}>
                    {activePaper.status?.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono text-ink-muted">{activePaper.subject} • {activePaper.exam_type}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => setShowAddQuestionForm(!showAddQuestionForm)}
                    className="bg-surface hover:bg-surface-raised border border-border text-ink text-[11px] font-mono flex items-center gap-1 py-1">
                    <Plus size={13} /> Add Question
                  </Button>
                  <Button size="sm" onClick={() => setShowPrintModal(true)}
                    className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black text-[11px] font-mono flex items-center gap-1 font-bold py-1">
                    <Printer size={13} /> Print Paper
                  </Button>
                  {activePaper.status === 'draft' && (
                    <Button size="sm" onClick={() => handleModeratePaper(activePaper.id, 'moderated')}
                      className="text-[10px] py-1 px-2 bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30">Moderate</Button>
                  )}
                  {activePaper.status === 'moderated' && (
                    <Button size="sm" onClick={() => handleModeratePaper(activePaper.id, 'final')}
                      className="text-[10px] py-1 px-2 bg-green-500/10 text-green-400 border border-green-500/30">Finalize</Button>
                  )}
                </div>
              </Card>

              {/* Inline Add Question Form */}
              {showAddQuestionForm && (
                <Card className="p-4 space-y-3 border-fuchsia-500/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-fuchsia-400 uppercase flex items-center gap-1"><Plus size={12} />Add Question to Paper</span>
                    <button onClick={() => setShowAddQuestionForm(false)}><X size={14} className="text-ink-muted" /></button>
                  </div>
                  <textarea placeholder="Enter question text…" value={paperNewQuestion.question_text}
                    onChange={e => setPaperNewQuestion(p => ({ ...p, question_text: e.target.value }))}
                    rows={2} className="w-full bg-surface border border-border text-ink rounded p-2 text-xs outline-none focus:border-fuchsia-500 resize-none" />
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[
                      { label: 'Section', field: 'section', type: 'select', opts: ['Part A', 'Part B'] },
                      { label: 'Marks', field: 'marks', type: 'number' },
                      { label: 'CO', field: 'co', type: 'text' },
                      { label: 'Bloom', field: 'bloom_level', type: 'select', opts: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'] },
                    ].map(({ label, field, type, opts }) => (
                      <div key={field}>
                        <label className="text-[9px] font-mono text-ink-muted uppercase block mb-1">{label}</label>
                        {type === 'select' ? (
                          <select value={(paperNewQuestion as any)[field]} onChange={e => setPaperNewQuestion(p => ({ ...p, [field]: e.target.value }))}
                            className="w-full bg-surface border border-border text-ink rounded py-1 px-2 text-xs outline-none">
                            {opts!.map(o => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={type} value={(paperNewQuestion as any)[field]} onChange={e => setPaperNewQuestion(p => ({ ...p, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                            className="w-full bg-surface border border-border text-ink rounded py-1 px-2 text-xs outline-none" />
                        )}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" onClick={handleAddQuestionToActivePaper} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black text-xs font-mono font-bold w-full">Insert Question</Button>
                </Card>
              )}

              {/* ─── OFFICIAL WHITE EXAM PAPER ─────────────────── */}
              <div className="bg-white text-gray-900 rounded-lg border border-gray-300 shadow-2xl p-8 font-serif">
                <p className="text-[9px] font-sans text-gray-400 text-right mb-1 flex items-center justify-end gap-1"><Pen size={9} />Click any field to edit</p>

                {/* College Header */}
                <div className="text-center border-b-2 border-gray-900 pb-4 mb-5">
                  <img src="/images/college_logo.png" alt="Sri Eshwar College of Engineering" className="h-16 object-contain mx-auto mb-2" />
                  <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">Sri Eshwar College of Engineering</h2>
                  <p className="text-xs text-gray-700 font-sans">An Autonomous Institution • Affiliated to Anna University, Chennai</p>
                  {/* Editable Department */}
                  <p
                    className="text-xs font-sans font-semibold text-gray-800 tracking-wider uppercase mt-1 cursor-pointer hover:text-fuchsia-700 hover:underline transition-colors"
                    onClick={() => startMetaEdit('department', paperMeta.department)}
                  >
                    {editingMetaField === 'department' ? (
                      <span className="inline-flex items-center gap-1">
                        <input className="border border-fuchsia-400 rounded px-1 py-0.5 text-xs bg-white text-gray-900 outline-none w-80"
                          value={editingMetaValue} onChange={e => setEditingMetaValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveMetaEdit(); }} autoFocus />
                        <button onClick={saveMetaEdit}><Save size={11} className="text-fuchsia-600" /></button>
                      </span>
                    ) : paperMeta.department}
                  </p>
                  {/* Editable Exam Title */}
                  <div className="mt-3 py-1 bg-gray-100 border-y border-gray-400 font-sans font-bold text-xs text-gray-900 uppercase tracking-widest cursor-pointer hover:bg-fuchsia-50 transition-colors"
                    onClick={() => startMetaEdit('examTitle', paperMeta.examTitle)}>
                    {editingMetaField === 'examTitle' ? (
                      <span className="inline-flex items-center gap-1">
                        <input className="border border-fuchsia-400 rounded px-1 py-0.5 text-xs bg-white text-gray-900 outline-none w-64"
                          value={editingMetaValue} onChange={e => setEditingMetaValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveMetaEdit(); }} autoFocus />
                        <button onClick={saveMetaEdit}><Save size={11} className="text-fuchsia-600" /></button>
                      </span>
                    ) : paperMeta.examTitle}
                  </div>
                </div>

                {/* Register Number */}
                <div className="flex justify-end mb-4 font-sans text-xs">
                  <div className="flex items-center gap-2 border border-gray-400 p-1.5 rounded bg-gray-50">
                    <span className="font-semibold text-gray-700">Reg. No.</span>
                    <div className="flex gap-0.5">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="w-5 h-6 border border-gray-400 bg-white" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Editable Metadata Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-gray-300 rounded p-3 mb-5 font-sans text-xs bg-gray-50/50">
                  <EditableMetaCell field="degree" label="Degree / Branch" value={paperMeta.degree} />
                  <EditableMetaCell field="semester" label="Semester / Year" value={paperMeta.semester} />
                  <div>
                    <span className="font-bold text-gray-800">Course Code: </span>
                    <span className="cursor-pointer hover:bg-fuchsia-100 hover:text-fuchsia-800 rounded px-1 transition-colors inline-flex items-center gap-1 group"
                      onClick={() => startMetaEdit('courseCode', paperMeta.courseCode)}>
                      {editingMetaField === 'courseCode' ? (
                        <><input className="border border-fuchsia-400 rounded px-1 py-0.5 text-xs bg-white w-20 outline-none" value={editingMetaValue} onChange={e => setEditingMetaValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveMetaEdit(); }} autoFocus />
                          <button onClick={saveMetaEdit}><Save size={10} className="text-fuchsia-600" /></button></>
                      ) : <>{paperMeta.courseCode} <Pen size={9} className="text-fuchsia-300 group-hover:text-fuchsia-600" /></>}
                    </span>
                    {' | '}
                    <span className="cursor-pointer hover:bg-fuchsia-100 hover:text-fuchsia-800 rounded px-1 transition-colors inline-flex items-center gap-1 group"
                      onClick={() => startMetaEdit('courseTitle', paperMeta.courseTitle)}>
                      {editingMetaField === 'courseTitle' ? (
                        <><input className="border border-fuchsia-400 rounded px-1 py-0.5 text-xs bg-white w-48 outline-none" value={editingMetaValue} onChange={e => setEditingMetaValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveMetaEdit(); }} autoFocus />
                          <button onClick={saveMetaEdit}><Save size={10} className="text-fuchsia-600" /></button></>
                      ) : <>{paperMeta.courseTitle} <Pen size={9} className="text-fuchsia-300 group-hover:text-fuchsia-600" /></>}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-800">Date &amp; Session: </span>
                    <span className="cursor-pointer hover:bg-fuchsia-100 rounded px-1 transition-colors inline-flex items-center gap-1 group"
                      onClick={() => startMetaEdit('date', paperMeta.date)}>
                      {editingMetaField === 'date' ? (
                        <><input className="border border-fuchsia-400 rounded px-1 py-0.5 text-xs bg-white w-24 outline-none" value={editingMetaValue} onChange={e => setEditingMetaValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveMetaEdit(); }} autoFocus />
                          <button onClick={saveMetaEdit}><Save size={10} className="text-fuchsia-600" /></button></>
                      ) : <>{paperMeta.date} / {paperMeta.session} <Pen size={9} className="text-fuchsia-300 group-hover:text-fuchsia-600" /></>}
                    </span>
                  </div>
                  <EditableMetaCell field="duration" label="Duration (Minutes)" value={String(paperMeta.duration)} />
                  <EditableMetaCell field="maxMarks" label="Maximum Marks" value={String(paperMeta.maxMarks)} />
                </div>

                {/* Editable Instructions */}
                <div className="border-l-4 border-gray-700 pl-3 mb-6 font-sans text-[11px] text-gray-700 py-1.5 bg-gray-50 cursor-pointer hover:bg-fuchsia-50 transition-colors group"
                  onClick={() => startMetaEdit('instructions', paperMeta.instructions)}>
                  <span className="font-bold not-italic text-gray-900">General Instructions: </span>
                  {editingMetaField === 'instructions' ? (
                    <span className="inline-flex items-center gap-1">
                      <textarea className="border border-fuchsia-400 rounded p-1 text-xs bg-white text-gray-900 outline-none w-full" value={editingMetaValue} onChange={e => setEditingMetaValue(e.target.value)} rows={2} autoFocus />
                      <button onClick={saveMetaEdit}><Save size={11} className="text-fuchsia-600" /></button>
                    </span>
                  ) : (
                    <>{paperMeta.instructions} <Pen size={9} className="text-fuchsia-300 group-hover:text-fuchsia-600" /></>
                  )}
                </div>

                {/* PART A */}
                {partAQuestions.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 mb-4">
                      <h3 className="font-bold text-sm text-gray-900 uppercase font-sans tracking-wide">
                        Part A — ({partAQuestions.length} Questions × {partATotalMarks > 0 ? Math.round(partATotalMarks / partAQuestions.length) : 2} = {partATotalMarks} Marks)
                      </h3>
                      <span className="text-xs font-sans font-semibold text-gray-500">Answer ALL Questions</span>
                    </div>
                    <div className="space-y-1">
                      {partAQuestions.map((q: any, idx: number) => {
                        const overallIdx = questionsList.findIndex((item: any) => item === q);
                        return <QuestionRow key={q.id || idx} q={q} idx={idx} overallIdx={overallIdx} qNum={idx + 1} />;
                      })}
                    </div>
                  </div>
                )}

                {/* PART B */}
                {partBQuestions.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 mb-4">
                      <h3 className="font-bold text-sm text-gray-900 uppercase font-sans tracking-wide">
                        Part B — ({partBQuestions.length} Questions × {partBTotalMarks > 0 ? Math.round(partBTotalMarks / partBQuestions.length) : 10} = {partBTotalMarks} Marks)
                      </h3>
                      <span className="text-xs font-sans font-semibold text-gray-500">Answer ALL Questions</span>
                    </div>
                    <div className="space-y-1">
                      {partBQuestions.map((q: any, idx: number) => {
                        const overallIdx = questionsList.findIndex((item: any) => item === q);
                        return <QuestionRow key={q.id || idx} q={q} idx={idx} overallIdx={overallIdx} qNum={partAQuestions.length + idx + 1} />;
                      })}
                    </div>
                  </div>
                )}

                {partAQuestions.length === 0 && partBQuestions.length === 0 && (
                  <div className="text-center py-12 text-gray-400 font-sans text-sm">
                    <ClipboardSignature className="mx-auto mb-3 opacity-20" size={40} />
                    No questions yet. Generate or add questions above.
                  </div>
                )}
              </div>

              {/* Rubric / Validate */}
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleGenerateRubric} disabled={isRubricLoading} className="text-[10px] py-1 px-3 flex items-center gap-1">
                    {isRubricLoading ? <RefreshCw size={11} className="animate-spin" /> : <BarChart2 size={11} />} Generate Rubric
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleValidatePaper} className="text-[10px] py-1 px-3 flex items-center gap-1">
                    <ChevronRight size={11} /> Validate CO/PO
                  </Button>
                  {activeRubric && <Button size="sm" variant="outline" onClick={() => setActiveRubric(null)} className="text-[10px] py-1 px-3">Hide Rubric</Button>}
                </div>
                {validationSummary && (
                  <div className={`rounded border px-3 py-2 text-[10px] ${validationSummary.status === 'pass' ? 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300' : 'border-status-warn/30 bg-status-warn/10 text-status-warn'}`}>
                    <div className="font-semibold">{validationSummary.status === 'pass' ? '✅ CO/PO mapping is compliant.' : '⚠️ CO/PO mapping needs review.'}</div>
                    <div className="mt-1 font-mono">Attained: {JSON.stringify(validationSummary.attained || {})}</div>
                  </div>
                )}
                <Input placeholder="Moderator audit notes…" value={moderatorNotes} onChange={e => setModeratorNotes(e.target.value)} className="text-xs" />
                {activeRubric && (
                  <div className="rounded border border-fuchsia-500/20 bg-surface/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-mono text-fuchsia-400 uppercase">Evaluation Rubric</div>
                      <Badge variant="accent">NBA Standard</Badge>
                    </div>
                    {activeRubric.map((c, i) => (
                      <div key={i} className="border-b border-border/40 pb-2 last:border-b-0">
                        <div className="text-[11px] font-semibold text-ink">{c.criterion} ({c.max_marks} marks)</div>
                        <div className="text-[10px] text-ink-muted">{c.descriptor}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="flex-1 min-h-48 flex flex-col items-center justify-center text-center p-8">
              <ClipboardSignature className="text-fuchsia-500/20 mb-4" size={48} />
              <div className="text-sm text-ink font-semibold">No paper selected</div>
              <p className="text-[11px] text-ink-muted mt-1 max-w-xs">Use the Paper Builder or ask the Assessment Advisor to generate an official question paper.</p>
            </Card>
          )}
        </div>

        {/* ── Right: Assessment Advisor Chat (In-Grid Column) ──── */}
        <div className="xl:col-span-3 flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col border border-fuchsia-500/40 bg-surface/96 backdrop-blur-md p-0 overflow-hidden">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-fuchsia-900/60 to-purple-900/60 px-4 py-3 flex items-center justify-between border-b border-fuchsia-500/30">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-fuchsia-500 flex items-center justify-center">
                <Sparkles size={14} className="text-black" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Assessment Advisor</div>
                <div className="text-[9px] text-fuchsia-300 font-mono">AI-Powered • NBA Compliant</div>
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
                className="text-[9px] font-mono bg-fuchsia-500/10 hover:bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/30 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50">
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="px-3 py-2 flex-1 overflow-y-auto space-y-2">
            {chatMessages.map((m, i) => (
              <div key={`${m.id}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                    <Sparkles size={10} className="text-black" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-line
                  ${m.role === 'user'
                    ? 'bg-fuchsia-600 text-white rounded-br-sm'
                    : 'bg-surface border border-border text-ink rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Streaming response */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                  <Sparkles size={10} className="text-black animate-pulse" />
                </div>
                <div className="max-w-[85%] bg-surface border border-border text-ink rounded-xl rounded-bl-sm px-3 py-2 text-[11px] leading-relaxed whitespace-pre-line">
                  {streamingText}
                  <span className="inline-block w-1 h-3 bg-fuchsia-400 ml-0.5 animate-pulse rounded" />
                </div>
              </div>
            )}

            {/* Tool traces */}
            {isLoading && streamingTraces.length === 0 && !streamingText && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center shrink-0 mr-1.5">
                  <Sparkles size={10} className="text-black animate-pulse" />
                </div>
                <div className="bg-surface border border-border rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {streamingTraces.map((t, i) => (
              <div key={i} className="text-[8px] font-mono text-fuchsia-400 pl-7">⚙ {t.name}… ({t.status})</div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          <div className="px-3 pb-3 pt-2 border-t border-border/40 flex gap-2">
            <input
              className="flex-1 bg-surface border border-border/60 text-ink text-xs rounded-xl px-3 py-2 outline-none focus:border-fuchsia-500 placeholder-ink-muted transition-colors"
              placeholder="Ask about questions, rubrics, CO/PO alignment…"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendChat()}
              disabled={isLoading || !chatInput.trim()}
              className="w-9 h-9 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 text-black flex items-center justify-center transition-colors disabled:opacity-50 shrink-0">
              <Send size={14} />
            </button>
          </div>
        </Card>
        </div>
      </div>

      {/* ── Print Modal ──────────────────────────────────────── */}
      {showPrintModal && activePaper && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-gray-900 max-w-4xl w-full p-10 font-serif shadow-2xl rounded-lg my-8 relative">
            <div className="flex items-center justify-between mb-6 print:hidden border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2 font-sans">
                <Printer size={18} className="text-gray-700" />
                <span className="font-bold text-sm text-gray-800">Student Examination Paper — Print Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => window.print()} className="bg-gray-900 hover:bg-black text-white text-xs font-sans flex items-center gap-1.5 px-4">
                  <Printer size={13} /> Print
                </Button>
                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
              </div>
            </div>

            {/* Header */}
            <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
              <img src="/images/college_logo.png" alt="Sri Eshwar College of Engineering" className="h-16 object-contain mx-auto mb-2" />
              <h2 className="text-xl font-bold uppercase tracking-wide">{paperMeta.department.includes('College') ? 'Sri Eshwar College of Engineering' : 'Sri Eshwar College of Engineering'}</h2>
              <p className="text-xs text-gray-700 font-sans">An Autonomous Institution • Affiliated to Anna University, Chennai</p>
              <p className="text-xs font-sans font-semibold tracking-wider uppercase mt-1">{paperMeta.department}</p>
              <div className="mt-3 py-1 bg-gray-100 border-y border-gray-400 font-sans font-bold text-xs uppercase tracking-widest">{paperMeta.examTitle}</div>
            </div>
            <div className="flex justify-end mb-4 font-sans text-xs">
              <div className="flex items-center gap-2 border border-gray-400 p-1.5 rounded bg-gray-50">
                <span className="font-semibold text-gray-700">Reg. No.</span>
                <div className="flex gap-0.5">{[...Array(12)].map((_, i) => <div key={i} className="w-5 h-6 border border-gray-400 bg-white" />)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-gray-300 rounded p-3 mb-5 font-sans text-xs bg-gray-50">
              <div><span className="font-bold">Degree / Branch:</span> {paperMeta.degree}</div>
              <div><span className="font-bold">Semester / Year:</span> {paperMeta.semester}</div>
              <div><span className="font-bold">Course Code &amp; Title:</span> {paperMeta.courseCode} | {paperMeta.courseTitle}</div>
              <div><span className="font-bold">Date &amp; Session:</span> {paperMeta.date} / {paperMeta.session}</div>
              <div><span className="font-bold">Duration:</span> {paperMeta.duration} Minutes</div>
              <div><span className="font-bold">Maximum Marks:</span> {paperMeta.maxMarks} Marks</div>
            </div>
            <div className="border-l-4 border-gray-700 pl-3 mb-6 font-sans text-[11px] text-gray-700 py-1.5 bg-gray-50 italic">
              <span className="font-bold not-italic">General Instructions:</span> {paperMeta.instructions}
            </div>
            {partAQuestions.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between border-b-2 border-gray-900 pb-1 mb-4">
                  <h3 className="font-bold text-sm uppercase font-sans tracking-wide">
                    Part A — ({partAQuestions.length} × {partATotalMarks > 0 ? Math.round(partATotalMarks / partAQuestions.length) : 2} = {partATotalMarks} Marks)
                  </h3>
                  <span className="text-xs font-sans font-semibold text-gray-500">Answer ALL Questions</span>
                </div>
                {partAQuestions.map((q: any, idx: number) => (
                  <div key={q.id || idx} className="flex justify-between gap-4 text-xs py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex gap-2 flex-1"><span className="font-bold font-mono min-w-[24px]">Q{idx + 1}.</span><span className="font-serif text-sm">{q.question_text}</span></div>
                    <div className="flex gap-1.5 shrink-0 font-sans items-start">
                      <span className="bg-gray-100 border border-gray-300 text-gray-800 font-mono text-[10px] px-1.5 py-0.5 rounded">{q.marks || 2} M</span>
                      <span className="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 font-mono text-[10px] px-1.5 py-0.5 rounded">{q.co || q.co_number || 'CO1'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {partBQuestions.length > 0 && (
              <div>
                <div className="flex justify-between border-b-2 border-gray-900 pb-1 mb-4">
                  <h3 className="font-bold text-sm uppercase font-sans tracking-wide">
                    Part B — ({partBQuestions.length} × {partBTotalMarks > 0 ? Math.round(partBTotalMarks / partBQuestions.length) : 10} = {partBTotalMarks} Marks)
                  </h3>
                  <span className="text-xs font-sans font-semibold text-gray-500">Answer ALL Questions</span>
                </div>
                {partBQuestions.map((q: any, idx: number) => (
                  <div key={q.id || idx} className="flex justify-between gap-4 text-xs py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex gap-2 flex-1"><span className="font-bold font-mono min-w-[24px]">Q{partAQuestions.length + idx + 1}.</span><span className="font-serif text-sm leading-relaxed">{q.question_text}</span></div>
                    <div className="flex gap-1.5 shrink-0 font-sans items-start">
                      <span className="bg-gray-100 border border-gray-300 text-gray-800 font-mono text-[10px] px-1.5 py-0.5 rounded">{q.marks || 10} M</span>
                      <span className="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 font-mono text-[10px] px-1.5 py-0.5 rounded">{q.co || q.co_number || 'CO2'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
