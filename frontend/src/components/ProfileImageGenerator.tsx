import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from './ui/Button'
import { api } from '../api/client'

const FALLBACK_SUBJECTS = [
  'Farmyard Animal', 'Forest Animal', 'Fish', 'Fruit',
  'Vegetable', 'Finance Symbol', 'Yellow Bear',
]

const FALLBACK_CLOTHES = [
  'None', 'a T-shirt', 'a suit and tie', 'a hoodie', 'a lab coat',
  'a cowboy outfit', 'a superhero cape', "a chef's apron",
  'viking armor', 'a tuxedo', 'a sports jersey',
  'a pirate costume', 'a wizard robe', 'a ninja outfit',
  'a space suit', 'a Hawaiian shirt',
]

const FALLBACK_ACCESSORIES = [
  'None', 'a top hat', 'a bow tie', 'a crown', 'a scarf',
  'a monocle', 'a party hat', 'a pair of headphones', 'a wizard hat',
  'a pirate hat', 'a santa hat', 'a cowboy hat', 'a flower crown',
  'a cape', 'a pair of sunglasses', 'a magnifying glass',
  'a skateboard', 'a briefcase', 'a tiny umbrella',
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomNonNone(arr: string[]): string {
  const options = arr.filter(v => v !== 'None')
  return options.length > 0 ? randomFrom(options) : arr[0]
}

const selectStyle: React.CSSProperties = {
  display: 'inline',
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  fontSize: '14px',
  color: 'var(--text-primary)',
  background: 'var(--surface)',
  border: '1.5px solid var(--border-light)',
  borderRadius: 'var(--radius-sm)',
  padding: '2px 4px',
  cursor: 'pointer',
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
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
}

export function ProfileImageGenerator({ onGenerate }: {
  onGenerate: (prompt: string) => Promise<string>
}) {
  const { data: optData } = useQuery({
    queryKey: ['image-options'],
    queryFn: () => api.imageOptions.get(),
    staleTime: Infinity,
  })

  const subjects = optData?.subjects ?? FALLBACK_SUBJECTS
  const clothesList = optData?.clothes ?? FALLBACK_CLOTHES
  const accessories = optData?.accessories ?? FALLBACK_ACCESSORIES

  const [mode, setMode] = useState<'help' | 'custom'>('help')
  const [subject, setSubject] = useState(() => randomFrom(FALLBACK_SUBJECTS))
  const [clothes, setClothes] = useState(() => randomNonNone(FALLBACK_CLOTHES))
  const [accessory, setAccessory] = useState(() => randomFrom(FALLBACK_ACCESSORIES))
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildPrompt = () => {
    const wearingPart = clothes === 'None' ? '' : `, wearing ${clothes}`
    const accPart = accessory === 'None' ? '' : (clothes === 'None' ? ` with ${accessory}` : ` and ${accessory}`)
    return `Close-up portrait of a ${subject} avatar${wearingPart}${accPart}. Face and shoulders only, centered, large in frame. Colorful, playful, simple.`
  }

  const handleGenerate = async () => {
    const prompt = mode === 'help' ? buildPrompt() : customPrompt.trim()
    if (!prompt) return
    setLoading(true)
    setError(null)
    try {
      await onGenerate(prompt)
    } catch (err: any) {
      setError(err.message ?? 'Image generation failed')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = mode === 'help' || customPrompt.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Mode selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Image Prompt
        </label>
        <select
          value={mode}
          onChange={e => setMode(e.target.value as 'help' | 'custom')}
          style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border-light)', fontSize: '15px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface)', cursor: 'pointer', outline: 'none' }}
        >
          <option value="help">Help me</option>
          <option value="custom">Custom prompt</option>
        </select>
      </div>

      {/* Help me builder */}
      {mode === 'help' && (
        <div style={{
          fontSize: '14px', lineHeight: 2, color: 'var(--text-primary)',
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          padding: '12px 14px', border: '1.5px solid var(--border-light)',
        }}>
          <span>A fun random </span>
          <select value={subject} onChange={e => setSubject(e.target.value)} style={selectStyle}>
            {subjects.map(s => <option key={s}>{s}</option>)}
          </select>
          <span> avatar</span>
          {clothes !== 'None' && <span>, wearing </span>}
          {clothes === 'None' && <span> </span>}
          <select value={clothes} onChange={e => setClothes(e.target.value)} style={selectStyle}>
            {clothesList.map(c => <option key={c}>{c}</option>)}
          </select>
          {accessory !== 'None' && (
            <span>{clothes === 'None' ? ' with ' : ' and '}</span>
          )}
          <select value={accessory} onChange={e => setAccessory(e.target.value)} style={selectStyle}>
            {accessories.map(a => <option key={a}>{a}</option>)}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>.</span>
        </div>
      )}

      {/* Custom prompt */}
      {mode === 'custom' && (
        <textarea
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          rows={3}
          placeholder="Describe your profile image..."
          style={textareaStyle}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
        />
      )}

      <Button onClick={handleGenerate} loading={loading} disabled={!canSubmit} variant="ghost" size="sm">
        ✨ Generate Profile Image
      </Button>
      {error && <p style={{ color: 'var(--danger-text)', fontSize: '13px' }}>{error}</p>}
    </div>
  )
}
