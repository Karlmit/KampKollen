import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { CompetitionLeaderboardContent } from '../components/CompetitionLeaderboardContent'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { CompetitionLeaderboard } from '../types'
import { useTranslation } from 'react-i18next'

export function CompetitionLeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { t } = useTranslation()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api.leaderboards.competition(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  if (isLoading) return <Layout title={t('leaderboard.title')} back={`/competitions/${id}`}><LoadingSpinner /></Layout>

  const lb: CompetitionLeaderboard = data
  if (!lb) return <Layout title={t('leaderboard.title')}><p>{t('leaderboard.notFound')}</p></Layout>

  return (
    <Layout
      title={lb.competition.name}
      back={`/competitions/${id}`}
      action={
        <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isFetching}>
          {t('leaderboard.refresh')}
        </Button>
      }
    >
      <CompetitionLeaderboardContent lb={lb} id={id!} userId={user?.id} />
    </Layout>
  )
}
