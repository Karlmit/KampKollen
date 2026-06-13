import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'

// Global banner shown to every player when a Quiz Master raises the
// "come to the lobby" announcement. Tapping it jumps straight to that quiz.
export function QuizLobbyBanner() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const { data } = useQuery({
    queryKey: ['quizAnnouncements'],
    queryFn: () => api.quiz.announcements(),
    enabled: !!user,
    refetchInterval: 8000,
  })

  if (!user) return null

  // Hide announcements the user dismissed or for the quiz they're already viewing.
  const announcement = (data?.announcements ?? []).find(
    a => !dismissed.has(a.ccId) && !location.pathname.includes(`/quiz/${a.ccId}`),
  )
  if (!announcement) return null

  const target = `/competitions/${announcement.competitionId}/quiz/${announcement.ccId}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(target)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(target) }}
      className="qz-lobby-banner"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        cursor: 'pointer',
        background: 'var(--accent)',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '0 16px 12px', maxWidth: '600px', margin: '0 auto',
      }}>
        <span className="qz-float" style={{ fontSize: '22px', flexShrink: 0 }}>🎯</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', lineHeight: 1.25 }}>
            {t('quiz.bannerTitle', { name: announcement.quizName })}
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.25 }}>
            {t('quiz.bannerCta')}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('common.cancel')}
          onClick={e => { e.stopPropagation(); setDismissed(prev => new Set(prev).add(announcement.ccId)) }}
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '16px', lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
