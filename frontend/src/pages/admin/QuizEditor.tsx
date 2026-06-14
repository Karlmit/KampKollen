import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { IconButton } from '../../components/quiz/IconButton'
import { GenerateImageDialog } from '../../components/quiz/GenerateImageDialog'
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'

type GenTarget =
  | { kind: 'quiz' }
  | { kind: 'question'; id: string; seed: string }
  | { kind: 'option'; id: string; seed: string }

// Ghost "pill" button shared by the image actions (upload / generate).
const pillStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  height: 38, padding: '0 14px', borderRadius: 'var(--radius)',
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap',
  cursor: 'pointer', transition: 'opacity 150ms var(--ease-out), transform 120ms var(--ease-out)',
}

function OptionRow({ option, onUpdate, onDelete, onImageUpload, onImageRemove, onGenerate, generating }: {
  option: any
  onUpdate: (data: { text?: string; isCorrect?: boolean }) => void
  onDelete: () => void
  onImageUpload: (file: File) => void
  onImageRemove: () => void
  onGenerate: () => void
  generating: boolean
}) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
      borderRadius: 'var(--radius-sm)', background: option.isCorrect ? 'color-mix(in srgb, var(--accent-green) 9%, transparent)' : 'var(--background)',
      border: `1.5px solid ${option.isCorrect ? 'var(--accent-green)' : 'var(--border-light)'}`,
    }}>
      <button
        type="button"
        onClick={() => onUpdate({ isCorrect: !option.isCorrect })}
        title={t('admin.quizEditor.markCorrect')}
        style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          border: `2px solid ${option.isCorrect ? 'var(--accent-green)' : 'var(--border-light)'}`,
          background: option.isCorrect ? 'var(--accent-green)' : 'transparent',
          color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 150ms var(--ease-out), background-color 150ms var(--ease-out)',
        }}
      >
        {option.isCorrect ? '✓' : ''}
      </button>
      {option.imageUrl && (
        <span style={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
          <img src={option.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-light)', display: 'block' }} />
          <button type="button" title={t('admin.quizEditor.removeImage')} onClick={onImageRemove}
            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-warm)', color: '#fff', border: '2px solid var(--surface)', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            ×
          </button>
        </span>
      )}
      <input
        value={option.text}
        onChange={e => onUpdate({ text: e.target.value })}
        onBlur={e => onUpdate({ text: e.target.value })}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-primary)' }}
        placeholder={t('admin.quizEditor.answerPlaceholder')}
      />
      <label
        title={t('admin.quizEditor.uploadImage')}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0, color: 'var(--text-muted)', fontSize: '15px', cursor: 'pointer' }}>
        🖼
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]) }} />
      </label>
      <IconButton size="sm" title={t('admin.quizEditor.generateAnswerImage')} disabled={generating} onClick={onGenerate}>✨</IconButton>
      <IconButton size="sm" tone="danger" title={t('admin.quizEditor.deleteOption')} onClick={onDelete}>×</IconButton>
    </div>
  )
}

export function AdminQuizEditor() {
  const { challengeId } = useParams<{ challengeId: string }>()
  const { t } = useTranslation()

  if (!challengeId) return null
  return <QuizEditorInner challengeId={challengeId} />
}

