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
    defaultTeamScoreMode: 'average_score' as TeamScoreMode,
    bestNPlayers: '', isGlobalTemplate: true,
    shotsPerTeam: '20', minShotsPerPlayer: '3', maxScorePerShot: '10', shootingLowerIsBetter: false,
    valueUnit: 'pts', allowDecimals: false, attemptsPerPlayer: '', sumAllAttempts: false, useTeamScoreMode: false,
  })

  const SCORE_TYPES: [ScoreType, string][] = [
    ['number_highest_wins', t('scoreTypes.number_highest_wins')],
    ['number_lowest_wins', t('scoreTypes.number_lowest_wins')],
    ['time_fastest_wins', t('scoreTypes.time_fastest_wins')],
    ['manual_points', t('scoreTypes.manual_points')],
    ['shooting', t('scoreTypes.shooting')],
    ['least_time_difference', t('scoreTypes.least_time_difference')],
  ]

  const isShooting = form.scoreType === 'shooting'
  const isTimeDiff = form.scoreType === 'least_time_difference'

  const TEAM_MODE_OPTIONS: { value: TeamScoreMode; label: string; desc: string }[] = [
    { value: 'average_score', label: t('admin.challenges.averageScore'), desc: t('admin.challenges.averageScoreDesc') },
    { value: 'sum_all_players', label: t('admin.challenges.sumAllPlayers'), desc: t('admin.challenges.sumAllPlayersDesc') },
    { value: 'best_n_players', label: t('admin.challenges.bestNPlayers'), desc: t('admin.challenges.bestNPlayersDesc') },
    { value: 'manual_team_score', label: t('admin.challenges.manualTeamScore'), desc: t('admin.challenges.manualTeamScoreDesc') },
  ]

  const { data, isLoading } = useQuery({ queryKey: ['challenges'], queryFn: () => api.challenges.list() })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', scoreType: 'number_highest_wins', defaultTeamScoreMode: 'average_score', bestNPlayers: '', isGlobalTemplate: true, shotsPerTeam: '20', minShotsPerPlayer: '3', maxScorePerShot: '10', shootingLowerIsBetter: false, valueUnit: 'pts', allowDecimals: false, attemptsPerPlayer: '', sumAllAttempts: false, useTeamScoreMode: false })
    setOpen(true)
  }

  const openEdit = (c: any) => {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', scoreType: c.scoreType, defaultTeamScoreMode: c.defaultTeamScoreMode, bestNPlayers: c.bestNPlayers?.toString() ?? '', isGlobalTemplate: c.isGlobalTemplate, shotsPerTeam: (c.shotsPerTeam ?? 20).toString(), minShotsPerPlayer: (c.minShotsPerPlayer ?? 3).toString(), maxScorePerShot: (c.maxScorePerShot ?? 10).toString(), shootingLowerIsBetter: !!c.shootingLowerIsBetter, valueUnit: c.valueUnit ?? 'pts', allowDecimals: !!c.allowDecimals, attemptsPerPlayer: c.attemptsPerPlayer != null ? String(c.attemptsPerPlayer) : '', sumAllAttempts: !!c.sumAllAttempts, useTeamScoreMode: !!c.useTeamScoreMode })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: any = { ...form, bestNPlayers: form.bestNPlayers ? parseInt(form.bestNPlayers) : undefined }
      if (form.scoreType === 'shooting') {
        data.shotsPerTeam = form.shotsPerTeam ? parseInt(form.shotsPerTeam) : 20
        data.minShotsPerPlayer = form.minShotsPerPlayer ? parseInt(form.minShotsPerPlayer) : 3
        data.maxScorePerShot = form.maxScorePerShot !== '' ? parseInt(form.maxScorePerShot) : 0
        data.shootingLowerIsBetter = form.shootingLowerIsBetter
        data.valueUnit = form.valueUnit?.trim() || 'pts'
        data.allowDecimals = form.allowDecimals
        data.attemptsPerPlayer = form.attemptsPerPlayer ? parseInt(form.attemptsPerPlayer) : null
        data.sumAllAttempts = form.sumAllAttempts
        data.useTeamScoreMode = form.useTeamScoreMode
      } else {
        delete data.shotsPerTeam; delete data.minShotsPerPlayer; delete data.maxScorePerShot; delete data.shootingLowerIsBetter
        delete data.valueUnit; delete data.allowDecimals; delete data.attemptsPerPlayer; delete data.sumAllAttempts; delete data.useTeamScoreMode
      }
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

  // Presets pre-fill the granular Attempts settings; every field stays editable
  // afterwards, so the admin can also build a fully custom challenge.
  const applyPreset = (kind: 'shooting' | 'spike') => {
    if (kind === 'shooting') {
      setForm(f => ({ ...f, valueUnit: 'pts', allowDecimals: false, attemptsPerPlayer: '', sumAllAttempts: false, useTeamScoreMode: false, shotsPerTeam: '20', minShotsPerPlayer: '3', maxScorePerShot: '10' }))
    } else {
      setForm(f => ({ ...f, valueUnit: 'cm', allowDecimals: true, attemptsPerPlayer: '3', sumAllAttempts: true, useTeamScoreMode: true, defaultTeamScoreMode: 'average_score', maxScorePerShot: '' }))
    }
  }

  // Which preset (if any) the current settings match, for the indicator.
  const activePreset =
    !form.allowDecimals && !form.sumAllAttempts && !form.useTeamScoreMode && form.attemptsPerPlayer === '' && form.valueUnit === 'pts' ? 'shooting'
    : form.allowDecimals && form.sumAllAttempts && form.useTeamScoreMode && form.attemptsPerPlayer !== '' ? 'spike'
    : 'custom'

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
    border: active ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
    background: active ? 'var(--surface)' : 'var(--background)', width: '100%',
  })

  return (
    <AdminLayout title={t('admin.challenges.title')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('admin.challenges.count', { count: data?.challenges?.filter((c: any) => !c.isQuiz).length ?? 0 })}</p>
        <Button size="sm" onClick={openCreate}>{t('admin.challenges.newChallenge')}</Button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data?.challenges?.filter((c: any) => !c.isQuiz).map((c: any) => (
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
          {isShooting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Presets: one tap pre-fills the settings below; all fields stay editable. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.preset')}</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {([
                    { key: 'shooting', label: t('admin.challenges.presetShooting'), onClick: () => applyPreset('shooting') },
                    { key: 'spike', label: t('admin.challenges.presetSpike'), onClick: () => applyPreset('spike') },
                    { key: 'custom', label: t('admin.challenges.presetCustom'), onClick: undefined },
                  ] as const).map(p => (
                    <button key={p.key} type="button" disabled={!p.onClick} onClick={p.onClick}
                      style={{ ...toggleBtnStyle(activePreset === p.key), flex: 1, textAlign: 'center', cursor: p.onClick ? 'pointer' : 'default', opacity: p.onClick ? 1 : (activePreset === 'custom' ? 1 : 0.6) }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{p.label}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('admin.challenges.presetHint')}</p>
              </div>

              <Input label={t('admin.challenges.valueUnit')} value={form.valueUnit} onChange={set('valueUnit')} placeholder="pts" />

              {/* Integer vs decimal entry */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.valueFormat')}</label>
                {[
                  { value: false, label: t('admin.challenges.formatInteger'), desc: t('admin.challenges.formatIntegerDesc') },
                  { value: true, label: t('admin.challenges.formatDecimal'), desc: t('admin.challenges.formatDecimalDesc') },
                ].map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => setForm(f => ({ ...f, allowDecimals: opt.value }))} style={toggleBtnStyle(form.allowDecimals === opt.value)}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{opt.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>

              <Input label={t('admin.challenges.attemptsPerPlayer')} type="number" value={form.attemptsPerPlayer} onChange={set('attemptsPerPlayer')} placeholder={t('admin.challenges.attemptsPerPlayerPlaceholder')} />
              <Input label={t('admin.challenges.maxScorePerShot')} type="number" value={form.maxScorePerShot} onChange={set('maxScorePerShot')} placeholder={t('admin.challenges.maxScorePerShotPlaceholder')} />

              {/* Individual aggregation: best-N vs sum-all */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.individualAgg')}</label>
                {[
                  { value: false, label: t('admin.challenges.aggBestN'), desc: t('admin.challenges.aggBestNDesc') },
                  { value: true, label: t('admin.challenges.aggSumAll'), desc: t('admin.challenges.aggSumAllDesc') },
                ].map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => setForm(f => ({ ...f, sumAllAttempts: opt.value }))} style={toggleBtnStyle(form.sumAllAttempts === opt.value)}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{opt.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
                  </button>
                ))}
                {!form.sumAllAttempts && (
                  <Input label={t('admin.challenges.minShotsPerPlayer')} type="number" value={form.minShotsPerPlayer} onChange={set('minShotsPerPlayer')} placeholder="3" />
                )}
              </div>

              {/* Team scoring: counted-shots cap vs team-score mode over player totals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.teamScoreCalc')}</label>
                {[
                  { value: false, label: t('admin.challenges.teamCountedShots'), desc: t('admin.challenges.teamCountedShotsDesc') },
                  { value: true, label: t('admin.challenges.teamPlayerTotals'), desc: t('admin.challenges.teamPlayerTotalsDesc') },
                ].map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => setForm(f => ({ ...f, useTeamScoreMode: opt.value }))} style={toggleBtnStyle(form.useTeamScoreMode === opt.value)}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{opt.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>

              {form.useTeamScoreMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {TEAM_MODE_OPTIONS.filter(o => o.value !== 'manual_team_score').map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, defaultTeamScoreMode: opt.value as TeamScoreMode }))} style={toggleBtnStyle(form.defaultTeamScoreMode === opt.value)}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{opt.label}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
                    </button>
                  ))}
                  {form.defaultTeamScoreMode === 'best_n_players' && (
                    <Input label={t('admin.challenges.topPlayersCount')} type="number" value={form.bestNPlayers} onChange={set('bestNPlayers')} placeholder={t('admin.challenges.topPlayersPlaceholder')} />
                  )}
                </div>
              ) : (
                <Input label={t('admin.challenges.shotsPerTeam')} type="number" value={form.shotsPerTeam} onChange={set('shotsPerTeam')} placeholder="20" />
              )}

              {/* Direction */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{t('admin.challenges.shootingDirection')}</label>
                {[
                  { value: false, label: t('admin.challenges.higherIsBetter'), desc: t('admin.challenges.higherIsBetterDesc') },
                  { value: true, label: t('admin.challenges.lowerIsBetter'), desc: t('admin.challenges.lowerIsBetterDesc') },
                ].map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => setForm(f => ({ ...f, shootingLowerIsBetter: opt.value }))} style={toggleBtnStyle(form.shootingLowerIsBetter === opt.value)}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{opt.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : isTimeDiff ? (
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              background: 'var(--surface)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
            }}>
              <span aria-hidden="true" style={{
                flexShrink: 0, width: '20px', height: '20px', borderRadius: '6px',
                background: 'var(--accent)', marginTop: '1px',
              }} />
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {t('admin.challenges.leastTimeDifferenceNote')}
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
