import { useState } from 'react'
import { useParams } from 'react-router-dom'
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

  const removePlayerMutation = useMutation({
    mutationFn: (userId: string) => api.teams.removePlayer(teamId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', competitionId] })
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      setRemoveError(null)
    },
    onError: (err: any) => setRemoveError(err.message ?? 'Failed to remove player'),
  })

  if (isLoading) return <Layout title="Team"><LoadingSpinner /></Layout>

  const comp = compData?.competition
  const team: Team = teamData?.team
  if (!comp || !team) return <Layout title="Team"><p>Not found</p></Layout>

  const teamPlayers = comp.players?.filter((p: CompetitionPlayer) => p.teamId === team.id) ?? []
  const poolPlayers = comp.players?.filter((p: CompetitionPlayer) => !p.teamId) ?? []

  const myPlayer = comp.players?.find((p: CompetitionPlayer) => p.userId === user?.id)
  const canManage = isAdmin || myPlayer?.isTeamLeader || team.leaderUserId === user?.id

  return (
    <Layout
      title={team.name}
      back={`/competitions/${competitionId}`}
      action={canManage ? (
        <Button size="sm" variant="ghost" onClick={() => { setNewName(team.name); setRenameOpen(true) }}>
          Rename
        </Button>
      ) : null}
    >
      {/* Team image */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <Avatar src={team.imageUrl} name={team.name} size={80} style={{ borderRadius: 'var(--radius)' }} />
        {canManage && (
          <ImageGenerator
            defaultPrompt={`Create a fun mascot/logo for a 5-kamp team called "${team.name}". Playful, bold, colorful, suitable as a round team profile image.`}
            currentImageUrl={team.imageUrl}
            onGenerate={async (prompt) => {
              const res = await api.teams.generateImage(team.id, prompt)
              qc.invalidateQueries({ queryKey: ['team', teamId] })
              return res.imageUrl
            }}
            label="Team Image"
          />
        )}
      </div>

      {/* Players */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: '12px' }}>
          Players ({teamPlayers.length})
        </h2>
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
                    {p.user.displayName ?? p.user.username}
                  </p>
                  {p.isTeamLeader && <Badge variant="info" style={{ fontSize: '11px' }}>Leader</Badge>}
                </div>
                {canManage && p.userId !== user?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePlayerMutation.mutate(p.userId)}
                    loading={removePlayerMutation.isPending}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    Remove
                  </Button>
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
    </Layout>
  )
}
