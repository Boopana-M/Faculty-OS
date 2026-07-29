import React from 'react';
import type { LucideIcon } from 'lucide-react';

// ==========================================
// CARD COMPONENT
// ==========================================
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-surface border border-border rounded-radius-md shadow-soft p-5 md:p-6 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// ==========================================
// INPUT COMPONENT
// ==========================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  return (
    <input
      className={`bg-surface border border-border text-ink rounded-radius-sm py-2.5 px-3 w-full outline-none transition-all duration-200 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/50 placeholder:text-ink-muted/50 ${className}`}
      {...props}
    />
  );
};

// ==========================================
// BUTTON COMPONENT
// ==========================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  let baseStyles = 'inline-flex items-center justify-center font-medium font-ui rounded-radius-sm transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-paper';
  
  let variantStyles = '';
  switch (variant) {
    case 'primary':
      variantStyles = 'bg-accent-500 hover:bg-accent-700 text-white shadow-sm focus:ring-accent-500';
      break;
    case 'secondary':
      variantStyles = 'bg-accent-100 hover:bg-accent-500/20 text-accent-500 focus:ring-accent-500';
      break;
    case 'outline':
      variantStyles = 'bg-transparent border border-border text-ink hover:bg-surface/50 focus:ring-accent-500';
      break;
    case 'danger':
      variantStyles = 'bg-status-bad hover:bg-red-700 text-white focus:ring-status-bad';
      break;
    case 'ghost':
      variantStyles = 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface/30';
      break;
  }

  let sizeStyles = '';
  switch (size) {
    case 'sm':
      sizeStyles = 'py-1.5 px-3 text-xs';
      break;
    case 'md':
      sizeStyles = 'py-2.5 px-4 text-sm';
      break;
    case 'lg':
      sizeStyles = 'py-3 px-6 text-base';
      break;
  }

  return (
    <button type="button" className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`} {...props}>
      {children}
    </button>
  );
};

// ==========================================
// BADGE COMPONENT
// ==========================================
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'accent',
  className = '',
  ...props
}) => {
  let styles = 'inline-flex items-center px-2 py-0.5 rounded-radius-sm font-mono text-xs tracking-wider uppercase font-semibold';
  
  switch (variant) {
    case 'accent':
      styles += ' bg-accent-100 text-accent-500 border border-accent-500/20';
      break;
    case 'success':
      styles += ' bg-status-good/10 text-status-good border border-status-good/20';
      break;
    case 'warning':
      styles += ' bg-status-warn/10 text-status-warn border border-status-warn/20';
      break;
    case 'danger':
      styles += ' bg-status-bad/10 text-status-bad border border-status-bad/20';
      break;
    case 'neutral':
      styles += ' bg-border/40 text-ink-muted border border-border/60';
      break;
  }

  return (
    <span className={`${styles} ${className}`} {...props}>
      {children}
    </span>
  );
};

// ==========================================
// SEAL COMPONENT (SIGNATURE ELEMENT)
// ==========================================
interface SealProps {
  agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4' | 'agent5' | 'agent6' | 'agent7' | 'agent8' | 'agent9' | 'agent10';
  icon: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  grayscale?: boolean;
  className?: string;
}

export const Seal: React.FC<SealProps> = ({
  agentId,
  icon: Icon,
  size = 'md',
  grayscale = false,
  className = ''
}) => {
  let sizeClass = 'w-10 h-10'; // md: 40px
  let iconSize = 18;
  
  if (size === 'sm') {
    sizeClass = 'w-7 h-7'; // sm: 28px
    iconSize = 13;
  } else if (size === 'lg') {
    sizeClass = 'w-14 h-14'; // lg: 56px
    iconSize = 24;
  }

  // Set the specific agent colors
  let colorClass = '';
  if (grayscale) {
    colorClass = 'bg-slate-700/50 text-slate-400 border border-slate-600/40 opacity-70';
  } else {
    switch (agentId) {
      case 'agent1':
        colorClass = 'bg-agent1-500 text-white';
        break;
      case 'agent2':
        colorClass = 'bg-agent2-500 text-white';
        break;
      case 'agent3':
        colorClass = 'bg-agent3-500 text-white';
        break;
      case 'agent4':
        colorClass = 'bg-agent4-500 text-white';
        break;
      case 'agent5':
        colorClass = 'bg-agent5-500 text-white';
        break;
      case 'agent6':
        colorClass = 'bg-agent6-500 text-white';
        break;
    }
  }

  return (
    <div
      className={`relative rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm ${colorClass} ${className} ${sizeClass}`}
    >
      {/* 2px inner ring inset */}
      {!grayscale && (
        <div className="absolute inset-[2px] rounded-full border border-white/40 pointer-events-none" />
      )}
      
      {/* Centered line icon */}
      <Icon size={iconSize} className="relative z-10 stroke-[2]" />
    </div>
  );
};
