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
import { Team, CompetitionPlayer } from '../types'

export function MyTeamPage() {
  const { competitionId, teamId } = useParams<{ competitionId: string; teamId: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const [renameOpen, setRenameOpen] = useState(false)
  const [newName, setNewName] = useState('')

  // Dummy player state
  const [addGuestOpen, setAddGuestOpen] = useState(false)
  const [guestName, setGuestName] = useState('')
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

  const addGuestMutation = useMutation({
    mutationFn: () => api.competitions.createDummyPlayer(competitionId!, { name: guestName.trim(), teamId: teamId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', competitionId] })
      setAddGuestOpen(false)
      setGuestName('')
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

  if (isLoading) return <Layout title="Team"><LoadingSpinner /></Layout>

  const comp = compData?.competition
  const team: Team = teamData?.team
  if (!comp || !team) return <Layout title="Team"><p>Not found</p></Layout>

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
          <Avatar src={team.imageUrl} name={team.name} size={80} style={{ borderRadius: '50%' }} />
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
              label="Team Image"
            shape="circle"
            />
            <Button variant="ghost" size="sm" onClick={() => { setNewName(team.name); setRenameOpen(true) }}>
              Rename Team
            </Button>
          </div>
        )}
      </div>

      {/* Players */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
            Players ({teamPlayers.length})
          </h2>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => { setGuestName(''); setAddGuestOpen(true) }} style={{ fontSize: '12px', padding: '4px 10px' }}>
              + Guest
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
                    {p.user?.isDummy && <Badge style={{ fontSize: '11px', background: 'var(--border-light)', color: 'var(--text-muted)' }}>Guest</Badge>}
                    {p.isTeamLeader && <Badge variant="info" style={{ fontSize: '11px' }}>Leader</Badge>}
                    {p.isScorekeeper && <Badge variant="success" style={{ fontSize: '11px' }}>Scorekeeper</Badge>}
                    {p.isQuizMaster && <Badge style={{ fontSize: '11px', background: 'var(--accent-orange)', color: '#fff' }}>🎯 QM</Badge>}
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
                      Convert
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoveConfirmUserId(p.userId)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Remove
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
                        {p.isQuizMaster ? '🎯 QM' : 'QM'}
                      </Button>
                    )}
                    {(isAdmin || !myPlayer?.isTeamLeader) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoveConfirmUserId(p.userId)}
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                      >
                        Leave
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
                        {p.isTeamLeader ? '⭐ Leader' : 'Leader'}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant={p.isScorekeeper ? 'success' : 'ghost'}
                        onClick={() => toggleScorekeeperMutation.mutate({ userId: p.userId, isScorekeeper: !p.isScorekeeper })}
                        loading={toggleScorekeeperMutation.isPending}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        Scorekeeper
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
                        {p.isQuizMaster ? '🎯 QM' : 'QM'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoveConfirmUserId(p.userId)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Remove
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
            Player Pool ({poolPlayers.length})
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
                      <Badge style={{ fontSize: '11px', background: 'var(--border-light)', color: 'var(--text-muted)' }}>Guest</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => addPlayerMutation.mutate(p.userId)}
                    loading={addPlayerMutation.isPending}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    Add to team
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
        title="Rename Team"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => renameMutation.mutate()} loading={renameMutation.isPending}>Save</Button>
          </>
        }
      >
        <Input
          label="Team name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* Add guest player modal */}
      <Modal
        open={addGuestOpen}
        onClose={() => setAddGuestOpen(false)}
        title="Add Guest Player"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddGuestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addGuestMutation.mutate()}
              loading={addGuestMutation.isPending}
              disabled={!guestName.trim()}
            >
              Add
            </Button>
          </>
        }
      >
        <Input
          label="Player name"
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          autoFocus
          placeholder="Enter name..."
        />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
          Guest players don't need an account. You can convert them to a registered user later.
        </p>
      </Modal>

      {/* Convert guest to real user modal */}
      <Modal
        open={convertOpen}
        onClose={() => { setConvertOpen(false); setConvertingDummy(null) }}
        title={`Convert "${convertingDummy?.user?.displayName ?? 'Guest'}"`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setConvertOpen(false); setConvertingDummy(null) }}>Cancel</Button>
            <Button
              onClick={() => convertMutation.mutate()}
              loading={convertMutation.isPending}
              disabled={!selectedRealUserId}
            >
              Convert
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', fontFamily: 'var(--font-ui)' }}>
          Select the registered player to replace this guest. The guest's scores will transfer to the selected player. Any existing scores the selected player already has in this competition will be overwritten.
        </p>
        {realCandidates.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: '16px 0' }}>
            No registered players to convert to.
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
            {(convertMutation.error as any)?.message ?? 'Conversion failed'}
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
            title={isSelf ? 'Leave team?' : `Remove ${name}?`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setRemoveConfirmUserId(null)}>Cancel</Button>
                <Button
                  onClick={() => { removePlayerMutation.mutate(removeConfirmUserId!); setRemoveConfirmUserId(null) }}
                  loading={removePlayerMutation.isPending}
                >
                  {isSelf ? 'Leave' : 'Remove'}
                </Button>
              </>
            }
          >
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {isSelf
                ? 'Are you sure you want to leave this team?'
                : `Are you sure you want to remove ${name} from the team?`}
            </p>
          </Modal>
        )
      })()}
    </Layout>
  )
}
