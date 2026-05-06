import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Evento, TipoEvento, EstadoEvento, TipoRecurrencia, CuentaBancaria, Persona } from '../../lib/types'
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

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

const fmt = (n: string | number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(parseFloat(String(n)))

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ── Recurring expansion ────────────────────────────────────────────────────
// Given a recurring event, generate all occurrences in [year, month]
function occurrencesInMonth(ev: Evento, year: number, month: number): Date[] {
  const base = new Date(ev.fecha)
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const dates: Date[] = []

  if (!ev.recurrente || !ev.tipoRecurrencia) {
    // Non-recurring: include only if in month
    if (base >= first && base <= last) dates.push(base)
    return dates
  }

  // Generate occurrences from base date forward into this month
  let cur = new Date(base)
  const maxIter = 400
  let i = 0
  while (cur <= last && i++ < maxIter) {
    if (cur >= first && cur <= last) dates.push(new Date(cur))
    // Advance
    switch (ev.tipoRecurrencia) {
      case 'DIARIA':   cur = new Date(cur); cur.setDate(cur.getDate() + 1); break
      case 'SEMANAL':  cur = new Date(cur); cur.setDate(cur.getDate() + 7); break
      case 'MENSUAL':  cur = new Date(cur); cur.setMonth(cur.getMonth() + 1); break
      case 'ANUAL':    cur = new Date(cur); cur.setFullYear(cur.getFullYear() + 1); break
    }
    if (cur > last) break
  }
  // If base is after this month's end, nothing
  return dates
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

// ── Evento Form ────────────────────────────────────────────────────────────
interface EventoForm {
  nombre: string; tipo: TipoEvento; fecha: string
  recurrente: boolean; tipoRecurrencia: TipoRecurrencia | ''
  presupuestoEstimado: string; moneda: string
  estado: EstadoEvento; personaId: string; prioridad: string; notas: string
}
const EMPTY_FORM: EventoForm = {
  nombre: '', tipo: 'PAGO_PROGRAMADO', fecha: new Date().toISOString().slice(0, 10),
  recurrente: false, tipoRecurrencia: '', presupuestoEstimado: '', moneda: 'DOP',
  estado: 'PLANIFICADO', personaId: '', prioridad: '3', notas: '',
}

function EventoFormPanel({ initial, personas, onSubmit, onClose, loading, error }: {
  initial?: EventoForm; personas: Persona[]; onSubmit(d: EventoForm): void
  onClose(): void; loading: boolean; error?: string | null
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
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha *
          <input required type="date" value={form.fecha} onChange={set('fecha')} className="input" />
        </label>
      </div>

      {/* Recurrence */}
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

      {/* Budget — only for payment events */}
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

      {/* Persona — for birthdays / personal events */}
      {(form.tipo === 'CUMPLEANOS' || form.tipo === 'OTRO') && (
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Persona (opcional)
          <select value={form.personaId} onChange={set('personaId')} className="input">
            <option value="">— Ninguna —</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </label>
      )}

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
function EjecutarFormPanel({ evento, cuentas, onSubmit, onClose, loading, error }: {
  evento: Evento; cuentas: CuentaBancaria[]; loading: boolean; error?: string | null
  onSubmit(cuentaId: string, notas: string): void; onClose(): void
}) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '')
  const [notas, setNotas]       = useState('')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(cuentaId, notas) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      {/* Summary */}
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

// ── Calendar ───────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, eventos, selectedDay, onSelectDay }: {
  year: number; month: number; eventos: Evento[]
  selectedDay: number | null; onSelectDay(d: number | null): void
}) {
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  // Build day → events map, expanding recurrences
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

  // Build grid cells
  const firstDow = new Date(year, month, 1).getDay()  // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return (
            <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-border/40 bg-background/20" />
          )

          const isToday      = isCurrentMonth && day === today.getDate()
          const isSelected   = day === selectedDay
          const dayEvents    = dayMap.get(day) ?? []
          const hasExec      = dayEvents.some(e => e.estado === 'PLANIFICADO' && (e.tipo === 'PAGO_PROGRAMADO' || e.tipo === 'NOMINA'))

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : day)}
              className={`min-h-[72px] border-b border-r border-border/40 p-1.5 text-left flex flex-col transition-colors
                ${isSelected ? 'bg-primary/10' : 'hover:bg-white/5'}
                ${day % 7 === 0 || (day + firstDow - 1) % 7 === 0 ? 'opacity-70' : ''}`}
            >
              {/* Day number */}
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                ${isToday ? 'bg-primary text-white' : isSelected ? 'text-primary' : 'text-text-secondary'}`}>
                {day}
              </span>

              {/* Event dots */}
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

              {/* Exec indicator */}
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
  notas:               f.notas || null,
})

export function EventosPage() {
  const qc = useQueryClient()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState<TipoEvento | ''>('')

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3200)
  }

  const mesStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const { data: eventos = [], isLoading } = useQuery<Evento[]>({
    queryKey: ['eventos', mesStr],
    queryFn: async () => (await api.get(`/eventos?mes=${mesStr}`)).data.data,
  })
  const { data: cuentas = [] } = useQuery<CuentaBancaria[]>({
    queryKey: ['cuentas'],
    queryFn: async () => (await api.get('/cuentas')).data.data,
  })
  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ['personas'],
    queryFn: async () => (await api.get('/personas')).data.data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['eventos'] })

  const create = useMutation({
    mutationFn: (d: object) => api.post('/eventos', d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Evento creado') },
    onError: (e: any) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error') },
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/eventos/${id}`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Evento actualizado') },
    onError: (e: any) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error') },
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/eventos/${id}`),
    onSuccess: () => { invalidate(); setModal(null); showToast('Evento eliminado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e?.message, 'error'),
  })
  const ejecutar = useMutation({
    mutationFn: ({ id, cuentaId, notas }: { id: string; cuentaId: string; notas: string }) =>
      api.post(`/eventos/${id}/ejecutar`, { cuentaId, notas }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['cuentas'] })
      qc.invalidateQueries({ queryKey: ['transacciones'] })
      setModal(null); showToast('✅ Transacción registrada correctamente')
    },
    onError: (e: any) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error') },
  })

  // Nav
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.getDate()) }

  // Events for selected day (expanding recurrences)
  const eventosDelDia = useMemo(() => {
    if (!selectedDay) return []
    return eventos.filter(ev => {
      const dates = occurrencesInMonth(ev, year, month)
      return dates.some(d => d.getDate() === selectedDay)
    }).filter(ev => !tipoFiltro || ev.tipo === tipoFiltro)
  }, [eventos, selectedDay, year, month, tipoFiltro])

  // All events in month for list view (when no day selected)
  const eventosDelMes = useMemo(() => {
    const expanded: { ev: Evento; date: Date }[] = []
    for (const ev of eventos) {
      if (tipoFiltro && ev.tipo !== tipoFiltro) continue
      const dates = occurrencesInMonth(ev, year, month)
      for (const d of dates) expanded.push({ ev, date: d })
    }
    return expanded.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [eventos, year, month, tipoFiltro])

  const displayList = selectedDay ? eventosDelDia.map(ev => {
    const dates = occurrencesInMonth(ev, year, month)
    const date = dates.find(d => d.getDate() === selectedDay) ?? dates[0]
    return { ev, date }
  }) : eventosDelMes

  // Summary for month
  const totalPagos   = eventosDelMes.filter(({ ev }) => ev.tipo === 'PAGO_PROGRAMADO').reduce((s, { ev }) => s + parseFloat(String(ev.presupuestoEstimado)), 0)
  const totalNomina  = eventosDelMes.filter(({ ev }) => ev.tipo === 'NOMINA').reduce((s, { ev }) => s + parseFloat(String(ev.presupuestoEstimado)), 0)
  const pendientes   = eventosDelMes.filter(({ ev }) => ev.estado === 'PLANIFICADO' && (ev.tipo === 'PAGO_PROGRAMADO' || ev.tipo === 'NOMINA')).length

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
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">💳 Pagos del mes</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totalPagos)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">💼 Nómina del mes</p>
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
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary flex-1 text-center">
              {MESES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
            <button onClick={goToday} className="text-xs px-2.5 py-1 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
              Hoy
            </button>
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

          {isLoading
            ? <div className="h-64 flex items-center justify-center text-text-muted text-sm">Cargando…</div>
            : <CalendarGrid year={year} month={month} eventos={eventos.filter(ev => !tipoFiltro || ev.tipo === tipoFiltro)}
                selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          }
        </div>

        {/* Right: Event list */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            {selectedDay
              ? `${selectedDay} de ${MESES[month]}`
              : `${MESES[month]} — todos los eventos`}
          </h3>

          {displayList.length === 0 && (
            <div className="text-center text-text-muted text-sm py-10 bg-surface border border-border rounded-xl">
              {selectedDay ? 'Sin eventos este día' : 'Sin eventos este mes'}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {displayList.map(({ ev, date }, idx) => {
              const cfg = TIPO_CONFIG[ev.tipo]
              const canExecute = ev.estado === 'PLANIFICADO' && (ev.tipo === 'PAGO_PROGRAMADO' || ev.tipo === 'NOMINA')
              const isEjecutado = ev.estado === 'EJECUTADO'
              return (
                <div key={`${ev.id}-${idx}`}
                  className={`bg-surface border rounded-xl p-3 flex gap-3 items-start
                    ${isEjecutado ? 'opacity-50' : 'border-border'}`}>
                  {/* Icon + color bar */}
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

                    {/* Action buttons */}
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

      {/* Modals */}
      {modal?.type === 'new' && (
        <Modal title="Nuevo evento" onClose={() => setModal(null)} wide>
          <EventoFormPanel personas={personas} onClose={() => setModal(null)}
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
              notas:               modal.evento.notas ?? '',
            }}
            personas={personas} onClose={() => setModal(null)}
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
            evento={modal.evento} cuentas={cuentas}
            loading={ejecutar.isPending} error={modal.error}
            onClose={() => setModal(null)}
            onSubmit={(cuentaId, notas) => ejecutar.mutate({ id: modal.evento.id, cuentaId, notas })} />
        </Modal>
      )}
    </div>
  )
}
