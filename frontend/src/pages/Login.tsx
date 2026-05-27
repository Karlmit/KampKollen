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

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link
            to="/competitions"
            style={{
              fontSize: '13px', color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', textDecoration: 'none',
              borderBottom: '1px solid var(--border-light)',
              paddingBottom: '1px',
            }}
          >
            Browse as Guest
          </Link>
        </div>
      </div>
    </div>
  )
}
