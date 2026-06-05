import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ApiError } from '../api/client'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
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
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            label="Password / PIN"
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
            Log in
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>
            Create one
          </Link>
        </p>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.06em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
        </div>

        {/* Guest CTA */}
        <Link to="/competitions" style={{ textDecoration: 'none', display: 'block' }}>
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
              Watch Live Competitions
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              No account needed — view live leaderboards and scores
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
