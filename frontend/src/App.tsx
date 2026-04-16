import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './components/AuthScreen'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './hooks/useAuth'
import { PipelinePage } from './pages/PipelinePage'
import { ProfilePage } from './pages/ProfilePage'
import { ReferencePage } from './pages/ReferencePage'
import './App.css'

function App() {
  const { loading, bypass, session } = useAuth()

  if (loading) {
    return (
      <div className="app app--boot">
        <div className="app__aurora" aria-hidden />
        <p className="app--boot-msg">Loading…</p>
      </div>
    )
  }

  if (!bypass && !session) {
    return (
      <div className="app">
        <div className="app__aurora" aria-hidden />
        <AuthScreen />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<PipelinePage />} />
          <Route path="reference" element={<ReferencePage />} />
          <Route path="profile" element={bypass ? <Navigate to="/" replace /> : <ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
