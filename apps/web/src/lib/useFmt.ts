import { usePreferenciasStore, type PrecisionDecimal } from '../store/preferencias.store'

// ── Símbolo por moneda ─────────────────────────────────────────────────────
const CURRENCY_MAP: Record<string, string> = {
  DOP: 'DOP',
  USD: 'USD',
  EUR: 'EUR',
}

function buildFormatter(
  moneda: string,
  precision: PrecisionDecimal,
  isTotal: boolean,
  mostrarSimbolo: boolean
) {
  const showDecimals =
    precision === 'siempre' ||
    (precision === 'solo_totales' && isTotal)

  const currency = CURRENCY_MAP[moneda] ?? 'DOP'

  if (mostrarSimbolo) {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    })
  } else {
    return new Intl.NumberFormat('es-DO', {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    })
  }
}

/**
 * Hook que devuelve una función fmt(valor, isTotal?) respetando
 * las preferencias de visualización del usuario.
 *
 * isTotal=true → aplica decimales cuando precisionDecimal='solo_totales'
 */
export function useFmt() {
  const { precisionDecimal, mostrarSimbolo, monedaVista, mostrarSaldoOculto } =
    usePreferenciasStore()

  return (n: string | number, isTotal = false): string => {
    if (mostrarSaldoOculto) return '••••'
    const num = typeof n === 'string' ? parseFloat(n) : n
    if (isNaN(num)) return '—'
    return buildFormatter(monedaVista, precisionDecimal, isTotal, mostrarSimbolo).format(num)
  }
}

/** Versión standalone (fuera de componentes React) — usa valores por defecto */
export function fmtStatic(n: string | number, moneda = 'DOP'): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/** Formatea una fecha según la preferencia del usuario */
export function useFmtFecha() {
  const { formatoFecha } = usePreferenciasStore()

  return (iso: string | null | undefined): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'

    if (formatoFecha === 'relativo') {
      const diff = Date.now() - d.getTime()
      const days = Math.floor(diff / 86400000)
      if (days === 0) return 'Hoy'
      if (days === 1) return 'Ayer'
      if (days < 7) return `Hace ${days} días`
      if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`
      if (days < 365) return `Hace ${Math.floor(days / 30)} meses`
      return `Hace ${Math.floor(days / 365)} años`
    }

    const day   = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year  = d.getFullYear()

    return formatoFecha === 'mm/dd/yyyy'
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`
  }
}
