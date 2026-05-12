import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PrecisionDecimal = 'siempre' | 'solo_totales' | 'nunca'
export type FormatoFecha     = 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'relativo'
export type TemaColor        = 'sistema' | 'oscuro' | 'claro'

export interface Preferencias {
  // ── Formato numérico ──────────────────────────────────────────────────
  precisionDecimal:    PrecisionDecimal   // cuándo mostrar los 2 decimales
  mostrarSimbolo:      boolean            // mostrar "RD$" o solo el número
  monedaVista:         string             // DOP | USD | EUR (solo visual)

  // ── Fechas ────────────────────────────────────────────────────────────
  formatoFecha:        FormatoFecha

  // ── Tabla / listados ──────────────────────────────────────────────────
  filasPorPagina:      10 | 25 | 50

  // ── Dashboard ─────────────────────────────────────────────────────────
  animacionesGraficos: boolean
  mostrarSaldoOculto:  boolean            // ocultar montos sensibles con ****
}

const DEFAULTS: Preferencias = {
  precisionDecimal:    'siempre',
  mostrarSimbolo:      true,
  monedaVista:         'DOP',
  formatoFecha:        'dd/mm/yyyy',
  filasPorPagina:      25,
  animacionesGraficos: true,
  mostrarSaldoOculto:  false,
}

interface PreferenciasState extends Preferencias {
  set: <K extends keyof Preferencias>(key: K, value: Preferencias[K]) => void
  reset: () => void
}

export const usePreferenciasStore = create<PreferenciasState>()(
  persist(
    set => ({
      ...DEFAULTS,
      set: (key, value) => set(state => ({ ...state, [key]: value })),
      reset: () => set(state => ({ ...state, ...DEFAULTS })),
    }),
    { name: 'cashmind-preferencias' }
  )
)
