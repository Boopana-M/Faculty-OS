import React from 'react';
import { Card, Button, Input, Badge, Seal } from '../components/Common';
import { useAgentTheme } from '../context/AgentThemeContext';
import { Bot, LayoutGrid, Award, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StyleGuide: React.FC = () => {
  const { activeAgent, setActiveAgent, getAgentThemeName } = useAgentTheme();

  return (
    <div className="min-height-screen bg-paper text-ink p-8 font-ui">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8 border-b border-border pb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink mb-2">EduPilot Design System</h1>
          <p className="text-ink-muted">Visual validation of typography, color tokens, and core components (Dark Mode).</p>
        </div>
        <Link to="/" className="text-accent-500 hover:text-accent-700 underline font-mono text-sm">
          Go to App Login
        </Link>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Colors Section */}
        <Card className="col-span-1 md:col-span-2">
          <h2 className="font-display text-2xl font-medium mb-4 flex items-center gap-2">
            <LayoutGrid size={20} className="text-accent-500" /> Color Tokens
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-muted">--paper (App Background)</span>
              <div className="h-12 w-full rounded border border-border bg-paper flex items-center justify-center font-mono text-xs text-ink">
                #0F172A
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-muted">--surface (Card Background)</span>
              <div className="h-12 w-full rounded border border-border bg-surface flex items-center justify-center font-mono text-xs text-ink">
                #1E293B
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-muted">--border (Hairlines)</span>
              <div className="h-12 w-full rounded border bg-border flex items-center justify-center font-mono text-xs text-ink-muted">
                #334155
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-muted">--ink (Primary Text)</span>
              <div className="h-12 w-full rounded border border-border bg-ink flex items-center justify-center font-mono text-xs text-paper">
                #F8FAFC
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border/50 pt-4">
            <h3 className="text-sm font-semibold text-ink-muted mb-3">Agent Theme Variables (Active: {getAgentThemeName()})</h3>
            <div className="flex gap-4 mb-4">
              <button 
                onClick={() => setActiveAgent('agent1')}
                className={`py-1 px-3 rounded text-xs border ${activeAgent === 'agent1' ? 'bg-agent1-100 text-agent1-500 border-agent1-500' : 'bg-surface border-border text-ink-muted'}`}
              >
                Agent 1 (Indigo)
              </button>
              <button 
                onClick={() => setActiveAgent('agent2')}
                className={`py-1 px-3 rounded text-xs border ${activeAgent === 'agent2' ? 'bg-agent2-100 text-agent2-500 border-agent2-500' : 'bg-surface border-border text-ink-muted'}`}
              >
                Agent 2 (Emerald)
              </button>
              <button 
                onClick={() => setActiveAgent('agent3')}
                className={`py-1 px-3 rounded text-xs border ${activeAgent === 'agent3' ? 'bg-agent3-100 text-agent3-500 border-agent3-500' : 'bg-surface border-border text-ink-muted'}`}
              >
                Agent 3 (Amber)
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="h-12 rounded bg-accent-500 flex items-center justify-center text-white text-xs font-semibold">
                --accent-500 (Primary)
              </div>
              <div className="h-12 rounded bg-accent-100 flex items-center justify-center text-accent-500 text-xs font-semibold border border-accent-500/20">
                --accent-100 (Tint)
              </div>
              <div className="h-12 rounded bg-accent-700 flex items-center justify-center text-white text-xs font-semibold">
                --accent-700 (Hover)
              </div>
            </div>
          </div>
        </Card>

        {/* Typography Section */}
        <Card>
          <h2 className="font-display text-2xl font-medium mb-4">Typography</h2>
          
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-xs text-ink-muted uppercase tracking-widest font-mono">Display (Fraunces Medium)</span>
              <h3 className="font-display text-3xl font-medium text-ink mt-1">Preethi R</h3>
            </div>
            
            <div>
              <span className="text-xs text-ink-muted uppercase tracking-widest font-mono">UI / Body (Inter)</span>
              <p className="font-ui text-sm text-ink mt-1">
                The Faculty Assistant Agent coordinates scheduling, emails, and curriculum planning.
              </p>
            </div>

            <div>
              <span className="text-xs text-ink-muted uppercase tracking-widest font-mono">Data / Mono (IBM Plex Mono)</span>
              <p className="font-mono text-sm text-accent-500 mt-1">
                24CC001 | 09:00 - 10:00 | 92.5%
              </p>
            </div>
          </div>
        </Card>

        {/* Seals Section */}
        <Card>
          <h2 className="font-display text-2xl font-medium mb-4">Seals (Signature Elements)</h2>
          <p className="text-xs text-ink-muted mb-4">
            Colored disc with a thin inner ring and a centered icon. Grayscale when inactive in switcher.
          </p>
          
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <Seal agentId="agent1" icon={Bot} size="lg" />
              <span className="text-xs font-mono">Agent 1 (LG)</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Seal agentId="agent2" icon={BookOpen} size="md" />
              <span className="text-xs font-mono">Agent 2 (MD)</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Seal agentId="agent3" icon={Award} size="sm" />
              <span className="text-xs font-mono">Agent 3 (SM)</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Seal agentId="agent2" icon={BookOpen} size="md" grayscale={true} />
              <span className="text-xs font-mono">Grayscale (Inactive)</span>
            </div>
          </div>
        </Card>

        {/* Buttons & Inputs */}
        <Card>
          <h2 className="font-display text-2xl font-medium mb-4">Buttons</h2>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button variant="primary">Primary Action</Button>
              <Button variant="secondary">Secondary</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Link</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex gap-2 items-center">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>
        </Card>

        {/* Form Controls & Badges */}
        <Card>
          <h2 className="font-display text-2xl font-medium mb-4">Inputs & Badges</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-ink-muted mb-1 block">Standard text field</label>
              <Input placeholder="Enter student email..." />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink-muted block">Status pills (Plex Mono)</span>
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">Active Class</Badge>
                <Badge variant="success">92% Present</Badge>
                <Badge variant="warning">70% Attendance</Badge>
                <Badge variant="danger">Detained</Badge>
                <Badge variant="neutral">Pending</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
