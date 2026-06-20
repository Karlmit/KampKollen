import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Lottie from 'lottie-react'
import giftAnimation from '../assets/giftAnimation.json'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Avatar } from '../components/ui/Avatar'
import { Badge, RoleBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ProfileImageGenerator } from '../components/ProfileImageGenerator'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { formatScore, extractScoreValue, trophyTitle, trophySubtitle } from '../utils'
import { BoldText } from '../components/ui/BoldText'
import { useTranslation } from 'react-i18next'

function TrophyCard({ trophy, isSelf, adminMode, giftAnimData, onOpen, onTakeBack }: {
  trophy: any
  isSelf: boolean
  adminMode: boolean
  giftAnimData: any
  onOpen: () => void
  onTakeBack: () => void
}) {
  const { t, i18n } = useTranslation()
  const [playing, setPlaying] = useState(false)
  const [revealed, setRevealed] = useState(trophy.isOpened)
  const title = trophyTitle(trophy, i18n.language)

  const handleClick = () => {
    if (!isSelf || revealed || playing || !giftAnimData) return
    setPlaying(true)
  }

  const handleComplete = () => {
    setRevealed(true)
    setPlaying(false)
    onOpen()
  }

  const imgUrl = trophy.imageUrl
  const canTap = isSelf && !revealed && !playing && !!giftAnimData
  // Admins see all content even for unopened trophies
  const showContent = revealed || adminMode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: 88 }}>
      {showContent ? (
        <img
          src={imgUrl}
          alt={title}
          style={{ width: 80, height: 80, borderRadius: 'var(--radius)', objectFit: 'cover', opacity: revealed ? 1 : 0.7 }}
        />
      ) : giftAnimData ? (
        <div
          onClick={handleClick}
          title={canTap ? t('profile.tapToOpen') : undefined}
          style={{
            width: 80, height: 80, cursor: canTap ? 'pointer' : 'default',
            position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden',
          }}
        >
          {/* key swap forces remount with correct autoplay state */}
          <Lottie
            key={playing ? 'playing' : 'idle'}
            animationData={giftAnimData}
            autoplay={playing}
            loop={false}
            onComplete={handleComplete}
            style={{ width: 80, height: 80 }}
          />
        </div>
      ) : (
        <div style={{
          width: 80, height: 80, borderRadius: 'var(--radius)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
        }}>🎁</div>
      )}
      {showContent ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          {!revealed && (
            <p style={{ fontSize: '9px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent-warm)', textAlign: 'center', letterSpacing: '0.04em' }}>
              {t('profile.unopened')}
            </p>
          )}
          <p style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '11px',
            textAlign: 'center', color: 'var(--text-primary)', lineHeight: 1.2,
            maxWidth: 88, wordBreak: 'break-word',
          }}>
            {title}
          </p>
          {(trophy.subtitleKey || trophy.subtitle) && (
            <p style={{
              fontSize: '9px', textAlign: 'center', color: 'var(--text-muted)',
              lineHeight: 1.3, maxWidth: 88, wordBreak: 'break-word',
            }}>
              <BoldText text={trophySubtitle(trophy, t)} />
            </p>
          )}
        </div>
      ) : (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          {isSelf ? t('profile.tapToOpen') : '???'}
        </p>
      )}
      {adminMode && (
        <button
          onClick={onTakeBack}
          style={{
            fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: 700,
            color: 'var(--accent-warm)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 0',
          }}
        >
          {t('profile.takeBack')}
        </button>
      )}
    </div>
  )
}

