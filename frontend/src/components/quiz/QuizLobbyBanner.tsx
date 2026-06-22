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

  const { data } = useQuery({
    queryKey: ['quizAnnouncements'],
    queryFn: () => api.quiz.announcements(),
    enabled: !!user,
    refetchInterval: 8000,
  })

  if (!user) return null

  // Hide the announcement for the quiz the player is already viewing.
  const announcement = (data?.announcements ?? []).find(
    a => !location.pathname.includes(`/quiz/${a.ccId}`),
  )
  if (!announcement) return null

  const target = `/competitions/${announcement.competitionId}/quiz/${announcement.ccId}`

  // A quiz that is already running (ACTIVE/CORRECTING) gets a steadier "rejoin"
  // message; a quiz still in the lobby keeps the QM's "come on over" call.
  const isLive = announcement.status !== 'LOBBY'
  const title = isLive ? 'quiz.bannerLiveTitle' : 'quiz.bannerTitle'
  const cta = isLive ? 'quiz.bannerLiveCta' : 'quiz.bannerCta'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(target)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(target) }}
      className="qz-lobby-banner qz-lobby-banner--pulse"
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
          <p style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', lineHeight: 1.25,
          }}>
            {isLive && <span className="live-dot" aria-hidden />}
            {t(title, { name: announcement.quizName })}
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.25 }}>
            {t(cta)}
          </p>
        </div>
      </div>
    </div>
  )
}
