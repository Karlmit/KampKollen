import { useRef, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { api, ApiError } from '../../api/client'

export function AdminBackup() {
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
      setDownloadError(e instanceof ApiError ? e.message : 'Download failed')
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
      setRestoreError(e instanceof ApiError ? e.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <AdminLayout title="Backup">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Download */}
        <Card>
          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
            Download Backup
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Exports all users, competitions, challenges, scores, trophies, settings, and uploaded images into a single ZIP file.
          </p>
          <Button onClick={handleDownload} loading={downloading}>
            Download Backup
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
            Restore from Backup
          </p>
          <p style={{ fontSize: '13px', color: 'var(--accent-warm)', marginBottom: '12px', fontFamily: 'var(--font-ui)' }}>
            Warning: This will replace all current data with the contents of the backup. This cannot be undone.
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
                {restoreFile ? restoreFile.name : 'Choose ZIP file'}
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
                  All current data will be permanently replaced. Are you sure?
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="ghost" size="sm" onClick={() => { setRestoreFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => setConfirm(true)}>
                    Yes, restore
                  </Button>
                </div>
              </div>
            )}

            {restoreFile && confirm && (
              <Button onClick={handleRestore} loading={restoring} disabled={restoring}>
                Restore Now
              </Button>
            )}
          </div>

          {restoreSuccess && (
            <p style={{ fontSize: '13px', color: 'var(--accent-green)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
              Restore complete. Reload the page to see the restored data.
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
