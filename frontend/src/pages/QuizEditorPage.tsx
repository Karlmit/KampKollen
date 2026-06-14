import { useState, type CSSProperties, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { IconButton } from '../components/quiz/IconButton'
import { api } from '../api/client'
import { useTranslation } from 'react-i18next'

// Ghost "pill" button shared by the image actions (upload / generate).
const pillStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  height: 38, padding: '0 14px', borderRadius: 'var(--radius)',
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap',
  cursor: 'pointer', transition: 'opacity 150ms var(--ease-out), transform 120ms var(--ease-out)',
}

const GRIP = '⠿'

// Drag handle props from dnd-kit, passed to the grip element only.
type HandleProps = Record<string, unknown>

function SortableOptionRow({ option, onUpdate, onDelete, onImageUpload, onImageRemove }: {
  option: any
  onUpdate: (data: { text?: string; isCorrect?: boolean }) => void
  onDelete: () => void
  onImageUpload: (file: File) => void
  onImageRemove: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px',
    borderRadius: 'var(--radius-sm)',
    background: option.isCorrect ? 'color-mix(in srgb, var(--accent-green) 9%, transparent)' : 'var(--background)',
    border: `1.5px solid ${option.isCorrect ? 'var(--accent-green)' : 'var(--border-light)'}`,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners}
        title={t('admin.quizEditor.reorderHint')}
        style={{ cursor: 'grab', color: 'var(--border-light)', fontSize: '14px', flexShrink: 0, touchAction: 'none', lineHeight: 1 }}>
        {GRIP}
      </span>
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
        defaultValue={option.text}
        onBlur={e => { if (e.target.value !== option.text) onUpdate({ text: e.target.value }) }}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-primary)' }}
        placeholder={t('admin.quizEditor.answerPlaceholder')}
      />
      <label
        title={t('admin.quizEditor.uploadImage')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0,
          color: 'var(--text-muted)', fontSize: '15px', cursor: 'pointer',
        }}>
        🖼
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]) }} />
      </label>
      <IconButton size="sm" tone="danger" title={t('admin.quizEditor.deleteOption')} onClick={onDelete}>×</IconButton>
    </div>
  )
}

// Wraps a question card so it can be dragged by its grip handle while the rest
// of the card (inputs, the nested option DnD) stays interactive.
function SortableQuestion({ id, children }: {
  id: string
  children: (h: { setNodeRef: (el: HTMLElement | null) => void; style: CSSProperties; handleProps: HandleProps }) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative', zIndex: isDragging ? 2 : undefined,
  }
  return <>{children({ setNodeRef, style, handleProps: { ...attributes, ...listeners } })}</>
}

