declare const __APP_VERSION__: string

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'

function SettingField({
  label, description, fieldKey, value, placeholder, type = 'text', onChange,
}: {
  label: string
  description: string
  fieldKey: string
  value: string
  placeholder?: string
  type?: string
  onChange: (key: string, value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <Input
        label={label}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(fieldKey, e.target.value)}
      />
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</p>
    </div>
  )
}

export function AdminSettings() {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    azure_image_endpoint: '',
    azure_image_api_key: '',
    azure_image_model: '',
  })
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.settings.get() })

  useEffect(() => {
    if (data) {
      setForm({
        azure_image_endpoint: data.settings.azure_image_endpoint ?? '',
        azure_image_api_key: data.settings.azure_image_api_key ?? '',
        azure_image_model: data.settings.azure_image_model ?? '',
      })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => api.settings.update(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const env = data?.envDefaults ?? {}

  return (
    <AdminLayout title="Settings">
      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
              Image Generation
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Azure AI Foundry credentials for AI image generation. Leave blank to use values from environment variables.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SettingField
                label="API Endpoint"
                description="Azure AI image generation endpoint URL"
                fieldKey="azure_image_endpoint"
                value={form.azure_image_endpoint}
                placeholder={env.azure_image_endpoint || 'https://your-resource.services.ai.azure.com/...'}
                onChange={set}
              />
              <SettingField
                label="API Key"
                description="Azure AI API key — stored securely in the database"
                fieldKey="azure_image_api_key"
                type="password"
                value={form.azure_image_api_key}
                placeholder={env.azure_image_api_key ? 'Set via environment variable' : 'Enter API key'}
                onChange={set}
              />
              <SettingField
                label="Model"
                description="Model name, e.g. MAI-Image-2e"
                fieldKey="azure_image_model"
                value={form.azure_image_model}
                placeholder={env.azure_image_model || 'MAI-Image-2e'}
                onChange={set}
              />
            </div>
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Save Settings
            </Button>
            {saved && (
              <p style={{ fontSize: '14px', color: 'var(--accent-green)', fontFamily: 'var(--font-ui)' }}>
                Saved
              </p>
            )}
          </div>

          {env.azure_image_endpoint && (
            <Card padding="12px">
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Environment variables are configured and used as fallback when fields are left blank.
                Database values (set above) take priority over environment variables.
              </p>
            </Card>
          )}

          <Card padding="12px" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                KampKollen version
              </p>
              <p style={{ fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                v{__APP_VERSION__}
              </p>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  )
}
