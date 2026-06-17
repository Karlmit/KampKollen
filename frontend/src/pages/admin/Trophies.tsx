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
import { useTranslation } from 'react-i18next'
import { trophyTitle, type LocalizedName } from '../../utils'

function WordRow({ word, generatingWord, onRemove, onGenerate, onUpdateSv }: {
  word: LocalizedName
  generatingWord: string | null
  onRemove: (en: string) => void
  onGenerate: (word: LocalizedName) => void
  onUpdateSv: (en: string, sv: string) => void
}) {
  const { t } = useTranslation()
  const [sv, setSv] = useState(word.sv ?? '')

  // Keep local input in sync if the word list is reloaded from the server.
  useEffect(() => { setSv(word.sv ?? '') }, [word.sv])

  const commit = () => {
    const trimmed = sv.trim()
    if (trimmed !== (word.sv ?? '')) onUpdateSv(word.en, trimmed)
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
          {word.en}
        </span>
        <input
          value={sv}
          onChange={e => setSv(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder={t('admin.trophies.swedishNamePlaceholder')}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: '13px',
            background: 'var(--surface)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px', outline: 'none',
            color: 'var(--text-primary)',
          }}
        />
      </div>
      <button
        onClick={() => onGenerate(word)}
        disabled={generatingWord !== null}
        title={t('admin.trophies.generateAwardFor', { word: word.en })}
        style={{
          width: 28, height: 28, borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)',
          background: generatingWord === word.en ? 'var(--accent)' : 'var(--surface)',
          color: generatingWord === word.en ? '#fff' : 'var(--text-muted)',
          cursor: generatingWord !== null ? 'default' : 'pointer',
          fontSize: '13px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          opacity: generatingWord !== null && generatingWord !== word.en ? 0.4 : 1,
          transition: 'background 150ms, color 150ms',
        }}
      >
        {generatingWord === word.en ? '…' : '⚡'}
      </button>
      <button
        onClick={() => onRemove(word.en)}
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
  )
}

