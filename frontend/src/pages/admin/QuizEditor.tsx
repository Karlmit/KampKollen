import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { useTranslation } from 'react-i18next'

function OptionRow({ option, onUpdate, onDelete, onImageUpload }: {
  option: any
  onUpdate: (data: { text?: string; isCorrect?: boolean }) => void
  onDelete: () => void
  onImageUpload: (file: File) => void
}) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
      borderRadius: 'var(--radius-sm)', background: option.isCorrect ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)' : 'var(--surface)',
      border: `1.5px solid ${option.isCorrect ? 'var(--accent-green)' : 'var(--border-light)'}`,
    }}>
      <button
        type="button"
        onClick={() => onUpdate({ isCorrect: !option.isCorrect })}
        title={t('admin.quizEditor.markCorrect')}
        style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          border: `2px solid ${option.isCorrect ? 'var(--accent-green)' : 'var(--border-light)'}`,
          background: option.isCorrect ? 'var(--accent-green)' : 'transparent',
          color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {option.isCorrect ? '✓' : ''}
      </button>
      {option.imageUrl && (
        <img src={option.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
      )}
      <input
        value={option.text}
        onChange={e => onUpdate({ text: e.target.value })}
        onBlur={e => onUpdate({ text: e.target.value })}
        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-ui)' }}
        placeholder={t('admin.quizEditor.answerPlaceholder')}
      />
      <label style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
        🖼
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]) }} />
      </label>
      <button type="button" onClick={onDelete} style={{ color: 'var(--accent-warm)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>×</button>
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
          <Card key={q.id}>
            {/* Question header */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)', minWidth: 24, paddingTop: 2 }}>Q{qi + 1}</span>
              <div style={{ flex: 1 }}>
                <textarea
                  defaultValue={q.text}
                  onBlur={e => updateQ.mutate({ id: q.id, text: e.target.value })}
                  rows={2}
                  style={{ width: '100%', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', resize: 'vertical' }}
                  placeholder={t('admin.quizEditor.questionPlaceholder')}
                />
                {q.imageUrl && <img src={q.imageUrl} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginTop: 4 }} />}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <label style={{ cursor: 'pointer', fontSize: '18px' }}>
                  🖼
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) uploadQImg.mutate({ id: q.id, file: e.target.files[0] }) }} />
                </label>
                {qi > 0 && (
                  <button type="button" onClick={() => {
                    const ids = questions.map((x: any) => x.id)
                    ;[ids[qi - 1], ids[qi]] = [ids[qi], ids[qi - 1]]
                    reorder.mutate(ids)
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)' }}>↑</button>
                )}
                {qi < questions.length - 1 && (
                  <button type="button" onClick={() => {
                    const ids = questions.map((x: any) => x.id)
                    ;[ids[qi], ids[qi + 1]] = [ids[qi + 1], ids[qi]]
                    reorder.mutate(ids)
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)' }}>↓</button>
                )}
                <button type="button" onClick={() => deleteQ.mutate(q.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--accent-warm)' }}>🗑</button>
              </div>
            </div>

            {/* Points + timer */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {t('admin.quizEditor.points')}
                <input type="number" min={1} defaultValue={q.points}
                  onBlur={e => updateQ.mutate({ id: q.id, points: parseInt(e.target.value) || 1 })}
                  style={{ width: 48, padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '13px' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {t('admin.quizEditor.timer')}
                <input type="number" min={0} defaultValue={q.timerSeconds}
                  onBlur={e => updateQ.mutate({ id: q.id, timerSeconds: parseInt(e.target.value) || 0 })}
                  style={{ width: 56, padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '13px' }} />
                <span style={{ fontSize: '11px' }}>{t('admin.quizEditor.noLimit')}</span>
              </label>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
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
            <div style={{ display: 'flex', gap: '6px' }}>
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
                style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '13px' }}
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
              style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '14px' }}
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
