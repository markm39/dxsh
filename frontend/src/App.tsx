import React from 'react'
import WorkflowDashboard from './pages/WorkflowDashboard'
import LoginForm from './components/auth/LoginForm'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm onSuccess={() => {}} />;
  }

  return (
    <div className="App">
      <WorkflowDashboard />
    </div>
  )
}

export default App