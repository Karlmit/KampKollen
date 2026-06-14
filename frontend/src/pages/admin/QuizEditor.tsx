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
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'

// Ghost "pill" button shared by the image actions (upload / generate).
const pillStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  height: 38, padding: '0 14px', borderRadius: 'var(--radius)',
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap',
  cursor: 'pointer', transition: 'opacity 150ms var(--ease-out), transform 120ms var(--ease-out)',
}

function OptionRow({ option, onUpdate, onDelete, onImageUpload }: {
  option: any
  onUpdate: (data: { text?: string; isCorrect?: boolean }) => void
  onDelete: () => void
  onImageUpload: (file: File) => void
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
        <img src={option.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-light)' }} />
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
    mutationFn: ({ id }: { id: string }) => api.quiz.generateQuestionImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const uploadOptImg = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.quiz.uploadOptionImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const reorder = useMutation({
    mutationFn: (order: string[]) => api.quiz.reorderQuestions(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  if (isLoading) return <AdminLayout title={t('admin.quizEditor.title')}><LoadingSpinner /></AdminLayout>

  const questions: any[] = data?.questions ?? []
  const challengeName = data?.challenge?.name ?? 'Quiz'

  return (
    <AdminLayout title={`Quiz: ${challengeName}`}>
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
            {q.imageUrl && <img src={q.imageUrl} alt="" style={{ width: '100%', maxWidth: 240, height: 150, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: 12 }} />}

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
                title={hasText ? t('admin.quizEditor.generateImage') : t('admin.quizEditor.generateImageNeedsText')}
                disabled={!hasText || genPending}
                onClick={() => genQImg.mutate({ id: q.id })}
                style={{ ...pillStyle, opacity: (!hasText || genPending) ? 0.45 : 1, cursor: (!hasText || genPending) ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (hasText && !genPending) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (hasText && !genPending) e.currentTarget.style.opacity = '1' }}>
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
    </AdminLayout>
  )
}
