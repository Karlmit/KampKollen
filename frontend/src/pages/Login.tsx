import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ApiError, api } from '../api/client'
import { Competition } from '../types'
import { useTranslation } from 'react-i18next'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Guests only see ACTIVE competitions. If there's exactly one, the guest CTA
  // jumps straight to its leaderboard instead of the competition list.
  const { data: compData } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })
  const activeComps = (compData?.competitions ?? []).filter((c: Competition) => c.status === 'ACTIVE')
  const guestTarget = activeComps.length === 1 ? `/competitions/${activeComps[0].id}` : '/competitions'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--background)', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* Logo */}
        <div style={{ marginBottom: '40px' }}>
          <img
            src="logo.png"
            alt="KampKollen"
            style={{ display: 'block', margin: '0 auto', width: '80%', maxWidth: '280px', height: 'auto' }}
          />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label={t('auth.username')}
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            label={t('auth.passwordPin')}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p style={{
              background: 'var(--danger)', color: 'var(--danger-text)',
              padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: '14px', fontFamily: 'var(--font-ui)',
            }}>
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} fullWidth size="lg">
            {t('auth.logIn')}
          </Button>
        </form>

        {/* New-user path: a full-weight secondary action, grouped tight under
            Log in so it reads as a real choice, not a footnote. */}
        <Button
          type="button"
          variant="ghost"
          fullWidth
          size="lg"
          onClick={() => navigate('/register')}
          style={{ marginTop: '12px' }}
        >
          {t('auth.createAccount')}
        </Button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.06em' }}>{t('common.or').toUpperCase()}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
        </div>

        {/* Guest CTA */}
        <Link to={guestTarget} style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--border-light)',
            padding: '18px 20px',
            textAlign: 'center',
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'border-color 150ms, background 150ms',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
          >
            <p style={{ fontSize: '28px', lineHeight: 1, marginBottom: '8px' }}>📊</p>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '16px', marginBottom: '4px', color: 'var(--text-primary)' }}>
              {t('auth.watchLive')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {t('auth.watchLiveDesc')}
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
