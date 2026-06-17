import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from './ui/Button'
import { api } from '../api/client'
import { useTranslation } from 'react-i18next'
import { pickLocalized, type LocalizedName } from '../utils'

const FALLBACK_SUBJECTS: LocalizedName[] = [
  'Farmyard Animal', 'Forest Animal', 'Fish', 'Fruit',
  'Vegetable', 'Finance Symbol', 'Yellow Bear',
].map(en => ({ en }))

const FALLBACK_CLOTHES: LocalizedName[] = [
  'None', 'a T-shirt', 'a suit and tie', 'a hoodie', 'a lab coat',
  'a cowboy outfit', 'a superhero cape', "a chef's apron",
  'viking armor', 'a tuxedo', 'a sports jersey',
  'a pirate costume', 'a wizard robe', 'a ninja outfit',
  'a space suit', 'a Hawaiian shirt',
].map(en => ({ en }))

const FALLBACK_ACCESSORIES: LocalizedName[] = [
  'None', 'a top hat', 'a bow tie', 'a crown', 'a scarf',
  'a monocle', 'a party hat', 'a pair of headphones', 'a wizard hat',
  'a pirate hat', 'a santa hat', 'a cowboy hat', 'a flower crown',
  'a cape', 'a pair of sunglasses', 'a magnifying glass',
  'a skateboard', 'a briefcase', 'a tiny umbrella',
].map(en => ({ en }))

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// The English value is always what feeds the (English) generation prompt.
function randomEn(arr: LocalizedName[]): string {
  return arr.length > 0 ? randomFrom(arr).en : ''
}

function randomNonNoneEn(arr: LocalizedName[]): string {
  const options = arr.filter(v => v.en !== 'None')
  return options.length > 0 ? randomFrom(options).en : (arr[0]?.en ?? '')
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
  const { t, i18n } = useTranslation()
  const { data: optData } = useQuery({
    queryKey: ['image-options'],
    queryFn: () => api.imageOptions.get(),
    staleTime: Infinity,
  })

  const subjects = optData?.subjects ?? FALLBACK_SUBJECTS
  const clothesList = optData?.clothes ?? FALLBACK_CLOTHES
  const accessories = optData?.accessories ?? FALLBACK_ACCESSORIES

  // Label for a select option: Swedish when available, English otherwise.
  // "None" is a control value, so it gets a dedicated translation.
  const label = (opt: LocalizedName) => opt.en === 'None' ? t('profileImage.none') : pickLocalized(opt, i18n.language)

  const [mode, setMode] = useState<'help' | 'custom'>('help')
  // State holds the English value (which builds the prompt); selects display labels.
  const [subject, setSubject] = useState(() => randomEn(FALLBACK_SUBJECTS))
  const [clothes, setClothes] = useState(() => randomNonNoneEn(FALLBACK_CLOTHES))
  const [accessory, setAccessory] = useState(() => randomEn(FALLBACK_ACCESSORIES))
  const [customPrompt, setCustomPrompt] = useState('')

  // Re-randomize once when server options first arrive (may include options beyond the fallback list)
  const seededFromServer = useRef(false)
  useEffect(() => {
    if (!seededFromServer.current && optData) {
      seededFromServer.current = true
      setSubject(randomEn(optData.subjects))
      setClothes(randomNonNoneEn(optData.clothes))
      setAccessory(randomEn(optData.accessories))
    }
  }, [optData])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildPrompt = () => {
    const wearingPart = clothes === 'None' ? '' : `, wearing ${clothes}`
    const accPart = accessory === 'None' ? '' : (clothes === 'None' ? ` with ${accessory}` : ` and ${accessory}`)
    return `Close-up portrait of a ${subject} avatar${wearingPart}${accPart}. Face and shoulders only, centered, large in frame. Colorful, playful, simple. Colorful background.`
  }

  const handleGenerate = async () => {
    const prompt = mode === 'help' ? buildPrompt() : customPrompt.trim()
    if (!prompt) return
    setLoading(true)
    setError(null)
    try {
      await onGenerate(prompt)
    } catch (err: any) {
      setError(err.message ?? t('profileImage.generationFailed'))
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
          {t('profileImage.imagePrompt')}
        </label>
        <select
          value={mode}
          onChange={e => setMode(e.target.value as 'help' | 'custom')}
          style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border-light)', fontSize: '15px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface)', cursor: 'pointer', outline: 'none' }}
        >
          <option value="help">{t('profileImage.helpMe')}</option>
          <option value="custom">{t('profileImage.customPrompt')}</option>
        </select>
      </div>

      {/* Help me builder */}
      {mode === 'help' && (
        <div style={{
          fontSize: '14px', lineHeight: 2, color: 'var(--text-primary)',
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          padding: '12px 14px', border: '1.5px solid var(--border-light)',
        }}>
          <span>{t('profileImage.aFun')} </span>
          <select value={subject} onChange={e => setSubject(e.target.value)} style={selectStyle}>
            {subjects.map(s => <option key={s.en} value={s.en}>{label(s)}</option>)}
          </select>
          <span> {t('profileImage.avatar')}</span>
          {clothes !== 'None' && <span>, {t('profileImage.wearing')} </span>}
          {clothes === 'None' && <span> </span>}
          <select value={clothes} onChange={e => setClothes(e.target.value)} style={selectStyle}>
            {clothesList.map(c => <option key={c.en} value={c.en}>{label(c)}</option>)}
          </select>
          {accessory !== 'None' && (
            <span>{clothes === 'None' ? ` ${t('profileImage.with')} ` : ` ${t('profileImage.and')} `}</span>
          )}
          <select value={accessory} onChange={e => setAccessory(e.target.value)} style={selectStyle}>
            {accessories.map(a => <option key={a.en} value={a.en}>{label(a)}</option>)}
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
          placeholder={t('profileImage.describeImage')}
          style={textareaStyle}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
        />
      )}

      <Button onClick={handleGenerate} loading={loading} disabled={!canSubmit} variant="ghost" size="sm">
        {t('profileImage.generateProfileImage')}
      </Button>
      {error && <p style={{ color: 'var(--danger-text)', fontSize: '13px' }}>{error}</p>}
    </div>
  )
}
