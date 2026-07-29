import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AgentThemeProvider } from './context/AgentThemeContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { StyleGuide } from './pages/StyleGuide';
import { api, getAuthToken, removeAuthToken } from './services/api';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const data = await api.getMe();
          setUser(data.user);
        } catch (err) {
          console.error("Auth init failed:", err);
          removeAuthToken();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
          Loading Session...
        </div>
      </div>
    );
  }

  return (
    <AgentThemeProvider>
      <Router>
        <Routes>
          {/* Style Guide */}
          <Route path="/dev/style-guide" element={<StyleGuide />} />
          
          {/* App Views */}
          <Route
            path="/"
            element={
              user ? (
                <Dashboard user={user} onLogout={handleLogout} />
              ) : (
                <Login onLoginSuccess={handleLoginSuccess} />
              )
            }
          />
          
          {/* Catch-all redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AgentThemeProvider>
  );
}

export default App;
