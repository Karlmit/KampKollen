import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './ui/Card'
import { Avatar } from './ui/Avatar'
import { CompetitionLeaderboard, LeaderboardTeam } from '../types'
import { useTranslation } from 'react-i18next'

type View = 'teams' | 'individual'

export function CompetitionLeaderboardContent({
  lb,
  id,
  userId,
}: {
  lb: CompetitionLeaderboard
  id: string
  userId?: string | null
}) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(() =>
    lb.competition.isTeamCompetition !== false ? 'teams' : 'individual'
  )
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null)

  const myEntry = userId ? lb.individualLeaderboard.find((p: any) => p.userId === userId) : null
  const myTeamId = myEntry?.teamId
  const isPlacementMode = lb.competition.scoringMode === 'placement_points'
  const isTeamComp = lb.competition.isTeamCompetition !== false

  const toggleChallenge = (ccId: string) =>
    setExpandedChallenge(prev => prev === ccId ? null : ccId)

  const renderScore = (score: number, placementPoints?: number) => {
    if (isPlacementMode) {
      return (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>
            {placementPoints != null ? `${placementPoints} ${t('leaderboardContent.pts')}` : '—'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
            ({score?.toFixed(1) ?? '0'})
          </span>
        </div>
      )
    }
    return (
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>
        {score?.toFixed(1) ?? '0'}
      </span>
    )
  }

  const topFive = lb.individualLeaderboard.slice(0, 5)

  return (
    <div>
      {/* View toggle — team competitions only */}
      {isTeamComp && (
        <div style={{ position: 'relative', display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '4px', marginBottom: '20px', gap: '4px' }}>
          <span style={{
            position: 'absolute', top: 4, bottom: 4,
            left: view === 'teams' ? 4 : 'calc(50% + 2px)',
            width: 'calc(50% - 6px)',
            background: 'var(--background)', borderRadius: '10px', boxShadow: 'var(--shadow-sm)',
            transition: 'left 220ms var(--ease-out)', pointerEvents: 'none',
          }} />
          {(['teams', 'individual'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1, padding: '8px', borderRadius: '10px', background: 'transparent',
                color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px',
                cursor: 'pointer', border: 'none', position: 'relative', zIndex: 1,
                transition: 'color 200ms var(--ease-out)',
              }}
            >
              {v === 'teams' ? t('leaderboardContent.teams') : t('leaderboardContent.individual')}
            </button>
          ))}
        </div>
      )}

      {/* Teams leaderboard */}
      {view === 'teams' && (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {lb.teamLeaderboard.map((team: LeaderboardTeam) => {
            const isFirst = team.rank === 1
            const rankLabel = team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : team.rank === 3 ? '🥉' : String(team.rank)
            return (
              <Card key={team.teamId} style={{ background: isFirst ? 'var(--text-primary)' : undefined, borderColor: isFirst ? 'var(--text-primary)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: isFirst ? '28px' : '22px', minWidth: '36px', textAlign: 'center', lineHeight: 1 }}>{rankLabel}</span>
                  <Link to={`/competitions/${id}/team/${team.teamId}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, textDecoration: 'none' }}>
                    <Avatar src={team.teamImageUrl} name={team.teamName} size={isFirst ? 48 : 40} style={{ borderRadius: '50%', border: isFirst ? '2px solid rgba(255,255,255,0.25)' : undefined }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: isFirst ? '18px' : '16px', color: isFirst ? '#fff' : undefined }}>{team.teamName}</p>
                      <p style={{ fontSize: '12px', color: isFirst ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>{team.playerCount} {t('leaderboardContent.players')}</p>
                      {myTeamId && team.teamId === myTeamId && (
                        <p style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.06em', color: isFirst ? 'rgba(255,255,255,0.7)' : 'var(--accent)', marginTop: '2px' }}>{t('leaderboardContent.yourTeam')}</p>
                      )}
                    </div>
                  </Link>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: isFirst ? '32px' : '22px', color: isFirst ? '#fff' : undefined, lineHeight: 1 }}>{team.totalPoints.toFixed(0)}</p>
                    <p style={{ fontSize: '11px', color: isFirst ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)', marginTop: '2px' }}>{t('leaderboardContent.pts')}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Individual leaderboard */}
      {view === 'individual' && (
        <>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topFive.map((p: any) => {
              const isFirst = p.rank === 1
              const isMe = p.userId === userId
              const rankLabel = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`
              return (
                <Card key={p.userId} padding="12px" style={{ background: isFirst ? 'var(--text-primary)' : undefined, borderColor: isFirst ? 'var(--text-primary)' : isMe ? 'var(--accent)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px', minWidth: '28px', textAlign: 'center', lineHeight: 1 }}>{rankLabel}</span>
                    <Avatar src={p.profileImageUrl} name={p.displayName ?? p.username ?? p.userId} size={36} style={{ border: isFirst ? '2px solid rgba(255,255,255,0.25)' : undefined }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', color: isFirst ? '#fff' : undefined }}>
                        <Link to={`/profile/${p.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{p.displayName ?? p.username ?? p.userId}</Link>
                      </p>
                      {p.teamName && <p style={{ fontSize: '12px', color: isFirst ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>{p.teamName}</p>}
                      {isMe && !isFirst && <p style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--accent)', marginTop: '1px' }}>{t('leaderboardContent.you')}</p>}
                    </div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: isFirst ? '24px' : '18px', color: isFirst ? '#fff' : undefined }}>{p.totalPoints.toFixed(0)}</p>
                  </div>
                </Card>
              )
            })}
          </div>

          {lb.individualLeaderboard.length > 5 && (
            <div style={{ marginTop: '8px' }}>
              {lb.individualLeaderboard.slice(5).map((p: any) => {
                const isMe = p.userId === userId
                return (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border-light)', ...(isMe ? { borderLeft: '3px solid var(--accent)' } : {}) }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)', minWidth: '24px', textAlign: 'center' }}>{p.rank}</span>
                    <Avatar src={p.profileImageUrl} name={p.displayName ?? p.username ?? p.userId} size={28} />
                    <div style={{ flex: 1 }}>
                      <Link to={`/profile/${p.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{p.displayName ?? p.username ?? p.userId}</p>
                      </Link>
                      {p.teamName && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.teamName}</p>}
                      {isMe && <p style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--accent)' }}>{t('leaderboardContent.you')}</p>}
                    </div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>{p.totalPoints.toFixed(0)}</p>
                  </div>
                )
              })}
            </div>
          )}

          {lb.individualLeaderboard.length > 5 && (
            <Link to={`/competitions/${id}/leaderboard/individual`} style={{ textDecoration: 'none', display: 'block', marginTop: '10px' }}>
              <Card padding="12px" style={{ textAlign: 'center', background: 'var(--surface)' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                  {t('leaderboardContent.fullIndividual', { count: lb.individualLeaderboard.length })}
                </p>
              </Card>
            </Link>
          )}
        </>
      )}

      {/* Challenge breakdown */}
      {(() => {
        // Quizzes don't count toward individual scores in team competitions, so
        // hide them from the per-challenge breakdown while in the individual view.
        const breakdown = lb.challengeLeaderboards.filter(
          (cl: any) => !(view === 'individual' && isTeamComp && cl.isQuiz)
        )
        return breakdown.length > 0 && (
        <section style={{ marginTop: '28px' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', color: 'var(--text-muted)' }}>
            {t('leaderboard.challengeBreakdown')}
          </h2>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {breakdown.map((cl: any) => {
              const isExpanded = expandedChallenge === cl.competitionChallengeId
              const items: any[] = view === 'individual' ? (cl.players ?? []) : (cl.teams ?? [])
              const visibleItems = isExpanded ? items : items.slice(0, 3)
              return (
                <Card key={cl.competitionChallengeId} padding="14px" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleChallenge(cl.competitionChallengeId)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      {cl.challengeLogoUrl && <img src={cl.challengeLogoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.challengeName}</p>
                        {cl.lowerIsBetter && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('leaderboardContent.lowerBetter')}</p>}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }}>{isExpanded ? '▲' : `▼ ${items.length}`}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {visibleItems.map((item: any) => {
                      const isPlayer = view === 'individual'
                      const itemRankLabel = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`
                      return (
                        <div key={isPlayer ? item.userId : item.teamId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '13px', flexShrink: 0 }}>{itemRankLabel}</span>
                            {isPlayer && <Avatar src={item.profileImageUrl} name={item.displayName ?? item.username ?? item.userId} size={24} />}
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isPlayer ? (
                                  <Link to={`/profile/${item.userId}`} onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                                    {item.displayName ?? item.username ?? item.userId}
                                  </Link>
                                ) : item.teamName}
                              </p>
                              {isPlayer && item.teamName && <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.teamName}</p>}
                            </div>
                          </div>
                          {renderScore(item.score, item.placementPoints)}
                        </div>
                      )
                    })}
                    {!isExpanded && items.length > 3 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>{t('leaderboardContent.moreExpand', { count: items.length - 3 })}</p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
        )
      })()}
    </div>
  )
}
