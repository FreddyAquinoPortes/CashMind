// Shared period utilities for EventosPage and ProyeccionesPage

export interface SavedPeriod {
  id: string
  nombre: string
  // New month-aware format (preferred for new periods)
  startDay?: number    // day of month when period starts (1–31)
  endDay?: number      // day of month when period ends (1–31); 0 = last day of end month
  monthSpan?: number   // months between start month and end month (0 = same, 1 = next, etc.)
  // Legacy format kept for backward compat
  durationDays?: number
  anchorDay?: number
}

export const LS_KEY = 'cashmind_saved_periods'

export const BUILT_IN_PERIODS: SavedPeriod[] = [
  { id: 'bimestral',     nombre: 'Bimestral',     startDay: 1, endDay: 0, monthSpan: 1 },
  { id: 'trimestral',    nombre: 'Trimestral',     startDay: 1, endDay: 0, monthSpan: 2 },
  { id: 'cuatrimestral', nombre: 'Cuatrimestral',  startDay: 1, endDay: 0, monthSpan: 3 },
  { id: 'semestral',     nombre: 'Semestral',      startDay: 1, endDay: 0, monthSpan: 5 },
  { id: 'anual',         nombre: 'Anual',          startDay: 1, endDay: 0, monthSpan: 11 },
]

export function loadSavedPeriods(): SavedPeriod[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
export function persistSavedPeriods(periods: SavedPeriod[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(periods))
}

/**
 * Calculate the concrete start/end dates for a saved period.
 *
 * - If anchorYear/anchorMonth are provided, use them as the start month.
 * - Otherwise, auto-detect the current cycle that contains today (or the nearest one).
 *
 * Handles both new month-aware format (startDay/endDay/monthSpan)
 * and legacy format (durationDays/anchorDay).
 */
export function applySavedPeriod(
  p: SavedPeriod,
  anchorYear?: number,
  anchorMonth?: number,
): { start: Date; end: Date } {
  // ── New month-aware format ────────────────────────────────────────────
  if (p.startDay !== undefined && p.monthSpan !== undefined && p.endDay !== undefined) {
    const { startDay, endDay, monthSpan } = p

    const calcEnd = (y: number, m: number): Date =>
      endDay === 0
        ? new Date(y, m + monthSpan + 1, 0) // last day of end-month
        : new Date(y, m + monthSpan, endDay)

    if (anchorYear !== undefined && anchorMonth !== undefined) {
      return {
        start: new Date(anchorYear, anchorMonth, startDay),
        end:   calcEnd(anchorYear, anchorMonth),
      }
    }

    // Auto-detect the cycle that contains today (or the most recent one)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let m = today.getMonth()
    let y = today.getFullYear()

    let start = new Date(y, m, startDay)
    let end   = calcEnd(y, m)

    if (today < start) {
      // Period hasn't started yet — go back one cycle
      m--; start = new Date(y, m, startDay); end = calcEnd(y, m)
    } else if (today > end) {
      // Period already ended — advance to next cycle
      m++; start = new Date(y, m, startDay); end = calcEnd(y, m)
    }

    return { start, end }
  }

  // ── Legacy fixed-day format ───────────────────────────────────────────
  const anchorDay = p.anchorDay ?? 1
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let start = new Date(today.getFullYear(), today.getMonth(), anchorDay)
  if (start > today) start = new Date(today.getFullYear(), today.getMonth() - 1, anchorDay)
  const end = new Date(start)
  end.setDate(end.getDate() + (p.durationDays ?? 30) - 1)
  return { start, end }
}

/** True if this saved period uses the new month-aware format */
export function isMonthAware(p: SavedPeriod): boolean {
  return p.startDay !== undefined && p.monthSpan !== undefined && p.endDay !== undefined
}
