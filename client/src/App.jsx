import React, { useState, useEffect } from 'react';
import './styles/theme.css';
import Intro from './components/Intro';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import MasterDashboard from './components/MasterDashboard';

function App() {
  const [screen, setScreen] = useState('intro');
  const [user, setUser] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'tangerine-disco');
  }, []);

  const handleLogin = (data) => {
    setUser(data);
    setScreen(data.role === 'master' ? 'master' : 'dashboard');
  };

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
          onLogout={() => { setScreen('intro'); setUser(null); }}
        />
      )}
      {screen === 'master' && (
        <MasterDashboard
          user={user}
          onLogout={() => { setScreen('intro'); setUser(null); }}
        />
      )}
    </div>
  );
}

export default App;