export function Profile() {
  const { id: paramId } = useParams<{ id?: string }>()
  const { user: me, logout, refreshUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const userId = paramId ?? me?.id
  const isSelf = userId === me?.id

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ realName: '', showRealName: false, password: '' })
  const [isGenerating, setIsGenerating] = useState(false)
  const [adminMode, setAdminMode] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.users.get(userId!),
    enabled: !!userId,
  })

  const updateMutation = useMutation({
    mutationFn: () => api.users.update(userId!, {
      realName: form.realName,
      showRealName: form.showRealName,
      password: form.password || undefined,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user', userId] })
      if (isSelf) await refreshUser()
      setEditing(false)
      setForm({ realName: '', showRealName: false, password: '' })
    },
  })

  const trophies: any[] = data?.user?.trophies ?? []

  const openTrophyMutation = useMutation({
    mutationFn: (id: string) => api.trophies.open(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user', userId] })
      await refreshUser()
    },
  })

  const takeBackMutation = useMutation({
    mutationFn: (id: string) => api.trophies.takeBack(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', userId] }),
  })

  const generateSendMutation = useMutation({
    mutationFn: () => api.trophies.generateSend(userId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', userId] }),
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  function changeLanguage(lang: string) {
    i18n.changeLanguage(lang)
    localStorage.setItem('language', lang)
  }

  if (isLoading) return <Layout title={t('profile.myProfile')}><LoadingSpinner /></Layout>
  const user = data?.user
  if (!user) return <Layout title={t('profile.myProfile')}><p>{t('profile.userNotFound')}</p></Layout>

  return (
    <Layout
      title={isSelf ? t('profile.myProfile') : (user.displayName ?? user.username)}
      action={isAdmin ? (
        <Link
          to="/admin"
          aria-label={t('nav.admin')}
          title={t('nav.admin')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border-light)',
            fontSize: '18px', lineHeight: 1, textDecoration: 'none', flexShrink: 0,
          }}
        >
          ⚙️
        </Link>
      ) : undefined}
    >
      {/* Profile header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        {isGenerating ? (
          <div className="shimmer" style={{ width: 120, height: 120, borderRadius: '50%', flexShrink: 0 }} />
        ) : (
          <Avatar src={user.profileImageUrl} name={user.displayName ?? user.username} size={120} />
        )}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '22px' }}>
            {user.displayName ?? user.username}
          </h2>
          {user.realName && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{user.realName}</p>}
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>@{user.username}</p>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
            <RoleBadge role={user.globalRole} />
            {user.groups?.map((ug: any) => (
              <span
                key={ug.groupId}
                style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: '99px',
                  background: 'var(--surface)', border: '1px solid var(--border-light)',
                  fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--text-muted)',
                }}
              >
                {ug.group.name}
              </span>
            ))}
          </div>
        </div>

        {(isSelf || isAdmin) && (
          <ProfileImageGenerator
            onGenerate={async (prompt) => {
              setIsGenerating(true)
              try {
                const res = await api.users.generateImage(userId!, prompt)
                await qc.invalidateQueries({ queryKey: ['user', userId] })
                if (isSelf) await refreshUser()
                return res.imageUrl
              } finally {
                setIsGenerating(false)
              }
            }}
          />
        )}
      </div>

      {/* Account settings card */}
      {(isSelf || isAdmin) && (
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>{t('profile.accountSettings')}</h3>
            <Button size="sm" variant="ghost" onClick={() => {
              setEditing(!editing)
              setForm({ realName: user.realName ?? '', showRealName: user.showRealName ?? false, password: '' })
            }}>
              {editing ? t('profile.cancel') : t('profile.edit')}
            </Button>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input label={t('profile.realName')} value={form.realName} onChange={e => setForm(f => ({ ...f, realName: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.showRealName}
                  onChange={e => setForm(f => ({ ...f, showRealName: e.target.checked }))}
                  style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '14px' }}>
                    {t('profile.showRealName')}
                  </span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('profile.showRealNameDesc')}
                  </span>
                </span>
              </label>
              <Input label={t('profile.newPassword')} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending} fullWidth>
                {t('profile.saveChanges')}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('profile.realName')}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{user.realName ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('profile.showRealName')}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{user.showRealName ? t('common.on') : t('common.off')}</span>
              </div>
            </div>
          )}

          {/* Language switcher */}
          {isSelf && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>
                {t('language.label')}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['sv', 'en'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 'var(--radius)',
                      border: i18n.language === lang ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                      background: i18n.language === lang ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--background)',
                      color: i18n.language === lang ? 'var(--accent)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {t(`language.${lang}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Log out */}
          {isSelf && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <Button variant="danger" onClick={handleLogout} fullWidth>{t('profile.logOut')}</Button>
            </div>
          )}
        </Card>
      )}

      {/* Trophy showcase */}
      {(trophies.length > 0 || isAdmin) && (
        <section style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {trophies.length > 0 ? t('profile.awardsCount', { count: trophies.length }) : t('profile.awards')}
            </h2>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {!isSelf && (
                  <Button
                    size="sm"
                    onClick={() => generateSendMutation.mutate()}
                    loading={generateSendMutation.isPending}
                    style={{ fontSize: '11px' }}
                  >
                    {t('profile.giveAward')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={adminMode ? 'danger' : 'ghost'}
                  onClick={() => setAdminMode(m => !m)}
                  style={{ fontSize: '11px' }}
                >
                  {adminMode ? t('profile.managing') : t('profile.manage')}
                </Button>
              </div>
            )}
          </div>

          {trophies.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>{t('profile.noTrophies')}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {trophies.map((trophy: any) => (
                <TrophyCard
                  key={trophy.id}
                  trophy={trophy}
                  isSelf={isSelf}
                  adminMode={adminMode}
                  giftAnimData={giftAnimation}
                  onOpen={() => openTrophyMutation.mutate(trophy.id)}
                  onTakeBack={() => takeBackMutation.mutate(trophy.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Personal bests per challenge */}
      {user.scores?.length > 0 && (() => {
        // Group by challenge, keep best score per challenge
        const bestByChallenge: Record<string, any> = {}
        for (const s of user.scores) {
          const cc = s.competitionChallenge
          if (!cc) continue
          const challenge = cc.challenge
          const effectiveSt = cc.scoreTypeOverride ?? challenge.scoreType
          const val = extractScoreValue(s, effectiveSt)
          if (val === null) continue
          const existing = bestByChallenge[challenge.id]
          const lowerBetter = effectiveSt === 'time_fastest_wins' || effectiveSt === 'number_lowest_wins' || effectiveSt === 'placement_lowest_wins'
          if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
            bestByChallenge[challenge.id] = {
              challenge,
              score: val,
              competitionName: cc.competition?.name ?? '',
              effectiveSt,
            }
          }
        }
        const bests = Object.values(bestByChallenge)
        if (bests.length === 0) return null
        return (
          <section style={{ marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', color: 'var(--text-muted)' }}>
              {t('profile.personalBests')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bests.map((b: any) => (
                <Card key={b.challenge.id} padding="12px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {b.challenge.logoUrl ? (
                      <img src={b.challenge.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏅</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{b.challenge.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.competitionName}</p>
                    </div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', flexShrink: 0 }}>
                      {formatScore(b.score, b.challenge.scoreType)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Competition history */}
      {user.competitionPlayers?.length > 0 && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', color: 'var(--text-muted)' }}>
            {t('profile.competitions')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {user.competitionPlayers.map((cp: any) => (
              <Card key={cp.id} padding="12px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{cp.competition.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {cp.team ? cp.team.name : t('profile.playerPool')}
                    </p>
                  </div>
                  {cp.isTeamLeader && <Badge variant="info">{t('profile.leader')}</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Layout>
  )
}
