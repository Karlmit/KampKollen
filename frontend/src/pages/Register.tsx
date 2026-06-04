import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { api, ApiError } from '../api/client'

export function Register() {
  const [form, setForm] = useState({ username: '', password: '', realName: '' })
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.groups.listPublic().then(r => setAvailableGroups(r.groups)).catch(() => {})
  }, [])

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  function toggleGroup(id: string) {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (selectedGroupIds.length === 0) {
      setError('Please select at least one group')
      return
    }
    setError('')
    setLoading(true)
    try {
      await register({
        username: form.username,
        password: form.password,
        realName: form.realName || undefined,
        groupIds: selectedGroupIds,
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
          <img src="logo.png" alt="KampKollen" style={{ display: 'block', margin: '0 auto 8px', width: '80%', maxWidth: '280px', height: 'auto' }} />
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

          {availableGroups.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                Group * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— select the group(s) you belong to</span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableGroups.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    style={{
                      padding: '10px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                      border: selectedGroupIds.includes(g.id) ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                      background: selectedGroupIds.includes(g.id) ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--background)',
                      fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '14px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    <span style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      border: selectedGroupIds.includes(g.id) ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                      background: selectedGroupIds.includes(g.id) ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '11px',
                    }}>
                      {selectedGroupIds.includes(g.id) ? '✓' : ''}
                    </span>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
