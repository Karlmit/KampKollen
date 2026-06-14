import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ImageGenerator } from '../../components/ImageGenerator'
import { TabBar } from '../../components/ui/TabBar'
import { api } from '../../api/client'
import { formatDate } from '../../utils'
import { useTranslation } from 'react-i18next'

type Tab = 'players' | 'teams' | 'challenges' | 'status'

function SortableChallenge({ cc, index, onRemove }: { cc: any; index: number; onRemove: (cc: any) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cc.id })
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
    }}>
      <Card padding="10px">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', touchAction: 'none', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '0 4px', userSelect: 'none' }}
          >
            ⠿
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '20px' }}>
            {index + 1}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{cc.challenge.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cc.challenge.scoreType}</p>
          </div>
          <Button size="sm" variant="danger" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => onRemove(cc)}>
            {t('common.remove')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function AdminCompetitionManage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'players'
  const setTab = (key: Tab) => setSearchParams({ tab: key }, { replace: true })

  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  const [addChallengeOpen, setAddChallengeOpen] = useState(false)
  const [addQuizOpen, setAddQuizOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedChallengeId, setSelectedChallengeId] = useState('')
  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [newQuizName, setNewQuizName] = useState('')
  const [deletingQuizTemplate, setDeletingQuizTemplate] = useState<any>(null)
  const [deleteQuizTemplateError, setDeleteQuizTemplateError] = useState<string | null>(null)

  const [assignTeamPlayer, setAssignTeamPlayer] = useState<any>(null)
  const [renamingTeam, setRenamingTeam] = useState<any>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [addTeamOpen, setAddTeamOpen] = useState(false)
  const [addTeamName, setAddTeamName] = useState('')
  const [removingTeam, setRemovingTeam] = useState<any>(null)
  const [imageTeam, setImageTeam] = useState<any>(null)
  const [removingChallenge, setRemovingChallenge] = useState<any>(null)
  const [localChallenges, setLocalChallenges] = useState<any[]>([])
  const [maxPointsInput, setMaxPointsInput] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const { data: compData, isLoading } = useQuery({
    queryKey: ['competition', id],
    queryFn: () => api.competitions.get(id!),
    enabled: !!id,
  })

  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: () => api.users.list() })
  const { data: challengesData } = useQuery({ queryKey: ['challenges'], queryFn: () => api.challenges.list() })

  const addPlayerMutation = useMutation({
    mutationFn: () => api.competitions.addPlayer(id!, { userId: selectedUserId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setAddPlayerOpen(false); setSelectedUserId('') },
  })

  const removePlayerMutation = useMutation({
    mutationFn: (userId: string) => api.competitions.removePlayer(id!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const assignTeamMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string | null }) =>
      api.competitions.updatePlayer(id!, userId, { teamId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setAssignTeamPlayer(null) },
  })

  const toggleLeaderMutation = useMutation({
    mutationFn: ({ userId, isTeamLeader }: { userId: string; isTeamLeader: boolean }) =>
      api.competitions.updatePlayer(id!, userId, { isTeamLeader }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const addChallengeMutation = useMutation({
    mutationFn: () => api.competitions.addChallenge(id!, { challengeId: selectedChallengeId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setAddChallengeOpen(false); setSelectedChallengeId('') },
  })

  const removeChallengeMutation = useMutation({
    mutationFn: (challengeId: string) => api.competitions.removeChallenge(id!, challengeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setRemovingChallenge(null) },
  })

  const addQuizMutation = useMutation({
    mutationFn: (templateId: string) => api.competitions.addQuiz(id!, { templateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', id] })
      setAddQuizOpen(false)
      setSelectedQuizId('')
    },
  })

  const createQuizMutation = useMutation({
    mutationFn: (name: string) => api.competitions.addQuiz(id!, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] })
      qc.invalidateQueries({ queryKey: ['competition', id] })
      setAddQuizOpen(false)
      setNewQuizName('')
    },
  })

  const deleteQuizTemplateMutation = useMutation({
    mutationFn: (challengeId: string) => api.challenges.delete(challengeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] })
      setDeletingQuizTemplate(null)
      setDeleteQuizTemplateError(null)
      setAddQuizOpen(true)
    },
    onError: (err: any) => {
      setDeleteQuizTemplateError(err.message ?? 'Something went wrong')
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (order: string[]) => api.competitions.reorderChallenges(id!, order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const renameTeamMutation = useMutation({
    mutationFn: () => api.teams.update(renamingTeam.id, { name: newTeamName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setRenamingTeam(null) },
  })

  const addTeamMutation = useMutation({
    mutationFn: (name: string) => api.teams.create(id!, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setAddTeamOpen(false); setAddTeamName('') },
  })

  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.teams.delete(teamId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setRemovingTeam(null) },
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.competitions.update(id!, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const updateScoringModeMutation = useMutation({
    mutationFn: (scoringMode: string) => api.competitions.update(id!, { scoringMode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  useEffect(() => {
    if (compData?.competition?.challenges) {
      setLocalChallenges([...compData.competition.challenges].sort((a: any, b: any) => a.order - b.order))
    }
  }, [compData])

  useEffect(() => {
    if (compData?.competition) {
      setMaxPointsInput(compData.competition.placementMaxPoints != null ? String(compData.competition.placementMaxPoints) : '')
    }
  }, [compData?.competition?.id])

  const updateMaxPointsMutation = useMutation({
    mutationFn: (value: number | null) => api.competitions.update(id!, { placementMaxPoints: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const updateTieBreakingMutation = useMutation({
    mutationFn: (tieBreakingMode: string | null) => api.competitions.update(id!, { tieBreakingMode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const updateTypeMutation = useMutation({
    mutationFn: (isTeamCompetition: boolean) => api.competitions.update(id!, { isTeamCompetition }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalChallenges(prev => {
      const oldIndex = prev.findIndex(c => c.id === active.id)
      const newIndex = prev.findIndex(c => c.id === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      reorderMutation.mutate(next.map(c => c.id))
      return next
    })
  }

  if (isLoading) return <AdminLayout title={t('admin.manage.title')}><LoadingSpinner /></AdminLayout>
  const comp = compData?.competition
  if (!comp) return <AdminLayout title={t('admin.manage.title')}><p>{t('common.notFound')}</p></AdminLayout>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'players', label: t('admin.manage.players', { count: comp.players?.length ?? 0 }) },
    ...(comp.isTeamCompetition !== false ? [{ key: 'teams' as Tab, label: t('admin.manage.teams', { count: comp.teams?.length ?? 0 }) }] : []),
    { key: 'challenges', label: t('admin.manage.challenges', { count: comp.challenges?.length ?? 0 }) },
    { key: 'status', label: t('admin.manage.settings') },
  ]

  const availableUsers = usersData?.users?.filter((u: any) => {
    if (comp.players?.some((p: any) => p.userId === u.id)) return false
    if (u.isDummy) return false
    if (comp.groupId) {
      return u.groups?.some((ug: any) => ug.groupId === comp.groupId)
    }
    return true
  }) ?? []

  const availableChallenges = challengesData?.challenges?.filter((c: any) =>
    !c.isQuiz && !comp.challenges?.some((cc: any) => cc.challengeId === c.id)
  ) ?? []

  const allQuizTemplates = challengesData?.challenges?.filter((c: any) => c.isQuiz && c.isGlobalTemplate) ?? []

  const autoMaxPts = comp.isTeamCompetition !== false
    ? (comp.teams?.length ?? 0) * 10
    : (comp.players?.length ?? 0) * 10

  const currentMaxDesc = comp.placementMaxPoints != null
    ? t('admin.manage.currently', { value: `${comp.placementMaxPoints} ${t('common.pts')}` })
    : comp.isTeamCompetition !== false
      ? t('admin.manage.currently', { value: t('admin.manage.maxPointsAutoTeams', { teams: comp.teams?.length ?? 0, points: (comp.teams?.length ?? 0) * 10 }) })
      : t('admin.manage.currently', { value: t('admin.manage.maxPointsAutoPlayers', { players: comp.players?.length ?? 0, points: (comp.players?.length ?? 0) * 10 }) })

  return (
    <AdminLayout title={comp.name}>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
        {comp.date ? formatDate(comp.date) + ' · ' : ''}<StatusBadge status={comp.status} />
      </p>

      <TabBar
        tabs={tabs}
        active={tab}
        onChange={key => setTab(key as Tab)}
        style={{ marginBottom: '16px' }}
      />

      {/* Players tab */}
      {tab === 'players' && (
        <>
          <Button size="sm" onClick={() => setAddPlayerOpen(true)} style={{ marginBottom: '12px' }}>{t('admin.manage.addPlayer')}</Button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {comp.players?.map((p: any) => (
              <Card key={p.userId} padding="10px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={32} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{p.user.displayName ?? p.user.username}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {comp.isTeamCompetition !== false && (p.team?.name ?? t('admin.manage.playerPool'))}
                      {p.isTeamLeader ? (comp.isTeamCompetition !== false ? ` · ${t('admin.manage.leaderLabel')}` : t('admin.manage.leaderLabel')) : ''}
                      {p.isScorekeeper ? (p.isTeamLeader ? ` · ${t('admin.manage.scorekeeperLabel')}` : t('admin.manage.scorekeeperLabel')) : ''}
                      {p.isQuizMaster ? ' · QM' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {comp.isTeamCompetition !== false && (
                      <Button size="sm" variant="ghost" style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => setAssignTeamPlayer(p)}>
                        {t('admin.manage.team')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={p.isTeamLeader ? 'success' : 'ghost'}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      loading={toggleLeaderMutation.isPending}
                      onClick={() => toggleLeaderMutation.mutate({ userId: p.userId, isTeamLeader: !p.isTeamLeader })}
                    >
                      {p.isTeamLeader ? t('admin.manage.starLeader') : t('admin.manage.leaderLabel')}
                    </Button>
                    <Button
                      size="sm"
                      variant={p.isQuizMaster ? 'success' : 'ghost'}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => api.competitions.updatePlayer(id!, p.userId, { isQuizMaster: !p.isQuizMaster }).then(() => qc.invalidateQueries({ queryKey: ['competition', id] }))}
                    >
                      {p.isQuizMaster ? '🎯 QM' : 'QM'}
                    </Button>
                    <Button size="sm" variant="danger" style={{ fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => removePlayerMutation.mutate(p.userId)}>
                      ×
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Teams tab */}
      {tab === 'teams' && (
        <>
          <Button size="sm" style={{ marginBottom: '12px' }}
            onClick={() => { setAddTeamName(`Team ${(comp.teams?.length ?? 0) + 1}`); setAddTeamOpen(true) }}>
            {t('admin.manage.addTeam')}
          </Button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {comp.teams?.map((team: any) => (
              <Card key={team.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <Avatar src={team.imageUrl} name={team.name} size={44} style={{ borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{team.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {comp.players?.filter((p: any) => p.teamId === team.id).length ?? 0} {t('common.players')}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button size="sm" variant="ghost" style={{ fontSize: '12px' }}
                    onClick={() => { setRenamingTeam(team); setNewTeamName(team.name) }}>
                    {t('common.rename')}
                  </Button>
                  <Button size="sm" variant="ghost" style={{ fontSize: '12px' }}
                    onClick={() => setImageTeam(team)}>
                    {t('common.image')}
                  </Button>
                  <Button size="sm" variant="danger" style={{ fontSize: '12px', marginLeft: 'auto' }}
                    onClick={() => setRemovingTeam(team)}>
                    {t('common.remove')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Challenges tab */}
      {tab === 'challenges' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Button size="sm" onClick={() => setAddChallengeOpen(true)}>{t('admin.manage.addChallenge')}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddQuizOpen(true); setSelectedQuizId(''); setNewQuizName('') }}>{t('admin.manage.addQuiz')}</Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localChallenges.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {localChallenges.map((cc, i) => (
                  <SortableChallenge key={cc.id} cc={cc} index={i} onRemove={setRemovingChallenge} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Status / Settings tab */}
      {tab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>{t('admin.manage.status')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['DRAFT', 'REGISTRATION', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map(s => (
                <Button
                  key={s}
                  variant={comp.status === s ? 'primary' : 'ghost'}
                  onClick={() => updateStatusMutation.mutate(s)}
                  loading={updateStatusMutation.isPending}
                  fullWidth
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>{t('admin.manage.competitionType')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { value: true, label: t('admin.manage.teamType'), desc: t('admin.manage.teamTypeDesc') },
                { value: false, label: t('admin.manage.individualType'), desc: t('admin.manage.individualTypeDesc') },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => updateTypeMutation.mutate(opt.value)}
                  style={{
                    padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                    border: (comp.isTeamCompetition !== false) === opt.value ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                    background: (comp.isTeamCompetition !== false) === opt.value ? 'var(--surface)' : 'var(--background)',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{opt.label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>{t('admin.manage.scoringMode')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { value: 'placement_points', label: t('admin.manage.placementPoints'), desc: t('admin.manage.placementPointsDesc') },
                { value: 'raw_sum', label: t('admin.manage.rawSum'), desc: t('admin.manage.rawSumDesc') },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateScoringModeMutation.mutate(opt.value)}
                  style={{
                    padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                    border: comp.scoringMode === opt.value ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                    background: comp.scoringMode === opt.value ? 'var(--surface)' : 'var(--background)',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{opt.label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {comp.scoringMode === 'placement_points' && (
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>{t('admin.manage.tieBreaking')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {[
                  { value: 'best_rank', label: t('admin.manage.bestRank'), desc: t('admin.manage.bestRankDesc') },
                  { value: 'average', label: t('admin.manage.average'), desc: t('admin.manage.averageDesc') },
                  { value: 'worst_rank', label: t('admin.manage.worstRank'), desc: t('admin.manage.worstRankDesc') },
                  { value: null, label: t('admin.manage.legacyOff'), desc: t('admin.manage.legacyOffDesc') },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => updateTieBreakingMutation.mutate(opt.value)}
                    style={{
                      padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                      border: comp.tieBreakingMode === opt.value ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                      background: comp.tieBreakingMode === opt.value ? 'var(--surface)' : 'var(--background)',
                    }}
                  >
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{opt.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {comp.scoringMode === 'placement_points' && (
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>{t('admin.manage.maxPointsTitle')}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {currentMaxDesc}{' — '}{t('admin.manage.maxPointsOverride')}
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    step="10"
                    placeholder={t('admin.manage.leaveBlankAuto', { points: autoMaxPts })}
                    value={maxPointsInput}
                    onChange={e => setMaxPointsInput(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '16px' }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => updateMaxPointsMutation.mutate(maxPointsInput ? parseInt(maxPointsInput, 10) : null)}
                  loading={updateMaxPointsMutation.isPending}
                >
                  {t('admin.manage.save')}
                </Button>
                {comp.placementMaxPoints != null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setMaxPointsInput(''); updateMaxPointsMutation.mutate(null) }}
                  >
                    {t('admin.manage.reset')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Player modal */}
      <Modal open={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} title={t('admin.manage.addPlayerModal')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddPlayerOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addPlayerMutation.mutate()} disabled={!selectedUserId} loading={addPlayerMutation.isPending}>{t('common.add')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {availableUsers.map((u: any) => (
            <button key={u.id} onClick={() => setSelectedUserId(u.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                borderRadius: 'var(--radius)', border: selectedUserId === u.id ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                background: selectedUserId === u.id ? 'var(--surface)' : 'var(--background)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <Avatar src={u.profileImageUrl} name={u.displayName ?? u.username} size={32} />
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{u.displayName ?? u.username}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username}</p>
              </div>
            </button>
          ))}
          {availableUsers.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
              {comp.groupId ? t('admin.manage.allGroupMembersAdded') : t('admin.manage.allUsersAdded')}
            </p>
          )}
        </div>
      </Modal>

      {/* Assign team modal */}
      <Modal open={!!assignTeamPlayer} onClose={() => setAssignTeamPlayer(null)}
        title={t('admin.manage.assignTeam', { name: assignTeamPlayer?.user?.displayName ?? assignTeamPlayer?.user?.username ?? '' })}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => assignTeamMutation.mutate({ userId: assignTeamPlayer.userId, teamId: null })}
            style={{
              padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
              border: !assignTeamPlayer?.teamId ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
              background: !assignTeamPlayer?.teamId ? 'var(--surface)' : 'var(--background)',
              width: '100%',
            }}
          >
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{t('admin.manage.playerPool')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('admin.manage.notAssignedToTeam')}</p>
          </button>
          {comp.teams?.map((team: any) => (
            <button key={team.id}
              onClick={() => assignTeamMutation.mutate({ userId: assignTeamPlayer.userId, teamId: team.id })}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                border: assignTeamPlayer?.teamId === team.id ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                background: assignTeamPlayer?.teamId === team.id ? 'var(--surface)' : 'var(--background)',
                width: '100%',
              }}
            >
              <Avatar src={team.imageUrl} name={team.name} size={36} style={{ borderRadius: '50%' }} />
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{team.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {comp.players?.filter((p: any) => p.teamId === team.id).length ?? 0} {t('common.players')}
                </p>
              </div>
              {assignTeamPlayer?.teamId === team.id && (
                <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Add team modal */}
      <Modal open={addTeamOpen} onClose={() => setAddTeamOpen(false)} title={t('admin.manage.addTeamModal')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddTeamOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addTeamMutation.mutate(addTeamName.trim())} disabled={!addTeamName.trim()} loading={addTeamMutation.isPending}>{t('common.add')}</Button>
          </>
        }
      >
        <Input label={t('admin.manage.teamName')} value={addTeamName}
          onChange={e => setAddTeamName(e.target.value)}
          onKeyDown={(e: any) => { if (e.key === 'Enter' && addTeamName.trim()) addTeamMutation.mutate(addTeamName.trim()) }}
          autoFocus />
      </Modal>

      {/* Remove team confirm modal */}
      <Modal open={!!removingTeam} onClose={() => setRemovingTeam(null)} title={t('admin.manage.removeTeam')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemovingTeam(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => removeTeamMutation.mutate(removingTeam.id)} loading={removeTeamMutation.isPending}>
              {t('common.remove')}
            </Button>
          </>
        }
      >
        {(() => {
          const memberCount = removingTeam ? (comp.players?.filter((p: any) => p.teamId === removingTeam.id).length ?? 0) : 0
          return (
            <>
              <p style={{ fontSize: '15px' }}>
                {memberCount > 0
                  ? t('admin.manage.removeTeamConfirmWithPlayers', { name: removingTeam?.name, count: memberCount })
                  : t('admin.manage.removeTeamConfirm', { name: removingTeam?.name })}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>{t('admin.manage.removeTeamDesc')}</p>
            </>
          )
        })()}
      </Modal>

      {/* Rename team modal */}
      <Modal open={!!renamingTeam} onClose={() => setRenamingTeam(null)} title={t('admin.manage.renameTeam')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenamingTeam(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => renameTeamMutation.mutate()} disabled={!newTeamName.trim()} loading={renameTeamMutation.isPending}>{t('admin.manage.save')}</Button>
          </>
        }
      >
        <Input label={t('admin.manage.teamName')} value={newTeamName} onChange={e => setNewTeamName(e.target.value)} autoFocus />
      </Modal>

      {/* Team image modal */}
      <Modal open={!!imageTeam} onClose={() => setImageTeam(null)} title={imageTeam ? t('admin.challenges.imageFor', { name: imageTeam.name }) : ''}>
        {imageTeam && (
          <ImageGenerator
            defaultPrompt={`A fun mascot or logo for a sports team called "${imageTeam.name}". Bold, colorful, playful.`}
            currentImageUrl={imageTeam.imageUrl}
            onGenerate={async (prompt) => {
              const res = await api.teams.generateImage(imageTeam.id, prompt)
              qc.invalidateQueries({ queryKey: ['competition', id] })
              setImageTeam((t: any) => ({ ...t, imageUrl: res.imageUrl }))
              return res.imageUrl
            }}
            label="Team Image"
          />
        )}
      </Modal>

      {/* Remove challenge confirm modal */}
      <Modal open={!!removingChallenge} onClose={() => setRemovingChallenge(null)} title={t('admin.manage.removeChallenge')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemovingChallenge(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => removeChallengeMutation.mutate(removingChallenge.challengeId)} loading={removeChallengeMutation.isPending}>
              {t('common.remove')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '15px' }}>
          {t('admin.manage.removeChallengeConfirm', { name: removingChallenge?.challenge?.name })}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>{t('admin.manage.removeChallengeDesc')}</p>
      </Modal>

      {/* Add Quiz modal */}
      <Modal open={addQuizOpen} onClose={() => { setAddQuizOpen(false); setSelectedQuizId(''); setNewQuizName('') }} title={t('admin.manage.addQuizModal')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Existing quiz templates */}
          {allQuizTemplates.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                {t('admin.manage.quizTemplates').toUpperCase()}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allQuizTemplates.map((c: any) => {
                  const isSelected = selectedQuizId === c.id
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      border: isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                      background: isSelected ? 'var(--surface)' : 'var(--background)',
                    }}>
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>🎯</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {c._count?.quizQuestions ?? 0} {t('admin.manage.questions')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <Button
                          size="sm"
                          variant={isSelected ? 'primary' : 'ghost'}
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => setSelectedQuizId(isSelected ? '' : c.id)}
                        >
                          {isSelected ? '✓ ' + t('admin.manage.selected') : t('admin.manage.select')}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => { setAddQuizOpen(false); setDeletingQuizTemplate(c) }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {selectedQuizId && (
            <Button
              fullWidth
              onClick={() => addQuizMutation.mutate(selectedQuizId)}
              loading={addQuizMutation.isPending}
            >
              {t('admin.manage.addSelectedQuiz')}
            </Button>
          )}

          {/* Create new quiz template */}
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
              {t('admin.manage.createNewQuiz').toUpperCase()}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={newQuizName}
                onChange={e => setNewQuizName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newQuizName.trim()) createQuizMutation.mutate(newQuizName.trim()) }}
                placeholder={t('admin.manage.quizNamePlaceholder')}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '14px', fontFamily: 'var(--font-ui)' }}
              />
              <Button
                size="sm"
                disabled={!newQuizName.trim()}
                loading={createQuizMutation.isPending}
                onClick={() => createQuizMutation.mutate(newQuizName.trim())}
              >
                {t('admin.manage.createAndAdd')}
              </Button>
            </div>
          </div>

          {allQuizTemplates.length === 0 && !newQuizName && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '8px 0' }}>
              {t('admin.manage.noQuizTemplates')}
            </p>
          )}
        </div>
      </Modal>

      {/* Delete quiz template confirm modal */}
      <Modal
        open={!!deletingQuizTemplate}
        onClose={() => { setDeletingQuizTemplate(null); setDeleteQuizTemplateError(null); setAddQuizOpen(true) }}
        title={t('admin.manage.deleteQuizTemplate')}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeletingQuizTemplate(null); setDeleteQuizTemplateError(null); setAddQuizOpen(true) }}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => { setDeleteQuizTemplateError(null); deleteQuizTemplateMutation.mutate(deletingQuizTemplate.id) }}
              loading={deleteQuizTemplateMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '15px' }}>{t('admin.manage.deleteQuizTemplateConfirm', { name: deletingQuizTemplate?.name })}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>{t('admin.manage.deleteQuizTemplateDesc')}</p>
        {deleteQuizTemplateError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '10px', fontWeight: 600 }}>{deleteQuizTemplateError}</p>
        )}
      </Modal>

      {/* Add challenge modal */}
      <Modal open={addChallengeOpen} onClose={() => setAddChallengeOpen(false)} title={t('admin.manage.addChallengeModal')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddChallengeOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addChallengeMutation.mutate()} disabled={!selectedChallengeId} loading={addChallengeMutation.isPending}>{t('common.add')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {availableChallenges.map((c: any) => (
            <button key={c.id} onClick={() => setSelectedChallengeId(c.id)}
              style={{
                padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                border: selectedChallengeId === c.id ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                background: selectedChallengeId === c.id ? 'var(--surface)' : 'var(--background)',
                width: '100%',
              }}
            >
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{c.name}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.scoreType}</p>
            </button>
          ))}
          {availableChallenges.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>{t('admin.manage.allChallengesAdded')}</p>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
