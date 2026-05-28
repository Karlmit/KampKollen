import { useState } from 'react'
import { Button } from './ui/Button'

interface ImageGeneratorProps {
  defaultPrompt: string
  onGenerate: (prompt: string) => Promise<string>
  currentImageUrl?: string | null
  label?: string
  shape?: 'circle' | 'square'
}

function resolveUrl(src: string): string {
  if (src.startsWith('/uploads/')) return src.slice(1)
  return src
}

export function ImageGenerator({ defaultPrompt, onGenerate, currentImageUrl, label = 'Image', shape = 'square' }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(currentImageUrl ?? null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = await onGenerate(prompt)
      setImageUrl(url)
    } catch (err: any) {
      setError(err.message ?? 'Image generation failed')
    } finally {
      setLoading(false)
    }
  }

  const resolvedImageUrl = imageUrl ? resolveUrl(imageUrl) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {resolvedImageUrl && (
        <img
          src={resolvedImageUrl}
          alt={label}
          style={{
            width: '120px', height: '120px',
            objectFit: 'cover', borderRadius: shape === 'circle' ? '50%' : 'var(--radius)',
            border: '2px solid var(--border-light)',
            alignSelf: 'center',
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Image prompt
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '13px',
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-primary)',
            background: 'var(--surface)',
            border: '1.5px solid var(--border-light)',
            borderRadius: 'var(--radius)',
            resize: 'vertical',
            lineHeight: 1.5,
            boxSizing: 'border-box',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
        />
      </div>
      <Button onClick={handleGenerate} loading={loading} variant="ghost" size="sm">
        ✨ Generate {label}
      </Button>
      {error && <p style={{ color: 'var(--danger-text)', fontSize: '13px' }}>{error}</p>}
    </div>
  )
}
