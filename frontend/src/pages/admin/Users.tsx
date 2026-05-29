import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { RoleBadge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'

export function AdminUsers() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [editUser, setEditUser] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [deleteError, setDeleteError] = useState('')
  const [form, setForm] = useState({ globalRole: '', password: '', displayName: '' })

  // Add-to-competition state
  const [addCompUser, setAddCompUser] = useState<any>(null)
  const [addCompId, setAddCompId] = useState('')
  const [addCompError, setAddCompError] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.users.list() })

  const { data: compsData } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
    enabled: !!addCompUser,
  })

  const updateMutation = useMutation({
    mutationFn: () => api.users.update(editUser.id, {
      globalRole: form.globalRole || undefined,
      password: form.password || undefined,
      displayName: form.displayName || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditUser(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteConfirm(null) },
    onError: (err: any) => setDeleteError(err.message ?? 'Delete failed'),
  })

  const addToCompMutation = useMutation({
    mutationFn: () => api.competitions.addPlayer(addCompId, { userId: addCompUser.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', addCompId] })
      setAddCompUser(null)
      setAddCompId('')
      setAddCompError('')
    },
    onError: (err: any) => setAddCompError(err.message ?? 'Failed to add player'),
  })

  const openEdit = (u: any) => {
    setEditUser(u)
    setForm({ globalRole: u.globalRole, password: '', displayName: u.displayName ?? '' })
  }

  const openAddComp = (u: any) => {
    setAddCompUser(u)
    setAddCompId('')
    setAddCompError('')
  }

  return (
    <AdminLayout title="Users">
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
        {data?.users?.length ?? 0} users
      </p>

      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data?.users?.map((u: any) => (
            <Card key={u.id} padding="12px">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar src={u.profileImageUrl} name={u.displayName ?? u.username} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                      {u.displayName ?? u.username}
                    </p>
                    <RoleBadge role={u.globalRole} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button size="sm" variant="ghost" style={{ fontSize: '11px' }} onClick={() => openAddComp(u)}>+ Comp</Button>
                  <Button size="sm" variant="ghost" style={{ fontSize: '11px' }} onClick={() => openEdit(u)}>Edit</Button>
                  {u.id !== me?.id && (
                    <Button size="sm" variant="danger" style={{ fontSize: '11px' }}
                      onClick={() => setDeleteConfirm(u)}>
                      ×
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add to competition modal */}
      <Modal
        open={!!addCompUser}
        onClose={() => { setAddCompUser(null); setAddCompId(''); setAddCompError('') }}
        title={`Add ${addCompUser?.displayName ?? addCompUser?.username ?? ''} to competition`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAddCompUser(null); setAddCompId(''); setAddCompError('') }}>Cancel</Button>
            <Button
              onClick={() => addToCompMutation.mutate()}
              disabled={!addCompId}
              loading={addToCompMutation.isPending}
            >
              Add
            </Button>
          </>
        }
      >
        {!compsData ? <LoadingSpinner /> : compsData.competitions?.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No competitions found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {compsData.competitions.map((c: any) => (
              <div
                key={c.id}
                onClick={() => { setAddCompId(c.id); setAddCompError('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${addCompId === c.id ? 'var(--accent)' : 'var(--border-light)'}`,
                  cursor: 'pointer',
                  background: addCompId === c.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{c.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.status}</p>
                </div>
                {addCompId === c.id && (
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                )}
              </div>
            ))}
          </div>
        )}
        {addCompError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
            {addCompError}
          </p>
        )}
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setDeleteError('') }}
        title="Delete User"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeleteConfirm(null); setDeleteError('') }}>Cancel</Button>
            <Button variant="danger" onClick={() => { setDeleteError(''); deleteMutation.mutate(deleteConfirm.id) }} loading={deleteMutation.isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '15px' }}>Delete <strong>{deleteConfirm?.displayName ?? deleteConfirm?.username}</strong>?</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>This cannot be undone. Their scores will be removed.</p>
        {deleteError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
            {deleteError}
          </p>
        )}
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit: ${editUser?.username}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>Save</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Display name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>Role</label>
            <select value={form.globalRole} onChange={e => setForm(f => ({ ...f, globalRole: e.target.value }))}
              style={{ padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '15px' }}>
              <option value="PLAYER">Player</option>
              <option value="SCOREKEEPER">Scorekeeper</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Input label="New password (leave blank to keep current)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
      </Modal>
    </AdminLayout>
  )
}
