import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthScreen } from './components/AuthScreen'
import { RequireAuth } from './components/RequireAuth'
import { useAuth } from './hooks/useAuth'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { DatasetsPage } from './pages/DatasetsPage'
import { LandingPage } from './pages/LandingPage'
import { MatcherPage } from './pages/MatcherPage'
import { PipelinePage } from './pages/PipelinePage'
import { ProfilePage } from './pages/ProfilePage'
import { ReferencePage } from './pages/ReferencePage'
import './App.css'

function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="app app--boot">
        <div className="app__aurora" aria-hidden />
        <p className="app--boot-msg">Loading…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route
            path="studio"
            element={
              <RequireAuth>
                <PipelinePage />
              </RequireAuth>
            }
          />
          <Route
            path="lab"
            element={
              <RequireAuth>
                <PipelinePage />
              </RequireAuth>
            }
          />
          <Route
            path="match"
            element={
              <RequireAuth>
                <MatcherPage />
              </RequireAuth>
            }
          />
          <Route
            path="datasets"
            element={
              <RequireAuth>
                <DatasetsPage />
              </RequireAuth>
            }
          />
          <Route path="reference" element={<ReferencePage />} />
          <Route
            path="profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path="signin" element={<AuthScreen />} />
          <Route path="auth/callback" element={<AuthCallbackPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
