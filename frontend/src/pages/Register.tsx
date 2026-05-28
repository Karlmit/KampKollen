import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ApiError } from '../api/client'

export function Register() {
  const [form, setForm] = useState({ username: '', password: '', realName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({
        username: form.username,
        password: form.password,
        realName: form.realName || undefined,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="logo.png" alt="KampKollen" style={{ height: '80px', objectFit: 'contain', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Username *" value={form.username} onChange={set('username')} autoComplete="username" placeholder="e.g. peter" required />
          {form.username.includes('@') && (
            <p style={{
              background: 'var(--surface)', color: 'var(--text-primary)',
              padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '14px',
            }}>
              ⚠️ Looks like you're typing an email address. Use a simple username instead, like <strong>"{form.username.split('@')[0]}"</strong>.
            </p>
          )}
          <Input label="Password / PIN *" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
          <Input label="Real name (optional)" value={form.realName} onChange={set('realName')} placeholder="e.g. Anna Karlsson" />
          {error && (
            <p style={{
              background: 'var(--danger)', color: 'var(--danger-text)',
              padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '14px',
            }}>
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: '4px' }}>
            Create account
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
