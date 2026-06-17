import { useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { sanitizeRichText } from '../../utils'

// Minimal rich-text editor for the quiz question description. Supports bold,
// italic and underline via the toolbar (or the usual Cmd/Ctrl+B/I/U shortcuts).
// Uncontrolled like the other editor fields: it seeds from `defaultValue` and
// commits the sanitised HTML on blur.
export function RichTextEditor({ defaultValue, onCommit, placeholder }: {
  defaultValue: string
  onCommit: (html: string) => void
  placeholder?: string
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  const exec = (cmd: 'bold' | 'italic' | 'underline') => {
    ref.current?.focus()
    document.execCommand(cmd, false)
  }

  const btnStyle: CSSProperties = {
    width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
    background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button type="button" title={t('admin.quizEditor.bold')} style={{ ...btnStyle, fontWeight: 800 }} onMouseDown={e => { e.preventDefault(); exec('bold') }}>B</button>
        <button type="button" title={t('admin.quizEditor.italic')} style={{ ...btnStyle, fontStyle: 'italic' }} onMouseDown={e => { e.preventDefault(); exec('italic') }}>I</button>
        <button type="button" title={t('admin.quizEditor.underline')} style={{ ...btnStyle, textDecoration: 'underline' }} onMouseDown={e => { e.preventDefault(); exec('underline') }}>U</button>
      </div>
      <div
        ref={ref}
        className="rte-input rte-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? ''}
        onBlur={() => onCommit(sanitizeRichText(ref.current?.innerHTML))}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(defaultValue) }}
        style={{
          minHeight: 60, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)', background: 'var(--background)',
          fontSize: '14px', fontFamily: 'var(--font-ui)', lineHeight: 1.5, color: 'var(--text-primary)',
        }}
      />
    </div>
  )
}
