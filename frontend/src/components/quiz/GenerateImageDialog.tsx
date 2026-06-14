import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useTranslation } from 'react-i18next'

interface GenerateImageDialogProps {
  open: boolean
  title: string
  /** Seed text shown in the prompt field; the user can edit it freely. */
  defaultPrompt: string
  submitting: boolean
  onSubmit: (prompt: string) => void
  onClose: () => void
}

/**
 * Prompt dialog for AI image generation. Used for quiz questions, answers and
 * the quiz cover image — anywhere the user should be able to describe the image
 * before it is generated.
 */
export function GenerateImageDialog({ open, title, defaultPrompt, submitting, onSubmit, onClose }: GenerateImageDialogProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState(defaultPrompt)

  // Reseed whenever the dialog is (re)opened for a different target.
  useEffect(() => { if (open) setPrompt(defaultPrompt) }, [open, defaultPrompt])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={() => onSubmit(prompt.trim())} loading={submitting} disabled={!prompt.trim()}>
            ✨ {t('admin.quizEditor.generateImageBtn')}
          </Button>
        </>
      }
    >
      <label htmlFor="gen-img-prompt" style={{
        display: 'block', marginBottom: 6,
        fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {t('admin.quizEditor.imagePromptLabel')}
      </label>
      <textarea
        id="gen-img-prompt"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={4}
        autoFocus
        placeholder={t('admin.quizEditor.imagePromptPlaceholder')}
        style={{
          width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: 'var(--font-body)',
          color: 'var(--text-primary)', background: 'var(--surface)',
          border: '1.5px solid var(--border-light)', borderRadius: 'var(--radius)',
          resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
      />
      <p style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {t('admin.quizEditor.imagePromptHint')}
      </p>
    </Modal>
  )
}
