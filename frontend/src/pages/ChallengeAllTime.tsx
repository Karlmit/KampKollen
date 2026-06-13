import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useGroup } from '../contexts/GroupContext'
import { api } from '../api/client'
import { formatScore } from '../utils'
import { useTranslation } from 'react-i18next'

export function ChallengeAllTimePage() {
  const { challengeId } = useParams<{ challengeId: string }>()
  const { activeGroupId } = useGroup()
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['challenge-all-time', challengeId, activeGroupId],
    queryFn: () => api.leaderboards.allTimeChallenge(challengeId!, activeGroupId),
    enabled: !!challengeId,
  })

  if (isLoading) return <Layout title={t('leaderboard.allTimeTitle')} back="/leaderboard"><LoadingSpinner /></Layout>

  const challenge = data?.challenge
  const scores: any[] = data?.allScores ?? []

  if (!challenge) return <Layout title={t('leaderboard.allTimeTitle')} back="/leaderboard"><p>{t('leaderboard.notFound')}</p></Layout>

  return (
    <Layout title={challenge.name} back="/leaderboard">
      {/* Challenge header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        {challenge.logoUrl ? (
          <img
            src={challenge.logoUrl}
            alt=""
            style={{ width: 48, height: 48, borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius)',
            background: 'var(--surface-raised)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>🏆</div>
        )}
        <div>
          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px' }}>{challenge.name}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t('leaderboard.allTimeBest', { count: scores.length })}
            {challenge.lowerIsBetter && ` · ${t('leaderboard.lowerIsBetter')}`}
          </p>
        </div>
      </div>

      {scores.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
            {t('leaderboard.noScoresYet')}
          </p>
        </Card>
      ) : (
        <Card padding="0px">
          {scores.map((s: any, i: number) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
            const isTop3 = i < 3
            return (
              <Link
                key={s.userId}
                to={`/profile/${s.userId}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 16px',
                  borderBottom: i < scores.length - 1 ? '1px solid var(--border-light)' : 'none',
                  background: i === 0 ? 'color-mix(in srgb, var(--text-primary) 4%, transparent)' : 'transparent',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-ui)', fontWeight: 700,
                    fontSize: medal ? '16px' : '13px',
                    color: isTop3 ? 'var(--text-primary)' : 'var(--text-muted)',
                    width: '24px', textAlign: 'center', flexShrink: 0, lineHeight: 1,
                  }}>
                    {medal ?? s.rank}
                  </span>
                  <Avatar src={s.profileImageUrl} name={s.displayName ?? s.username} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'var(--font-ui)', fontWeight: isTop3 ? 700 : 600,
                      fontSize: '14px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.displayName ?? s.username}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {s.competitionName}
                    </p>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui)', fontWeight: 700,
                    fontSize: isTop3 ? '16px' : '14px',
                    color: i === 0 ? 'var(--text-primary)' : 'inherit',
                    flexShrink: 0,
                  }}>
                    {formatScore(s.score, challenge.scoreType)}
                  </p>
                </div>
              </Link>
            )
          })}
        </Card>
      )}
    </Layout>
  )
}
