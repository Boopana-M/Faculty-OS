import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Calendar, Mail, BookOpen, FileText, Search, Copy, Check, ChevronDown, ChevronUp, Clock, MapPin, ArrowRight, Edit, Trash2, Plus, Upload, X, AlertTriangle, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Card, Button, Input, Badge, Seal } from './Common';
import { api, type ChatMessage } from '../services/api';

interface SharedChatInterfaceProps {
  agentId: string;
  agentTitle: string;
  agentSubtitle?: string;
}

export const SharedChatInterface: React.FC<SharedChatInterfaceProps> = ({ agentId, agentTitle, agentSubtitle = "Ready to assist" }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // States for interactive draft editing
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  
  // State for expanded lesson plans / cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  // State for copied status
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingTraces]);

  const handleSendMessage = (text: string, hidden: boolean = false) => {
    if (!text.trim() || isLoading) return;

    const userMsgId = Math.random().toString(36).substring(7);
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (!hidden) {
      setMessages(prev => [...prev, userMessage]);
    }
    
    setInputText('');
    setIsLoading(true);
    setStreamingText('');
    streamingTextRef.current = '';
    setStreamingTraces([]);

    const assistantMsgId = Math.random().toString(36).substring(7);

    api.streamChat(
      agentId,
      text,
      [...messages, userMessage],
      (chunk) => {
        streamingTextRef.current += chunk;
        setStreamingText(streamingTextRef.current);
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
        setMessages(prev => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: streamingTextRef.current,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tool_calls: toolCalls,
            richData: richData
          }
        ]);
        setStreamingText('');
        streamingTextRef.current = '';
        setStreamingTraces([]);
        setIsLoading(false);
      },
      (error) => {
        setMessages(prev => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request.',
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const renderEmailDraftCard = (data: any, messageId: string) => {
    const isEditing = editingDraftId === messageId;
    
    return (
      <Card className="mt-3 border border-border bg-surface shadow-sm overflow-hidden w-full max-w-md">
        <div className="bg-paper border-b border-border px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-accent-500" />
            <span className="text-xs font-bold text-ink">Email Draft</span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-[10px]"
              onClick={() => {
                if (isEditing) {
                  setEditingDraftId(null);
                } else {
                  setEditSubject(data.subject);
                  setEditBody(data.body);
                  setEditingDraftId(messageId);
                }
              }}
            >
              {isEditing ? <Check size={12} className="mr-1" /> : <Edit size={12} className="mr-1" />}
              {isEditing ? 'Save' : 'Edit'}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-[10px]"
              onClick={() => copyToClipboard(`Subject: ${data.subject}\n\n${data.body}`, messageId)}
            >
              {copiedId === messageId ? <Check size={12} className="mr-1 text-emerald-500" /> : <Copy size={12} className="mr-1" />}
              {copiedId === messageId ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="p-3 text-xs flex flex-col gap-2">
          <div className="grid grid-cols-[50px_1fr] items-center">
            <span className="text-ink-muted font-medium">To:</span>
            <span className="text-ink">{data.to_name}</span>
          </div>
          <div className="grid grid-cols-[50px_1fr] items-center">
            <span className="text-ink-muted font-medium">Subject:</span>
            {isEditing ? (
              <Input 
                value={editSubject} 
                onChange={e => setEditSubject(e.target.value)} 
                className="h-6 text-xs" 
              />
            ) : (
              <span className="text-ink font-semibold">{data.subject}</span>
            )}
          </div>
          <div className="mt-2">
            {isEditing ? (
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                className="w-full h-32 p-2 text-xs bg-paper border border-border rounded resize-none focus:outline-none focus:border-accent-500 text-ink"
              />
            ) : (
              <div className="whitespace-pre-wrap text-ink-muted bg-paper p-2 rounded border border-border">{data.body}</div>
            )}
          </div>
          <Button 
            className="w-full mt-2 h-8 text-xs bg-accent-500 text-black hover:bg-accent-600"
            onClick={() => {
              const sub = encodeURIComponent(isEditing ? editSubject : data.subject);
              const b = encodeURIComponent(isEditing ? editBody : data.body);
              window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${sub}&body=${b}`, '_blank');
            }}
          >
            Open in Gmail
          </Button>
        </div>
      </Card>
    );
  };

  const renderInteractiveChoices = (data: any) => {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {data.choices.map((choice: any, idx: number) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(choice.value, true)}
            className="text-xs bg-surface border border-border hover:border-accent-500 hover:text-accent-500 transition py-1.5 px-3 rounded flex items-center gap-1.5 shadow-sm text-ink font-medium"
          >
            {choice.icon && <span>{choice.icon}</span>}
            {choice.label}
          </button>
        ))}
      </div>
    );
  };

  const renderLessonPlanCard = (data: any, messageId: string) => {
    const isExpanded = expandedCards[messageId] ?? true;
    return (
      <Card className="mt-3 border-l-4 border-l-amber-500 bg-surface/50 p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-[10px] font-bold text-amber-500 tracking-wider uppercase mb-1">Lesson Plan Generated</div>
            <h4 className="text-sm font-bold text-ink">{data.subject}</h4>
            <div className="text-xs text-ink-muted">Unit {data.unit}: {data.topic}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => toggleCard(messageId)} className="h-6 w-6">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-bold text-ink mb-1 flex items-center gap-1"><BookOpen size={12} className="text-amber-500"/> Objectives</div>
              <p className="text-xs text-ink-muted">{data.objectives}</p>
            </div>
            <div>
              <div className="text-xs font-bold text-ink mb-2 flex items-center gap-1"><Clock size={12} className="text-amber-500"/> Activities (50 mins)</div>
              <div className="space-y-2">
                {data.activities.map((act: any, i: number) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <Badge variant="neutral" className="shrink-0 bg-paper text-ink">{act.duration}</Badge>
                    <div>
                      <div className="font-semibold text-ink">{act.name}</div>
                      <div className="text-ink-muted">{act.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-paper p-2 rounded text-xs border border-border">
              <span className="font-bold text-ink mr-1">Assessment:</span>
              <span className="text-ink-muted">{data.assessment}</span>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderPolicyCitationsCard = (data: any) => {
    return (
      <Card className="mt-3 border border-border bg-surface overflow-hidden">
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-3 py-2 flex items-center gap-2">
          <BookOpen size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-blue-500">Cited Policies</span>
        </div>
        <div className="p-3 space-y-3">
          {data.citations.map((cite: any, i: number) => (
            <div key={i} className="text-xs">
              <div className="font-bold text-ink mb-1">{cite.title}</div>
              <div className="text-[10px] text-ink-muted font-mono mb-1">{cite.source}</div>
              <div className="bg-paper border-l-2 border-border p-2 text-ink-muted italic">"{cite.snippet}"</div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-border rounded-xl bg-surface/96 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent-900/50 to-primary-900/50 px-6 py-4 flex items-center justify-between border-b border-accent-500/30">
        <div className="flex items-center gap-4">
          <Seal icon={Bot} agentId={agentId as any} />
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              {agentTitle}
              <Badge variant="success" className="animate-pulse">Online</Badge>
            </h2>
            <p className="text-sm text-ink-muted">{agentSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-70">
            <Seal icon={Bot} agentId={agentId as any} size="lg" />
            <h3 className="mt-4 text-xl font-bold text-ink">How can I help you?</h3>
            <p className="text-sm text-ink-muted mt-2">
              I can manage your schedules, answer policy queries, draft emails, and plan lessons.
            </p>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-primary-500' : 'bg-surface border border-border'}`}>
              {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-accent-500" />}
            </div>
            
            <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`text-sm p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary-500 text-white rounded-tr-sm' 
                  : 'bg-paper text-ink rounded-tl-sm border border-border'
              }`}>
                <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>
                  {msg.content}
                </ReactMarkdown></div>
                
                {msg.richData && (
                  <>
                    {msg.richData.type === 'email_draft' && renderEmailDraftCard(msg.richData, msg.id)}
                    {msg.richData.type === 'interactive_choices' && renderInteractiveChoices(msg.richData)}
                    {msg.richData.type === 'lesson_plan' && renderLessonPlanCard(msg.richData, msg.id)}
                    {msg.richData.type === 'policy' && renderPolicyCitationsCard(msg.richData)}
                  </>
                )}
                
                <span className={`text-[10px] font-mono mt-2 block ${msg.role === 'user' ? 'text-primary-100 text-right' : 'text-ink-muted px-1'}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {/* Streaming Placeholder */}
        {(isLoading || streamingText) && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 shadow-sm">
              <Bot size={16} className="text-accent-500 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1 w-full">
              {streamingTraces.map((trace, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-accent-500 font-mono bg-accent-500/10 px-2 py-1 rounded w-fit mb-1 border border-accent-500/20">
                  <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></span>
                  {trace.status === 'running' ? 'Calling tool...' : 'Completed tool'} {trace.name}
                </div>
              ))}
              {(streamingText || isLoading) && (
                <div className="text-sm p-4 rounded-2xl rounded-tl-sm bg-paper text-ink border border-border shadow-sm">
                  {streamingText ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
                  ) : (
                    <div className="flex gap-1.5 items-center h-5">
                      <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                      <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-paper border-t border-border">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if(e.key === 'Enter') handleSendMessage(inputText); }}
            placeholder="Ask me anything..."
            className="w-full bg-surface border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-accent-500 text-ink shadow-sm"
          />
          <Button 
            onClick={() => handleSendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="absolute right-1 top-1 h-9 w-9 p-0 bg-accent-500 hover:bg-accent-600 text-black rounded-lg disabled:opacity-50"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};
