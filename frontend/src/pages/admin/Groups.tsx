import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'
import { useTranslation } from 'react-i18next'

export function AdminGroups() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [newGroupName, setNewGroupName] = useState('')
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [createError, setCreateError] = useState('')

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => api.groups.list(),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
  })

  const { data: membersData } = useQuery({
    queryKey: ['group-members', expandedGroupId],
    queryFn: () => api.groups.members(expandedGroupId!),
    enabled: !!expandedGroupId,
  })

  const createMutation = useMutation({
    mutationFn: () => api.groups.create(newGroupName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-groups'] })
      setNewGroupName('')
      setCreateError('')
    },
    onError: (e: any) => setCreateError(e.message ?? 'Failed to create group'),
  })

  const addMeMutation = useMutation({
    mutationFn: (groupId: string) => api.groups.addMember(groupId, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-groups'] })
      qc.invalidateQueries({ queryKey: ['group-members', expandedGroupId] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => api.groups.addMember(groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', expandedGroupId] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => api.groups.removeMember(groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', expandedGroupId] })
    },
  })

  const groups: any[] = groupsData?.groups ?? []
  const allUsers: any[] = usersData?.users?.filter((u: any) => !u.isDummy) ?? []
  const members: any[] = membersData?.members ?? []
  const memberIds = new Set(members.map((m: any) => m.id))
  const nonMembers = allUsers.filter((u: any) => !memberIds.has(u.id))

  return (
    <AdminLayout title={t('admin.groups.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Create group */}
        <Card>
          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>{t('admin.groups.createGroup')}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <Input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder={t('admin.groups.groupNamePlaceholder')}
                onKeyDown={e => e.key === 'Enter' && newGroupName.trim() && createMutation.mutate()}
              />
            </div>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!newGroupName.trim()}>
              {t('admin.groups.create')}
            </Button>
          </div>
          {createError && <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '6px', fontFamily: 'var(--font-ui)' }}>{createError}</p>}
        </Card>

        {/* Group list */}
        {isLoading ? <LoadingSpinner /> : groups.map((g: any) => {
          const isExpanded = expandedGroupId === g.id

          return (
            <Card key={g.id} padding="0">
              <button
                style={{
                  width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                }}
                onClick={() => setExpandedGroupId(isExpanded ? null : g.id)}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{g.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('admin.groups.membersCount', { members: g._count?.members ?? 0, competitions: g._count?.competitions ?? 0 })}
                  </p>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-light)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Add me button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addMeMutation.mutate(g.id)}
                    loading={addMeMutation.isPending}
                  >
                    {t('admin.groups.addMeToGroup')}
                  </Button>

                  {/* Add other user */}
                  {nonMembers.length > 0 && (
                    <div>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>{t('admin.groups.addMember')}</p>
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) {
                            addMemberMutation.mutate({ groupId: g.id, userId: e.target.value })
                            e.target.value = ''
                          }
                        }}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '14px' }}
                      >
                        <option value="">{t('admin.groups.selectUser')}</option>
                        {nonMembers.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.displayName ?? u.username}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Member list */}
                  {members.length > 0 && (
                    <div>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>{t('admin.groups.members')}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {members.map((m: any) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={m.profileImageUrl} name={m.displayName ?? m.username} size={28} />
                            <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600 }}>
                              {m.displayName ?? m.username}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--accent-warm)' }}
                              onClick={() => removeMemberMutation.mutate({ groupId: g.id, userId: m.id })}
                              loading={removeMemberMutation.isPending}
                            >
                              {t('admin.groups.remove')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </AdminLayout>
  )
}
