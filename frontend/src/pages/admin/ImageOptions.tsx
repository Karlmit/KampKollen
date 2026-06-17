import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { useTranslation } from 'react-i18next'
import type { LocalizedName } from '../../utils'

type Category = 'subjects' | 'clothes' | 'accessories'

function OptionRow({ item, isProtected, onRemove, onUpdateSv }: {
  item: LocalizedName
  isProtected: boolean
  onRemove: (en: string) => void
  onUpdateSv: (en: string, sv: string) => void
}) {
  const { t } = useTranslation()
  const [sv, setSv] = useState(item.sv ?? '')

  // Keep local input in sync if the list is reloaded from the server.
  useEffect(() => { setSv(item.sv ?? '') }, [item.sv])

  const commit = () => {
    const trimmed = sv.trim()
    if (trimmed !== (item.sv ?? '')) onUpdateSv(item.en, trimmed)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, display: 'flex', gap: '6px', minWidth: 0 }}>
        <span style={{
          flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: '13px',
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)', padding: '6px 10px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.en}
        </span>
        <input
          value={sv}
          onChange={e => setSv(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder={t('admin.imageOptions.swedishPlaceholder')}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: '13px',
            background: 'var(--surface)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px', outline: 'none',
            color: 'var(--text-primary)',
          }}
        />
      </div>
      <button
        onClick={() => onRemove(item.en)}
        disabled={isProtected}
        style={{
          width: 28, height: 28, borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)',
          background: isProtected ? 'var(--surface)' : 'var(--accent-warm)',
          color: isProtected ? 'var(--text-muted)' : '#fff',
          cursor: isProtected ? 'not-allowed' : 'pointer',
          fontSize: '14px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, opacity: isProtected ? 0.4 : 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

function OptionList({
  category,
  items,
  onAdd,
  onRemove,
  onUpdateSv,
}: {
  category: Category
  items: LocalizedName[]
  onAdd: (item: LocalizedName) => void
  onRemove: (en: string) => void
  onUpdateSv: (en: string, sv: string) => void
}) {
  const { t } = useTranslation()
  const [newEn, setNewEn] = useState('')
  const [newSv, setNewSv] = useState('')

  const CATEGORY_LABELS: Record<Category, string> = {
    subjects: t('admin.imageOptions.subjects'),
    clothes: t('admin.imageOptions.clothing'),
    accessories: t('admin.imageOptions.accessories'),
  }

  const CATEGORY_HINTS: Record<Category, string> = {
    subjects: t('admin.imageOptions.subjectsHint'),
    clothes: t('admin.imageOptions.clothesHint'),
    accessories: t('admin.imageOptions.accessoriesHint'),
  }

  const isDuplicate = items.some(i => i.en === newEn.trim())

  const handleAdd = () => {
    const en = newEn.trim()
    if (!en || isDuplicate) return
    const sv = newSv.trim()
    onAdd(sv ? { en, sv } : { en })
    setNewEn('')
    setNewSv('')
  }

  return (
    <Card>
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
        {CATEGORY_LABELS[category]}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {CATEGORY_HINTS[category]}
      </p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', padding: '0 2px' }}>
        <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.imageOptions.englishName')}</span>
        <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.imageOptions.swedishName')}</span>
        <span style={{ width: 36, flexShrink: 0 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {items.map(item => (
          <OptionRow
            key={item.en}
            item={item}
            isProtected={item.en === 'None' && category !== 'subjects'}
            onRemove={onRemove}
            onUpdateSv={onUpdateSv}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            label={t('admin.imageOptions.addOption')}
            value={newEn}
            onChange={e => setNewEn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder={t('admin.imageOptions.addOptionPlaceholder')}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={t('admin.imageOptions.swedishName')}
            value={newSv}
            onChange={e => setNewSv(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder={t('admin.imageOptions.swedishPlaceholder')}
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!newEn.trim() || isDuplicate}
          style={{ alignSelf: 'flex-end', height: '40px' }}
        >
          {t('common.add')}
        </Button>
      </div>
    </Card>
  )
}

export function AdminImageOptions() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [subjects, setSubjects] = useState<LocalizedName[]>([])
  const [clothes, setClothes] = useState<LocalizedName[]>([])
  const [accessories, setAccessories] = useState<LocalizedName[]>([])
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['image-options'],
    queryFn: () => api.imageOptions.get(),
  })

  useEffect(() => {
    if (data) {
      setSubjects(data.subjects)
      setClothes(data.clothes)
      setAccessories(data.accessories)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (opts: { subjects: LocalizedName[]; clothes: LocalizedName[]; accessories: LocalizedName[] }) =>
      api.imageOptions.update(opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['image-options'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const save = (next: { subjects: LocalizedName[]; clothes: LocalizedName[]; accessories: LocalizedName[] }) => {
    saveMutation.mutate(next)
  }

  const handleExport = () => {
    const payload = JSON.stringify({ subjects, clothes, accessories }, null, 2)
    navigator.clipboard.writeText(payload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleAdd = (category: Category, item: LocalizedName) => {
    const next = {
      subjects: category === 'subjects' ? [...subjects, item] : subjects,
      clothes: category === 'clothes' ? [...clothes, item] : clothes,
      accessories: category === 'accessories' ? [...accessories, item] : accessories,
    }
    setSubjects(next.subjects)
    setClothes(next.clothes)
    setAccessories(next.accessories)
    save(next)
  }

  const handleRemove = (category: Category, en: string) => {
    const next = {
      subjects: category === 'subjects' ? subjects.filter(i => i.en !== en) : subjects,
      clothes: category === 'clothes' ? clothes.filter(i => i.en !== en) : clothes,
      accessories: category === 'accessories' ? accessories.filter(i => i.en !== en) : accessories,
    }
    setSubjects(next.subjects)
    setClothes(next.clothes)
    setAccessories(next.accessories)
    save(next)
  }

  const handleUpdateSv = (category: Category, en: string, sv: string) => {
    const apply = (list: LocalizedName[]) => list.map(i => i.en === en ? (sv ? { en, sv } : { en }) : i)
    const next = {
      subjects: category === 'subjects' ? apply(subjects) : subjects,
      clothes: category === 'clothes' ? apply(clothes) : clothes,
      accessories: category === 'accessories' ? apply(accessories) : accessories,
    }
    setSubjects(next.subjects)
    setClothes(next.clothes)
    setAccessories(next.accessories)
    save(next)
  }

  return (
    <AdminLayout title={t('admin.imageOptions.title')}>
      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            {saved && (
              <p style={{ fontSize: '13px', color: 'var(--accent-green)', fontFamily: 'var(--font-ui)' }}>
                {t('admin.imageOptions.saved')}
              </p>
            )}
            <Button size="sm" variant="ghost" onClick={handleExport}>
              {copied ? t('admin.imageOptions.copied') : t('admin.imageOptions.exportLists')}
            </Button>
          </div>
          <OptionList
            category="subjects"
            items={subjects}
            onAdd={item => handleAdd('subjects', item)}
            onRemove={en => handleRemove('subjects', en)}
            onUpdateSv={(en, sv) => handleUpdateSv('subjects', en, sv)}
          />
          <OptionList
            category="clothes"
            items={clothes}
            onAdd={item => handleAdd('clothes', item)}
            onRemove={en => handleRemove('clothes', en)}
            onUpdateSv={(en, sv) => handleUpdateSv('clothes', en, sv)}
          />
          <OptionList
            category="accessories"
            items={accessories}
            onAdd={item => handleAdd('accessories', item)}
            onRemove={en => handleRemove('accessories', en)}
            onUpdateSv={(en, sv) => handleUpdateSv('accessories', en, sv)}
          />
        </div>
      )}
    </AdminLayout>
  )
}
