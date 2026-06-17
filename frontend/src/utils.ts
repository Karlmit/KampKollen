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

export function formatDate(iso: string) {
  const d = new Date(iso)
  const day = d.getUTCDate().toString().padStart(2, '0')
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${day}-${month}-${d.getUTCFullYear()}`
}
