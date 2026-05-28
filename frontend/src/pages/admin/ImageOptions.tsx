import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'

type Category = 'subjects' | 'clothes' | 'accessories'

const CATEGORY_LABELS: Record<Category, string> = {
  subjects: 'Subjects',
  clothes: 'Clothing',
  accessories: 'Accessories',
}

const CATEGORY_HINTS: Record<Category, string> = {
  subjects: 'e.g. "Farmyard Animal", "Robot", "Superhero"',
  clothes: 'e.g. "a pirate hat", "a wedding dress". "None" cannot be removed.',
  accessories: 'e.g. "a top hat", "sunglasses". "None" cannot be removed.',
}

function OptionList({
  category,
  items,
  onAdd,
  onRemove,
}: {
  category: Category
  items: string[]
  onAdd: (item: string) => void
  onRemove: (item: string) => void
}) {
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed || items.includes(trimmed)) return
    onAdd(trimmed)
    setNewValue('')
  }

  return (
    <Card>
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
        {CATEGORY_LABELS[category]}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {CATEGORY_HINTS[category]}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {items.map(item => {
          const isProtected = item === 'None' && category !== 'subjects'
          return (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                flex: 1, fontFamily: 'var(--font-ui)', fontSize: '13px',
                background: 'var(--surface)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)', padding: '6px 10px',
              }}>
                {item}
              </span>
              <button
                onClick={() => onRemove(item)}
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
                title={isProtected ? 'None cannot be removed' : `Remove "${item}"`}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            label="Add option"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Type and press Enter or Add"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!newValue.trim() || items.includes(newValue.trim())}
          style={{ alignSelf: 'flex-end', height: '40px' }}
        >
          Add
        </Button>
      </div>
    </Card>
  )
}

export function AdminImageOptions() {
  const qc = useQueryClient()
  const [subjects, setSubjects] = useState<string[]>([])
  const [clothes, setClothes] = useState<string[]>([])
  const [accessories, setAccessories] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

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
    mutationFn: (opts: { subjects: string[]; clothes: string[]; accessories: string[] }) =>
      api.imageOptions.update(opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['image-options'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const save = (next: { subjects: string[]; clothes: string[]; accessories: string[] }) => {
    saveMutation.mutate(next)
  }

  const handleAdd = (category: Category, item: string) => {
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

  const handleRemove = (category: Category, item: string) => {
    const next = {
      subjects: category === 'subjects' ? subjects.filter(i => i !== item) : subjects,
      clothes: category === 'clothes' ? clothes.filter(i => i !== item) : clothes,
      accessories: category === 'accessories' ? accessories.filter(i => i !== item) : accessories,
    }
    setSubjects(next.subjects)
    setClothes(next.clothes)
    setAccessories(next.accessories)
    save(next)
  }

  return (
    <AdminLayout title="Image Options">
      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {saved && (
            <p style={{ fontSize: '13px', color: 'var(--accent-green)', fontFamily: 'var(--font-ui)', textAlign: 'right' }}>
              Saved ✓
            </p>
          )}
          <OptionList
            category="subjects"
            items={subjects}
            onAdd={item => handleAdd('subjects', item)}
            onRemove={item => handleRemove('subjects', item)}
          />
          <OptionList
            category="clothes"
            items={clothes}
            onAdd={item => handleAdd('clothes', item)}
            onRemove={item => handleRemove('clothes', item)}
          />
          <OptionList
            category="accessories"
            items={accessories}
            onAdd={item => handleAdd('accessories', item)}
            onRemove={item => handleRemove('accessories', item)}
          />
        </div>
      )}
    </AdminLayout>
  )
}
