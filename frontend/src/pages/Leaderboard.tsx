import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { CompetitionLeaderboardContent } from '../components/CompetitionLeaderboardContent'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { CompetitionLeaderboard } from '../types'

export function CompetitionLeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api.leaderboards.competition(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  if (isLoading) return <Layout title="Leaderboard" back={`/competitions/${id}`}><LoadingSpinner /></Layout>

  const lb: CompetitionLeaderboard = data
  if (!lb) return <Layout title="Leaderboard"><p>Not found</p></Layout>

  return (
    <Layout
      title={lb.competition.name}
      back={`/competitions/${id}`}
      action={
        <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isFetching}>
          ↻ Refresh
        </Button>
      }
    >
      <CompetitionLeaderboardContent lb={lb} id={id!} userId={user?.id} />
    </Layout>
  )
}
