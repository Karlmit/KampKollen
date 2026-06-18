declare const __APP_VERSION__: string

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    azure_image_endpoint: '',
    azure_image_api_key: '',
    azure_image_model: '',
    single_group_mode: 'false',
    single_group_id: '',
  })
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.settings.get() })
  const { data: groupsData } = useQuery({ queryKey: ['admin-groups'], queryFn: () => api.groups.list() })
  const groups = groupsData?.groups ?? []

  useEffect(() => {
    if (data) {
      setForm({
        azure_image_endpoint: data.settings.azure_image_endpoint ?? '',
        azure_image_api_key: data.settings.azure_image_api_key ?? '',
        azure_image_model: data.settings.azure_image_model ?? '',
        single_group_mode: data.settings.single_group_mode ?? 'false',
        single_group_id: data.settings.single_group_id ?? '',
      })
    }
  }, [data])

  const singleGroupOn = form.single_group_mode === 'true'

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
    <AdminLayout title={t('admin.settings.title')}>
      {isLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
              {t('admin.settings.imageGeneration')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {t('admin.settings.imageGenerationDesc')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SettingField
                label={t('admin.settings.apiEndpoint')}
                description={t('admin.settings.apiEndpointDesc')}
                fieldKey="azure_image_endpoint"
                value={form.azure_image_endpoint}
                placeholder={env.azure_image_endpoint || 'https://your-resource.services.ai.azure.com/...'}
                onChange={set}
              />
              <SettingField
                label={t('admin.settings.apiKey')}
                description={t('admin.settings.apiKeyDesc')}
                fieldKey="azure_image_api_key"
                type="password"
                value={form.azure_image_api_key}
                placeholder={env.azure_image_api_key ? t('admin.settings.setViaEnv') : t('admin.settings.enterApiKey')}
                onChange={set}
              />
              <SettingField
                label={t('admin.settings.model')}
                description={t('admin.settings.modelDesc')}
                fieldKey="azure_image_model"
                value={form.azure_image_model}
                placeholder={env.azure_image_model || 'MAI-Image-2e'}
                onChange={set}
              />
            </div>
          </Card>

          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
              {t('admin.settings.registration')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {t('admin.settings.registrationDesc')}
            </p>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={singleGroupOn}
                onChange={e => set('single_group_mode', e.target.checked ? 'true' : 'false')}
                style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '14px' }}>
                  {t('admin.settings.singleGroupMode')}
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {t('admin.settings.singleGroupModeDesc')}
                </span>
              </span>
            </label>

            {singleGroupOn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '13px' }}>
                  {t('admin.settings.singleGroupSelect')}
                </label>
                <select
                  value={form.single_group_id}
                  onChange={e => set('single_group_id', e.target.value)}
                  style={{ padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', fontSize: '15px' }}
                >
                  <option value="">{t('admin.settings.singleGroupSelectPlaceholder')}</option>
                  {groups.map((g: { id: string; name: string }) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {form.single_group_id
                    ? t('admin.settings.singleGroupSelectDesc')
                    : t('admin.settings.singleGroupNeedsGroup')}
                </p>
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {t('admin.settings.saveSettings')}
            </Button>
            {saved && (
              <p style={{ fontSize: '14px', color: 'var(--accent-green)', fontFamily: 'var(--font-ui)' }}>
                {t('admin.settings.saved')}
              </p>
            )}
          </div>

          {env.azure_image_endpoint && (
            <Card padding="12px">
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('admin.settings.envFallback')}
              </p>
            </Card>
          )}

          <Card padding="12px" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                {t('admin.settings.version')}
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
