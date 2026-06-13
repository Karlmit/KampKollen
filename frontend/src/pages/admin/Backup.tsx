import { useRef, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { api, ApiError } from '../../api/client'
import { useTranslation } from 'react-i18next'

export function AdminBackup() {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleDownload() {
    setDownloadError('')
    setDownloading(true)
    try {
      await api.backup.download()
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : t('admin.backup.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  async function handleRestore() {
    if (!restoreFile) return
    setRestoreError('')
    setRestoreSuccess(false)
    setRestoring(true)
    try {
      await api.backup.restore(restoreFile)
      setRestoreSuccess(true)
      setRestoreFile(null)
      setConfirm(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setRestoreError(e instanceof ApiError ? e.message : t('admin.backup.restoreFailed'))
    } finally {
      setRestoring(false)
    }
  }

  return (
    <AdminLayout title={t('admin.backup.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Download */}
        <Card>
          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
            {t('admin.backup.downloadBackup')}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('admin.backup.downloadDesc')}
          </p>
          <Button onClick={handleDownload} loading={downloading}>
            {t('admin.backup.download')}
          </Button>
          {downloadError && (
            <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
              {downloadError}
            </p>
          )}
        </Card>

        {/* Restore */}
        <Card>
          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
            {t('admin.backup.restoreBackup')}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginBottom: '12px', fontFamily: 'var(--font-ui)' }}>
            {t('admin.backup.restoreWarning')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                htmlFor="backup-file"
                style={{
                  display: 'inline-block', padding: '8px 16px',
                  border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
                  background: 'var(--surface-raised)',
                }}
              >
                {restoreFile ? restoreFile.name : t('admin.backup.chooseFile')}
              </label>
              <input
                ref={fileRef}
                id="backup-file"
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setRestoreFile(f)
                  setConfirm(false)
                  setRestoreError('')
                  setRestoreSuccess(false)
                }}
              />
            </div>

            {restoreFile && !confirm && (
              <div style={{
                padding: '12px', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--accent-warm) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-warm) 30%, transparent)',
              }}>
                <p style={{ fontSize: '13px', fontFamily: 'var(--font-ui)', marginBottom: '10px' }}>
                  {t('admin.backup.willBeReplaced')}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="ghost" size="sm" onClick={() => { setRestoreFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={() => setConfirm(true)}>
                    {t('admin.backup.yesRestore')}
                  </Button>
                </div>
              </div>
            )}

            {restoreFile && confirm && (
              <Button onClick={handleRestore} loading={restoring} disabled={restoring}>
                {t('admin.backup.restoreNow')}
              </Button>
            )}
          </div>

          {restoreSuccess && (
            <p style={{ fontSize: '13px', color: 'var(--accent-green)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
              {t('admin.backup.restoreComplete')}
            </p>
          )}
          {restoreError && (
            <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
              {restoreError}
            </p>
          )}
        </Card>

      </div>
    </AdminLayout>
  )
}
