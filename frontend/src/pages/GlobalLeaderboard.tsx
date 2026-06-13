import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { BoldText } from '../components/ui/BoldText'
import { api } from '../api/client'
import { formatDate, formatScore } from '../utils'
import { useTranslation } from 'react-i18next'

type View = 'competitions' | 'challenges' | 'awards'

export function GlobalLeaderboard() {
  const { user } = useAuth()
  const { activeGroupId, setActiveGroupId } = useGroup()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as View) ?? 'competitions'
  const setView = (v: View) => setSearchParams({ view: v }, { replace: true })

  const myGroups = user?.groups ?? []
  const showGroupFilter = myGroups.length > 1

  const { data: compsData, isLoading: compsLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
    enabled: view === 'competitions',
  })

  const { data: challengeData, isLoading: challengesLoading } = useQuery({
    queryKey: ['leaderboards', 'challenges-all-time', activeGroupId],
    queryFn: () => api.leaderboards.challengesAllTime(activeGroupId),
    enabled: view === 'challenges',
  })

  const { data: awardsData, isLoading: awardsLoading } = useQuery({
    queryKey: ['trophies-history', activeGroupId],
    queryFn: () => api.trophies.history(activeGroupId),
    enabled: view === 'awards',
  })

  const allComps: any[] = compsData?.competitions ?? []
  const filteredComps = activeGroupId ? allComps.filter((c: any) => c.groupId === activeGroupId) : allComps
  const activeComps = filteredComps.filter((c: any) => c.status === 'ACTIVE')
  const completedComps = filteredComps.filter((c: any) => c.status === 'COMPLETED')
  const challengeRecords: any[] = challengeData?.challenges ?? []
  const awardPlayers: any[] = awardsData?.players ?? []

  const viewButtons: { key: View; icon: string; labelKey: string }[] = [
    { key: 'competitions', icon: '🏆', labelKey: 'globalLeaderboard.competitionsLabel' },
    { key: 'challenges',   icon: '⚔️',  labelKey: 'globalLeaderboard.challengesLabel' },
    { key: 'awards',       icon: '🎁',  labelKey: 'globalLeaderboard.awardsLabel' },
  ]

  return (
    <Layout title={t('globalLeaderboard.title')}>
      {/* Group filter */}
      {showGroupFilter && (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
            {t('globalLeaderboard.group')}:
          </label>
          <select
            value={activeGroupId ?? ''}
            onChange={e => setActiveGroupId(e.target.value || null)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '14px', fontFamily: 'var(--font-ui)' }}
          >
            <option value="">{t('globalLeaderboard.allGroups')}</option>
            {myGroups.map((ug: any) => (
              <option key={ug.groupId} value={ug.groupId}>{ug.group.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* View selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {viewButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setView(btn.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
              border: view === btn.key ? '2px solid var(--accent)' : '2px solid var(--border-light)',
              background: view === btn.key ? 'var(--text-primary)' : 'var(--background)',
              color: view === btn.key ? '#fff' : 'var(--text-primary)',
              transition: 'border-color 150ms, background 150ms, color 150ms',
            }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{btn.icon}</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{t(btn.labelKey as any)}</span>
            <span style={{ marginLeft: 'auto', fontSize: '18px', opacity: 0.5 }}>›</span>
          </button>
        ))}
      </div>

      {/* ── Competitions view ── */}
      {view === 'competitions' && (
        compsLoading ? <LoadingSpinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {activeComps.length > 0 && (
              <section>
                <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)' }}>
                  {t('globalLeaderboard.liveCompetitions')}
                </h2>
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeComps.map((c: any) => (
                    <Link to={`/competitions/${c.id}/leaderboard`} key={c.id} style={{ textDecoration: 'none' }}>
                      <Card className="card-interactive">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span className="live-dot" />
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                            </div>
                            {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                            <StatusBadge status={c.status} />
                            <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {completedComps.length > 0 && (
              <section>
                <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)' }}>
                  {t('globalLeaderboard.pastCompetitions')}
                </h2>
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {completedComps.map((c: any) => (
                    <Link to={`/competitions/${c.id}/leaderboard`} key={c.id} style={{ textDecoration: 'none' }}>
                      <Card className="card-interactive">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{c.name}</p>
                            {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <StatusBadge status={c.status} />
                            <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {activeComps.length === 0 && completedComps.length === 0 && (
              <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>{t('globalLeaderboard.noCompetitionsYet')}</p></Card>
            )}
          </div>
        )
      )}

      {/* ── Challenges view ── */}
      {view === 'challenges' && (
        challengesLoading ? <LoadingSpinner /> : (
          challengeRecords.length === 0 ? (
            <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>{t('globalLeaderboard.noChallengesYet')}</p></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {challengeRecords.map((ch: any) => (
                <Card key={ch.challengeId} padding="0px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                    {ch.challengeLogoUrl ? (
                      <img src={ch.challengeLogoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏆</div>
                    )}
                    <p style={{ flex: 1, fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{ch.challengeName}</p>
                    <Link to={`/leaderboard/challenge/${ch.challengeId}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent)' }}>{t('globalLeaderboard.viewAll')}</span>
                    </Link>
                  </div>
                  <div>
                    {ch.topScores.map((s: any, i: number) => (
                      <Link to={`/profile/${s.userId}`} key={s.userId} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: i < ch.topScores.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                          <span style={{ fontSize: '14px', flexShrink: 0, width: '20px', textAlign: 'center' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                          </span>
                          <Avatar src={s.profileImageUrl} name={s.displayName ?? s.username} size={28} />
                          <p style={{ flex: 1, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '13px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.displayName ?? s.username}
                          </p>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', color: i === 0 ? 'var(--text-primary)' : 'inherit' }}>
                              {formatScore(s.score, ch.scoreType)}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.competitionName}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )
        )
      )}

      {/* ── Awards view ── */}
      {view === 'awards' && (
        awardsLoading ? <LoadingSpinner /> : (
          awardPlayers.length === 0 ? (
            <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>{t('globalLeaderboard.noAwardsYet')}</p></Card>
          ) : (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {awardPlayers.map((p: any) => (
                <Card key={p.userId} padding="0">
                  {/* Player header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border-light)' }}>
                    <Avatar src={p.profileImageUrl} name={p.displayName ?? p.username} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/profile/${p.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>
                          {p.displayName ?? p.username}
                        </p>
                      </Link>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px' }}>{p.trophyCount}</span>
                      <span style={{ fontSize: '18px' }}>🎁</span>
                    </div>
                  </div>
                  {/* Trophy list */}
                  <div>
                    {p.trophies.map((trophy: any, i: number) => (
                      <div
                        key={trophy.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 16px',
                          borderBottom: i < p.trophies.length - 1 ? '1px solid var(--border-light)' : 'none',
                        }}
                      >
                        <img
                          src={trophy.imageUrl}
                          alt={trophy.title}
                          style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{trophy.title}</p>
                          {trophy.subtitle && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}><BoldText text={trophy.subtitle} /></p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )
        )
      )}
    </Layout>
  )
}
