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
  onChange,
}: {
  category: Category
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setNewValue('')
  }

  const handleRemove = (item: string) => {
    onChange(items.filter(i => i !== item))
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
                onClick={() => handleRemove(item)}
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
          style={{ marginBottom: '0', alignSelf: 'flex-end', height: '40px' }}
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
    mutationFn: () => api.imageOptions.update({ subjects, clothes, accessories }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['image-options'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  return (
    <AdminLayout title="Image Options">
      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <OptionList category="subjects" items={subjects} onChange={setSubjects} />
          <OptionList category="clothes" items={clothes} onChange={setClothes} />
          <OptionList category="accessories" items={accessories} onChange={setAccessories} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Save Changes
            </Button>
            {saved && (
              <p style={{ fontSize: '14px', color: 'var(--accent-green)', fontFamily: 'var(--font-ui)' }}>
                Saved
              </p>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
