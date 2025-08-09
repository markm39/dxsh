import React, { useState, useEffect } from 'react'
import WorkflowDashboard from './pages/WorkflowDashboard'
import LoginForm from './components/auth/LoginForm'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuthenticated } = useAuth();
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    setShowDashboard(isAuthenticated);
  }, [isAuthenticated]);

  if (!showDashboard) {
    return <LoginForm onSuccess={() => setShowDashboard(true)} />;
  }

  return (
    <div className="App">
      <WorkflowDashboard />
    </div>
  )
}

export default App