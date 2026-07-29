import React from 'react';
import { useAgentTheme, type AgentId } from '../context/AgentThemeContext';
import { FacultyAssistant } from './FacultyAssistant';
import { AcademicWorkflow } from './AcademicWorkflow';
import { Analytics } from './Analytics';
import { ResearchGrants } from './ResearchGrants';
import { ExamAssessment } from './ExamAssessment';
import { MentorWellbeing } from './MentorWellbeing';
import { PlacementInternships } from './PlacementInternships';
import { AlumniRelations } from './AlumniRelations';
import { EventManagement } from './EventManagement';
import { InventoryResources } from './InventoryResources';
import { Seal, Button, Badge } from '../components/Common';
import { Bot, BookOpen, Award, GraduationCap, ClipboardSignature, Heart, LogOut, User as UserIcon, Briefcase, Network, CalendarDays, Package } from 'lucide-react';
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
      desc: 'NBA/NAAC, performance reports',
      icon: Award,
      colorClass: 'agent3'
    },
    {
      id: 'agent4',
      name: 'Research & Grants',
      desc: 'Publications, grants tracker, co-authors',
      icon: GraduationCap,
      colorClass: 'agent4'
    },
    {
      id: 'agent5',
      name: 'Exam & Assessment Design',
      desc: 'Question papers, rubrics, moderation',
      icon: ClipboardSignature,
      colorClass: 'agent5'
    },
    {
      id: 'agent6',
      name: 'Mentor & Wellbeing',
      desc: 'Mentees check-ins, mood & escalations',
      icon: Heart,
      colorClass: 'agent6'
    },
    {
      id: 'agent7',
      name: 'Placement & Internships',
      desc: 'Drives, internships, mock interviews',
      icon: Briefcase,
      colorClass: 'agent7'
    },
    {
      id: 'agent8',
      name: 'Alumni Relations',
      desc: 'Alumni directory, guest lectures, funds',
      icon: Network,
      colorClass: 'agent8'
    },
    {
      id: 'agent9',
      name: 'Event Management',
      desc: 'FDPs, budget tracking, committees',
      icon: CalendarDays,
      colorClass: 'agent9'
    },
    {
      id: 'agent10',
      name: 'Inventory & Resources',
      desc: 'Lab equipment, software licenses, books',
      icon: Package,
      colorClass: 'agent10'
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
                <AcademicWorkflow user={user} />
              )}

              {activeAgent === 'agent3' && (
                <Analytics user={user} />
              )}

              {activeAgent === 'agent4' && (
                <ResearchGrants user={user} />
              )}

              {activeAgent === 'agent5' && (
                <ExamAssessment user={user} />
              )}

              {activeAgent === 'agent6' && (
                <MentorWellbeing user={user} />
              )}

              {activeAgent === 'agent7' && (
                <PlacementInternships user={user} />
              )}

              {activeAgent === 'agent8' && (
                <AlumniRelations user={user} />
              )}

              {activeAgent === 'agent9' && (
                <EventManagement user={user} />
              )}

              {activeAgent === 'agent10' && (
                <InventoryResources user={user} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  );
};
