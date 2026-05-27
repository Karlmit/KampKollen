import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', dateDisplay: '', teamCount: '3', scoringMode: 'placement_points', placementMaxPoints: '' })

  const { data: compsData, isLoading } = useQuery({ queryKey: ['competitions'], queryFn: () => api.competitions.list() })

  const createMutation = useMutation({
    mutationFn: () => {
      const iso = displayToIso(form.dateDisplay)
      return api.competitions.create({
        name: form.name,
        date: iso ? new Date(iso + 'T12:00:00').toISOString() : undefined,
        teamCount: parseInt(form.teamCount, 10),
        scoringMode: form.scoringMode,
        ...(form.placementMaxPoints ? { placementMaxPoints: parseInt(form.placementMaxPoints, 10) } : {}),
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competitions'] }); setCreateOpen(false); setForm({ name: '', dateDisplay: '', teamCount: '3', scoringMode: 'placement_points', placementMaxPoints: '' }) },
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
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setForm({ name: '', dateDisplay: '', teamCount: '3', scoringMode: 'placement_points', placementMaxPoints: '' }) }}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!form.name}>Create</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Competition name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input
            label="Date (optional)"
            type="text"
            inputMode="numeric"
            placeholder="DD-MM-YYYY"
            value={form.dateDisplay}
            onChange={e => setForm(f => ({ ...f, dateDisplay: maskDateInput(e.target.value) }))}
          />
          <Input label="Number of teams" type="number" min="1" max="20" value={form.teamCount} onChange={e => setForm(f => ({ ...f, teamCount: e.target.value }))} />
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
                Leave blank to auto-calculate (teams × 10 = {parseInt(form.teamCount, 10) * 10}). Enter a number to override — e.g. 30 with 4 teams gives 30, 20, 10, 0.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
