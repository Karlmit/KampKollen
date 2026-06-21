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

// Format a raw leaderboard score for display: `least_time_difference` shows a
// seconds suffix, everything else gets one decimal plus an optional unit (e.g.
// shooting). Shared by every leaderboard / team-results view so the formatting
// stays identical across them.
export function formatLeaderboardScore(score: number, scoreType?: string, unit?: string | null): string {
  if (scoreType === 'least_time_difference') {
    const s = score ?? 0
    return `${Number.isInteger(s) ? s : s.toFixed(1)}s`
  }
  const base = score?.toFixed(1) ?? '0'
  return unit ? `${base} ${unit}` : base
}

// Medal emoji for the top three ranks, otherwise the numeric rank. `hash`
// controls whether non-medal ranks render as "#4" (default) or plain "4".
export function rankLabel(rank: number, opts: { hash?: boolean } = {}): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${opts.hash === false ? '' : '#'}${rank}`
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
// the user is allowed to enter scores for it: a global admin (any team), or a
// team leader / scorekeeper / referee within that competition. Mirrors the gate
// in Scorekeeper.tsx so the picker never offers a competition that would bounce.
export function scorableCompetitions(
  competitions: any[],
  opts: { isAdmin: boolean },
): any[] {
  return competitions.filter((c: any) => {
    if (NON_SCORABLE_STATUSES.includes(c.status)) return false
    if (opts.isAdmin) return true
    return !!(c.myPlayer?.isTeamLeader || c.myPlayer?.isScorekeeper || c.myPlayer?.isReferee)
  })
}

// Sanitise rich text coming from the quiz description editor. Only bold/italic/
// underline and line breaks survive; everything else (scripts, styles, attributes,
// other tags) is stripped. Editors are trusted QMs/admins — this is defence in depth
// before the HTML is rendered to players via dangerouslySetInnerHTML.
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return ''
  return html
    // Normalise the tags execCommand emits to the canonical allowlist.
    .replace(/<\s*(\/?)\s*strong\b[^>]*>/gi, '<$1b>')
    .replace(/<\s*(\/?)\s*em\b[^>]*>/gi, '<$1i>')
    // Block wrappers (div/p) become line breaks.
    .replace(/<\s*(div|p)\b[^>]*>/gi, '<br>')
    .replace(/<\/\s*(div|p)\s*>/gi, '')
    // Drop any tag that is not an allowed formatting tag (keeps attributes out too).
    .replace(/<(?!\s*\/?\s*(b|i|u|br)\b)[^>]*>/gi, '')
    // Strip attributes from the allowed opening tags.
    .replace(/<\s*(b|i|u)\b[^>]*>/gi, (_m, tag: string) => `<${tag.toLowerCase()}>`)
    .replace(/<\s*br\b[^>]*\/?>/gi, '<br>')
    // Drop leading/trailing line breaks (and the whitespace around them) so a
    // stray empty line in the editor doesn't leave dead space under the text.
    .replace(/^(?:\s|<br>)+/i, '')
    .replace(/(?:\s|<br>)+$/i, '')
    .trim()
}
