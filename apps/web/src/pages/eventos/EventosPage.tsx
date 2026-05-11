import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import type { Evento, TipoEvento, EstadoEvento, TipoRecurrencia, CuentaBancaria, Persona, Categoria, Subcategoria } from '../../lib/types'
import {
  PlusIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon,
  ChevronDownIcon, BookmarkIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@iconify/react'

// ── Constants ──────────────────────────────────────────────────────────────
const TIPO_CONFIG: Record<TipoEvento, { label: string; color: string; dot: string; icon: string }> = {
  PAGO_PROGRAMADO: { label: 'Pago programado', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   dot: '#f59e0b', icon: '💳' },
  NOMINA:          { label: 'Nómina',           color: 'bg-green-500/15 text-green-400 border-green-500/30',   dot: '#22c55e', icon: '💼' },
  CUMPLEANOS:      { label: 'Cumpleaños',        color: 'bg-pink-500/15 text-pink-400 border-pink-500/30',     dot: '#ec4899', icon: '🎂' },
  FERIADO:         { label: 'Feriado',           color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     dot: '#3b82f6', icon: '🏖️' },
  OTRO:            { label: 'Otro',              color: 'bg-gray-500/15 text-gray-400 border-gray-500/30',     dot: '#6b7280', icon: '📌' },
}

const ESTADO_CONFIG: Record<EstadoEvento, { label: string; color: string }> = {
  PLANIFICADO: { label: 'Planificado', color: 'text-blue-400' },
  APARTADO:    { label: 'Apartado',    color: 'text-amber-400' },
  EJECUTADO:   { label: 'Ejecutado',   color: 'text-success' },
  CANCELADO:   { label: 'Cancelado',   color: 'text-text-muted line-through' },
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Parsea fechas ISO del API como fecha LOCAL (evita el desfase UTC-4 de RD)
const parseLocalDate = (iso: string) => {
  const part = iso.split('T')[0]!          // "YYYY-MM-DD"
  const [y, m, d] = part.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

const fmt = (n: string | number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(parseFloat(String(n)))

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ── Period types ───────────────────────────────────────────────────────────
type PeriodType = 'dia' | 'semana' | 'mes' | 'custom'

interface SavedPeriod {
  id: string
  nombre: string
  durationDays: number
  anchorDay: number
}

const LS_KEY = 'cashmind_saved_periods'

const BUILT_IN_PERIODS: SavedPeriod[] = [
  { id: 'bimestral',     nombre: 'Bimestral',     durationDays: 60,  anchorDay: 1 },
  { id: 'trimestral',    nombre: 'Trimestral',     durationDays: 90,  anchorDay: 1 },
  { id: 'cuatrimestral', nombre: 'Cuatrimestral',  durationDays: 120, anchorDay: 1 },
  { id: 'semestral',     nombre: 'Semestral',      durationDays: 180, anchorDay: 1 },
  { id: 'anual',         nombre: 'Anual',          durationDays: 365, anchorDay: 1 },
]

function loadSavedPeriods(): SavedPeriod[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function persistSavedPeriods(periods: SavedPeriod[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(periods))
}

function applyBuiltInPeriod(p: SavedPeriod): { start: Date; end: Date } {
  const today = new Date()
  let start = new Date(today.getFullYear(), today.getMonth(), p.anchorDay)
  if (start > today) start = new Date(today.getFullYear(), today.getMonth() - 1, p.anchorDay)
  const end = new Date(start)
  end.setDate(end.getDate() + p.durationDays - 1)
  return { start, end }
}

function getWeekStart(d: Date): Date {
  const s = new Date(d)
  s.setDate(s.getDate() - s.getDay())
  s.setHours(0, 0, 0, 0)
  return s
}

// ── Recurring expansion ────────────────────────────────────────────────────
function occurrencesInMonth(ev: Evento, year: number, month: number): Date[] {
  const base = parseLocalDate(ev.fecha)
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const dates: Date[] = []

  if (!ev.recurrente || !ev.tipoRecurrencia) {
    if (base >= first && base <= last) dates.push(base)
    return dates
  }

  let cur = new Date(base)
  const maxIter = 400
  let i = 0
  while (cur <= last && i++ < maxIter) {
    if (cur >= first) dates.push(new Date(cur))
    switch (ev.tipoRecurrencia) {
      case 'DIARIA':  cur = new Date(cur); cur.setDate(cur.getDate() + 1); break
      case 'SEMANAL': cur = new Date(cur); cur.setDate(cur.getDate() + 7); break
      case 'MENSUAL': cur = new Date(cur); cur.setMonth(cur.getMonth() + 1); break
      case 'ANUAL':   cur = new Date(cur); cur.setFullYear(cur.getFullYear() + 1); break
    }
    if (cur > last) break
  }
  return dates
}

function occursOnDate(ev: Evento, date: Date): boolean {
  const ds = toDateStr(date)
  const base = parseLocalDate(ev.fecha)
  if (!ev.recurrente || !ev.tipoRecurrencia) {
    return toDateStr(base) === ds
  }
  let cur = new Date(base)
  let i = 0
  while (cur <= date && i++ < 2000) {
    if (toDateStr(cur) === ds) return true
    switch (ev.tipoRecurrencia) {
      case 'DIARIA':  cur.setDate(cur.getDate() + 1); break
      case 'SEMANAL': cur.setDate(cur.getDate() + 7); break
      case 'MENSUAL': cur.setMonth(cur.getMonth() + 1); break
      case 'ANUAL':   cur.setFullYear(cur.getFullYear() + 1); break
    }
  }
  return false
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
      {msg}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: {
  title: string; onClose(): void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-surface border border-border rounded-xl w-full shadow-2xl flex flex-col max-h-[90vh] ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

// ── CategoriaSelect ────────────────────────────────────────────────────────
function CategoriaSelect({ value, onChange, categorias, placeholder = '— Sin categoría —' }: {
  value: string; onChange(id: string): void
  categorias: Categoria[]; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = categorias.find(c => c.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="input w-full text-left flex items-center gap-2"
      >
        {selected ? (
          <>
            {selected.icono && (
              <Icon
                icon={selected.icono.includes(':') ? selected.icono : `tabler:${selected.icono}`}
                className="w-4 h-4 flex-shrink-0"
                style={{ color: selected.color ?? '#22c55e' }}
              />
            )}
            <span className="text-text-primary flex-1 truncate">{selected.nombre}</span>
          </>
        ) : (
          <span className="text-text-muted flex-1">{placeholder}</span>
        )}
        <ChevronDownIcon className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[600] top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-2xl py-1 max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${!value ? 'text-primary font-medium' : 'text-text-muted'}`}
          >
            {placeholder}
          </button>
          {categorias.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-white/5 transition-colors
                ${value === c.id ? 'text-primary font-medium bg-primary/5' : 'text-text-secondary'}`}
            >
              {c.icono ? (
                <Icon
                  icon={c.icono.includes(':') ? c.icono : `tabler:${c.icono}`}
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: c.color ?? '#22c55e' }}
                />
              ) : (
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? '#22c55e' }} />
              )}
              <span className="truncate">{c.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SubcategoriaSelect({ value, onChange, subcategorias, disabled }: {
  value: string; onChange(id: string): void
  subcategorias: Subcategoria[]; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = subcategorias.find(s => s.id === value)

  if (disabled) return (
    <div className="input opacity-40 flex items-center gap-2 cursor-not-allowed select-none">
      <span className="text-text-muted text-sm">— Sin subcategoría —</span>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="input w-full text-left flex items-center gap-2"
      >
        {selected ? (
          <>
            {selected.icono && (
              <Icon
                icon={selected.icono.includes(':') ? selected.icono : `tabler:${selected.icono}`}
                className="w-4 h-4 flex-shrink-0"
                style={{ color: selected.color ?? '#94a3b8' }}
              />
            )}
            <span className="text-text-primary flex-1 truncate">{selected.nombre}</span>
          </>
        ) : (
          <span className="text-text-muted flex-1">— Sin subcategoría —</span>
        )}
        <ChevronDownIcon className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[600] top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-2xl py-1 max-h-44 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${!value ? 'text-primary font-medium' : 'text-text-muted'}`}
          >
            — Sin subcategoría —
          </button>
          {subcategorias.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-white/5 transition-colors
                ${value === s.id ? 'text-primary font-medium bg-primary/5' : 'text-text-secondary'}`}
            >
              {s.icono ? (
                <Icon
                  icon={s.icono.includes(':') ? s.icono : `tabler:${s.icono}`}
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: s.color ?? '#94a3b8' }}
                />
              ) : (
                <span className="w-2 h-2 rounded-full flex-shrink-0 ml-1" style={{ backgroundColor: s.color ?? '#94a3b8' }} />
              )}
              <span className="truncate">{s.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DatePicker ─────────────────────────────────────────────────────────────
function DatePicker({ value, onChange }: { value: string; onChange(v: string): void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const toLocal = (iso: string) => iso ? new Date(iso + 'T00:00:00') : new Date()
  const parsed = toLocal(value)
  const [viewYear,  setViewYear]  = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (value) { const d = toLocal(value); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
  }, [value])

  const todayStr = new Date().toISOString().slice(0, 10)
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const select = (day: number) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`)
    setOpen(false)
  }

  const prevM = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextM = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0)  } else setViewMonth(m => m + 1) }

  const displayValue = value
    ? toLocal(value).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="input w-full text-left flex items-center gap-2 cursor-pointer"
      >
        <CalendarDaysIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
        <span className={displayValue ? 'text-text-primary' : 'text-text-muted'}>
          {displayValue || 'Seleccionar fecha…'}
        </span>
      </button>

      {open && (
        <div className="absolute z-[600] mt-1 left-0 bg-surface border border-border rounded-xl shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevM} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-text-primary select-none">
              {MESES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextM} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-[10px] text-text-muted font-semibold uppercase py-1 select-none">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
              const isSelected = dateStr === value
              const isToday    = dateStr === todayStr
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => select(day)}
                  className={`h-8 w-full rounded-lg text-sm font-medium transition-colors select-none
                    ${isSelected
                      ? 'bg-primary text-white shadow-sm'
                      : isToday
                        ? 'border border-primary text-primary'
                        : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'
                    }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => { onChange(todayStr); setOpen(false) }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PeriodDropdown ─────────────────────────────────────────────────────────
function PeriodDropdown({ periodType, customLabel, onSelect, onOpenCustom, savedPeriods, onApplySaved, onDeleteSaved }: {
  periodType: PeriodType
  customLabel: string
  onSelect(t: 'dia' | 'semana' | 'mes'): void
  onOpenCustom(): void
  savedPeriods: SavedPeriod[]
  onApplySaved(p: SavedPeriod): void
  onDeleteSaved(id: string): void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pillLabel = periodType === 'dia' ? 'Hoy' : periodType === 'semana' ? 'Semana' : periodType === 'mes' ? 'Mes' : customLabel

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium"
      >
        {pillLabel}
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[300] bg-surface border border-border rounded-xl shadow-2xl w-56 py-1 overflow-hidden">
          {(['dia', 'semana', 'mes'] as const).map(t => (
            <button key={t} onClick={() => { onSelect(t); setOpen(false) }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/5
                ${periodType === t ? 'text-primary font-medium' : 'text-text-secondary'}`}>
              {t === 'dia' ? 'Hoy' : t === 'semana' ? 'Esta semana' : 'Este mes'}
            </button>
          ))}
          <button onClick={() => { onOpenCustom(); setOpen(false) }}
            className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-white/5 transition-colors">
            Período personalizado…
          </button>

          <div className="border-t border-border mt-1 pt-1">
            <p className="px-4 py-1 text-[10px] text-text-muted uppercase tracking-wider">Períodos guardados</p>
            {[...BUILT_IN_PERIODS, ...savedPeriods].map(p => (
              <div key={p.id} className="flex items-center group">
                <button onClick={() => { onApplySaved(p); setOpen(false) }}
                  className="flex-1 text-left px-4 py-1.5 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors">
                  {p.nombre}
                </button>
                {!BUILT_IN_PERIODS.find(b => b.id === p.id) && (
                  <button onClick={() => onDeleteSaved(p.id)}
                    className="opacity-0 group-hover:opacity-100 pr-3 text-xs text-text-muted hover:text-danger transition-all">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CustomPeriodModal ──────────────────────────────────────────────────────
function CustomPeriodModal({ onClose, onApply, onSave }: {
  onClose(): void
  onApply(start: Date, end: Date): void
  onSave(nombre: string, start: Date, end: Date): void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [startStr, setStartStr] = useState(todayStr)
  const [endStr,   setEndStr]   = useState(todayStr)
  const [saveName, setSaveName] = useState('')
  const [saving,   setSaving]   = useState(false)

  const start = new Date(startStr + 'T00:00:00')
  const end   = new Date(endStr   + 'T00:00:00')
  const valid = startStr && endStr && start <= end
  const days  = valid ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1 : 0

  const QUICK = [
    { label: 'Bimestral (2m)',     days: 60 },
    { label: 'Trimestral (3m)',    days: 90 },
    { label: 'Cuatrimestral (4m)', days: 120 },
    { label: 'Semestral (6m)',     days: 180 },
    { label: 'Anual (12m)',        days: 365 },
  ]

  const applyQuick = (d: number) => {
    const s = new Date()
    const e = new Date(s)
    e.setDate(e.getDate() + d - 1)
    setStartStr(toDateStr(s))
    setEndStr(toDateStr(e))
  }

  return (
    <Modal title="Período personalizado" onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs text-text-muted mb-2 font-medium">Duración rápida</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map(q => (
              <button key={q.label} type="button" onClick={() => applyQuick(q.days)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:border-primary/50 hover:text-primary transition-colors">
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            Desde
            <DatePicker value={startStr} onChange={setStartStr} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            Hasta
            <DatePicker value={endStr} onChange={v => { if (v >= startStr) setEndStr(v) }} />
          </div>
        </div>

        {valid && (
          <p className="text-xs text-text-muted text-center -mt-2">
            {days} {days === 1 ? 'día' : 'días'} ({startStr === endStr ? 'un solo día' : `${fmtDate(startStr)} — ${fmtDate(endStr)}`})
          </p>
        )}

        {saving ? (
          <div className="flex gap-2 items-center">
            <input value={saveName} onChange={e => setSaveName(e.target.value)}
              placeholder="Nombre del período…" className="input flex-1 text-sm" autoFocus />
            <button type="button" disabled={!saveName || !valid}
              onClick={() => { if (valid) { onSave(saveName, start, end); setSaving(false) } }}
              className="btn-primary text-xs px-3">
              Guardar
            </button>
            <button type="button" onClick={() => setSaving(false)} className="btn-ghost text-xs px-3">×</button>
          </div>
        ) : (
          <button type="button" onClick={() => setSaving(true)}
            className="text-xs text-text-muted hover:text-primary transition-colors self-start flex items-center gap-1">
            <BookmarkIcon className="w-3.5 h-3.5" /> Guardar este período
          </button>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="button" disabled={!valid}
            onClick={() => { if (valid) onApply(start, end) }}
            className="btn-primary">
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── WeekStrip ──────────────────────────────────────────────────────────────
function WeekStrip({ ws, eventos, selectedStr, onSelectDay }: {
  ws: Date; eventos: Evento[]
  selectedStr: string | null; onSelectDay(ds: string): void
}) {
  const todayStr = toDateStr(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws)
    d.setDate(ws.getDate() + i)
    return d
  })

  const evMap = useMemo(() => {
    const map = new Map<string, Evento[]>()
    for (const d of days) {
      map.set(toDateStr(d), eventos.filter(ev => occursOnDate(ev, d)))
    }
    return map
  }, [eventos, ws.toISOString()])

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map(d => {
          const ds = toDateStr(d)
          const isToday = ds === todayStr
          const isSel   = ds === selectedStr
          const dayEvs  = evMap.get(ds) ?? []
          return (
            <button key={ds} type="button" onClick={() => onSelectDay(ds)}
              className={`flex flex-col items-center py-4 px-1 min-h-[110px] transition-colors border-r border-border/40 last:border-r-0
                ${isSel ? 'bg-primary/10' : 'hover:bg-white/5'}`}>
              <span className="text-[10px] text-text-muted uppercase mb-1">{DIAS_SEMANA[d.getDay()]}</span>
              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mb-2
                ${isToday ? 'bg-primary text-white' : isSel ? 'text-primary' : 'text-text-secondary'}`}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 w-full px-1">
                {dayEvs.slice(0, 3).map((ev, i) => (
                  <div key={`${ev.id}-${i}`} className="w-full rounded text-[9px] px-1 py-0.5 truncate"
                    style={{ backgroundColor: (TIPO_CONFIG[ev.tipo]?.dot ?? '#6b7280') + '30', color: TIPO_CONFIG[ev.tipo]?.dot ?? '#6b7280' }}>
                    {ev.nombre}
                  </div>
                ))}
                {dayEvs.length > 3 && (
                  <span className="text-[9px] text-text-muted text-center">+{dayEvs.length - 3}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── CalendarGrid ───────────────────────────────────────────────────────────
function CalendarGrid({ year, month, eventos, selectedDay, onSelectDay, rangeStart, rangeEnd }: {
  year: number; month: number; eventos: Evento[]
  selectedDay: number | null; onSelectDay(d: number | null): void
  rangeStart?: string; rangeEnd?: string
}) {
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const dayMap = useMemo(() => {
    const map = new Map<number, Evento[]>()
    for (const ev of eventos) {
      const dates = occurrencesInMonth(ev, year, month)
      for (const d of dates) {
        const day = d.getDate()
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(ev)
      }
    }
    return map
  }, [eventos, year, month])

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return (
            <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-border/40 bg-background/20" />
          )

          const dateStr   = `${year}-${pad(month + 1)}-${pad(day)}`
          const isToday   = isCurrentMonth && day === today.getDate()
          const isSelected = day === selectedDay
          const inRange   = rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd
          const dayEvents = dayMap.get(day) ?? []
          const hasExec   = dayEvents.some(e => e.estado === 'PLANIFICADO' && (e.tipo === 'PAGO_PROGRAMADO' || e.tipo === 'NOMINA'))

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : day)}
              className={`min-h-[72px] border-b border-r border-border/40 p-1.5 text-left flex flex-col transition-colors
                ${isSelected ? 'bg-primary/10' : inRange ? 'bg-primary/5' : 'hover:bg-white/5'}`}
            >
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                ${isToday ? 'bg-primary text-white' : isSelected ? 'text-primary' : 'text-text-secondary'}`}>
                {day}
              </span>

              <div className="flex flex-wrap gap-0.5 flex-1">
                {dayEvents.slice(0, 4).map((ev, idx) => (
                  <span
                    key={`${ev.id}-${idx}`}
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TIPO_CONFIG[ev.tipo]?.dot ?? '#6b7280' }}
                    title={ev.nombre}
                  />
                ))}
                {dayEvents.length > 4 && (
                  <span className="text-[9px] text-text-muted leading-none">+{dayEvents.length - 4}</span>
                )}
              </div>

              {hasExec && (
                <span className="text-[9px] text-amber-400 font-semibold mt-auto">● pendiente</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Evento Form ────────────────────────────────────────────────────────────
interface EventoForm {
  nombre: string; tipo: TipoEvento; fecha: string
  recurrente: boolean; tipoRecurrencia: TipoRecurrencia | ''
  presupuestoEstimado: string; moneda: string
  estado: EstadoEvento; personaId: string; prioridad: string
  categoriaId: string; subcategoriaId: string; notas: string
}
const EMPTY_FORM: EventoForm = {
  nombre: '', tipo: 'PAGO_PROGRAMADO', fecha: new Date().toISOString().slice(0, 10),
  recurrente: false, tipoRecurrencia: '', presupuestoEstimado: '', moneda: 'DOP',
  estado: 'PLANIFICADO', personaId: '', prioridad: '3', categoriaId: '', subcategoriaId: '', notas: '',
}

function EventoFormPanel({ initial, personas, categorias, onSubmit, onClose, loading, error }: {
  initial?: EventoForm; personas: Persona[]; categorias: Categoria[]
  onSubmit(d: EventoForm): void; onClose(): void; loading: boolean; error?: string | null
}) {
  const [form, setForm] = useState<EventoForm>(initial ?? EMPTY_FORM)
  const set = (k: keyof EventoForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))
  const setCheck = (k: keyof EventoForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [k]: e.target.checked }))

  const isPago = form.tipo === 'PAGO_PROGRAMADO' || form.tipo === 'NOMINA'

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre *
        <input required type="text" maxLength={150} value={form.nombre} onChange={set('nombre')}
          className="input" placeholder="Ej. Pago luz, Cumpleaños mamá..." />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo *
          <select required value={form.tipo} onChange={set('tipo')} className="input">
            {(Object.keys(TIPO_CONFIG) as TipoEvento[]).map(t => (
              <option key={t} value={t}>{TIPO_CONFIG[t].icon} {TIPO_CONFIG[t].label}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha *
          <DatePicker value={form.fecha} onChange={v => setForm(p => ({ ...p, fecha: v }))} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={form.recurrente} onChange={setCheck('recurrente')}
            className="w-4 h-4 accent-primary" />
          Evento recurrente
        </label>
        {form.recurrente && (
          <select value={form.tipoRecurrencia} onChange={set('tipoRecurrencia')} className="input">
            <option value="">— Frecuencia —</option>
            <option value="DIARIA">Diaria</option>
            <option value="SEMANAL">Semanal</option>
            <option value="MENSUAL">Mensual</option>
            <option value="ANUAL">Anual</option>
          </select>
        )}
      </div>

      {isPago && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Monto estimado
            <input type="number" step="0.01" min="0" value={form.presupuestoEstimado}
              onChange={set('presupuestoEstimado')} className="input" placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Moneda
            <select value={form.moneda} onChange={set('moneda')} className="input">
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Estado
          <select value={form.estado} onChange={set('estado')} className="input">
            {(Object.keys(ESTADO_CONFIG) as EstadoEvento[]).map(e => (
              <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Prioridad (1-5)
          <input type="number" min="1" max="5" value={form.prioridad} onChange={set('prioridad')} className="input" />
        </label>
      </div>

      {(form.tipo === 'CUMPLEANOS' || form.tipo === 'OTRO') && (
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Persona (opcional)
          <select value={form.personaId} onChange={set('personaId')} className="input">
            <option value="">— Ninguna —</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </label>
      )}

      {/* Category */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Categoría
          <CategoriaSelect
            value={form.categoriaId}
            onChange={id => setForm(p => ({ ...p, categoriaId: id, subcategoriaId: '' }))}
            categorias={categorias}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Subcategoría
          <SubcategoriaSelect
            value={form.subcategoriaId}
            onChange={id => setForm(p => ({ ...p, subcategoriaId: id }))}
            subcategorias={categorias.find(c => c.id === form.categoriaId)?.subcategorias ?? []}
            disabled={!form.categoriaId}
          />
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <textarea value={form.notas} onChange={set('notas')} className="input resize-none" rows={2}
          placeholder="Información adicional..." />
      </label>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── Ejecutar Form ──────────────────────────────────────────────────────────
function EjecutarFormPanel({ evento, cuentas, categorias, onSubmit, onClose, loading, error }: {
  evento: Evento; cuentas: CuentaBancaria[]; categorias: Categoria[]; loading: boolean; error?: string | null
  onSubmit(cuentaId: string, categoriaId: string, subcategoriaId: string, notas: string): void; onClose(): void
}) {
  const [cuentaId,      setCuentaId]      = useState(cuentas[0]?.id ?? '')
  const [categoriaId,   setCategoriaId]   = useState((evento as any).categoriaId ?? '')
  const [subcategoriaId,setSubcategoriaId]= useState((evento as any).subcategoriaId ?? '')
  const [notas,         setNotas]         = useState('')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(cuentaId, categoriaId, subcategoriaId, notas) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-background/60 rounded-xl p-4 border border-border/60">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{TIPO_CONFIG[evento.tipo]?.icon}</span>
          <span className="font-semibold text-text-primary">{evento.nombre}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-text-muted">Monto estimado</span>
            <p className="font-bold text-text-primary">{fmt(evento.presupuestoEstimado)}</p>
          </div>
          <div>
            <span className="text-text-muted">Fecha</span>
            <p className="font-medium text-text-primary">{fmtDate(evento.fecha)}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted -mt-1">
        Se creará una transacción de <strong>{evento.tipo === 'NOMINA' ? 'Ingreso' : 'Gasto'}</strong> por el monto estimado y el evento quedará marcado como Ejecutado.
      </p>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Cuenta *
        <select required value={cuentaId} onChange={e => setCuentaId(e.target.value)} className="input">
          <option value="">— Seleccionar cuenta —</option>
          {cuentas.map(c => (
            <option key={c.id} value={c.id}>{c.alias ?? c.banco} (···{c.numero.slice(-4)})</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Categoría
          <CategoriaSelect
            value={categoriaId}
            onChange={id => { setCategoriaId(id); setSubcategoriaId('') }}
            categorias={categorias}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Subcategoría
          <SubcategoriaSelect
            value={subcategoriaId}
            onChange={setSubcategoriaId}
            subcategorias={categorias.find(c => c.id === categoriaId)?.subcategorias ?? []}
            disabled={!categoriaId}
          />
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas (opcional)
        <input value={notas} onChange={e => setNotas(e.target.value)} className="input"
          placeholder="Ej. Cuota mayo, mes de..." />
      </label>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading || !cuentaId} className="btn-primary">
          {loading ? 'Ejecutando…' : '▶ Ejecutar'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new'; error?: string }
  | { type: 'edit'; evento: Evento; error?: string }
  | { type: 'delete'; evento: Evento }
  | { type: 'ejecutar'; evento: Evento; error?: string }
  | null

const toPayload = (f: EventoForm) => ({
  nombre:              f.nombre,
  tipo:                f.tipo,
  fecha:               f.fecha,
  recurrente:          f.recurrente,
  tipoRecurrencia:     f.recurrente && f.tipoRecurrencia ? f.tipoRecurrencia : null,
  presupuestoEstimado: f.presupuestoEstimado ? parseFloat(f.presupuestoEstimado) : 0,
  moneda:              f.moneda,
  estado:              f.estado,
  prioridad:           parseInt(f.prioridad),
  personaId:           f.personaId || null,
  categoriaId:         f.categoriaId || null,
  subcategoriaId:      f.subcategoriaId || null,
  notas:               f.notas || null,
})

export function EventosPage() {
  const qc  = useQueryClient()
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Period state ─────────────────────────────────────────────────────────
  const [periodType,  setPeriodType]  = useState<PeriodType>('mes')
  const [periodStart, setPeriodStart] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [periodEnd,   setPeriodEnd]   = useState<Date>(() => new Date(today.getFullYear(), today.getMonth() + 1, 0))
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(toDateStr(today))
  const [tipoFiltro,  setTipoFiltro]  = useState<TipoEvento | ''>('')
  const [modal,       setModal]       = useState<ModalState>(null)
  const [customOpen,  setCustomOpen]  = useState(false)
  const [toast,       setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [savedPeriods, setSavedPeriods] = useState<SavedPeriod[]>(loadSavedPeriods)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3200)
  }

  // ── Query params ──────────────────────────────────────────────────────────
  const queryParams = useMemo(() => {
    if (periodType === 'mes') {
      return `mes=${periodStart.getFullYear()}-${pad(periodStart.getMonth() + 1)}`
    }
    return `inicio=${toDateStr(periodStart)}&fin=${toDateStr(periodEnd)}`
  }, [periodType, periodStart, periodEnd])

  const { data: eventos = [], isLoading } = useQuery<Evento[]>({
    queryKey: ['eventos', queryParams, cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/eventos?${queryParams}`)).data.data,
    enabled: !!cid,
  })
  const { data: cuentas = [] } = useQuery<CuentaBancaria[]>({
    queryKey: ['cuentas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/cuentas`)).data.data,
    enabled: !!cid,
  })
  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ['personas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
    enabled: !!cid,
  })
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias')).data.data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['eventos'] })

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/eventos`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Evento creado') },
    onError: (e: any) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error') },
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/eventos/${id}`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Evento actualizado') },
    onError: (e: any) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error') },
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/eventos/${id}`),
    onSuccess: () => { invalidate(); setModal(null); showToast('Evento eliminado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e?.message, 'error'),
  })
  const ejecutar = useMutation({
    mutationFn: ({ id, cuentaId, categoriaId, subcategoriaId, notas }: { id: string; cuentaId: string; categoriaId: string; subcategoriaId: string; notas: string }) =>
      api.post(`/eventos/${id}/ejecutar`, { clienteId: cid, cuentaId, categoriaId: categoriaId || null, subcategoriaId: subcategoriaId || null, notas }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['cuentas'] })
      qc.invalidateQueries({ queryKey: ['transacciones'] })
      setModal(null); showToast('✅ Transacción registrada correctamente')
    },
    onError: (e: any) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error') },
  })

  // ── Period selection handlers ─────────────────────────────────────────────
  const selectPeriod = (t: 'dia' | 'semana' | 'mes') => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    if (t === 'dia') {
      setPeriodType('dia'); setPeriodStart(now); setPeriodEnd(now)
      setSelectedDay(now.getDate()); setSelectedDayStr(toDateStr(now))
    } else if (t === 'semana') {
      const ws = getWeekStart(now)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      setPeriodType('semana'); setPeriodStart(ws); setPeriodEnd(we)
      setSelectedDayStr(toDateStr(now)); setSelectedDay(now.getDate())
    } else {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1)
      const me = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setPeriodType('mes'); setPeriodStart(ms); setPeriodEnd(me)
      setSelectedDay(now.getDate()); setSelectedDayStr(toDateStr(now))
    }
  }

  const applyCustom = (start: Date, end: Date) => {
    setPeriodType('custom'); setPeriodStart(start); setPeriodEnd(end)
    setSelectedDay(null); setSelectedDayStr(null)
    setCustomOpen(false)
  }

  const applySaved = (p: SavedPeriod) => {
    const { start, end } = applyBuiltInPeriod(p)
    setPeriodType('custom'); setPeriodStart(start); setPeriodEnd(end)
    setSelectedDay(null); setSelectedDayStr(null)
  }

  const saveCustomPeriod = (nombre: string, start: Date, end: Date) => {
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const anchorDay = start.getDate()
    const np: SavedPeriod = { id: `custom_${Date.now()}`, nombre, durationDays: days, anchorDay }
    const updated = [...savedPeriods, np]
    setSavedPeriods(updated)
    persistSavedPeriods(updated)
  }

  const deleteSaved = (id: string) => {
    const updated = savedPeriods.filter(p => p.id !== id)
    setSavedPeriods(updated)
    persistSavedPeriods(updated)
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (dir: -1 | 1) => {
    if (periodType === 'dia') {
      const d = new Date(periodStart)
      d.setDate(d.getDate() + dir)
      setPeriodStart(d); setPeriodEnd(d)
      setSelectedDay(d.getDate()); setSelectedDayStr(toDateStr(d))
    } else if (periodType === 'semana') {
      const ws = new Date(periodStart); ws.setDate(ws.getDate() + dir * 7)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      setPeriodStart(ws); setPeriodEnd(we)
    } else if (periodType === 'mes') {
      const d = new Date(periodStart)
      d.setMonth(d.getMonth() + dir)
      const ms = new Date(d.getFullYear(), d.getMonth(), 1)
      const me = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      setPeriodStart(ms); setPeriodEnd(me)
      setSelectedDay(null); setSelectedDayStr(null)
    } else {
      const dur = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000)
      const ns = new Date(periodStart); ns.setDate(ns.getDate() + dir * (dur + 1))
      const ne = new Date(ns); ne.setDate(ne.getDate() + dur)
      setPeriodStart(ns); setPeriodEnd(ne)
      setSelectedDay(null); setSelectedDayStr(null)
    }
  }

  const goToday = () => selectPeriod(periodType === 'dia' ? 'dia' : periodType === 'semana' ? 'semana' : 'mes')

  // ── Filtered events ───────────────────────────────────────────────────────
  const eventosFiltrados = useMemo(() =>
    tipoFiltro ? eventos.filter(ev => ev.tipo === tipoFiltro) : eventos,
    [eventos, tipoFiltro],
  )

  // Events for selected day or full period
  const displayList = useMemo(() => {
    if (periodType === 'dia' || (selectedDayStr && periodType !== 'semana')) {
      const targetDate = selectedDayStr ? new Date(selectedDayStr + 'T00:00:00') : periodStart
      return eventosFiltrados
        .filter(ev => occursOnDate(ev, targetDate))
        .map(ev => ({ ev, date: targetDate }))
    }
    if (periodType === 'semana' && selectedDayStr) {
      const targetDate = new Date(selectedDayStr + 'T00:00:00')
      return eventosFiltrados
        .filter(ev => occursOnDate(ev, targetDate))
        .map(ev => ({ ev, date: targetDate }))
    }
    // All events in period
    const expanded: { ev: Evento; date: Date }[] = []
    const start = periodStart
    const end   = periodEnd
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d)
      for (const ev of eventosFiltrados) {
        if (occursOnDate(ev, day)) expanded.push({ ev, date: new Date(day) })
      }
    }
    return expanded.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [eventosFiltrados, periodType, periodStart, periodEnd, selectedDayStr])

  // Summary
  const totalPagos  = displayList.filter(({ ev }) => ev.tipo === 'PAGO_PROGRAMADO').reduce((s, { ev }) => s + parseFloat(String(ev.presupuestoEstimado)), 0)
  const totalNomina = displayList.filter(({ ev }) => ev.tipo === 'NOMINA').reduce((s, { ev }) => s + parseFloat(String(ev.presupuestoEstimado)), 0)
  const pendientes  = displayList.filter(({ ev }) => ev.estado === 'PLANIFICADO' && (ev.tipo === 'PAGO_PROGRAMADO' || ev.tipo === 'NOMINA')).length

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (periodType === 'dia') {
      return periodStart.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
    }
    if (periodType === 'semana') {
      const ws = periodStart; const we = periodEnd
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()}–${we.getDate()} de ${MESES[ws.getMonth()]} ${ws.getFullYear()}`
      }
      return `${ws.getDate()} ${(MESES[ws.getMonth()] ?? '').slice(0, 3)} – ${we.getDate()} ${(MESES[we.getMonth()] ?? '').slice(0, 3)} ${we.getFullYear()}`
    }
    if (periodType === 'mes') {
      return `${MESES[periodStart.getMonth()]} ${periodStart.getFullYear()}`
    }
    return `${fmtDate(toDateStr(periodStart))} — ${fmtDate(toDateStr(periodEnd))}`
  }, [periodType, periodStart, periodEnd])

  // ── Calendar view ─────────────────────────────────────────────────────────
  const calendarMonths = useMemo(() => {
    if (periodType !== 'custom') {
      return [{ year: periodStart.getFullYear(), month: periodStart.getMonth() }]
    }
    const months: { year: number; month: number }[] = []
    let cur = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
    const endMonth = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
    while (cur <= endMonth) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() })
      cur.setMonth(cur.getMonth() + 1)
    }
    return months
  }, [periodType, periodStart, periodEnd])

  const rangeStartStr = toDateStr(periodStart)
  const rangeEndStr   = toDateStr(periodEnd)

  return (
    <div className="flex flex-col gap-5">
      {toast && <Toast {...toast} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Eventos</h1>
          <p className="text-text-muted text-sm mt-0.5">Calendario de pagos, fechas importantes y recordatorios</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nuevo evento
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">💳 Pagos del período</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totalPagos)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">💼 Nómina del período</p>
          <p className="text-xl font-bold text-success">{fmt(totalNomina)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">⏳ Pendientes de ejecutar</p>
          <p className="text-xl font-bold text-text-primary">{pendientes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        {/* Left: Calendar */}
        <div className="flex flex-col gap-3">
          {/* Period nav */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary flex-1 text-center capitalize">
              {periodLabel}
            </h2>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
            <PeriodDropdown
              periodType={periodType}
              customLabel={periodType === 'custom' ? 'Período' : 'Período'}
              onSelect={selectPeriod}
              onOpenCustom={() => setCustomOpen(true)}
              savedPeriods={savedPeriods}
              onApplySaved={applySaved}
              onDeleteSaved={deleteSaved}
            />
            {periodType !== 'custom' && (
              <button onClick={goToday} className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors">
                Ahora
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {(Object.keys(TIPO_CONFIG) as TipoEvento[]).map(t => (
              <button key={t} type="button"
                onClick={() => setTipoFiltro(f => f === t ? '' : t)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors
                  ${tipoFiltro === t ? 'opacity-100' : 'opacity-60 hover:opacity-100'} ${TIPO_CONFIG[t].color}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TIPO_CONFIG[t].dot }} />
                {TIPO_CONFIG[t].label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-text-muted text-sm">Cargando…</div>
          ) : periodType === 'semana' ? (
            <WeekStrip
              ws={periodStart}
              eventos={eventosFiltrados}
              selectedStr={selectedDayStr}
              onSelectDay={ds => {
                setSelectedDayStr(prev => prev === ds ? null : ds)
                const d = new Date(ds + 'T00:00:00')
                setSelectedDay(prev => prev === d.getDate() ? null : d.getDate())
              }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {calendarMonths.map(({ year, month }) => (
                <div key={`${year}-${month}`}>
                  {calendarMonths.length > 1 && (
                    <p className="text-sm font-semibold text-text-secondary mb-2">{MESES[month]} {year}</p>
                  )}
                  <CalendarGrid
                    year={year}
                    month={month}
                    eventos={eventosFiltrados}
                    selectedDay={periodType === 'dia' ? periodStart.getDate() : selectedDay}
                    onSelectDay={d => {
                      setSelectedDay(prev => prev === d ? null : d)
                      if (d !== null) {
                        setSelectedDayStr(`${year}-${pad(month + 1)}-${pad(d)}`)
                      } else {
                        setSelectedDayStr(null)
                      }
                    }}
                    rangeStart={periodType === 'custom' ? rangeStartStr : undefined}
                    rangeEnd={periodType === 'custom' ? rangeEndStr : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Event list */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            {selectedDayStr && periodType !== 'dia'
              ? (() => { const d = new Date(selectedDayStr + 'T00:00:00'); return `${d.getDate()} de ${MESES[d.getMonth()]}` })()
              : periodType === 'dia'
                ? `${periodStart.getDate()} de ${MESES[periodStart.getMonth()]}`
                : `${periodLabel} — todos los eventos`}
          </h3>

          {displayList.length === 0 && (
            <div className="text-center text-text-muted text-sm py-10 bg-surface border border-border rounded-xl">
              Sin eventos en este período
            </div>
          )}

          <div className="flex flex-col gap-2">
            {displayList.map(({ ev, date }, idx) => {
              const cfg = TIPO_CONFIG[ev.tipo]
              const canExecute = ev.estado === 'PLANIFICADO' && parseFloat(String(ev.presupuestoEstimado)) > 0
              const isEjecutado = ev.estado === 'EJECUTADO'
              return (
                <div key={`${ev.id}-${idx}`}
                  className={`bg-surface border rounded-xl p-3 flex gap-3 items-start
                    ${isEjecutado ? 'opacity-50' : 'border-border'}`}>
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                  <div className="text-xl flex-shrink-0 leading-none mt-0.5">{cfg.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${ESTADO_CONFIG[ev.estado].color}`}>{ev.nombre}</p>
                        <p className="text-xs text-text-muted">{fmtDate(date.toISOString())}</p>
                        {ev.recurrente && (
                          <p className="text-xs text-text-muted">🔁 {ev.tipoRecurrencia?.toLowerCase()}</p>
                        )}
                      </div>
                      {parseFloat(String(ev.presupuestoEstimado)) > 0 && (
                        <p className={`text-sm font-bold flex-shrink-0 ${ev.tipo === 'NOMINA' ? 'text-success' : 'text-danger'}`}>
                          {ev.tipo === 'NOMINA' ? '+' : '-'}{fmt(ev.presupuestoEstimado)}
                        </p>
                      )}
                    </div>

                    {ev.notas && <p className="text-xs text-text-muted mt-1 truncate">{ev.notas}</p>}

                    <div className="flex items-center gap-2 mt-2">
                      {canExecute && (
                        <button onClick={() => setModal({ type: 'ejecutar', evento: ev })}
                          className="text-xs px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors font-semibold flex items-center gap-1">
                          ▶ Ejecutar
                        </button>
                      )}
                      {isEjecutado && (
                        <span className="text-xs text-success font-medium">✓ Ejecutado</span>
                      )}
                      <button onClick={() => setModal({ type: 'edit', evento: ev })}
                        className="text-xs text-text-muted hover:text-primary transition-colors px-1">✏</button>
                      <button onClick={() => setModal({ type: 'delete', evento: ev })}
                        className="text-xs text-text-muted hover:text-danger transition-colors px-1">🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Custom period modal */}
      {customOpen && (
        <CustomPeriodModal
          onClose={() => setCustomOpen(false)}
          onApply={applyCustom}
          onSave={saveCustomPeriod}
        />
      )}

      {/* Event modals */}
      {modal?.type === 'new' && (
        <Modal title="Nuevo evento" onClose={() => setModal(null)} wide>
          <EventoFormPanel personas={personas} categorias={categorias} onClose={() => setModal(null)}
            loading={create.isPending} error={modal.error}
            onSubmit={d => create.mutate(toPayload(d))} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar evento" onClose={() => setModal(null)} wide>
          <EventoFormPanel
            initial={{
              nombre:              modal.evento.nombre,
              tipo:                modal.evento.tipo,
              fecha:               modal.evento.fecha.slice(0, 10),
              recurrente:          modal.evento.recurrente,
              tipoRecurrencia:     (modal.evento.tipoRecurrencia ?? '') as TipoRecurrencia | '',
              presupuestoEstimado: String(modal.evento.presupuestoEstimado),
              moneda:              modal.evento.moneda,
              estado:              modal.evento.estado,
              prioridad:           String(modal.evento.prioridad),
              personaId:           modal.evento.personaId ?? '',
              categoriaId:         (modal.evento as any).categoriaId ?? '',
              subcategoriaId:      (modal.evento as any).subcategoriaId ?? '',
              notas:               modal.evento.notas ?? '',
            }}
            personas={personas} categorias={categorias} onClose={() => setModal(null)}
            loading={update.isPending} error={modal.error}
            onSubmit={d => update.mutate({ id: modal.evento.id, d: toPayload(d) })} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar evento" onClose={() => setModal(null)}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Eliminar el evento <strong className="text-text-primary">"{modal.evento.nombre}"</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.evento.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'ejecutar' && (
        <Modal title="Ejecutar evento" onClose={() => setModal(null)}>
          <EjecutarFormPanel
            evento={modal.evento} cuentas={cuentas} categorias={categorias}
            loading={ejecutar.isPending} error={modal.error}
            onClose={() => setModal(null)}
            onSubmit={(cuentaId, categoriaId, subcategoriaId, notas) =>
              ejecutar.mutate({ id: modal.evento.id, cuentaId, categoriaId, subcategoriaId, notas })} />
        </Modal>
      )}
    </div>
  )
}
