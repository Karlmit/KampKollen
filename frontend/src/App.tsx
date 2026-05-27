import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PageLoader } from './components/ui/LoadingSpinner'

import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { Profile } from './pages/Profile'
import { CompetitionList } from './pages/CompetitionList'
import { CompetitionDetail } from './pages/CompetitionDetail'
import { CompetitionLeaderboardPage } from './pages/Leaderboard'
import { IndividualLeaderboardPage } from './pages/IndividualLeaderboard'
import { GlobalLeaderboard } from './pages/GlobalLeaderboard'
import { MyTeamPage } from './pages/MyTeam'
import { ScorekeeperPage } from './pages/Scorekeeper'
import { AdminCompetitions } from './pages/admin/Competitions'
import { AdminCompetitionManage } from './pages/admin/CompetitionManage'
import { AdminChallenges } from './pages/admin/Challenges'
import { AdminUsers } from './pages/admin/Users'
import { AdminSettings } from './pages/admin/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      {/* Protected */}
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/profile/:id" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/competitions" element={<CompetitionList />} />
      <Route path="/competitions/:id" element={<CompetitionDetail />} />
      <Route path="/competitions/:id/leaderboard" element={<CompetitionLeaderboardPage />} />
      <Route path="/competitions/:id/leaderboard/individual" element={<IndividualLeaderboardPage />} />
      <Route path="/competitions/:competitionId/team/:teamId" element={<RequireAuth><MyTeamPage /></RequireAuth>} />
      <Route path="/competitions/:id/scores" element={<RequireAuth><ScorekeeperPage /></RequireAuth>} />
      <Route path="/leaderboard" element={<GlobalLeaderboard />} />

      {/* Admin */}
      <Route path="/admin" element={<RequireAuth><Navigate to="/admin/competitions" replace /></RequireAuth>} />
      <Route path="/admin/competitions" element={<RequireAuth><AdminCompetitions /></RequireAuth>} />
      <Route path="/admin/competitions/:id" element={<RequireAuth><AdminCompetitionManage /></RequireAuth>} />
      <Route path="/admin/challenges" element={<RequireAuth><AdminChallenges /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
      <Route path="/admin/settings" element={<RequireAuth><AdminSettings /></RequireAuth>} />

      <Route path="*" element={<Navigate to={user ? '/' : '/competitions'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