function QuizEditorInner({ challengeId }: { challengeId: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [newQText, setNewQText] = useState('')
  const [newOptText, setNewOptText] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['quiz-full', challengeId],
    queryFn: async () => {
      const res = await fetch(`api/quiz/challenge/${challengeId}/questions`, { credentials: 'include' })
      if (!res.ok) return { questions: [], challenge: null }
      return res.json()
    },
  })

  const createQ = useMutation({
    mutationFn: () => api.quiz.createQuestion({ challengeId, text: newQText.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }); setNewQText('') },
  })

  const updateQ = useMutation({
    mutationFn: ({ id, ...rest }: any) => api.quiz.updateQuestion(id, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const deleteQ = useMutation({
    mutationFn: (id: string) => api.quiz.deleteQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const addOpt = useMutation({
    mutationFn: ({ questionId, text }: { questionId: string; text: string }) => api.quiz.createOption(questionId, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const updateOpt = useMutation({
    mutationFn: ({ id, ...rest }: any) => api.quiz.updateOption(id, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const deleteOpt = useMutation({
    mutationFn: (id: string) => api.quiz.deleteOption(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const uploadQImg = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.quiz.uploadQuestionImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const genQImg = useMutation({
    mutationFn: ({ id, prompt }: { id: string; prompt?: string }) => api.quiz.generateQuestionImage(id, prompt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const removeQImg = useMutation({
    mutationFn: ({ id }: { id: string }) => api.quiz.removeQuestionImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const uploadOptImg = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.quiz.uploadOptionImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const genOptImg = useMutation({
    mutationFn: ({ id, prompt }: { id: string; prompt?: string }) => api.quiz.generateOptionImage(id, prompt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const removeOptImg = useMutation({
    mutationFn: ({ id }: { id: string }) => api.quiz.removeOptionImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const genQuizImg = useMutation({
    mutationFn: ({ prompt }: { prompt?: string }) => api.quiz.generateQuizImage(challengeId, prompt),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }); qc.invalidateQueries({ queryKey: ['competitions'] }) },
  })

  const removeQuizImg = useMutation({
    mutationFn: () => api.quiz.removeQuizImage(challengeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }); qc.invalidateQueries({ queryKey: ['competitions'] }) },
  })

  const [genTarget, setGenTarget] = useState<GenTarget | null>(null)
  const generating = genQImg.isPending || genOptImg.isPending || genQuizImg.isPending

  async function runGenerate(prompt: string) {
    if (!genTarget) return
    try {
      if (genTarget.kind === 'quiz') await genQuizImg.mutateAsync({ prompt })
      else if (genTarget.kind === 'question') await genQImg.mutateAsync({ id: genTarget.id, prompt })
      else await genOptImg.mutateAsync({ id: genTarget.id, prompt })
      setGenTarget(null)
    } catch { /* keep the dialog open so the user can retry */ }
  }

  function dialogTitle(target: GenTarget): string {
    if (target.kind === 'quiz') return t('admin.quizEditor.generateQuizImageTitle')
    if (target.kind === 'question') return t('admin.quizEditor.generateQuestionImageTitle')
    return t('admin.quizEditor.generateAnswerImageTitle')
  }

  const reorder = useMutation({
    mutationFn: (order: string[]) => api.quiz.reorderQuestions(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  if (isLoading) return <AdminLayout title={t('admin.quizEditor.title')}><LoadingSpinner /></AdminLayout>

  const questions: any[] = data?.questions ?? []
  const challengeName = data?.challenge?.name ?? 'Quiz'
  const quizImageUrl: string | null = data?.challenge?.logoUrl ?? null

  return (
    <AdminLayout title={`Quiz: ${challengeName}`}>
      {/* Quiz cover image — shown in the challenge list and the lobby */}
      <Card padding="14px" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {quizImageUrl ? (
            <div style={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
              <img src={quizImageUrl} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', display: 'block' }} />
              <button type="button" title={t('admin.quizEditor.removeImage')} disabled={removeQuizImg.isPending}
                onClick={() => removeQuizImg.mutate()}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-warm)', color: '#fff', border: '2px solid var(--surface)', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                ×
              </button>
            </div>
          ) : (
            <div style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 'var(--radius)', border: '1px dashed var(--border-light)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'var(--text-muted)' }}>
              🖼
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', marginBottom: 2 }}>{t('admin.quizEditor.quizImageHeading')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{t('admin.quizEditor.quizImageHint')}</p>
            <button type="button"
              disabled={genQuizImg.isPending}
              onClick={() => setGenTarget({ kind: 'quiz' })}
              style={{ ...pillStyle, opacity: genQuizImg.isPending ? 0.45 : 1, cursor: genQuizImg.isPending ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!genQuizImg.isPending) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { if (!genQuizImg.isPending) e.currentTarget.style.opacity = '1' }}>
              {genQuizImg.isPending ? <span className="loading-dots"><span /><span /><span /></span> : <>✨ {t('admin.quizEditor.generateQuizImage')}</>}
            </button>
          </div>
        </div>
      </Card>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        {t('admin.quizEditor.questionsCount', { count: questions.length })}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {questions.map((q: any, qi: number) => (
          <Card key={q.id} padding="14px">
            {/* Question header: number · text · reorder · delete */}
            {(() => {
              const genPending = genQImg.isPending && genQImg.variables?.id === q.id
              const hasText = !!q.text?.trim()
              return (
            <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, marginTop: 5, padding: '0 9px', borderRadius: 'var(--radius-full)', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                {qi + 1}
              </span>
              <textarea
                defaultValue={q.text}
                onBlur={e => updateQ.mutate({ id: q.id, text: e.target.value })}
                rows={1}
                style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', resize: 'vertical', minHeight: 40, lineHeight: 1.35, color: 'var(--text-primary)', paddingTop: 9 }}
                placeholder={t('admin.quizEditor.questionPlaceholder')}
              />
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {qi > 0 && (
                  <IconButton size="sm" title={t('admin.quizEditor.reorderHint')} onClick={() => {
                    const ids = questions.map((x: any) => x.id)
                    ;[ids[qi - 1], ids[qi]] = [ids[qi], ids[qi - 1]]
                    reorder.mutate(ids)
                  }}>↑</IconButton>
                )}
                {qi < questions.length - 1 && (
                  <IconButton size="sm" title={t('admin.quizEditor.reorderHint')} onClick={() => {
                    const ids = questions.map((x: any) => x.id)
                    ;[ids[qi], ids[qi + 1]] = [ids[qi + 1], ids[qi]]
                    reorder.mutate(ids)
                  }}>↓</IconButton>
                )}
                <IconButton tone="danger" title={t('admin.quizEditor.deleteQuestion')} onClick={() => deleteQ.mutate(q.id)}>🗑</IconButton>
              </div>
            </div>

            {/* Image preview */}
            {q.imageUrl && (
              <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 240, marginBottom: 12 }}>
                <img src={q.imageUrl} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'block' }} />
                <button type="button" title={t('admin.quizEditor.removeImage')}
                  disabled={removeQImg.isPending && removeQImg.variables?.id === q.id}
                  onClick={() => removeQImg.mutate({ id: q.id })}
                  style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 'var(--radius-full)', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 150ms var(--ease-out)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-warm)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)' }}>
                  ×
                </button>
              </div>
            )}

            {/* Image actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 12 }}>
              <label style={pillStyle}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                🖼 {t('admin.quizEditor.uploadImage')}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) uploadQImg.mutate({ id: q.id, file: e.target.files[0] }) }} />
              </label>
              <button type="button"
                title={t('admin.quizEditor.generateImage')}
                disabled={genPending}
                onClick={() => setGenTarget({ kind: 'question', id: q.id, seed: hasText ? t('admin.quizEditor.promptSeedQuestion', { text: q.text }) : '' })}
                style={{ ...pillStyle, opacity: genPending ? 0.45 : 1, cursor: genPending ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (!genPending) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!genPending) e.currentTarget.style.opacity = '1' }}>
                {genPending ? <span className="loading-dots"><span /><span /><span /></span> : <>✨ {t('admin.quizEditor.generateImageBtn')}</>}
              </button>
            </div>
            </>
              )
            })()}

            {/* Points + timer */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {t('admin.quizEditor.points')}
                <input type="number" min={1} defaultValue={q.points}
                  onBlur={e => updateQ.mutate({ id: q.id, points: parseInt(e.target.value) || 1 })}
                  style={{ width: 62, height: 34, padding: '0 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '14px', color: 'var(--text-primary)' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {t('admin.quizEditor.timer')}
                <input type="number" min={0} defaultValue={q.timerSeconds}
                  onBlur={e => updateQ.mutate({ id: q.id, timerSeconds: parseInt(e.target.value) || 0 })}
                  style={{ width: 62, height: 34, padding: '0 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '14px', color: 'var(--text-primary)' }} />
                <span style={{ fontSize: '11px' }}>{t('admin.quizEditor.noLimit')}</span>
              </label>
            </div>

            <hr style={{ height: 1, background: 'var(--border-light)', border: 'none', margin: '0 0 12px' }} />

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              {(q.options ?? []).map((opt: any) => (
                <OptionRow
                  key={opt.id}
                  option={opt}
                  onUpdate={d => updateOpt.mutate({ id: opt.id, ...d })}
                  onDelete={() => deleteOpt.mutate(opt.id)}
                  onImageUpload={file => uploadOptImg.mutate({ id: opt.id, file })}
                  onImageRemove={() => removeOptImg.mutate({ id: opt.id })}
                  onGenerate={() => setGenTarget({ kind: 'option', id: opt.id, seed: t('admin.quizEditor.promptSeedAnswer', { text: opt.text }) })}
                  generating={generating}
                />
              ))}
            </div>

            {/* Add option */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={newOptText[q.id] ?? ''}
                onChange={e => setNewOptText(prev => ({ ...prev, [q.id]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (newOptText[q.id] ?? '').trim()) {
                    addOpt.mutate({ questionId: q.id, text: (newOptText[q.id] ?? '').trim() })
                    setNewOptText(prev => ({ ...prev, [q.id]: '' }))
                  }
                }}
                placeholder={t('admin.quizEditor.addOptionPlaceholder')}
                style={{ flex: 1, minWidth: 0, height: 38, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '14px', color: 'var(--text-primary)' }}
              />
              <Button size="sm" variant="ghost"
                disabled={!(newOptText[q.id] ?? '').trim()}
                onClick={() => {
                  const text = (newOptText[q.id] ?? '').trim()
                  if (text) { addOpt.mutate({ questionId: q.id, text }); setNewOptText(prev => ({ ...prev, [q.id]: '' })) }
                }}>
                {t('admin.quizEditor.addOption')}
              </Button>
            </div>
          </Card>
        ))}

        {/* Add question */}
        <Card>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newQText}
              onChange={e => setNewQText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newQText.trim()) createQ.mutate() }}
              placeholder={t('admin.quizEditor.newQuestionPlaceholder')}
              style={{ flex: 1, minWidth: 0, height: 46, padding: '0 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '15px', color: 'var(--text-primary)' }}
            />
            <Button disabled={!newQText.trim()} onClick={() => createQ.mutate()} loading={createQ.isPending}>
              {t('admin.quizEditor.addQuestion')}
            </Button>
          </div>
        </Card>
      </div>

      <GenerateImageDialog
        open={!!genTarget}
        title={genTarget ? dialogTitle(genTarget) : ''}
        defaultPrompt={
          genTarget?.kind === 'quiz'
            ? t('admin.quizEditor.promptSeedQuiz', { name: challengeName })
            : genTarget?.seed ?? ''
        }
        submitting={generating}
        onSubmit={runGenerate}
        onClose={() => { if (!generating) setGenTarget(null) }}
      />
    </AdminLayout>
  )
}
