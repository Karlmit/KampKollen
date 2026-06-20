import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ImageGenerator } from '../components/ImageGenerator'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { Team, CompetitionPlayer, CompetitionLeaderboard } from '../types'
import { useTranslation } from 'react-i18next'

export function MyTeamPage() {
  const { competitionId, teamId } = useParams<{ competitionId: string; teamId: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [renameOpen, setRenameOpen] = useState(false)
  const [newName, setNewName] = useState('')

  // Create user state
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createUsername, setCreateUsername] = useState('')
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertingDummy, setConvertingDummy] = useState<CompetitionPlayer | null>(null)
  const [selectedRealUserId, setSelectedRealUserId] = useState('')

  const { data: compData, isLoading } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => api.competitions.get(competitionId!),
    enabled: !!competitionId,
  })

  const { data: teamData } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.teams.get(teamId!),
    enabled: !!teamId,
  })

  const { data: lbData } = useQuery<CompetitionLeaderboard>({
    queryKey: ['leaderboard', competitionId],
    queryFn: () => api.leaderboards.competition(competitionId!),
    enabled: !!competitionId,
    refetchInterval: 30_000,
  })

  const renameMutation = useMutation({
    mutationFn: () => api.teams.update(teamId!, { name: newName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team', teamId] }); setRenameOpen(false) },
  })

  const addPlayerMutation = useMutation({
    mutationFn: (userId: string) => api.teams.addPlayer(teamId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', competitionId] }),
  })

  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeConfirmUserId, setRemoveConfirmUserId] = useState<string | null>(null)

  const removePlayerMutation = useMutation({
    mutationFn: (userId: string) => api.teams.removePlayer(teamId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', competitionId] })
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      setRemoveError(null)
    },
    onError: (err: any) => setRemoveError(err.message ?? 'Failed to remove player'),
  })

  const toggleScorekeeperMutation = useMutation({
    mutationFn: ({ userId, isScorekeeper }: { userId: string; isScorekeeper: boolean }) =>
      api.competitions.updatePlayer(competitionId!, userId, { isScorekeeper }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', competitionId] }),
  })

  const toggleLeaderMutation = useMutation({
    mutationFn: ({ userId, isTeamLeader }: { userId: string; isTeamLeader: boolean }) =>
      api.competitions.updatePlayer(competitionId!, userId, { isTeamLeader }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', competitionId] }),
  })

  const toggleQuizMasterMutation = useMutation({
    mutationFn: ({ userId, isQuizMaster }: { userId: string; isQuizMaster: boolean }) =>
      api.competitions.updatePlayer(competitionId!, userId, { isQuizMaster }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', competitionId] }),
  })

  const createUserMutation = useMutation({
    mutationFn: () => api.competitions.createUser(competitionId!, { name: createName.trim(), username: createUsername.trim(), teamId: teamId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', competitionId] })
      setCreateUserOpen(false)
      setCreateName('')
      setCreateUsername('')
    },
  })

  const convertMutation = useMutation({
    mutationFn: () => api.competitions.convertDummyPlayer(competitionId!, convertingDummy!.userId, { realUserId: selectedRealUserId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', competitionId] })
      setConvertOpen(false)
      setConvertingDummy(null)
      setSelectedRealUserId('')
    },
  })

  if (isLoading) return <Layout title=""><LoadingSpinner /></Layout>

  const comp = compData?.competition
  const team: Team = teamData?.team
  if (!comp || !team) return <Layout title=""><p>{t('team.notFound')}</p></Layout>

  const teamPlayers = (comp.players?.filter((p: CompetitionPlayer) => p.teamId === team.id) ?? [])
    .sort((a: CompetitionPlayer, b: CompetitionPlayer) => (b.isTeamLeader ? 1 : 0) - (a.isTeamLeader ? 1 : 0))
  const poolPlayers = comp.players?.filter((p: CompetitionPlayer) => !p.teamId) ?? []
  // Real (non-dummy) players in the pool or on the team — candidates for converting a dummy
  const realCandidates = [
    ...poolPlayers.filter((p: CompetitionPlayer) => !p.user?.isDummy),
    ...teamPlayers.filter((p: CompetitionPlayer) => !p.user?.isDummy),
  ]

  const myPlayer = comp.players?.find((p: CompetitionPlayer) => p.userId === user?.id)
  // Non-admin team leaders can only manage their OWN team
  const isOwnTeam = myPlayer?.teamId === team.id
  const canManage = isAdmin || ((myPlayer?.isTeamLeader || team.leaderUserId === user?.id) && isOwnTeam)

  // Team standing + per-challenge results, derived from the shared competition
  // leaderboard so the numbers always match the leaderboard tab.
  const isPlacementMode = lbData?.competition.scoringMode === 'placement_points'
  const standing = lbData?.teamLeaderboard.find(tm => tm.teamId === team.id)
  const challengeResults = (lbData?.challengeLeaderboards ?? [])
    .map(cl => ({ cl, entry: cl.teams.find(tm => tm.teamId === team.id) }))
    .filter(({ cl, entry }) => cl.hasScore && entry)
  const rankLabel = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
  const fmtRaw = (score: number, scoreType?: string, unit?: string | null) => {
    if (scoreType === 'least_time_difference') {
      const s = score ?? 0
      return `${Number.isInteger(s) ? s : s.toFixed(1)}s`
    }
    const base = score?.toFixed(1) ?? '0'
    return unit ? `${base} ${unit}` : base
  }

  function openConvert(p: CompetitionPlayer) {
    setConvertingDummy(p)
    setSelectedRealUserId('')
    setConvertOpen(true)
  }

  return (
    <Layout
      title={team.name}
      back={`/competitions/${competitionId}`}
    >
      {/* Team image */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        {!canManage && (
          <>
            <Avatar src={team.imageUrl} name={team.name} size={80} style={{ borderRadius: '50%' }} />
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', textAlign: 'center' }}>{team.name}</p>
          </>
        )}
        {canManage && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ImageGenerator
              defaultPrompt={`Create a fun mascot/logo for a 5-kamp team called "${team.name}". Playful, bold, colorful, suitable as a round team profile image.`}
              currentImageUrl={team.imageUrl}
              onGenerate={async (prompt) => {
                const res = await api.teams.generateImage(team.id, prompt)
                qc.invalidateQueries({ queryKey: ['team', teamId] })
                return res.imageUrl
              }}
              label={t('team.teamImage')}
              shape="circle"
              afterImage={<p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', textAlign: 'center' }}>{team.name}</p>}
            />
            <Button variant="ghost" size="sm" onClick={() => { setNewName(team.name); setRenameOpen(true) }}>
              {t('team.renameTeam')}
            </Button>
          </div>
        )}
      </div>

      {/* Team performance — placement + per-challenge results */}
      {lbData && (
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: '12px' }}>
            {t('team.performance')}
          </h2>

          {/* Overall placement */}
          {standing?.hasScore ? (
            <Card style={{ background: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)', marginBottom: challengeResults.length > 0 ? '16px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '34px', lineHeight: 1, minWidth: '44px', textAlign: 'center' }}>{rankLabel(standing.rank)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65, fontFamily: 'var(--font-ui)' }}>
                    {t('team.placement')}
                  </p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px' }}>
                    {t('team.challengeRank', { rank: standing.rank, count: lbData.teamLeaderboard.length })}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '30px', lineHeight: 1 }}>{standing.totalPoints.toFixed(0)}</p>
                  <p style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px' }}>{t('team.totalPts')}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card padding="16px" style={{ textAlign: 'center', background: 'var(--surface)', marginBottom: 0 }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('team.noScoresYet')}</p>
            </Card>
          )}

          {/* Per-challenge results */}
          {challengeResults.length > 0 && (
            <>
              <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
                {t('team.scoresByChallenge')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {challengeResults.map(({ cl, entry }) => (
                  <Card key={cl.competitionChallengeId} padding="12px">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {cl.challengeLogoUrl
                        ? <img src={cl.challengeLogoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                        : <span style={{ fontSize: '20px', minWidth: '28px', textAlign: 'center' }}>{rankLabel(entry!.rank)}</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cl.challengeName}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {rankLabel(entry!.rank)} · {t('team.challengeRank', { rank: entry!.rank, count: cl.teams.length })}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {isPlacementMode ? (
                          <>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>
                              {entry!.placementPoints != null ? `${entry!.placementPoints} ${t('leaderboardContent.pts')}` : '—'}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {fmtRaw(entry!.score, cl.scoreType, (cl as any).valueUnit)}
                            </p>
                          </>
                        ) : (
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>
                            {fmtRaw(entry!.score, cl.scoreType, (cl as any).valueUnit)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Players */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
            {t('team.playersCount', { count: teamPlayers.length })}
          </h2>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => { setCreateName(''); setCreateUsername(''); createUserMutation.reset(); setCreateUserOpen(true) }} style={{ fontSize: '12px', padding: '4px 10px' }}>
              {t('team.createUser')}
            </Button>
          )}
        </div>
        {removeError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginBottom: '8px' }}>{removeError}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {teamPlayers.map((p: CompetitionPlayer) => (
            <Card key={p.userId} padding="12px">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                    {p.user?.isDummy ? (
                      <span style={{ color: 'inherit' }}>{p.user.displayName ?? p.user.username}</span>
                    ) : (
                      <Link to={`/profile/${p.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {p.user.displayName ?? p.user.username}
                      </Link>
                    )}
                  </p>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                    {p.user?.isDummy && <Badge style={{ fontSize: '11px', background: 'var(--border-light)', color: 'var(--text-muted)' }}>{t('team.guest')}</Badge>}
                    {p.isTeamLeader && <Badge variant="info" style={{ fontSize: '11px' }}>{t('team.leader')}</Badge>}
                    {p.isScorekeeper && <Badge variant="success" style={{ fontSize: '11px' }}>{t('team.scorekeeper')}</Badge>}
                    {p.isReferee && <Badge style={{ fontSize: '11px', background: 'var(--accent)', color: '#fff' }}>{t('badges.referee')}</Badge>}
                    {p.isQuizMaster && <Badge style={{ fontSize: '11px', background: 'var(--accent-orange)', color: '#fff' }}>{t('team.qmActive')}</Badge>}
                  </div>
                </div>
                {canManage && p.user?.isDummy && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openConvert(p)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      {t('team.convert')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoveConfirmUserId(p.userId)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      {t('team.remove')}
                    </Button>
                  </div>
                )}
                {canManage && !p.user?.isDummy && p.userId === user?.id && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant={p.isQuizMaster ? 'success' : 'ghost'}
                        onClick={() => toggleQuizMasterMutation.mutate({ userId: p.userId, isQuizMaster: !p.isQuizMaster })}
                        loading={toggleQuizMasterMutation.isPending}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        {p.isQuizMaster ? t('team.qmActive') : t('team.qm')}
                      </Button>
                    )}
                    {(isAdmin || !myPlayer?.isTeamLeader) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoveConfirmUserId(p.userId)}
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                      >
                        {t('team.leave')}
                      </Button>
                    )}
                  </div>
                )}
                {canManage && !p.user?.isDummy && p.userId !== user?.id && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant={p.isTeamLeader ? 'success' : 'ghost'}
                        onClick={() => toggleLeaderMutation.mutate({ userId: p.userId, isTeamLeader: !p.isTeamLeader })}
                        loading={toggleLeaderMutation.isPending}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        {p.isTeamLeader ? t('team.starLeader') : t('team.leader')}
                      </Button>
                    )}
                    {(isAdmin || myPlayer?.isTeamLeader) && (
                      <Button
                        size="sm"
                        variant={p.isScorekeeper ? 'success' : 'ghost'}
                        onClick={() => toggleScorekeeperMutation.mutate({ userId: p.userId, isScorekeeper: !p.isScorekeeper })}
                        loading={toggleScorekeeperMutation.isPending}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        {t('team.scorekeeper')}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant={p.isQuizMaster ? 'success' : 'ghost'}
                        onClick={() => toggleQuizMasterMutation.mutate({ userId: p.userId, isQuizMaster: !p.isQuizMaster })}
                        loading={toggleQuizMasterMutation.isPending}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        {p.isQuizMaster ? t('team.qmActive') : t('team.qm')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoveConfirmUserId(p.userId)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      {t('team.remove')}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Player pool */}
      {canManage && poolPlayers.length > 0 && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: '12px', color: 'var(--text-muted)' }}>
            {t('team.playerPoolCount', { count: poolPlayers.length })}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {poolPlayers.map((p: CompetitionPlayer) => (
              <Card key={p.userId} padding="12px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                      {p.user.displayName ?? p.user.username}
                    </p>
                    {p.user?.isDummy && (
                      <Badge style={{ fontSize: '11px', background: 'var(--border-light)', color: 'var(--text-muted)' }}>{t('team.guest')}</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => addPlayerMutation.mutate(p.userId)}
                    loading={addPlayerMutation.isPending}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    {t('team.addToTeam')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Rename modal */}
      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t('team.renameTeam')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => renameMutation.mutate()} loading={renameMutation.isPending}>{t('common.save')}</Button>
          </>
        }
      >
        <Input
          label={t('team.teamName')}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* Create user modal */}
      <Modal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title={t('team.createUserTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateUserOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => createUserMutation.mutate()}
              loading={createUserMutation.isPending}
              disabled={!createName.trim() || !createUsername.trim()}
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label={t('team.playerName')}
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            autoFocus
            placeholder={t('team.enterName')}
          />
          <Input
            label={t('team.username')}
            value={createUsername}
            onChange={e => setCreateUsername(e.target.value)}
            placeholder={t('team.enterUsername')}
          />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
          {t('team.createUserDescription')}
        </p>
        {createUserMutation.isError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
            {(createUserMutation.error as any)?.message ?? t('team.createUserFailed')}
          </p>
        )}
      </Modal>

      {/* Convert guest to real user modal */}
      <Modal
        open={convertOpen}
        onClose={() => { setConvertOpen(false); setConvertingDummy(null) }}
        title={t('team.convertTitle', { name: convertingDummy?.user?.displayName ?? 'Guest' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setConvertOpen(false); setConvertingDummy(null) }}>{t('common.cancel')}</Button>
            <Button
              onClick={() => convertMutation.mutate()}
              loading={convertMutation.isPending}
              disabled={!selectedRealUserId}
            >
              {t('team.convert')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', fontFamily: 'var(--font-ui)' }}>
          {t('team.convertDescription')}
        </p>
        {realCandidates.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: '16px 0' }}>
            {t('team.noRegisteredPlayers')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {realCandidates.map((p: CompetitionPlayer) => (
              <div
                key={p.userId}
                onClick={() => setSelectedRealUserId(p.userId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${selectedRealUserId === p.userId ? 'var(--accent)' : 'var(--border-light)'}`,
                  cursor: 'pointer',
                  background: selectedRealUserId === p.userId ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={32} />
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '14px' }}>
                  {p.user.displayName ?? p.user.username}
                </span>
              </div>
            ))}
          </div>
        )}
        {convertMutation.isError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
            {(convertMutation.error as any)?.message ?? t('team.conversionFailed')}
          </p>
        )}
      </Modal>

      {/* Remove / leave confirmation modal */}
      {(() => {
        const pending = teamPlayers.find((p: CompetitionPlayer) => p.userId === removeConfirmUserId)
        const isSelf = removeConfirmUserId === user?.id
        const name = pending?.user?.displayName ?? pending?.user?.username ?? 'this player'
        return (
          <Modal
            open={!!removeConfirmUserId}
            onClose={() => setRemoveConfirmUserId(null)}
            title={isSelf ? t('team.leaveTeamTitle') : t('team.removePlayerTitle', { name })}
            footer={
              <>
                <Button variant="ghost" onClick={() => setRemoveConfirmUserId(null)}>{t('common.cancel')}</Button>
                <Button
                  onClick={() => { removePlayerMutation.mutate(removeConfirmUserId!); setRemoveConfirmUserId(null) }}
                  loading={removePlayerMutation.isPending}
                >
                  {isSelf ? t('team.leave') : t('team.remove')}
                </Button>
              </>
            }
          >
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {isSelf
                ? t('team.areYouSureLeave')
                : t('team.areYouSureRemove', { name })}
            </p>
          </Modal>
        )
      })()}
    </Layout>
  )
}
