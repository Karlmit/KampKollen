import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'

export function IndividualLeaderboardPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api.leaderboards.competition(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  if (isLoading) return <Layout title="Individual" back={`/competitions/${id}/leaderboard`}><LoadingSpinner /></Layout>

  const lb = data
  if (!lb) return <Layout title="Individual"><p>Not found</p></Layout>

  const rankEmoji = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  return (
    <Layout title="Individual" back={`/competitions/${id}/leaderboard`}>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
        {lb.competition.name} · {lb.individualLeaderboard.length} players
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {lb.individualLeaderboard.map((p: any) => (
          <Card key={p.userId} padding="12px" style={{ border: p.rank === 1 ? '2px solid #ffd700' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: p.rank <= 3 ? '22px' : '14px', minWidth: '32px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-muted)' }}>
                {rankEmoji(p.rank)}
              </span>
              <Avatar src={p.profileImageUrl} name={p.displayName ?? p.username ?? p.userId} size={40} />
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                  <Link to={`/profile/${p.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {p.displayName ?? p.username ?? p.userId}
                  </Link>
                </p>
                {p.teamName && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.teamName}</p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px' }}>
                  {p.totalPoints.toFixed(0)}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pts</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  )
}
