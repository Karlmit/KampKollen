import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
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
import { GenerateImageDialog } from '../components/quiz/GenerateImageDialog'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { api } from '../api/client'
import { useTranslation } from 'react-i18next'

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

const GRIP = '⠿'

// Drag handle props from dnd-kit, passed to the grip element only.
type HandleProps = Record<string, unknown>

function SortableOptionRow({ option, onUpdate, onDelete, onImageUpload, onImageRemove, onGenerate, generating }: {
  option: any
  onUpdate: (data: { text?: string; isCorrect?: boolean }) => void
  onDelete: () => void
  onImageUpload: (file: File) => void
  onImageRemove: () => void
  onGenerate: () => void
  generating: boolean
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
      <IconButton size="sm" title={t('admin.quizEditor.generateAnswerImage')} disabled={generating} onClick={onGenerate}>✨</IconButton>
      <IconButton size="sm" tone="danger" title={t('admin.quizEditor.deleteOption')} onClick={onDelete}>×</IconButton>
    </div>
  )
}

// One individually-scored free-text answer field (e.g. "Year" → 1p). The label
// is the sub-prompt shown to players; points is the max the QM can award.
function SortableFieldRow({ field, index, onUpdate, onDelete, canDelete }: {
  field: any
  index: number
  onUpdate: (data: { label?: string; points?: number; correctAnswer?: string }) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
    display: 'flex', flexDirection: 'column', gap: '8px', padding: '9px 10px',
    borderRadius: 'var(--radius-sm)', background: 'var(--background)', border: '1.5px solid var(--border-light)',
  }
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span {...attributes} {...listeners}
          title={t('admin.quizEditor.reorderHint')}
          style={{ cursor: 'grab', color: 'var(--border-light)', fontSize: '14px', flexShrink: 0, touchAction: 'none', lineHeight: 1 }}>
          {GRIP}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--surface-raised)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
          {index + 1}
        </span>
        <input
          defaultValue={field.label}
          onBlur={e => { if (e.target.value !== field.label) onUpdate({ label: e.target.value }) }}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-primary)' }}
          placeholder={t('admin.quizEditor.fieldLabelPlaceholder')}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          <input type="number" min={1} defaultValue={field.points}
            onBlur={e => onUpdate({ points: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{ width: 52, height: 32, padding: '0 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--surface)', fontSize: '14px', color: 'var(--text-primary)' }} />
          {t('admin.quizEditor.pointsShort')}
        </label>
        <IconButton size="sm" tone="danger" title={t('admin.quizEditor.deleteField')} disabled={!canDelete} onClick={onDelete}>×</IconButton>
      </div>
      {/* Expected answer — only ever shown to the QM while correcting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: 32 }}>
        <span style={{ flexShrink: 0, fontSize: '13px', lineHeight: 1 }} title={t('admin.quizEditor.fieldAnswerHint')}>🔑</span>
        <input
          defaultValue={field.correctAnswer ?? ''}
          onBlur={e => { if (e.target.value !== (field.correctAnswer ?? '')) onUpdate({ correctAnswer: e.target.value }) }}
          style={{ flex: 1, minWidth: 0, height: 32, padding: '0 8px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-light)', background: 'var(--surface)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}
          placeholder={t('admin.quizEditor.fieldAnswerPlaceholder')}
        />
      </div>
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
  const addField = useMutation({
    mutationFn: (questionId: string) => api.quiz.createField(questionId, { label: '', points: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const updateField = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; label?: string; points?: number; correctAnswer?: string }) => api.quiz.updateField(id, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const deleteField = useMutation({
    mutationFn: (id: string) => api.quiz.deleteField(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const reorderFields = useMutation({
    mutationFn: (order: string[]) => api.quiz.reorderFields(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const genQuizImg = useMutation({
    mutationFn: ({ prompt }: { prompt?: string }) => api.quiz.generateQuizImage(challengeId!, prompt),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }); qc.invalidateQueries({ queryKey: ['competitions'] }) },
  })
  const removeQuizImg = useMutation({
    mutationFn: () => api.quiz.removeQuizImage(challengeId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }); qc.invalidateQueries({ queryKey: ['competitions'] }) },
  })
  const updateSettings = useMutation({
    mutationFn: (quizPhaseCorrection: boolean) => api.quiz.updateSettings(challengeId!, { quizPhaseCorrection }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })
  const [savedTemplate, setSavedTemplate] = useState(false)
  const saveAsTemplate = useMutation({
    mutationFn: () => api.quiz.saveAsTemplate(challengeId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['challenges'] }); setSavedTemplate(true); setTimeout(() => setSavedTemplate(false), 2500) },
  })

  // Single AI-generation dialog driven by which target the user picked.
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
  const reorderOpts = useMutation({
    mutationFn: (order: string[]) => api.quiz.reorderOptions(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz-full', challengeId] }),
  })

  const backUrl = `/competitions/${competitionId}/quiz/${ccId}`

  if (isLoading || !stateData) return <Layout title={t('admin.quizEditor.title')} back={backUrl}><LoadingSpinner /></Layout>

  const questions: any[] = data?.questions ?? []
  const challengeName = data?.challenge?.name ?? 'Quiz'
  const quizImageUrl: string | null = data?.challenge?.logoUrl ?? null
  const phaseMode = !!data?.challenge?.quizPhaseCorrection

  // 1-based phase group number per question index — a new group starts wherever
  // the `phase` value changes between consecutive questions. Drives the group
  // dividers shown in the editor when phase correction is on.
  const phaseGroupOf: number[] = []
  {
    let g = 0
    questions.forEach((q, i) => {
      if (i === 0 || questions[i - 1].phase !== q.phase) g++
      phaseGroupOf[i] = g
    })
  }
  const quizImgRemoving = removeQuizImg.isPending
  const quizImgGenerating = genQuizImg.isPending

  return (
    <Layout title={t('admin.quizEditor.editTitle', { name: challengeName })} back={backUrl}>
      {/* Quiz cover image — shown in the challenge list and the lobby */}
      <Card padding="14px" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {quizImageUrl ? (
            <div style={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
              <img src={quizImageUrl} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', display: 'block' }} />
              <button type="button" title={t('admin.quizEditor.removeImage')} disabled={quizImgRemoving}
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
              disabled={quizImgGenerating}
              onClick={() => setGenTarget({ kind: 'quiz' })}
              style={{ ...pillStyle, opacity: quizImgGenerating ? 0.45 : 1, cursor: quizImgGenerating ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!quizImgGenerating) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { if (!quizImgGenerating) e.currentTarget.style.opacity = '1' }}>
              {quizImgGenerating ? <span className="loading-dots"><span /><span /><span /></span> : <>✨ {t('admin.quizEditor.generateQuizImage')}</>}
            </button>
          </div>
        </div>
      </Card>

      {/* Correction mode — quiz-then-correction (default) vs. phase correction */}
      <Card padding="14px" style={{ marginBottom: '16px' }}>
        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)', marginBottom: 10 }}>
          {t('admin.quizEditor.correctionMode')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {([
            { value: false, label: t('admin.quizEditor.correctionModeEnd'), hint: t('admin.quizEditor.correctionModeEndHint') },
            { value: true, label: t('admin.quizEditor.correctionModePhase'), hint: t('admin.quizEditor.correctionModePhaseHint') },
          ] as const).map(opt => {
            const active = phaseMode === opt.value
            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={updateSettings.isPending}
                onClick={() => { if (!active) updateSettings.mutate(opt.value) }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left', width: '100%',
                  padding: '12px 14px', borderRadius: 'var(--radius)', cursor: active ? 'default' : 'pointer',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--background)',
                  transition: 'border-color 150ms var(--ease-out), background 150ms var(--ease-out)',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{active ? '✓' : ''}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{opt.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Save the current quiz as a reusable template (e.g. before a test play) */}
      <Card padding="14px" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: 2 }}>{t('admin.quizEditor.saveAsTemplate')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('admin.quizEditor.saveAsTemplateHint')}</p>
          </div>
          <Button
            variant={savedTemplate ? 'success' : 'ghost'}
            disabled={questions.length === 0 || saveAsTemplate.isPending}
            loading={saveAsTemplate.isPending}
            onClick={() => saveAsTemplate.mutate()}
          >
            {savedTemplate ? t('admin.quizEditor.saveAsTemplateDone') : t('admin.quizEditor.saveAsTemplate')}
          </Button>
        </div>
      </Card>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '60ch', lineHeight: 1.55 }}>
        {t('admin.quizEditor.questionsCount', { count: questions.length })} {t('admin.quizEditor.reorderHint')}
        {phaseMode && <> {t('admin.quizEditor.phaseHint')}</>}
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
                const startsPhase = phaseMode && (qi === 0 || questions[qi - 1].phase !== q.phase)
                return (
                  <Fragment key={q.id}>
                  {startsPhase && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: qi === 0 ? '0 0 -6px' : '6px 0 -6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 12px', borderRadius: 'var(--radius-full)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                        {t('admin.quizEditor.phaseGroup', { number: phaseGroupOf[qi] })}
                      </span>
                      <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                    </div>
                  )}
                  <SortableQuestion id={q.id}>
                    {({ setNodeRef, style, handleProps }) => (
                      <div ref={setNodeRef} style={style}>
                        <Card padding="14px">
                          {/* Header: grip · number · editable question title · delete */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                            <span {...handleProps}
                              title={t('admin.quizEditor.reorderHint')}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 40, color: 'var(--border-light)', fontSize: '16px', cursor: 'grab', flexShrink: 0, touchAction: 'none' }}>
                              {GRIP}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, marginTop: 7, padding: '0 9px', borderRadius: 'var(--radius-full)', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                              {qi + 1}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <label htmlFor={`q-title-${q.id}`} style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>
                                {t('admin.quizEditor.questionTitle')}
                              </label>
                              <textarea
                                id={`q-title-${q.id}`}
                                defaultValue={q.text}
                                onBlur={e => { if (e.target.value !== q.text) updateQ.mutate({ id: q.id, text: e.target.value }) }}
                                rows={1}
                                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--background)', outline: 'none', resize: 'vertical', minHeight: 42, lineHeight: 1.35, color: 'var(--text-primary)', padding: '10px 12px' }}
                                placeholder={t('admin.quizEditor.questionPlaceholder')}
                              />
                            </div>
                            <IconButton tone="danger" title={t('admin.quizEditor.deleteQuestion')} onClick={() => deleteQ.mutate(q.id)}>🗑</IconButton>
                          </div>

                          {/* Optional rich-text description shown under the question */}
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>{t('admin.quizEditor.description')}</p>
                            <RichTextEditor
                              defaultValue={q.description ?? ''}
                              placeholder={t('admin.quizEditor.descriptionPlaceholder')}
                              onCommit={html => { if (html !== (q.description ?? '')) updateQ.mutate({ id: q.id, description: html }) }}
                            />
                          </div>

                          {/* QM-only "manus" / script notes — shown to the quiz
                              master while presenting, never to players */}
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>{t('admin.quizEditor.manus')}</p>
                            <textarea
                              defaultValue={q.manusText ?? ''}
                              onBlur={e => { if (e.target.value !== (q.manusText ?? '')) updateQ.mutate({ id: q.id, manusText: e.target.value }) }}
                              rows={2}
                              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: '14px', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', outline: 'none', resize: 'vertical', minHeight: 48, lineHeight: 1.4, color: 'var(--text-primary)', padding: '10px 12px' }}
                              placeholder={t('admin.quizEditor.manusPlaceholder')}
                            />
                          </div>

                          {/* QM-only "manus" / script notes — shown to the quiz
                              master while CORRECTING, never to players */}
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>{t('admin.quizEditor.correctionManus')}</p>
                            <textarea
                              defaultValue={q.correctionManusText ?? ''}
                              onBlur={e => { if (e.target.value !== (q.correctionManusText ?? '')) updateQ.mutate({ id: q.id, correctionManusText: e.target.value }) }}
                              rows={2}
                              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: '14px', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', outline: 'none', resize: 'vertical', minHeight: 48, lineHeight: 1.4, color: 'var(--text-primary)', padding: '10px 12px' }}
                              placeholder={t('admin.quizEditor.correctionManusPlaceholder')}
                            />
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
                              title={t('admin.quizEditor.generateImage')}
                              disabled={genPending}
                              onClick={() => setGenTarget({ kind: 'question', id: q.id, seed: hasText ? t('admin.quizEditor.promptSeedQuestion', { text: q.text }) : '' })}
                              style={{ ...pillStyle, opacity: genPending ? 0.45 : 1, cursor: genPending ? 'not-allowed' : 'pointer' }}
                              onMouseEnter={e => { if (!genPending) e.currentTarget.style.opacity = '0.85' }}
                              onMouseLeave={e => { if (!genPending) e.currentTarget.style.opacity = '1' }}>
                              {genPending ? <span className="loading-dots"><span /><span /><span /></span> : <>✨ {t('admin.quizEditor.generateImageBtn')}</>}
                            </button>
                          </div>

                          {/* Meta: points · timer · free-text toggle */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            {q.isFreeText ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {t('admin.quizEditor.points')}
                                <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                                  {(q.fields ?? []).reduce((sum: number, f: any) => sum + (f.points ?? 0), 0)}
                                </strong>
                              </span>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {t('admin.quizEditor.points')}
                                <input type="number" min={1} defaultValue={q.points}
                                  onBlur={e => updateQ.mutate({ id: q.id, points: parseInt(e.target.value) || 1 })}
                                  style={{ width: 62, height: 34, padding: '0 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '14px', color: 'var(--text-primary)' }} />
                              </label>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {t('admin.quizEditor.timer')}
                              <input type="number" min={0} defaultValue={q.timerSeconds}
                                onBlur={e => updateQ.mutate({ id: q.id, timerSeconds: parseInt(e.target.value) || 0 })}
                                style={{ width: 62, height: 34, padding: '0 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '14px', color: 'var(--text-primary)' }} />
                              <span style={{ fontSize: '11px' }}>{t('admin.quizEditor.noLimit')}</span>
                            </label>
                            {phaseMode && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {t('admin.quizEditor.phaseField')}
                                <input type="number" min={0} defaultValue={q.phase ?? 0}
                                  key={`phase-${q.id}-${q.phase}`}
                                  onBlur={e => { const v = Math.max(0, parseInt(e.target.value) || 0); if (v !== (q.phase ?? 0)) updateQ.mutate({ id: q.id, phase: v }) }}
                                  style={{ width: 56, height: 34, padding: '0 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--background)', fontSize: '14px', color: 'var(--text-primary)' }} />
                              </label>
                            )}
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

                          {/* "Find the red thread": show this team's/player's own
                              answers from earlier questions while they answer this one. */}
                          {(() => {
                            const earlier = questions.slice(0, qi)
                            const selected: string[] = q.showAnswersFromQuestionIds ?? []
                            const toggle = (id: string) => {
                              const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
                              updateQ.mutate({ id: q.id, showAnswersFromQuestionIds: next })
                            }
                            return (
                              <div style={{ marginBottom: '12px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
                                  {t('admin.quizEditor.showPriorAnswers')}
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: earlier.length ? 8 : 0 }}>
                                  {t('admin.quizEditor.showPriorAnswersHint')}
                                </p>
                                {earlier.length === 0 ? (
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    {t('admin.quizEditor.showPriorAnswersNone')}
                                  </p>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {earlier.map((eq: any, ei: number) => {
                                      const on = selected.includes(eq.id)
                                      const snippet = (eq.text ?? '').trim() || t('admin.quizEditor.untitledQuestion')
                                      return (
                                        <button
                                          key={eq.id}
                                          type="button"
                                          onClick={() => toggle(eq.id)}
                                          title={snippet}
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%',
                                            padding: '5px 10px', borderRadius: '99px', cursor: 'pointer',
                                            border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-light)'}`,
                                            background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--background)',
                                            color: on ? 'var(--accent)' : 'var(--text-muted)',
                                            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px',
                                            transition: 'border-color 150ms, background 150ms, color 150ms',
                                          }}
                                        >
                                          <span style={{ flexShrink: 0 }}>{on ? '✓' : ''} {t('admin.quizEditor.questionNumber', { number: ei + 1 })}</span>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, fontWeight: 500 }}>
                                            {snippet}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          <hr style={{ height: 1, background: 'var(--border-light)', border: 'none', margin: '0 0 12px' }} />

                          {q.isFreeText ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {t('admin.quizEditor.freeTextInfo')}
                              </p>
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={({ active, over }) => {
                                  if (!over || active.id === over.id) return
                                  const fields = q.fields ?? []
                                  const oldIdx = fields.findIndex((f: any) => f.id === active.id)
                                  const newIdx = fields.findIndex((f: any) => f.id === over.id)
                                  if (oldIdx === -1 || newIdx === -1) return
                                  reorderFields.mutate(arrayMove(fields, oldIdx, newIdx).map((f: any) => f.id))
                                }}
                              >
                                <SortableContext items={(q.fields ?? []).map((f: any) => f.id)} strategy={verticalListSortingStrategy}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {(q.fields ?? []).map((f: any, fi: number) => (
                                      <SortableFieldRow
                                        key={f.id}
                                        field={f}
                                        index={fi}
                                        canDelete={(q.fields ?? []).length > 1}
                                        onUpdate={d => updateField.mutate({ id: f.id, ...d })}
                                        onDelete={() => deleteField.mutate(f.id)}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                              <Button size="sm" variant="ghost" loading={addField.isPending && addField.variables === q.id} onClick={() => addField.mutate(q.id)}>
                                {t('admin.quizEditor.addField')}
                              </Button>
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
                                        onGenerate={() => setGenTarget({ kind: 'option', id: opt.id, seed: t('admin.quizEditor.promptSeedAnswer', { text: opt.text }) })}
                                        generating={generating}
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
                  </Fragment>
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
    </Layout>
  )
}
