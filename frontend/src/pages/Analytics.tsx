import React, { useState, useEffect } from 'react';
import { Award, TrendingUp, AlertTriangle, FileText, CheckCircle2, ChevronRight, Send, Search, Download, HelpCircle, Sparkles } from 'lucide-react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { api, type ChatMessage, type User as UserType } from '../services/api';

interface AnalyticsProps {
  user: UserType;
}

export const Analytics: React.FC<AnalyticsProps> = ({ user }) => {
  const [kpis, setKpis] = useState<any>({
    total_students: 8,
    avg_attendance: 87,
    avg_internal_marks: '34/50',
    co_attainment_rate: '60%'
  });
  const [charts, setCharts] = useState<any>({
    performance_chart: [
      { range: '0-10', count: 0 },
      { range: '10-20', count: 2 },
      { range: '20-30', count: 3 },
      { range: '30-40', count: 2 },
      { range: '40-50', count: 1 }
    ],
    attendance_chart: [
      { date: '07-23', rate: 90 },
      { date: '07-24', rate: 85 },
      { date: '07-25', rate: 88 },
      { date: '07-26', rate: 84 },
      { date: '07-27', rate: 87 }
    ],
    co_chart: [
      { co: 'CO1', target: 75, attained: 80 },
      { co: 'CO2', target: 75, attained: 60 },
      { co: 'CO3', target: 75, attained: 95 }
    ]
  });
  const [atRisk, setAtRisk] = useState<any[]>([]);
  const [department, setDepartment] = useState('CCE');
  const [departments, setDepartments] = useState<string[]>(['CCE', 'CSE']);
  const [classSection, setClassSection] = useState('CCE-A');
  const [classSections, setClassSections] = useState<string[]>(['CCE-A', 'CSE-A', 'CSE-B']);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  // Bottom Center Query Bar states
  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [queryToolCalls, setQueryToolCalls] = useState<any[]>([]);
  const [isQueryLoading, setIsQueryLoading] = useState(false);

  const loadData = async () => {
    try {
      const [kpiData, chartData, riskData, sections, availableDepartments] = await Promise.all([
        api.getAnalyticsKpis(department, classSection),
        api.getAnalyticsCharts(department, classSection),
        api.getAtRiskAnalytics(department, classSection),
        api.getClassSections(department),
        api.getDepartments(),
      ]);
      setKpis(kpiData);
      setCharts(chartData);
      setAtRisk(riskData);
      setClassSections(sections);
      setDepartments(availableDepartments);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [department, classSection]);

  const handleDownloadPDF = async () => {
    setIsReportLoading(true);
    setReportStatus(null);
    try {
      const res = await api.getAnalyticsPDF();
      setReportStatus(res.message);
    } catch (e) {
      setReportStatus("Failed to generate PDF report.");
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleSendQuery = () => {
    if (!queryInput.trim()) return;
    setIsQueryLoading(true);
    setQueryResponse(null);
    setQueryToolCalls([]);

    api.streamChat(
      'agent3',
      queryInput,
      [],
      (chunk) => {
        setQueryResponse(prev => (prev || '') + chunk);
      },
      (trace) => {
        setQueryToolCalls(prev => {
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
        setIsQueryLoading(false);
        loadData();
      },
      (err) => {
        console.error(err);
        setIsQueryLoading(false);
      }
    );
  };

  // SVG Chart rendering dimensions
  const chartWidth = 360;
  const chartHeight = 180;
  const padding = 30;

  return (
    <div className="h-full flex flex-col relative bg-paper text-ink overflow-hidden font-ui">
      
      {/* Header Row */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Seal agentId="agent3" icon={Award} size="md" className="bg-amber-500" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Analytics & Accreditation</h1>
            <p className="text-xs text-ink-muted">Executive dashboard: continuous evaluation metrics, course outcome (CO) mappings, and NBA/NAAC drafts.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={department} onChange={event => { const selectedDepartment = event.target.value; setDepartment(selectedDepartment); setClassSection(selectedDepartment === 'CCE' ? 'CCE-A' : 'CSE-A'); }} className="bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 text-xs font-mono focus:border-amber-500 outline-none">
            {departments.map(item => <option key={item}>{item}</option>)}
          </select>
          <select value={classSection} onChange={event => setClassSection(event.target.value)} className="bg-surface border border-border text-ink rounded-radius-sm py-2 px-3 text-xs font-mono focus:border-amber-500 outline-none">
            {classSections.map(section => <option key={section}>{section}</option>)}
          </select>
          <Button 
            onClick={handleDownloadPDF}
            className="bg-amber-500 hover:bg-amber-700 text-black text-xs flex items-center gap-1.5 font-mono py-2"
            disabled={isReportLoading}
          >
            <Download size={14} />
            {isReportLoading ? 'COMPILING...' : 'NBA ACCREDITATION PDF'}
          </Button>
        </div>
      </div>

      {reportStatus && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400 font-mono flex items-center justify-between">
          <span>{reportStatus}</span>
          <button onClick={() => setReportStatus(null)} className="text-amber-400/60 hover:text-amber-400">[X]</button>
        </div>
      )}

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto pr-1 pb-24 space-y-6">
        
        {/* KPI Cards (4 in a row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="text-[10px] font-mono text-ink-muted uppercase">Total Students</div>
            <div className="font-display text-3xl font-bold text-ink mt-1">{kpis.total_students}</div>
            {/* Sparkline simulation */}
            <svg className="absolute bottom-0 left-0 right-0 h-8 w-full text-amber-500/20" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,10 L20,8 L40,9 L60,4 L80,6 L100,2 L100,10 Z" fill="currentColor" />
              <path d="M0,10 L20,8 L40,9 L60,4 L80,6 L100,2" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
            </svg>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="text-[10px] font-mono text-ink-muted uppercase">Avg Attendance</div>
            <div className="font-display text-3xl font-bold text-amber-400 mt-1">{kpis.avg_attendance}%</div>
            <svg className="absolute bottom-0 left-0 right-0 h-8 w-full text-amber-500/20" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,5 L20,6 L40,4 L60,3 L80,7 L100,2 L100,10 Z" fill="currentColor" />
              <path d="M0,5 L20,6 L40,4 L60,3 L80,7 L100,2" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
            </svg>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="text-[10px] font-mono text-ink-muted uppercase">Avg Internals</div>
            <div className="font-display text-3xl font-bold text-ink mt-1">{kpis.avg_internal_marks}</div>
            <svg className="absolute bottom-0 left-0 right-0 h-8 w-full text-amber-500/20" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,8 L20,7 L40,5 L60,6 L80,3 L100,1 L100,10 Z" fill="currentColor" />
              <path d="M0,8 L20,7 L40,5 L60,6 L80,3 L100,1" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
            </svg>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="text-[10px] font-mono text-ink-muted uppercase">CO Attainment</div>
            <div className="font-display text-3xl font-bold text-amber-400 mt-1">{kpis.co_attainment_rate}</div>
            <svg className="absolute bottom-0 left-0 right-0 h-8 w-full text-amber-500/20" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,9 L20,8 L40,9 L60,5 L80,7 L100,3 L100,10 Z" fill="currentColor" />
              <path d="M0,9 L20,8 L40,9 L60,5 L80,7 L100,3" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
            </svg>
          </Card>
        </div>

        {/* 2x2 Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Performance Distribution (SVG Bar Chart) */}
          <Card>
            <div className="text-xs font-semibold text-ink-muted uppercase font-mono mb-4">Performance Distribution</div>
            <div className="flex justify-center">
              <svg width={chartWidth} height={chartHeight} className="overflow-visible font-mono text-[9px] fill-ink-muted">
                {/* Grid lines */}
                {[0, 1, 2, 3].map((g) => (
                  <line 
                    key={g} 
                    x1={padding} 
                    y1={padding + g * 40} 
                    x2={chartWidth - padding} 
                    y2={padding + g * 40} 
                    stroke="var(--border)" 
                    strokeDasharray="2 2"
                  />
                ))}
                
                {/* Bars */}
                {charts.performance_chart.map((c: any, i: number) => {
                  const maxCount = Math.max(...charts.performance_chart.map((x: any) => x.count), 1);
                  const barHeight = (c.count / maxCount) * 100;
                  const barWidth = 35;
                  const spacing = (chartWidth - padding * 2) / charts.performance_chart.length;
                  const x = padding + i * spacing + (spacing - barWidth) / 2;
                  const y = chartHeight - padding - barHeight;
                  
                  return (
                    <g key={c.range}>
                      <rect 
                        x={x} 
                        y={y} 
                        width={barWidth} 
                        height={barHeight} 
                        fill="var(--agent3-500)" 
                        opacity="0.8" 
                        rx="2"
                      />
                      <text x={x + barWidth/2} y={y - 5} textAnchor="middle" fill="var(--ink)" className="font-semibold">{c.count}</text>
                      <text x={x + barWidth/2} y={chartHeight - padding + 15} textAnchor="middle">{c.range}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>

          {/* Chart 2: Attendance Trend (SVG Line Chart) */}
          <Card>
            <div className="text-xs font-semibold text-ink-muted uppercase font-mono mb-4">Attendance Rate Trend (%)</div>
            <div className="flex justify-center">
              <svg width={chartWidth} height={chartHeight} className="overflow-visible font-mono text-[9px] fill-ink-muted">
                {/* Grid lines */}
                {[0, 20, 40, 60, 80, 100].map((val, idx) => (
                  <line 
                    key={val} 
                    x1={padding} 
                    y1={chartHeight - padding - idx * 24} 
                    x2={chartWidth - padding} 
                    y2={chartHeight - padding - idx * 24} 
                    stroke="var(--border)" 
                  />
                ))}
                {/* Draw line */}
                {(() => {
                  const spacing = (chartWidth - padding * 2) / (charts.attendance_chart.length - 1);
                  const points = charts.attendance_chart.map((c: any, i: number) => {
                    const x = padding + i * spacing;
                    const y = chartHeight - padding - (c.rate / 100) * 120; // scale to fit
                    return { x, y, rate: c.rate, date: c.date };
                  });
                  const pathD = points.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                  
                  return (
                    <g>
                      <path d={pathD} fill="none" stroke="var(--agent3-500)" strokeWidth="2" />
                      {points.map((p: any, idx: number) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="3.5" fill="var(--agent3-700)" stroke="var(--agent3-500)" strokeWidth="1.5" />
                          <text x={p.x} y={p.y - 8} textAnchor="middle" fill="var(--ink)">{p.rate}%</text>
                          <text x={p.x} y={chartHeight - padding + 15} textAnchor="middle">{p.date}</text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </svg>
            </div>
          </Card>

          {/* Chart 3: At-Risk Table */}
          <Card className="flex flex-col h-[280px]">
            <div className="text-xs font-semibold text-ink-muted uppercase font-mono mb-3">At-Risk Students Prediction</div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-ink-muted">
                    <th className="py-2">ROLL NO</th>
                    <th className="py-2">NAME</th>
                    <th className="py-2 text-center">ATTENDANCE</th>
                    <th className="py-2 text-center">MARKS</th>
                    <th className="py-2 text-right">RISK LEVEL</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((r, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-surface/30">
                      <td className="py-2.5 font-mono">{r.roll_no}</td>
                      <td className="py-2.5 font-bold">{r.name}</td>
                      <td className="py-2.5 text-center font-mono text-status-bad">{r.attendance}%</td>
                      <td className="py-2.5 text-center font-mono">{r.marks}/50</td>
                      <td className="py-2.5 text-right">
                        <Badge variant="danger">{r.risk_level}</Badge>
                      </td>
                    </tr>
                  ))}
                  {atRisk.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-muted font-mono">No at-risk students flagged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Chart 4: CO Attainment Target vs Attained */}
          <Card>
            <div className="text-xs font-semibold text-ink-muted uppercase font-mono mb-4">CO Attainment vs Target</div>
            <div className="flex justify-center">
              <svg width={chartWidth} height={chartHeight} className="overflow-visible font-mono text-[9px] fill-ink-muted">
                {/* Grid line at 100% */}
                <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="var(--border)" strokeDasharray="2 2" />
                <text x={chartWidth - padding + 5} y={padding + 3} textAnchor="start">100%</text>

                {charts.co_chart.map((c: any, i: number) => {
                  const spacing = (chartWidth - padding * 2) / charts.co_chart.length;
                  const x = padding + i * spacing + 10;
                  const yTarget = chartHeight - padding - (c.target / 100) * 120;
                  const yAttained = chartHeight - padding - (c.attained / 100) * 120;
                  const barWidth = 15;

                  return (
                    <g key={c.co}>
                      {/* Target bar outline */}
                      <rect 
                        x={x} 
                        y={yTarget} 
                        width={barWidth} 
                        height={(c.target / 100) * 120} 
                        fill="none" 
                        stroke="var(--ink-muted)" 
                        strokeWidth="1.5" 
                        strokeDasharray="2 2"
                      />
                      {/* Attained bar filled */}
                      <rect 
                        x={x + barWidth + 4} 
                        y={yAttained} 
                        width={barWidth} 
                        height={(c.attained / 100) * 120} 
                        fill="var(--agent3-500)" 
                        rx="1"
                      />
                      
                      <text x={x + 15} y={chartHeight - padding + 15} textAnchor="middle">{c.co}</text>
                      <text x={x + barWidth/2} y={yTarget - 5} textAnchor="middle" fill="var(--ink-muted)">{c.target}</text>
                      <text x={x + barWidth + 4 + barWidth/2} y={yAttained - 5} textAnchor="middle" fill="var(--agent3-200)">{c.attained}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>

        </div>

      </div>

      {/* Floating Center Query Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-30">
        <Card className="shadow-2xl border-amber-500/40 border bg-surface/95 backdrop-blur">
          {queryResponse && (
            <div className="mb-4 max-h-48 overflow-y-auto border-b border-border/80 pb-3 text-xs leading-relaxed">
              <div className="font-mono text-[10px] text-amber-400 mb-1 flex items-center gap-1.5">
                <Sparkles size={10} /> ANALYTICS ADVISOR
              </div>
              <div className="whitespace-pre-wrap">{queryResponse}</div>
            </div>
          )}
          
          {queryToolCalls.map((t, idx) => (
            <div key={idx} className="text-[9px] font-mono text-amber-500/80 mb-2">
              Executing {t.name}... ({t.status})
            </div>
          ))}

          <div className="flex gap-2">
            <Input 
              placeholder="Ask about attainment targets, weak student lists, or department averages..."
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendQuery()}
              className="text-xs border-amber-500/20 focus:border-amber-500"
            />
            <Button onClick={handleSendQuery} size="sm" className="bg-amber-500 hover:bg-amber-600 text-black px-4">
              Ask
            </Button>
          </div>
        </Card>
      </div>

    </div>
  );
};
