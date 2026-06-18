import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useTranslation } from 'react-i18next'

interface SaveTemplateDialogProps {
  open: boolean
  /** Seed name shown in the field; the user can edit it freely. */
  defaultName: string
  submitting: boolean
  onSubmit: (name: string) => void
  onClose: () => void
}

/**
 * Prompt dialog for saving the current quiz as a reusable template. Lets the
 * admin name the template before it is created, defaulting to the quiz's name.
 */
export function SaveTemplateDialog({ open, defaultName, submitting, onSubmit, onClose }: SaveTemplateDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(defaultName)

  // Reseed whenever the dialog is (re)opened.
  useEffect(() => { if (open) setName(defaultName) }, [open, defaultName])

  const canSubmit = !!name.trim() && !submitting
  const submit = () => { if (canSubmit) onSubmit(name.trim()) }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('admin.quizEditor.saveTemplateTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={submitting} disabled={!name.trim()}>
            {t('admin.quizEditor.saveAsTemplate')}
          </Button>
        </>
      }
    >
      <label htmlFor="tpl-name" style={{
        display: 'block', marginBottom: 6,
        fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {t('admin.quizEditor.templateNameLabel')}
      </label>
      <input
        id="tpl-name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        autoFocus
        placeholder={t('admin.quizEditor.templateNamePlaceholder')}
        style={{
          width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: 'var(--font-body)',
          color: 'var(--text-primary)', background: 'var(--surface)',
          border: '1.5px solid var(--border-light)', borderRadius: 'var(--radius)',
          lineHeight: 1.5, boxSizing: 'border-box', outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
      />
      <p style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {t('admin.quizEditor.saveAsTemplateHint')}
      </p>
    </Modal>
  )
}
