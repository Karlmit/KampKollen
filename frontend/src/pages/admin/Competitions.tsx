import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { formatDate } from '../../utils'

function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

function displayToIso(display: string): string {
  const m = display.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

export function AdminCompetitions() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', dateDisplay: '', competitionType: 'team' as 'team' | 'individual', teamCount: '3', scoringMode: 'placement_points', placementMaxPoints: '', tieBreakingMode: 'best_rank', groupId: '' })

  const { data: compsData, isLoading } = useQuery({ queryKey: ['competitions'], queryFn: () => api.competitions.list() })
  const { data: groupsData } = useQuery({ queryKey: ['my-groups'], queryFn: () => api.groups.list() })
  const myGroups: any[] = groupsData?.groups ?? []

  // Auto-select if only one group
  const effectiveGroupId = form.groupId || (myGroups.length === 1 ? myGroups[0].id : '')

  const createMutation = useMutation({
    mutationFn: () => {
      const iso = displayToIso(form.dateDisplay)
      return api.competitions.create({
        name: form.name,
        date: iso ? new Date(iso + 'T12:00:00').toISOString() : undefined,
        isTeamCompetition: form.competitionType === 'team',
        ...(form.competitionType === 'team' ? { teamCount: parseInt(form.teamCount, 10) } : {}),
        scoringMode: form.scoringMode,
        ...(form.scoringMode === 'placement_points' ? { tieBreakingMode: form.tieBreakingMode || null } : {}),
        ...(form.placementMaxPoints ? { placementMaxPoints: parseInt(form.placementMaxPoints, 10) } : {}),
        ...(effectiveGroupId ? { groupId: effectiveGroupId } : {}),
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competitions'] }); setCreateOpen(false); setForm({ name: '', dateDisplay: '', competitionType: 'team', teamCount: '3', scoringMode: 'placement_points', placementMaxPoints: '', tieBreakingMode: 'best_rank', groupId: '' }) },
  })

  return (
    <AdminLayout title="Competitions">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{compsData?.competitions?.length ?? 0} competitions</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>+ New Competition</Button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {compsData?.competitions?.map((c: any) => (
            <Card key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>{c.name}</p>
                  {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link to={`/admin/competitions/${c.id}`}>
                  <Button size="sm" variant="ghost">Manage →</Button>
                </Link>
                <Link to={`/competitions/${c.id}/leaderboard`}>
                  <Button size="sm" variant="ghost">Leaderboard</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Competition"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setForm({ name: '', dateDisplay: '', competitionType: 'team', teamCount: '3', scoringMode: 'placement_points', placementMaxPoints: '', tieBreakingMode: 'best_rank', groupId: '' }) }}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!form.name}>Create</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>Competition type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { value: 'team', label: '🛡️ Team', desc: 'Players compete in teams' },
                { value: 'individual', label: '👤 Individual', desc: 'Players compete directly' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, competitionType: opt.value }))}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                    border: form.competitionType === opt.value ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                    background: form.competitionType === opt.value ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--background)',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{opt.label}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <Input label="Competition name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input
            label="Date (optional)"
            type="text"
            inputMode="numeric"
            placeholder="DD-MM-YYYY"
            value={form.dateDisplay}
            onChange={e => setForm(f => ({ ...f, dateDisplay: maskDateInput(e.target.value) }))}
          />
          {form.competitionType === 'team' && (
            <Input label="Number of teams" type="number" min="1" max="20" value={form.teamCount} onChange={e => setForm(f => ({ ...f, teamCount: e.target.value }))} />
          )}
          {myGroups.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>Group *</label>
              <select
                value={form.groupId}
                onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '16px' }}
                required
              >
                <option value="">Select a group…</option>
                {myGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>Scoring mode</label>
            <select
              value={form.scoringMode}
              onChange={e => setForm(f => ({ ...f, scoringMode: e.target.value }))}
              style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '16px' }}
            >
              <option value="placement_points">Placement points — 1st gets N×10, 2nd (N-1)×10, …</option>
              <option value="raw_sum">Raw sum — add up actual scores across challenges</option>
            </select>
          </div>
          {form.scoringMode === 'placement_points' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>Tie-breaking mode</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { value: 'best_rank', label: 'Best Rank (Recommended)', desc: 'Tied for 1st → both get 1st-place points. Next distinct rank skips.' },
                    { value: 'average', label: 'Average', desc: 'Tied for 1st → both get the mean of 1st and 2nd place points.' },
                    { value: 'worst_rank', label: 'Worst Rank', desc: 'Tied for 1st → both get 2nd-place points.' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tieBreakingMode: opt.value }))}
                      style={{
                        padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                        border: form.tieBreakingMode === opt.value ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                        background: form.tieBreakingMode === opt.value ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--background)',
                      }}
                    >
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '1px' }}>{opt.label}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>
                  Max points per challenge
                </label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="10"
                  placeholder={`Leave blank = auto (${parseInt(form.teamCount, 10) * 10})`}
                  value={form.placementMaxPoints}
                  onChange={e => setForm(f => ({ ...f, placementMaxPoints: e.target.value }))}
                  style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '16px' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Leave blank to auto-calculate (teams × 10 = {parseInt(form.teamCount, 10) * 10}). Enter a number to override.
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
