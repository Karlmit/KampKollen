export function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <div
        style={{
          width: size, height: size,
          border: `3px solid var(--border-light)`,
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function PageLoader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100dvh', gap: '16px',
      background: 'var(--background)',
    }}>
      <img src="logo.png" alt="KampKollen" style={{ height: '72px', objectFit: 'contain' }} />
      <LoadingSpinner size={36} />
    </div>
  )
}
