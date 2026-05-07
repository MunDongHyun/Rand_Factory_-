import React, { useState, useEffect } from 'react';
import './styles/theme.css'
import api from './lib/api';
import { getToken, clearToken } from './lib/auth';
import Intro from './components/Intro';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import MasterDashboard from './components/MasterDashboard';

const screenForRole = (role) => (role === 'a' ? 'master' : 'dashboard');

function App() {
  const [screen, setScreen] = useState('intro');
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'tangerine-disco');
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setRestoring(false);
      return;
    }
    api.get('/users/me')
      .then((res) => {
        setUser(res.data);
        setScreen(screenForRole(res.data.user_role));
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setRestoring(false));
  }, []);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    setScreen(screenForRole(loggedInUser.user_role));
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setScreen('intro');
  };

  useEffect(() => {
    const onAuthLogout = () => {
      setUser(null);
      setScreen('intro');
    };
    window.addEventListener('auth:logout', onAuthLogout);
    return () => window.removeEventListener('auth:logout', onAuthLogout);
  }, []);

  if (restoring) return null;

  return (
    <div className="App">
      {screen === 'intro' && (
        <Intro
          onLogin={handleLogin}
          onSignup={() => setScreen('signup')}
        />
      )}
      {screen === 'signup' && (
        <Signup
          onBack={() => setScreen('intro')}
          onComplete={() => setScreen('intro')}
        />
      )}
      {screen === 'dashboard' && (
        <Dashboard
          user={user}
          onLogout={handleLogout}
        />
      )}
      {screen === 'master' && (
        <MasterDashboard
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
