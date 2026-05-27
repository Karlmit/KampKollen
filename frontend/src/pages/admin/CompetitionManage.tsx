import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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

type Tab = 'players' | 'teams' | 'challenges' | 'status'

function SortableChallenge({ cc, index, onRemove }: { cc: any; index: number; onRemove: (cc: any) => void }) {
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
            Remove
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function AdminCompetitionManage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('players')

  // Modal state
  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  const [addChallengeOpen, setAddChallengeOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedChallengeId, setSelectedChallengeId] = useState('')

  const [assignTeamPlayer, setAssignTeamPlayer] = useState<any>(null)
  const [renamingTeam, setRenamingTeam] = useState<any>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [imageTeam, setImageTeam] = useState<any>(null)
  const [removingChallenge, setRemovingChallenge] = useState<any>(null)
  const [localChallenges, setLocalChallenges] = useState<any[]>([])

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

  const reorderMutation = useMutation({
    mutationFn: (order: string[]) => api.competitions.reorderChallenges(id!, order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const renameTeamMutation = useMutation({
    mutationFn: () => api.teams.update(renamingTeam.id, { name: newTeamName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competition', id] }); setRenamingTeam(null) },
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

  if (isLoading) return <AdminLayout title="Manage Competition"><LoadingSpinner /></AdminLayout>
  const comp = compData?.competition
  if (!comp) return <AdminLayout title="Competition"><p>Not found</p></AdminLayout>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'players', label: `Players (${comp.players?.length ?? 0})` },
    { key: 'teams', label: `Teams (${comp.teams?.length ?? 0})` },
    { key: 'challenges', label: `Challenges (${comp.challenges?.length ?? 0})` },
    { key: 'status', label: 'Settings' },
  ]

  const availableUsers = usersData?.users?.filter((u: any) =>
    !comp.players?.some((p: any) => p.userId === u.id)
  ) ?? []

  const availableChallenges = challengesData?.challenges?.filter((c: any) =>
    !comp.challenges?.some((cc: any) => cc.challengeId === c.id)
  ) ?? []

  return (
    <AdminLayout title={comp.name}>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
        {comp.date ? formatDate(comp.date) + ' · ' : ''}<StatusBadge status={comp.status} />
      </p>

      {/* Tabs */}
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={key => setTab(key as Tab)}
        style={{ marginBottom: '16px' }}
      />

      {/* Players tab */}
      {tab === 'players' && (
        <>
          <Button size="sm" onClick={() => setAddPlayerOpen(true)} style={{ marginBottom: '12px' }}>+ Add Player</Button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {comp.players?.map((p: any) => (
              <Card key={p.userId} padding="10px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={32} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{p.user.displayName ?? p.user.username}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {p.team?.name ?? 'Player Pool'}
                      {p.isTeamLeader ? ' · Leader' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="ghost" style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => setAssignTeamPlayer(p)}>
                      Team
                    </Button>
                    <Button
                      size="sm"
                      variant={p.isTeamLeader ? 'success' : 'ghost'}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      loading={toggleLeaderMutation.isPending}
                      onClick={() => toggleLeaderMutation.mutate({ userId: p.userId, isTeamLeader: !p.isTeamLeader })}
                    >
                      {p.isTeamLeader ? '⭐ Leader' : 'Leader'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comp.teams?.map((team: any) => (
            <Card key={team.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Avatar src={team.imageUrl} name={team.name} size={44} style={{ borderRadius: 'var(--radius-sm)' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{team.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {comp.players?.filter((p: any) => p.teamId === team.id).length ?? 0} players
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button size="sm" variant="ghost" style={{ fontSize: '12px' }}
                  onClick={() => { setRenamingTeam(team); setNewTeamName(team.name) }}>
                  Rename
                </Button>
                <Button size="sm" variant="ghost" style={{ fontSize: '12px' }}
                  onClick={() => setImageTeam(team)}>
                  ✨ Image
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Challenges tab */}
      {tab === 'challenges' && (
        <>
          <Button size="sm" onClick={() => setAddChallengeOpen(true)} style={{ marginBottom: '12px' }}>+ Add Challenge</Button>
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
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>STATUS</p>
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
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>SCORING MODE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { value: 'placement_points', label: 'Placement points', desc: '1st gets N×10 pts, 2nd (N-1)×10, … normalized per challenge' },
                { value: 'raw_sum', label: 'Raw sum', desc: 'Add up actual scores across all challenges' },
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
        </div>
      )}

      {/* Add Player modal */}
      <Modal open={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} title="Add Player"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddPlayerOpen(false)}>Cancel</Button>
            <Button onClick={() => addPlayerMutation.mutate()} disabled={!selectedUserId} loading={addPlayerMutation.isPending}>Add</Button>
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
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>All users are already in this competition</p>
          )}
        </div>
      </Modal>

      {/* Assign team modal */}
      <Modal open={!!assignTeamPlayer} onClose={() => setAssignTeamPlayer(null)}
        title={`Assign ${assignTeamPlayer?.user?.displayName ?? assignTeamPlayer?.user?.username ?? ''}`}
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
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>Player Pool</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not assigned to a team</p>
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
              <Avatar src={team.imageUrl} name={team.name} size={36} style={{ borderRadius: 'var(--radius-sm)' }} />
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{team.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {comp.players?.filter((p: any) => p.teamId === team.id).length ?? 0} players
                </p>
              </div>
              {assignTeamPlayer?.teamId === team.id && (
                <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Rename team modal */}
      <Modal open={!!renamingTeam} onClose={() => setRenamingTeam(null)} title="Rename Team"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenamingTeam(null)}>Cancel</Button>
            <Button onClick={() => renameTeamMutation.mutate()} disabled={!newTeamName.trim()} loading={renameTeamMutation.isPending}>Save</Button>
          </>
        }
      >
        <Input label="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} autoFocus />
      </Modal>

      {/* Team image modal */}
      <Modal open={!!imageTeam} onClose={() => setImageTeam(null)} title={imageTeam ? `Image for ${imageTeam.name}` : ''}>
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
      <Modal open={!!removingChallenge} onClose={() => setRemovingChallenge(null)} title="Remove Challenge"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemovingChallenge(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => removeChallengeMutation.mutate(removingChallenge.challengeId)} loading={removeChallengeMutation.isPending}>
              Remove
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '15px' }}>
          Remove <strong>{removingChallenge?.challenge?.name}</strong> from this competition?
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Scores for this challenge will also be deleted.</p>
      </Modal>

      {/* Add challenge modal */}
      <Modal open={addChallengeOpen} onClose={() => setAddChallengeOpen(false)} title="Add Challenge"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddChallengeOpen(false)}>Cancel</Button>
            <Button onClick={() => addChallengeMutation.mutate()} disabled={!selectedChallengeId} loading={addChallengeMutation.isPending}>Add</Button>
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
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>All challenges have been added</p>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