export function QuizEditorPage() {
  const { competitionId, ccId } = useParams<{ competitionId: string; ccId: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [newQText, setNewQText] = useState('')
  const [newOptText, setNewOptText] = useState<Record<string, string>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor))

  // Get challengeId from the quiz state (already fetched by QuizPage, likely cached)
  const { data: stateData } = useQuery({
    queryKey: ['quiz', ccId],
    queryFn: () => api.quiz.getState(ccId!),
    enabled: !!ccId,
  })
  const challengeId = stateData?.challengeId

  const { data, isLoading } = useQuery({
    queryKey: ['quiz-full', challengeId],
    queryFn: async () => {
      const res = await fetch(`api/quiz/challenge/${challengeId}/questions`, { credentials: 'include' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      return res.json()
    },
    enabled: !!challengeId,
  })

  const createQ = useMutation({
    mutationFn: () => api.quiz.createQuestion({ challengeId: challengeId!, text: newQText.trim() }),
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
    mutationFn: ({ questionId, text, questions: qs }: { questionId: string; text: string; questions: any[] }) => {
      const q = qs.find((x: any) => x.id === questionId)
      // First option for this question → automatically correct
      const isFirstOption = !q?.options?.length
      return api.quiz.createOption(questionId, { text, isCorrect: isFirstOption })
    },
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
  const removeQImg = useMutation({
    mutationFn: ({ id }: { id: string }) => api.quiz.removeQuestionImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const uploadOptImg = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.quiz.uploadOptionImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const removeOptImg = useMutation({
    mutationFn: ({ id }: { id: string }) => api.quiz.removeOptionImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const reorder = useMutation({
    mutationFn: (order: string[]) => api.quiz.reorderQuestions(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const reorderOpts = useMutation({
    mutationFn: (order: string[]) => api.quiz.reorderOptions(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const backUrl = `/competitions/${competitionId}/quiz/${ccId}`

  if (isLoading || !stateData) return <Layout title={t('admin.quizEditor.title')} back={backUrl}><LoadingSpinner /></Layout>

  const questions: any[] = data?.questions ?? []
  const challengeName = data?.challenge?.name ?? 'Quiz'

  return (
    <Layout title={t('admin.quizEditor.editTitle', { name: challengeName })} back={backUrl}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '60ch', lineHeight: 1.55 }}>
        {t('admin.quizEditor.questionsCount', { count: questions.length })} {t('admin.quizEditor.reorderHint')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return
            const ids = questions.map((x: any) => x.id)
            const oldIdx = ids.indexOf(active.id as string)
            const newIdx = ids.indexOf(over.id as string)
            if (oldIdx === -1 || newIdx === -1) return
            reorder.mutate(arrayMove(ids, oldIdx, newIdx))
          }}
        >
          <SortableContext items={questions.map((q: any) => q.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((q: any, qi: number) => {
                const genPending = genQImg.isPending && genQImg.variables?.id === q.id
                const hasText = !!q.text?.trim()
                return (
                  <SortableQuestion key={q.id} id={q.id}>
                    {({ setNodeRef, style, handleProps }) => (
                      <div ref={setNodeRef} style={style}>
                        <Card padding="14px">
                          {/* Header: grip · number · question text · delete */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                            <span {...handleProps}
                              title={t('admin.quizEditor.reorderHint')}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 40, color: 'var(--border-light)', fontSize: '16px', cursor: 'grab', flexShrink: 0, touchAction: 'none' }}>
                              {GRIP}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, marginTop: 5, padding: '0 9px', borderRadius: 'var(--radius-full)', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                              {qi + 1}
                            </span>
                            <textarea
                              defaultValue={q.text}
                              onBlur={e => { if (e.target.value !== q.text) updateQ.mutate({ id: q.id, text: e.target.value }) }}
                              rows={1}
                              style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', resize: 'vertical', minHeight: 40, lineHeight: 1.35, color: 'var(--text-primary)', paddingTop: 9 }}
                              placeholder={t('admin.quizEditor.questionPlaceholder')}
                            />
                            <IconButton tone="danger" title={t('admin.quizEditor.deleteQuestion')} onClick={() => deleteQ.mutate(q.id)}>🗑</IconButton>
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
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadQImg.mutate({ id: q.id, file: e.target.files[0] }) }} />
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

                          {/* Meta: points · timer · free-text toggle */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
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
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginLeft: 'auto' }}>
                              <input
                                type="checkbox"
                                checked={!!q.isFreeText}
                                onChange={e => updateQ.mutate({ id: q.id, isFreeText: e.target.checked })}
                                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                              />
                              <span>{t('quiz.freeTextQuestion')}</span>
                            </label>
                          </div>

                          <hr style={{ height: 1, background: 'var(--border-light)', border: 'none', margin: '0 0 12px' }} />

                          {q.isFreeText ? (
                            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', fontSize: '13px', color: 'var(--text-muted)' }}>
                              {t('admin.quizEditor.freeTextInfo')}
                            </div>
                          ) : (
                            <>
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={({ active, over }) => {
                                  if (!over || active.id === over.id) return
                                  const opts = q.options ?? []
                                  const oldIdx = opts.findIndex((o: any) => o.id === active.id)
                                  const newIdx = opts.findIndex((o: any) => o.id === over.id)
                                  const reordered = arrayMove(opts, oldIdx, newIdx)
                                  reorderOpts.mutate(reordered.map((o: any) => o.id))
                                }}
                              >
                                <SortableContext items={(q.options ?? []).map((o: any) => o.id)} strategy={verticalListSortingStrategy}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                    {(q.options ?? []).map((opt: any) => (
                                      <SortableOptionRow
                                        key={opt.id}
                                        option={opt}
                                        onUpdate={d => updateOpt.mutate({ id: opt.id, ...d })}
                                        onDelete={() => deleteOpt.mutate(opt.id)}
                                        onImageUpload={file => uploadOptImg.mutate({ id: opt.id, file })}
                                        onImageRemove={() => removeOptImg.mutate({ id: opt.id })}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  value={newOptText[q.id] ?? ''}
                                  onChange={e => setNewOptText(prev => ({ ...prev, [q.id]: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && (newOptText[q.id] ?? '').trim()) {
                                      addOpt.mutate({ questionId: q.id, text: (newOptText[q.id] ?? '').trim(), questions })
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
                                    if (text) { addOpt.mutate({ questionId: q.id, text, questions }); setNewOptText(x => ({ ...x, [q.id]: '' })) }
                                  }}>
                                  {t('admin.quizEditor.addOption')}
                                </Button>
                              </div>
                            </>
                          )}
                        </Card>
                      </div>
                    )}
                  </SortableQuestion>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

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
    </Layout>
  )
}
