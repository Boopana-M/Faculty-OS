import React, { useState } from 'react';
import { Bot, Lock, Mail } from 'lucide-react';
import { Card, Input, Button, Seal } from '../components/Common';
import { api, setAuthToken } from '../services/api';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('demo@faculty.edu');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.login(email, password);
      setAuthToken(data.access_token);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-paper p-4 font-ui relative overflow-hidden">
      {/* Background radial gradients for ambient dark glow */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-agent1-500/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-agent2-500/5 blur-[80px] pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 border border-border/80 bg-surface shadow-soft p-8 select-none">
        
        {/* Seal Avatar */}
        <div className="flex flex-col items-center justify-center mb-6">
          <Seal agentId="agent1" icon={Bot} size="lg" className="mb-4 animate-pulse" />
          <h1 className="font-display text-4xl text-ink font-semibold tracking-tight">EduPilot</h1>
          <span className="text-xs text-ink-muted mt-1 uppercase tracking-widest font-mono">Faculty Operating System</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-status-bad/15 border border-status-bad/30 rounded-radius-sm text-status-bad text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
              <Mail size={13} /> Email Address
            </label>
            <Input
              type="email"
              placeholder="e.g. professor@faculty.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
              <Lock size={13} /> Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="text-sm font-mono"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full py-3"
            >
              {loading ? 'Authenticating...' : 'Sign In to Ledger'}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-border/60 pt-4 text-center">
          <p className="text-xs text-ink-muted">
            Demo Credentials: <code className="text-accent-500 font-mono font-semibold">demo@faculty.edu</code> / <code className="text-accent-500 font-mono font-semibold">demo1234</code>
          </p>
        </div>
      </Card>
    </div>
  );
};