function WordList({ words, generatingWord, onAdd, onRemove, onGenerate, onUpdateSv }: {
  words: LocalizedName[]
  generatingWord: string | null
  onAdd: (w: LocalizedName) => void
  onRemove: (en: string) => void
  onGenerate: (w: LocalizedName) => void
  onUpdateSv: (en: string, sv: string) => void
}) {
  const { t } = useTranslation()
  const [newEn, setNewEn] = useState('')
  const [newSv, setNewSv] = useState('')

  const isDuplicate = words.some(w => w.en === newEn.trim())

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
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{t('admin.trophies.awardWords')}</p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {t('admin.trophies.awardWordsDesc')}
      </p>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', padding: '0 2px' }}>
        <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.trophies.englishName')}</span>
        <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.trophies.swedishName')}</span>
        <span style={{ width: 64, flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {words.map(word => (
          <WordRow
            key={word.en}
            word={word}
            generatingWord={generatingWord}
            onRemove={onRemove}
            onGenerate={onGenerate}
            onUpdateSv={onUpdateSv}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            label={t('admin.trophies.addWord')}
            value={newEn}
            onChange={e => setNewEn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder={t('admin.trophies.addWordPlaceholder')}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={t('admin.trophies.swedishName')}
            value={newSv}
            onChange={e => setNewSv(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder={t('admin.trophies.swedishNamePlaceholder')}
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!newEn.trim() || isDuplicate}
          style={{ alignSelf: 'flex-end', height: '40px' }}
        >
          {t('admin.trophies.add')}
        </Button>
      </div>
    </Card>
  )
}

export function AdminTrophies() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [words, setWords] = useState<LocalizedName[]>([])
  const [generatingWord, setGeneratingWord] = useState<string | null>(null)
  const [sendTrophy, setSendTrophy] = useState<any>(null)
  const [sendUserId, setSendUserId] = useState('')
  const [sendError, setSendError] = useState('')
  const [reserveTrophy, setReserveTrophy] = useState<any>(null)
  const [reserveCompId, setReserveCompId] = useState('')

  const { data: wordsData } = useQuery({
    queryKey: ['trophy-words'],
    queryFn: () => api.trophies.getWords(),
  })

  useEffect(() => {
    if (wordsData) setWords(wordsData.words)
  }, [wordsData])

  const { data: statusData } = useQuery({
    queryKey: ['trophy-status'],
    queryFn: () => api.trophies.getStatus(),
    refetchInterval: (query) => (query.state.data?.generating ?? 0) > 0 ? 1500 : false,
    refetchIntervalInBackground: true,
  })

  const { data: storageData, isLoading: storageLoading } = useQuery({
    queryKey: ['trophy-storage'],
    queryFn: () => api.trophies.getStorage(),
    refetchInterval: (query) => {
      void query
      return (statusData?.generating ?? 0) > 0 ? 2000 : false
    },
  })

  const { data: compsData } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
    enabled: !!reserveTrophy,
  })
  const reservableComps = (compsData?.competitions ?? []).filter(
    (c: any) => c.status === 'ACTIVE' || c.status === 'REGISTRATION'
  )

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: !!sendTrophy,
  })

  const updateWordsMutation = useMutation({
    mutationFn: (w: LocalizedName[]) => api.trophies.updateWords(w),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trophy-words'] }),
  })

  const generateMutation = useMutation({
    mutationFn: (arg?: { word: string; wordSv?: string }) => api.trophies.generate(arg?.word, arg?.wordSv),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trophy-storage'] })
      qc.invalidateQueries({ queryKey: ['trophy-status'] })
      setGeneratingWord(null)
    },
    onError: () => setGeneratingWord(null),
  })

  const ensureMutation = useMutation({
    mutationFn: (competitionId: string) => api.trophies.ensureForCompetition(competitionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trophy-status'] }),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.trophies.send(sendTrophy.id, sendUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trophy-storage'] })
      qc.invalidateQueries({ queryKey: ['trophy-status'] })
      setSendTrophy(null)
      setSendUserId('')
      setSendError('')
    },
    onError: (err: any) => setSendError(err.message ?? 'Failed to send'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.trophies.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trophy-storage'] })
      qc.invalidateQueries({ queryKey: ['trophy-status'] })
    },
  })

  const reserveMutation = useMutation({
    mutationFn: ({ id, competitionId }: { id: string; competitionId: string | null }) =>
      api.trophies.reserve(id, competitionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trophy-storage'] })
      qc.invalidateQueries({ queryKey: ['trophy-status'] })
      setReserveTrophy(null)
      setReserveCompId('')
    },
  })

  const handleWordAdd = (w: LocalizedName) => {
    const next = [...words, w]
    setWords(next)
    updateWordsMutation.mutate(next)
  }

  const handleWordRemove = (en: string) => {
    const next = words.filter(x => x.en !== en)
    setWords(next)
    updateWordsMutation.mutate(next)
  }

  const handleWordUpdateSv = (en: string, sv: string) => {
    const next = words.map(w => w.en === en ? (sv ? { en, sv } : { en }) : w)
    setWords(next)
    updateWordsMutation.mutate(next)
  }

  const handleWordGenerate = (word: LocalizedName) => {
    setGeneratingWord(word.en)
    generateMutation.mutate({ word: word.en, wordSv: word.sv })
  }

  const generating = statusData?.generating ?? 0
  const storageCount = statusData?.storageCount ?? storageData?.trophies?.length ?? 0
  const activeCompetitions = statusData?.activeCompetitions ?? []

  return (
    <AdminLayout title={t('admin.trophies.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Award Words */}
        <WordList
          words={words}
          generatingWord={generatingWord}
          onAdd={handleWordAdd}
          onRemove={handleWordRemove}
          onGenerate={handleWordGenerate}
          onUpdateSv={handleWordUpdateSv}
        />

        {/* Active competition needs */}
        {activeCompetitions.length > 0 && (
          <section>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {t('admin.trophies.activeCompetitions')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeCompetitions.map((comp: any) => {
                const hasEnough = storageCount >= comp.needed
                const deficit = Math.max(0, comp.needed - storageCount)
                return (
                  <Card key={comp.id} padding="12px">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{comp.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {t('admin.trophies.needs', { needed: comp.needed, maxTeamSize: comp.maxTeamSize, challengeCount: comp.challengeCount })}
                          {comp.reservedCount > 0 && (
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}> {t('admin.trophies.reserved', { count: comp.reservedCount })}</span>
                          )}
                          {' · '}
                          <span style={{ color: hasEnough ? 'var(--accent)' : 'var(--accent-warm)', fontWeight: 600 }}>
                            {hasEnough
                              ? t('admin.trophies.inStorage', { count: storageCount })
                              : t('admin.trophies.missing', { count: storageCount, deficit })}
                          </span>
                        </p>
                      </div>
                      {!hasEnough && (
                        <Button
                          size="sm"
                          onClick={() => ensureMutation.mutate(comp.id)}
                          loading={ensureMutation.isPending}
                          style={{ flexShrink: 0, fontSize: '11px' }}
                        >
                          {t('admin.trophies.generate', { count: deficit })}
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        )}

        {/* Award Storage */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {t('admin.trophies.awardStorage', { count: storageCount })}
              </h2>
              {generating > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontFamily: 'var(--font-ui)', color: 'var(--accent)',
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  borderRadius: '20px', padding: '2px 8px',
                }}>
                  <span className="live-dot" style={{ background: 'var(--accent)', width: 6, height: 6 }} />
                  {t('admin.trophies.generating', { count: generating })}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate(undefined)}
              loading={generateMutation.isPending && generatingWord === null}
            >
              {t('admin.trophies.generateNew')}
            </Button>
          </div>

          {storageLoading ? <LoadingSpinner /> : storageData?.trophies?.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              {t('admin.trophies.noAwards')}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {storageData?.trophies?.map((trophy: any) => (
                <Card key={trophy.id} padding="10px" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <img
                    src={trophy.imageUrl}
                    alt={trophyTitle(trophy, i18n.language)}
                    style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                  />
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>{trophyTitle(trophy, i18n.language)}</p>

                  {/* Reservation status */}
                  {trophy.reservedForCompetition ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
                      <span style={{
                        fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: 700,
                        color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        borderRadius: '20px', padding: '2px 6px',
                        maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t('admin.trophies.reservedFor', { name: trophy.reservedForCompetition.name })}
                      </span>
                      <button
                        onClick={() => reserveMutation.mutate({ id: trophy.id, competitionId: null })}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: '12px', padding: '0', lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReserveTrophy(trophy); setReserveCompId('') }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)',
                        padding: '0', textDecoration: 'underline', textDecorationStyle: 'dotted',
                      }}
                    >
                      {t('admin.trophies.reserveFor')}
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ flex: 1, fontSize: '11px' }}
                      onClick={() => { setSendTrophy(trophy); setSendUserId(''); setSendError('') }}
                    >
                      {t('admin.trophies.send')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      style={{ fontSize: '11px' }}
                      onClick={() => deleteMutation.mutate(trophy.id)}
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
        title={t('admin.trophies.sendTrophy', { title: sendTrophy ? trophyTitle(sendTrophy, i18n.language) : '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSendTrophy(null); setSendUserId(''); setSendError('') }}>{t('common.cancel')}</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!sendUserId}
              loading={sendMutation.isPending}
            >
              {t('admin.trophies.send')}
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

      {/* Reserve for competition modal */}
      <Modal
        open={!!reserveTrophy}
        onClose={() => { setReserveTrophy(null); setReserveCompId('') }}
        title={t('admin.trophies.reserveTrophy', { title: reserveTrophy ? trophyTitle(reserveTrophy, i18n.language) : '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setReserveTrophy(null); setReserveCompId('') }}>{t('common.cancel')}</Button>
            <Button
              onClick={() => reserveMutation.mutate({ id: reserveTrophy.id, competitionId: reserveCompId })}
              disabled={!reserveCompId}
              loading={reserveMutation.isPending}
            >
              {t('admin.trophies.reserve')}
            </Button>
          </>
        }
      >
        {reservableComps.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '12px 0' }}>
            {t('admin.trophies.noActiveComps')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {reservableComps.map((c: any) => (
              <div
                key={c.id}
                onClick={() => setReserveCompId(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${reserveCompId === c.id ? 'var(--accent)' : 'var(--border-light)'}`,
                  cursor: 'pointer',
                  background: reserveCompId === c.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{c.name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.status}</p>
                </div>
                {reserveCompId === c.id && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
