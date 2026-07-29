import React, { createContext, useContext, useState, useEffect } from 'react';

export type AgentId = 'agent1' | 'agent2' | 'agent3' | 'agent4' | 'agent5' | 'agent6' | 'agent7' | 'agent8' | 'agent9' | 'agent10' | 'agent7' | 'agent8' | 'agent9' | 'agent10';

interface AgentThemeContextType {
  activeAgent: AgentId;
  setActiveAgent: (agent: AgentId) => void;
  getAgentThemeName: () => string;
}

const AgentThemeContext = createContext<AgentThemeContextType | undefined>(undefined);

export const AgentThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAgent, setActiveAgent] = useState<AgentId>('agent1');

  useEffect(() => {
    // Sync class on the document body/root element
    const root = document.documentElement;
    root.classList.remove(
      'theme-agent1',
      'theme-agent2',
      'theme-agent3',
      'theme-agent4',
      'theme-agent5',
      'theme-agent6',
      'theme-agent7',
      'theme-agent8',
      'theme-agent9',
      'theme-agent10'
    );
    
    root.classList.add(`theme-${activeAgent}`);
  }, [activeAgent]);

  const getAgentThemeName = () => {
    switch (activeAgent) {
      case 'agent1':
        return 'Faculty Assistant';
      case 'agent2':
        return 'Academic Workflow';
      case 'agent3':
        return 'Analytics & Accreditation';
      case 'agent4':
        return 'Research & Grants';
      case 'agent5':
        return 'Exam & Assessment Design';
      case 'agent6':
        return 'Mentor & Wellbeing';
      case 'agent7':
        return 'Placement & Internships';
      case 'agent8':
        return 'Alumni Relations';
      case 'agent9':
        return 'Event & Committee Management';
      case 'agent10':
        return 'Inventory & Resources';
      default:
        return 'Faculty Assistant';
    }
  };

  return (
    <AgentThemeContext.Provider value={{ activeAgent, setActiveAgent, getAgentThemeName }}>
      {children}
    </AgentThemeContext.Provider>
  );
};

export const useAgentTheme = () => {
  const context = useContext(AgentThemeContext);
  if (!context) {
    throw new Error('useAgentTheme must be used within an AgentThemeProvider');
  }
  return context;
};
