import React from 'react';
import { useAgentTheme, type AgentId } from '../context/AgentThemeContext';
import { FacultyAssistant } from './FacultyAssistant';
import { Seal, Button, Badge } from '../components/Common';
import { Bot, BookOpen, Award, LogOut, User as UserIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const { activeAgent, setActiveAgent, getAgentThemeName } = useAgentTheme();

  const agents: Array<{ id: AgentId; name: string; desc: string; icon: any; colorClass: string }> = [
    {
      id: 'agent1',
      name: 'Faculty Assistant',
      desc: 'Schedules, policy search, email drafting',
      icon: Bot,
      colorClass: 'agent1'
    },
    {
      id: 'agent2',
      name: 'Academic Workflow',
      desc: 'Attendance, marks, assignments',
      icon: BookOpen,
      colorClass: 'agent2'
    },
    {
      id: 'agent3',
      name: 'Analytics & Accreditation',
      desc: ' NBA/NAAC, performance reports',
      icon: Award,
      colorClass: 'agent3'
    }
  ];

  const getAgentHeaderIcon = () => {
    const active = agents.find(a => a.id === activeAgent);
    return active ? active.icon : Bot;
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink overflow-hidden font-ui">
      
      {/* ==========================================
          TOP BAR
         ========================================== */}
      <header className="h-16 bg-surface border-b border-border px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Main brand icon */}
            <Seal agentId="agent1" icon={Bot} size="sm" className="bg-indigo-600 animate-pulse" />
            <span className="font-display font-semibold text-xl tracking-tight text-ink">EduPilot</span>
          </div>
          
          <div className="h-4 w-[1px] bg-border/80" />
          
          {/* Active Agent Name Tag */}
          <div className="flex items-center gap-2">
            <Seal agentId={activeAgent} icon={getAgentHeaderIcon()} size="sm" />
            <span className="text-xs font-mono font-medium text-ink-muted uppercase tracking-wider">
              {getAgentThemeName()}
            </span>
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-ink">{user.name}</div>
            <div className="text-[10px] text-ink-muted font-mono">{user.designation}</div>
          </div>
          
          <div className="w-8 h-8 rounded-full border border-border bg-surface flex items-center justify-center text-ink-muted">
            <UserIcon size={14} />
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="p-1.5 hover:bg-status-bad/15 hover:text-status-bad text-ink-muted transition"
            title="Log Out"
          >
            <LogOut size={14} />
          </Button>
        </div>
      </header>

      {/* ==========================================
          MAIN AREA (SIDEBAR + CONTENT)
         ========================================== */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* SIDEBAR AGENT SWITCHER */}
        <aside className="w-64 bg-surface border-r border-border flex flex-col justify-between p-4 z-10">
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider px-2">
              Faculty Agents
            </div>
            
            <nav className="space-y-1.5">
              {agents.map((agent) => {
                const isActive = activeAgent === agent.id;
                
                return (
                  <button
                    key={agent.id}
                    onClick={() => setActiveAgent(agent.id)}
                    className={`w-full text-left p-2.5 rounded-radius-sm transition-all duration-200 flex items-center gap-3 border-l-3 ${
                      isActive
                        ? `bg-accent-100/50 border-l-accent-500 text-ink shadow-sm`
                        : `border-l-transparent text-ink-muted hover:text-ink hover:bg-paper/50`
                    }`}
                  >
                    <Seal 
                      agentId={agent.id} 
                      icon={agent.icon} 
                      size="sm" 
                      grayscale={!isActive} 
                    />
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {agent.name}
                      </div>
                      <div className="text-[9px] text-ink-muted truncate mt-0.5 leading-none">
                        {agent.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Dev Shortcuts */}
          <div className="border-t border-border/60 pt-3">
            <a 
              href="/dev/style-guide"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center p-2 border border-dashed border-border text-[10px] font-mono text-ink-muted rounded hover:border-accent-500 hover:text-accent-500 transition"
            >
              Open System Style Guide
            </a>
          </div>
        </aside>

        {/* MAIN DISPLAY WITH TRANSIENT CROSS-FADE */}
        <main className="flex-1 p-6 overflow-y-auto relative bg-paper select-none">
          {/* Ambient agent back-glow wrapper */}
          <div className={`absolute inset-0 opacity-10 bg-accent-100 transition-colors duration-500 pointer-events-none`} />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeAgent}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="h-full relative z-10"
            >
              {activeAgent === 'agent1' && (
                <FacultyAssistant user={user} />
              )}

              {activeAgent === 'agent2' && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
                  <Seal agentId="agent2" icon={BookOpen} size="lg" className="mb-4 bg-emerald-600/90" />
                  <h1 className="font-display text-4xl font-semibold tracking-tight text-ink mb-2">
                    Academic Workflow Agent
                  </h1>
                  <Badge variant="accent">Phase 2 Module</Badge>
                  <p className="text-sm text-ink-muted mt-3 leading-relaxed">
                    This agent is designed for grid/table interfaces (attendance records, assignment marks tracker, reminders feed). Once activated, you can mark students present, calculate internal assessments, and delegate reminders in emerald themes.
                  </p>
                </div>
              )}

              {activeAgent === 'agent3' && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
                  <Seal agentId="agent3" icon={Award} size="lg" className="mb-4 bg-amber-600/90" />
                  <h1 className="font-display text-4xl font-semibold tracking-tight text-ink mb-2">
                    Analytics & Accreditation Agent
                  </h1>
                  <Badge variant="accent">Phase 3 Module</Badge>
                  <p className="text-sm text-ink-muted mt-3 leading-relaxed">
                    This agent generates KPI charts, performance insights, and accreditation paperwork (NBA/NAAC reports). Features student risk forecasting dashboards and downloadable letters in amber themes.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  );
};
