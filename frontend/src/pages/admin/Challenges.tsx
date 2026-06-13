import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { ImageGenerator } from '../../components/ImageGenerator'
import { ScoreType, TeamScoreMode } from '../../types'
import { useTranslation } from 'react-i18next'

export function AdminChallenges() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [imageChallenge, setImageChallenge] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [form, setForm] = useState({
    name: '', description: '', scoreType: 'number_highest_wins' as ScoreType,
    defaultTeamScoreMode: 'sum_all_players' as TeamScoreMode,
    bestNPlayers: '', isGlobalTemplate: true,
  })

  const SCORE_TYPES: [ScoreType, string][] = [
    ['number_highest_wins', t('scoreTypes.number_highest_wins')],
    ['number_lowest_wins', t('scoreTypes.number_lowest_wins')],
    ['time_fastest_wins', t('scoreTypes.time_fastest_wins')],
    ['manual_points', t('scoreTypes.manual_points')],
  ]

  const TEAM_MODE_OPTIONS: { value: TeamScoreMode; label: string; desc: string }[] = [
    { value: 'sum_all_players', label: t('admin.challenges.sumAllPlayers'), desc: t('admin.challenges.sumAllPlayersDesc') },
    { value: 'best_n_players', label: t('admin.challenges.bestNPlayers'), desc: t('admin.challenges.bestNPlayersDesc') },
    { value: 'average_score', label: t('admin.challenges.averageScore'), desc: t('admin.challenges.averageScoreDesc') },
    { value: 'manual_team_score', label: t('admin.challenges.manualTeamScore'), desc: t('admin.challenges.manualTeamScoreDesc') },
  ]

  const { data, isLoading } = useQuery({ queryKey: ['challenges'], queryFn: () => api.challenges.list() })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', scoreType: 'number_highest_wins', defaultTeamScoreMode: 'sum_all_players', bestNPlayers: '', isGlobalTemplate: true })
    setOpen(true)
  }

  const openEdit = (c: any) => {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', scoreType: c.scoreType, defaultTeamScoreMode: c.defaultTeamScoreMode, bestNPlayers: c.bestNPlayers?.toString() ?? '', isGlobalTemplate: c.isGlobalTemplate })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: any = { ...form, bestNPlayers: form.bestNPlayers ? parseInt(form.bestNPlayers) : undefined }
      return editing ? api.challenges.update(editing.id, data) : api.challenges.create(data)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['challenges'] }); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.challenges.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  })

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <AdminLayout title={t('admin.challenges.title')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('admin.challenges.count', { count: data?.challenges?.length ?? 0 })}</p>
        <Button size="sm" onClick={openCreate}>{t('admin.challenges.newChallenge')}</Button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data?.challenges?.map((c: any) => (
            <Card key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{c.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t(`scoreTypes.${c.scoreType}` as any)}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {c.isGlobalTemplate && <Badge variant="info">{t('admin.challenges.template')}</Badge>}
                  {c.isQuiz && <Badge variant="success">{t('admin.challenges.quiz', { count: c._count?.quizQuestions ?? 0 })}</Badge>}
                </div>
              </div>
              {c.description && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>{c.description}</p>}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Button size="sm" variant="ghost" style={{ fontSize: '12px' }} onClick={() => openEdit(c)}>{t('admin.challenges.edit')}</Button>
                {c.isQuiz && (
                  <Link to={`/admin/quiz/${c.id}`}>
                    <Button size="sm" variant="ghost" style={{ fontSize: '12px' }}>{t('admin.challenges.questions')}</Button>
                  </Link>
                )}
                <Button size="sm" variant="ghost" style={{ fontSize: '12px' }} onClick={() => setImageChallenge(c)}>{t('admin.challenges.image')}</Button>
                <Button size="sm" variant="danger" style={{ fontSize: '12px' }} onClick={() => setDeleteConfirm(c)}>{t('admin.challenges.delete')}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Challenge image modal */}
      <Modal open={!!imageChallenge} onClose={() => setImageChallenge(null)} title={imageChallenge ? t('admin.challenges.imageFor', { name: imageChallenge.name }) : ''}>
        {imageChallenge && (
          <ImageGenerator
            defaultPrompt={`An app icon for a sports challenge called "${imageChallenge.name}". Simple, bold, colorful icon style.`}
            currentImageUrl={imageChallenge.logoUrl}
            onGenerate={async (prompt) => {
              const res = await api.challenges.generateImage(imageChallenge.id, prompt)
              qc.invalidateQueries({ queryKey: ['challenges'] })
              setImageChallenge((c: any) => ({ ...c, logoUrl: res.imageUrl }))
              return res.imageUrl
            }}
            label="Challenge Image"
          />
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={t('admin.challenges.deleteChallenge')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => { deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm(null) }} loading={deleteMutation.isPending}>
              {t('admin.challenges.delete')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '15px' }}>{t('admin.challenges.deleteChallengeTitle', { name: deleteConfirm?.name })}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>{t('admin.challenges.deleteChallengeDesc')}</p>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('admin.challenges.editChallengeTitle') : t('admin.challenges.createChallenge')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.name}>{t('admin.challenges.save')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label={t('admin.challenges.name')} value={form.name} onChange={set('name')} autoFocus />
          <Input label={t('admin.challenges.description')} value={form.description} onChange={set('description')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.scoreType')}</label>
            <select value={form.scoreType} onChange={set('scoreType') as any}
              style={{ padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '15px' }}>
              {SCORE_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.teamScoreCalc')}</label>
            {TEAM_MODE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, defaultTeamScoreMode: opt.value as TeamScoreMode }))}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                  border: form.defaultTeamScoreMode === opt.value ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                  background: form.defaultTeamScoreMode === opt.value ? 'var(--surface)' : 'var(--background)',
                  width: '100%',
                }}
              >
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{opt.label}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
              </button>
            ))}
          </div>
          {form.defaultTeamScoreMode === 'best_n_players' && (
            <Input label={t('admin.challenges.topPlayersCount')} type="number" value={form.bestNPlayers} onChange={set('bestNPlayers')} placeholder={t('admin.challenges.topPlayersPlaceholder')} />
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
