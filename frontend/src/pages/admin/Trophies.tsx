import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'

function WordList({ words, onAdd, onRemove }: {
  words: string[]
  onAdd: (w: string) => void
  onRemove: (w: string) => void
}) {
  const [newWord, setNewWord] = useState('')

  const handleAdd = () => {
    const trimmed = newWord.trim()
    if (!trimmed || words.includes(trimmed)) return
    onAdd(trimmed)
    setNewWord('')
  }

  return (
    <Card>
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>Trophy Words</p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Random words used when generating trophy images.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {words.map(word => (
          <div key={word} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              flex: 1, fontFamily: 'var(--font-ui)', fontSize: '13px',
              background: 'var(--surface)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)', padding: '6px 10px',
            }}>
              {word}
            </span>
            <button
              onClick={() => onRemove(word)}
              style={{
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                background: 'var(--accent-warm)', color: '#fff',
                cursor: 'pointer', fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            label="Add word"
            value={newWord}
            onChange={e => setNewWord(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Type and press Enter or Add"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!newWord.trim() || words.includes(newWord.trim())}
          style={{ alignSelf: 'flex-end', height: '40px' }}
        >
          Add
        </Button>
      </div>
    </Card>
  )
}

export function AdminTrophies() {
  const qc = useQueryClient()
  const [words, setWords] = useState<string[]>([])
  const [sendTrophy, setSendTrophy] = useState<any>(null)
  const [sendUserId, setSendUserId] = useState('')
  const [sendError, setSendError] = useState('')

  const { data: wordsData } = useQuery({
    queryKey: ['trophy-words'],
    queryFn: () => api.trophies.getWords(),
  })

  useEffect(() => {
    if (wordsData) setWords(wordsData.words)
  }, [wordsData])

  const { data: storageData, isLoading: storageLoading } = useQuery({
    queryKey: ['trophy-storage'],
    queryFn: () => api.trophies.getStorage(),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: !!sendTrophy,
  })

  const updateWordsMutation = useMutation({
    mutationFn: (w: string[]) => api.trophies.updateWords(w),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trophy-words'] }),
  })

  const generateMutation = useMutation({
    mutationFn: () => api.trophies.generate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trophy-storage'] }),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.trophies.send(sendTrophy.id, sendUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trophy-storage'] })
      setSendTrophy(null)
      setSendUserId('')
      setSendError('')
    },
    onError: (err: any) => setSendError(err.message ?? 'Failed to send'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.trophies.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trophy-storage'] }),
  })

  const handleWordAdd = (w: string) => {
    const next = [...words, w]
    setWords(next)
    updateWordsMutation.mutate(next)
  }

  const handleWordRemove = (w: string) => {
    const next = words.filter(x => x !== w)
    setWords(next)
    updateWordsMutation.mutate(next)
  }

  return (
    <AdminLayout title="Trophies">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Trophy Words */}
        <WordList words={words} onAdd={handleWordAdd} onRemove={handleWordRemove} />

        {/* Trophy Storage */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Trophy Storage ({storageData?.trophies?.length ?? 0})
            </h2>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
            >
              + Generate
            </Button>
          </div>

          {storageLoading ? <LoadingSpinner /> : storageData?.trophies?.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              No trophies in storage. Generate one!
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {storageData?.trophies?.map((t: any) => (
                <Card key={t.id} padding="10px" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={t.imageUrl.startsWith('http') ? t.imageUrl : `/${t.imageUrl}`}
                    alt={t.title}
                    style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                  />
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>{t.title}</p>
                  <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ flex: 1, fontSize: '11px' }}
                      onClick={() => { setSendTrophy(t); setSendUserId(''); setSendError('') }}
                    >
                      Send
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      style={{ fontSize: '11px' }}
                      onClick={() => deleteMutation.mutate(t.id)}
                      loading={deleteMutation.isPending}
                    >
                      ×
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Send to user modal */}
      <Modal
        open={!!sendTrophy}
        onClose={() => { setSendTrophy(null); setSendUserId(''); setSendError('') }}
        title={`Send "${sendTrophy?.title}" to…`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSendTrophy(null); setSendUserId(''); setSendError('') }}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!sendUserId}
              loading={sendMutation.isPending}
            >
              Send
            </Button>
          </>
        }
      >
        {!usersData ? <LoadingSpinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {usersData.users?.filter((u: any) => !u.isDummy).map((u: any) => (
              <div
                key={u.id}
                onClick={() => { setSendUserId(u.id); setSendError('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${sendUserId === u.id ? 'var(--accent)' : 'var(--border-light)'}`,
                  cursor: 'pointer',
                  background: sendUserId === u.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                <Avatar src={u.profileImageUrl} name={u.displayName ?? u.username} size={28} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{u.displayName ?? u.username}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{u.username}</p>
                </div>
                {sendUserId === u.id && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>
        )}
        {sendError && (
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
            {sendError}
          </p>
        )}
      </Modal>
    </AdminLayout>
  )
}
