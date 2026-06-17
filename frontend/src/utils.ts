export function formatScore(score: number, scoreType: string): string {
  if (scoreType === 'time_fastest_wins') {
    const totalSec = score / 1000
    const mins = Math.floor(totalSec / 60)
    const secs = (totalSec % 60).toFixed(2)
    if (mins > 0) return `${mins}:${secs.padStart(5, '0')}`
    return `${secs}s`
  }
  if (scoreType === 'placement_lowest_wins') return `#${score}`
  if (Number.isInteger(score)) return String(score)
  return score.toFixed(2)
}

export function extractScoreValue(score: any, scoreType: string): number | null {
  if (scoreType === 'time_fastest_wins') return score.timeMs ?? null
  if (scoreType === 'placement_lowest_wins') return score.placement ?? null
  if (scoreType === 'manual_points') return score.calculatedPoints ?? null
  return score.rawScore ?? null
}

// A value with an English name and an optional Swedish name.
export interface LocalizedName {
  en: string
  sv?: string
}

// Pick the name for the active language, falling back to English when the
// Swedish name is missing.
export function pickLocalized(opt: { en?: string; sv?: string | null }, lang: string): string {
  if (lang?.startsWith('sv') && opt.sv && opt.sv.trim()) return opt.sv
  return opt.en ?? ''
}

// Resolve a trophy's display title for the active language (titleSv → title).
export function trophyTitle(trophy: { title?: string; titleSv?: string | null }, lang: string): string {
  if (lang?.startsWith('sv') && trophy.titleSv && trophy.titleSv.trim()) return trophy.titleSv
  return trophy.title ?? ''
}

// Resolve a trophy's subtitle. New awards carry a structured i18n key + params
// and render in the active language; older awards only have a static (English)
// `subtitle` string, which is used as the fallback.
export function trophySubtitle(
  trophy: { subtitle?: string | null; subtitleKey?: string | null; subtitleParams?: Record<string, unknown> | null },
  t: (...args: any[]) => unknown,
): string {
  if (trophy.subtitleKey) return String(t(`trophySubtitle.${trophy.subtitleKey}`, trophy.subtitleParams ?? {}))
  return trophy.subtitle ?? ''
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  const day = d.getUTCDate().toString().padStart(2, '0')
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${day}-${month}-${d.getUTCFullYear()}`
}

// Statuses a competition can hold once it is no longer scoreable.
const NON_SCORABLE_STATUSES = ['COMPLETED', 'ARCHIVED', 'TEMPLATE']

// A competition is scoreable by the current user when it is still ongoing and
// the user is allowed to enter scores for it: a global admin/referee (any team),
// or a team leader/scorekeeper within that competition (their own team). Mirrors
// the gate in Scorekeeper.tsx so the picker never offers a competition that would
// bounce.
export function scorableCompetitions(
  competitions: any[],
  opts: { isAdmin: boolean; isReferee: boolean },
): any[] {
  return competitions.filter((c: any) => {
    if (NON_SCORABLE_STATUSES.includes(c.status)) return false
    if (opts.isAdmin || opts.isReferee) return true
    return !!(c.myPlayer?.isTeamLeader || c.myPlayer?.isScorekeeper)
  })
}
