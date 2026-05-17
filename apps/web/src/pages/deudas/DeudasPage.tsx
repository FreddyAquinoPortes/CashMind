import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useFmt } from '../../lib/useFmt'
import type { Deuda, TipoDeuda, TipoPlazo, EstadoDeuda, Persona, PagoDeuda } from '../../lib/types'
import { TIPOS_DEUDA, MONEDAS } from '../../lib/constants'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const ESTADO_COLORS: Record<EstadoDeuda, string> = {
  ACTIVA: '#22c55e', SALDADA: '#6366f1', EN_MORA: '#ef4444',
  RENEGOCIADA: '#f59e0b', CANCELADA: '#94a3b8',
}
const ESTADO_LABELS: Record<EstadoDeuda, string> = {
  ACTIVA: 'Activa', SALDADA: 'Saldada', EN_MORA: 'En mora',
  RENEGOCIADA: 'Renegociada', CANCELADA: 'Cancelada',
}

function personaDisplayName(p: { nombre: string; apellido: string | null; tipo: string }) {
  return p.tipo === 'persona' && p.apellido ? `${p.nombre} ${p.apellido}` : p.nombre
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
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function DeudaProgress({ saldo, original, compact }: { saldo: string; original: string; compact?: boolean }) {
  const fmt = useFmt()
  const s = parseFloat(String(saldo))
  const o = parseFloat(String(original))
  const pct = o > 0 ? (s / o) * 100 : 0
  const color = pct <= 25 ? '#22c55e' : pct <= 60 ? '#f59e0b' : '#ef4444'
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-border rounded-full h-1.5">
          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs text-text-muted tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
      </div>
    )
  }
  return (
    <div>
      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>Saldo: {fmt(saldo)}</span>
        <span>Pagado: {fmt(Math.max(0, o - s))}</span>
      </div>
      <div className="w-full bg-border rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-xs text-text-muted mt-1 text-right">{pct.toFixed(0)}% pendiente</div>
    </div>
  )
}

// ── Deuda Form ─────────────────────────────────────────────────────────────
interface DeudaForm {
  personaId: string; concepto: string; tipo: TipoDeuda; montoOriginal: string; saldoActual: string
  moneda: string; fechaInicio: string; fechaFin: string; tasaInteres: string; montoCuota: string
  tipoPlazo: TipoPlazo; numeroCuotas: string; diaCobro: string
  estado: EstadoDeuda; notas: string
}
const EMPTY: DeudaForm = {
  personaId: '', concepto: '', tipo: 'PERSONAL', montoOriginal: '', saldoActual: '',
  moneda: 'DOP', fechaInicio: new Date().toISOString().slice(0, 10), fechaFin: '',
  tasaInteres: '', montoCuota: '', tipoPlazo: 'FIJO', numeroCuotas: '', diaCobro: '', estado: 'ACTIVA', notas: '',
}

/** Amortización francesa: cuota fija mensual */
function calcMontoCuota(monto: number, tasaAnual: number, n: number): number {
  if (!monto || !n) return 0
  if (tasaAnual === 0) return monto / n
  const r = (tasaAnual / 100) / 12
  return (monto * r) / (1 - Math.pow(1 + r, -n))
}

/** Newton-Raphson: given monto, cuota mensual y n cuotas → tasa anual % (null si tasa negativa) */
function calcTasaAnualDesdeMontos(monto: number, cuota: number, n: number): number | null {
  const minCuota = monto / n
  if (cuota < minCuota - 0.001) return null  // implies negative rate
  if (Math.abs(cuota - minCuota) < 0.001) return 0
  let r = 0.01
  for (let i = 0; i < 300; i++) {
    const pow = Math.pow(1 + r, -n)
    const denom = 1 - pow
    const f = (monto * r) / denom - cuota
    const df = monto * (denom + r * n * Math.pow(1 + r, -n - 1)) / (denom * denom)
    if (df === 0) return null
    const r1 = r - f / df
    if (isNaN(r1) || r1 <= 0) return null
    if (Math.abs(r1 - r) < 1e-12) { r = r1; break }
    r = r1
  }
  return r > 0 ? Math.round(r * 12 * 100 * 100) / 100 : null
}

/** Add N months to a date string (YYYY-MM-DD), clamp to last day of month */
function addMonthsStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (d.getDate() > lastDay) d.setDate(lastDay)
  return d.toISOString().slice(0, 10)
}

function DeudaFormPanel({
  initial, isEdit = false, personas, onSubmit, onClose, loading, error,
}: {
  initial?: DeudaForm; isEdit?: boolean; personas: Persona[]
  onSubmit(d: DeudaForm, cuotasPagadasAnteriores: number): void
  onClose(): void; loading: boolean; error?: string | null
}) {
  const [form, setForm] = useState<DeudaForm>(initial ?? EMPTY)
  const [confirmarPagadas, setConfirmarPagadas] = useState(false)
  const [cuotaError, setCuotaError] = useState('')

  const set = (k: keyof DeudaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const isFijo = form.tipoPlazo === 'FIJO'

  // Auto-calculate fechaFin from fechaInicio + numeroCuotas
  useEffect(() => {
    if (!isFijo || !form.fechaInicio || !form.numeroCuotas) return
    const n = parseInt(form.numeroCuotas)
    if (n > 0) setForm(p => ({ ...p, fechaFin: addMonthsStr(p.fechaInicio, n) }))
  }, [form.fechaInicio, form.numeroCuotas, form.tipoPlazo])

  // Derived values
  const montoOrig  = parseFloat(form.montoOriginal) || 0
  const saldoAct   = parseFloat(form.saldoActual) || montoOrig
  const nCuotas    = parseInt(form.numeroCuotas) || 0
  const cuotaSimple = nCuotas > 0 && montoOrig > 0 ? montoOrig / nCuotas : 0

  // Smart detection of already-paid cuotas (uses simple division for estimation)
  const estimadaPagadas = (isFijo && cuotaSimple > 0 && saldoAct < montoOrig && !isEdit)
    ? Math.max(0, Math.round((montoOrig - saldoAct) / cuotaSimple))
    : 0
  const cuotasPagadasAnteriores = confirmarPagadas ? estimadaPagadas : 0

  // ── Bidirectional handlers: tasa ↔ montoCuota ────────────────────────────
  const toStr = (n: number) => n > 0 ? n.toFixed(2) : ''

  const handleTasaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTasa = e.target.value
    const cuota = toStr(calcMontoCuota(montoOrig, parseFloat(newTasa) || 0, nCuotas))
    setCuotaError('')
    setForm(p => ({ ...p, tasaInteres: newTasa, montoCuota: cuota }))
  }

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const m = parseFloat(val) || 0
    const t = parseFloat(form.tasaInteres) || 0
    const cuota = toStr(calcMontoCuota(m, t, nCuotas))
    setForm(p => ({ ...p, montoOriginal: val, montoCuota: cuota }))
  }

  const handleCuotasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const n = parseInt(val) || 0
    const t = parseFloat(form.tasaInteres) || 0
    const cuota = toStr(calcMontoCuota(montoOrig, t, n))
    setForm(p => ({ ...p, numeroCuotas: val, montoCuota: cuota }))
  }

  const handleMontoCuotaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const c = parseFloat(val) || 0
    let newTasa = form.tasaInteres
    let err = ''
    if (c > 0 && montoOrig > 0 && nCuotas > 0) {
      const minC = montoOrig / nCuotas
      if (c < minC - 0.001) {
        err = `Cuota mínima sin interés: ${minC.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — un valor menor implica tasa negativa`
      } else {
        const anual = calcTasaAnualDesdeMontos(montoOrig, c, nCuotas)
        if (anual !== null) newTasa = anual.toFixed(2)
      }
    }
    setCuotaError(err)
    setForm(p => ({ ...p, montoCuota: val, tasaInteres: newTasa }))
  }

  return (
    <form onSubmit={e => { e.preventDefault(); if (cuotaError) return; onSubmit(form, cuotasPagadasAnteriores) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Persona / Entidad *
        <select required value={form.personaId} onChange={set('personaId')} className="input">
          <option value="">— Seleccionar —</option>
          {personas.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Concepto *
        <input required type="text" maxLength={150} value={form.concepto} onChange={set('concepto')}
          className="input" placeholder="Ej. Préstamo personal — diciembre 2025" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo de deuda
          <select value={form.tipo} onChange={set('tipo')} className="input">
            {TIPOS_DEUDA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Moneda
          <select value={form.moneda} onChange={set('moneda')} className="input">
            {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.value}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Monto original *
          <input required type="number" step="0.01" min="0.01" value={form.montoOriginal}
            onChange={handleMontoChange} className="input" placeholder="0.00" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Saldo actual
          <input type="number" step="0.01" min="0" value={form.saldoActual}
            onChange={set('saldoActual')} className="input" placeholder="Igual al original" />
        </label>
      </div>

      {/* ── Tipo de plazo + cuotas PRIMERO ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo de plazo
          <select value={form.tipoPlazo} onChange={set('tipoPlazo')} className="input">
            <option value="FIJO">Fijo (cuotas)</option>
            <option value="FLEXIBLE">Flexible</option>
          </select>
        </label>
        {isFijo && (
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            N° cuotas *
            <input required type="number" min="1" value={form.numeroCuotas}
              onChange={handleCuotasChange} className="input" placeholder="12" />
          </label>
        )}
      </div>

      {/* Tasa siempre visible (para FIJO calcula cuota, para FLEXIBLE es informativa) */}
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Tasa de interés % anual
        <input type="number" step="0.01" min="0" max="200" value={form.tasaInteres}
          onChange={handleTasaChange} className="input" placeholder="0.00 (sin interés)" />
      </label>

      {/* Monto cuota — editable y bidireccional */}
      {isFijo && (
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          <span className="flex items-center gap-2">
            Monto por cuota
            <span className="text-xs text-primary font-normal">
              {form.tasaInteres ? '(calculado desde tasa)' : '(ingresa para derivar la tasa)'}
            </span>
          </span>
          <input
            type="number" step="0.01" min="0"
            value={form.montoCuota}
            onChange={handleMontoCuotaChange}
            className={`input ${cuotaError ? 'border-danger' : ''}`}
            placeholder="Se calcula automáticamente"
          />
          {cuotaError && (
            <span className="text-xs text-danger mt-0.5">{cuotaError}</span>
          )}
          {!cuotaError && form.montoCuota && nCuotas > 0 && (
            <span className="text-xs text-text-muted mt-0.5">
              Total: {form.moneda} {(parseFloat(form.montoCuota) * nCuotas).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </label>
      )}

      {/* ── Fechas (fechaFin se auto-calcula si es FIJO) ──────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha inicio *
          <input required type="date" value={form.fechaInicio} onChange={set('fechaInicio')} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha fin {isFijo && <span className="text-xs text-primary">(calculada)</span>}
          <input type="date" value={form.fechaFin} onChange={set('fechaFin')} className="input"
            readOnly={isFijo} style={{ opacity: isFijo ? 0.7 : 1 }} />
        </label>
      </div>

      {/* ── Smart: cuotas pagadas anteriormente ──────────────────────────── */}
      {estimadaPagadas > 0 && (
        <label className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmarPagadas}
            onChange={e => setConfirmarPagadas(e.target.checked)}
            className="mt-0.5 accent-amber-500"
          />
          <div>
            <p className="text-sm font-medium text-amber-500">
              Se detectaron {estimadaPagadas} cuota{estimadaPagadas !== 1 ? 's' : ''} pagada{estimadaPagadas !== 1 ? 's' : ''} anteriormente
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Marca esta casilla para confirmar y no generar eventos ya vencidos
              ({estimadaPagadas}/{nCuotas} pagadas · solo se crearán {nCuotas - estimadaPagadas} eventos)
            </p>
          </div>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Estado
        <select value={form.estado} onChange={set('estado')} className="input">
          {(Object.keys(ESTADO_LABELS) as EstadoDeuda[]).map(e => (
            <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <textarea value={form.notas} onChange={set('notas')} className="input resize-none" rows={2}
          placeholder="Información adicional..." />
      </label>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading || !!cuotaError} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── Pago Form ──────────────────────────────────────────────────────────────
function PagoFormPanel({ deuda, onSubmit, onClose, loading, error }: {
  deuda: Deuda; onSubmit(monto: number, notas: string): void
  onClose(): void; loading: boolean; error?: string | null
}) {
  const fmt = useFmt()
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const saldo = parseFloat(String(deuda.saldoActual))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(parseFloat(monto), notas) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}
      <div className="bg-background/50 rounded-xl p-3 text-sm">
        <p className="text-text-muted text-xs mb-1">{deuda.concepto ?? '—'}</p>
        <div className="flex justify-between text-text-muted">
          <span>Saldo actual</span>
          <span className="font-semibold text-danger">{fmt(saldo)}</span>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Monto del pago *
        <input required type="number" step="0.01" min="0.01" max={saldo}
          value={monto} onChange={e => setMonto(e.target.value)} className="input" placeholder="0.00" autoFocus />
        <span className="text-xs text-text-muted">Máximo: {fmt(saldo)}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <input value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Ej. Cuota de mayo..." />
      </label>
      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Aplicando…' : 'Aplicar pago'}</button>
      </div>
    </form>
  )
}

// ── Deuda Row (expandable) ─────────────────────────────────────────────────
function DeudaRow({ d, onEdit, onDelete, onPago }: {
  d: Deuda
  onEdit(d: Deuda): void
  onDelete(d: Deuda): void
  onPago(d: Deuda): void
}) {
  const fmt = useFmt()
  const [open, setOpen] = useState(false)
  const color     = ESTADO_COLORS[d.estado]
  const tipoLabel = TIPOS_DEUDA.find(t => t.value === d.tipo)?.label ?? d.tipo

  const { data: pagos, isLoading: pagosLoading } = useQuery<PagoDeuda[]>({
    queryKey: ['deuda-pagos', d.id],
    queryFn: async () => (await api.get(`/deudas/${d.id}/pagos`)).data.data,
    enabled: open,           // only fetch when expanded
    staleTime: 30_000,
  })

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    const [y, m, day] = iso.slice(0, 10).split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Summary row */}
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Expand chevron */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="mt-1 flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
          title={open ? 'Colapsar' : 'Ver detalles'}
        >
          {open
            ? <ChevronDownIcon className="w-3.5 h-3.5" />
            : <ChevronRightIcon className="w-3.5 h-3.5" />}
        </button>

        {/* Estado dot */}
        <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: color }} />

        <div className="flex-1 min-w-0">
          {/* Concepto + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-sm font-medium text-text-primary cursor-pointer hover:text-primary transition-colors"
              onClick={() => setOpen(o => !o)}>
              {d.concepto ?? '(sin concepto)'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-border/80 text-text-muted">{tipoLabel}</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: color + '22', color }}>
              {ESTADO_LABELS[d.estado]}
            </span>
            {d.tipoPlazo === 'FIJO' && d.numeroCuotas && (
              <span className="text-xs text-text-muted">{d.numeroCuotas} cuotas</span>
            )}
          </div>
          <DeudaProgress saldo={d.saldoActual} original={d.montoOriginal} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2 mt-0.5">
          {d.estado === 'ACTIVA' && (
            <button onClick={() => onPago(d)}
              className="px-2 py-1 rounded text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors">
              💳 Pago
            </button>
          )}
          <button onClick={() => onEdit(d)}
            className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors text-sm">✏</button>
          <button onClick={() => onDelete(d)}
            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors text-sm">🗑</button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {open && (
        <div className="mx-4 mb-4 rounded-xl bg-background/60 border border-border/60 overflow-hidden">
          {/* Key data grid */}
          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
            <div className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Fecha inicio</p>
              <p className="text-sm font-medium text-text-primary">{fmtDate(d.fechaInicio)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Fecha fin</p>
              <p className="text-sm font-medium text-text-primary">{fmtDate(d.fechaFin)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Tasa de interés</p>
              <p className="text-sm font-medium text-text-primary">
                {d.tasaInteres ? `${parseFloat(String(d.tasaInteres)).toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
            <div className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Tipo plazo</p>
              <p className="text-sm font-medium text-text-primary">{d.tipoPlazo === 'FIJO' ? 'Fijo' : 'Flexible'}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Cuotas</p>
              <p className="text-sm font-medium text-text-primary">{d.numeroCuotas ?? '—'}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Moneda</p>
              <p className="text-sm font-medium text-text-primary">{d.moneda}</p>
            </div>
          </div>
          {d.notas && (
            <div className="px-3 py-2.5 border-b border-border/60">
              <p className="text-xs text-text-muted mb-0.5">Notas</p>
              <p className="text-sm text-text-secondary">{d.notas}</p>
            </div>
          )}

          {/* Payment history */}
          <div className="px-3 py-2.5">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Historial de pagos</p>
            {pagosLoading && (
              <p className="text-xs text-text-muted">Cargando…</p>
            )}
            {!pagosLoading && (!pagos || pagos.length === 0) && (
              <p className="text-xs text-text-muted italic">Sin pagos registrados</p>
            )}
            {!pagosLoading && pagos && pagos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {pagos.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                      <span className="text-text-secondary">{fmtDate(p.fecha)}</span>
                      {p.notas && <span className="text-xs text-text-muted truncate max-w-[120px]">{p.notas}</span>}
                    </div>
                    <span className="font-medium text-success tabular-nums">+{fmt(p.monto)}</span>
                  </div>
                ))}
                {/* Total paid summary */}
                <div className="flex items-center justify-between text-xs text-text-muted pt-1.5 border-t border-border/60 mt-0.5">
                  <span>{pagos.length} {pagos.length === 1 ? 'pago' : 'pagos'}</span>
                  <span className="font-semibold text-success">
                    Total: {fmt(pagos.reduce((s, p) => s + parseFloat(String(p.monto)), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Persona Group Card ──────────────────────────────────────────────────────
function PersonaGroupCard({
  personaName, deudas, filtroEstado,
  onNew, onEdit, onDelete, onPago,
}: {
  personaName: string
  deudas: Deuda[]
  filtroEstado: EstadoDeuda | ''
  onNew(): void
  onEdit(d: Deuda): void
  onDelete(d: Deuda): void
  onPago(d: Deuda): void
}) {
  const fmt = useFmt()
  const [open, setOpen] = useState(true)

  const filtered = deudas.filter(d => !filtroEstado || d.estado === filtroEstado)
  if (filtered.length === 0) return null

  const totalSaldo = filtered.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const totalOriginal = filtered.reduce((s, d) => s + parseFloat(String(d.montoOriginal)), 0)
  const activas = filtered.filter(d => d.estado === 'ACTIVA').length
  const hasActive = activas > 0

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header row — persona name + totals */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        {open
          ? <ChevronDownIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
          : <ChevronRightIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
        }

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">{personaName.charAt(0).toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary truncate">{personaName}</span>
            <span className="text-xs text-text-muted">{filtered.length} {filtered.length === 1 ? 'deuda' : 'deudas'}</span>
            {activas > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                {activas} activa{activas > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className={`font-bold tabular-nums ${hasActive ? 'text-danger' : 'text-text-muted'}`}>
            {fmt(totalSaldo)}
          </p>
          {totalOriginal !== totalSaldo && (
            <p className="text-xs text-text-muted">de {fmt(totalOriginal)}</p>
          )}
        </div>
      </button>

      {/* Collapsed: mini progress bar */}
      {!open && hasActive && (
        <div className="px-4 pb-3">
          <DeudaProgress saldo={String(totalSaldo)} original={String(totalOriginal)} compact />
        </div>
      )}

      {/* Expanded: list of debts */}
      {open && (
        <div className="border-t border-border">
          {filtered.map(d => (
            <DeudaRow
              key={d.id}
              d={d}
              onEdit={onEdit}
              onDelete={onDelete}
              onPago={onPago}
            />
          ))}

          {/* Add another debt for this person shortcut */}
          <div className="px-4 py-2">
            <button onClick={onNew}
              className="text-xs text-text-muted hover:text-primary transition-colors flex items-center gap-1">
              <PlusIcon className="w-3 h-3" /> Agregar otra deuda a {personaName.split(' ')[0]}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new'; prePersonaId?: string; error?: string }
  | { type: 'edit'; deuda: Deuda; error?: string }
  | { type: 'delete'; deuda: Deuda }
  | { type: 'pago'; deuda: Deuda; error?: string }
  | null

const toPayload = (d: DeudaForm, cuotasPagadasAnteriores = 0) => ({
  personaId: d.personaId,
  concepto: d.concepto || null,
  tipo: d.tipo,
  montoOriginal: parseFloat(d.montoOriginal),
  saldoActual: d.saldoActual ? parseFloat(d.saldoActual) : undefined,
  moneda: d.moneda,
  fechaInicio: d.fechaInicio,
  fechaFin: d.fechaFin || null,
  tasaInteres: d.tasaInteres ? parseFloat(d.tasaInteres) : null,
  tipoPlazo: d.tipoPlazo,
  numeroCuotas: d.numeroCuotas ? parseInt(d.numeroCuotas) : null,
  diaCobro: d.diaCobro ? parseInt(d.diaCobro) : null,
  estado: d.estado,
  notas: d.notas || null,
  cuotasPagadasAnteriores,
})

export function DeudasPage() {
  const fmt = useFmt()
  const qc = useQueryClient()
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const { data: deudas = [], isLoading } = useQuery<Deuda[]>({
    queryKey: ['deudas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/deudas`)).data.data,
    enabled: !!cid,
  })
  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ['personas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
    enabled: !!cid,
  })

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoDeuda | ''>('')
  const closeModal = () => setModal(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['deudas', cid] })

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/deudas`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Deuda registrada') },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error al registrar deuda'
      setModal(p => p ? { ...p, error: msg } : p); showToast(msg, 'error')
    },
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/deudas/${id}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Deuda actualizada') },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error al actualizar deuda'
      setModal(p => p ? { ...p, error: msg } : p); showToast(msg, 'error')
    },
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/deudas/${id}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Deuda eliminada') },
    onError: (e: any) => { showToast(e?.response?.data?.error ?? e?.message, 'error') },
  })
  const pagar = useMutation({
    mutationFn: ({ id, monto, notas }: { id: string; monto: number; notas: string }) =>
      api.post(`/deudas/${id}/pagos`, { monto, notas }),
    onSuccess: () => { invalidate(); closeModal(); showToast('Pago aplicado correctamente') },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error al aplicar pago'
      setModal(p => p ? { ...p, error: msg } : p); showToast(msg, 'error')
    },
  })

  // ── Summary ────────────────────────────────────────────────────────────
  const totalPorPagar = deudas.filter(d => d.estado === 'ACTIVA').reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const totalOriginal = deudas.filter(d => d.estado === 'ACTIVA').reduce((s, d) => s + parseFloat(String(d.montoOriginal)), 0)
  const saldadas = deudas.filter(d => d.estado === 'SALDADA').length

  // ── Group by persona ───────────────────────────────────────────────────
  // Build a map: personaId → { name, deudas[] }
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; deudas: Deuda[] }>()
    for (const d of deudas) {
      const key = d.personaId ?? `__txt__${d.acreedorTexto ?? 'sin_persona'}`
      if (!map.has(key)) {
        const name = d.persona
          ? personaDisplayName(d.persona)
          : (d.acreedorTexto ?? 'Sin acreedor')
        map.set(key, { name, deudas: [] })
      }
      map.get(key)!.deudas.push(d)
    }
    // Sort groups: most total saldo first
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const sA = a.deudas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
      const sB = b.deudas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
      return sB - sA
    })
  }, [deudas])

  // Modal initial form when pre-filling persona
  const newFormInitial = (prePersonaId?: string): DeudaForm =>
    prePersonaId ? { ...EMPTY, personaId: prePersonaId } : EMPTY

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast {...toast} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Deudas</h1>
          <p className="text-text-muted text-sm mt-0.5">Control de préstamos, cuotas y obligaciones financieras</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nueva deuda
        </button>
      </div>

      {/* Summary cards */}
      {deudas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Por pagar (activas)</p>
            <p className="text-xl font-bold text-danger">{fmt(totalPorPagar)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Monto original</p>
            <p className="text-xl font-bold text-text-primary">{fmt(totalOriginal)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Saldadas</p>
            <p className="text-xl font-bold text-success">{saldadas}</p>
          </div>
        </div>
      )}

      {/* Filter by estado */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'ACTIVA', 'SALDADA', 'EN_MORA', 'RENEGOCIADA', 'CANCELADA'] as const).map(e => (
          <button key={e} type="button" onClick={() => setFiltroEstado(e as EstadoDeuda | '')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
              ${filtroEstado === e ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-primary/40'}`}>
            {e === '' ? 'Todas' : ESTADO_LABELS[e as EstadoDeuda]}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex items-center justify-center h-32 text-text-muted text-sm">Cargando…</div>}

      {/* Grouped cards */}
      <div className="flex flex-col gap-3">
        {groups.map(([key, { name, deudas: groupDeudas }]) => (
          <PersonaGroupCard
            key={key}
            personaName={name}
            deudas={groupDeudas}
            filtroEstado={filtroEstado}
            onNew={() => setModal({ type: 'new', prePersonaId: groupDeudas[0]?.personaId ?? undefined })}
            onEdit={d => setModal({ type: 'edit', deuda: d })}
            onDelete={d => setModal({ type: 'delete', deuda: d })}
            onPago={d => setModal({ type: 'pago', deuda: d })}
          />
        ))}
      </div>

      {!isLoading && groups.length === 0 && (
        <div className="text-center text-text-muted py-16 text-sm">
          <p className="text-4xl mb-4">💸</p>
          <p className="font-medium text-text-secondary mb-1">No hay deudas registradas</p>
          <p className="text-xs mb-4">Registra préstamos, cuotas o cualquier obligación financiera</p>
          <button onClick={() => setModal({ type: 'new' })} className="btn-primary">+ Registrar primera deuda</button>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'new' && (
        <Modal title="Nueva deuda" onClose={closeModal}>
          <DeudaFormPanel
            initial={newFormInitial(modal.prePersonaId)}
            personas={personas} onClose={closeModal} loading={create.isPending} error={modal.error}
            onSubmit={(d, cuotasPagadas) => create.mutate(toPayload(d, cuotasPagadas))} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar deuda" onClose={closeModal}>
          <DeudaFormPanel
            isEdit
            initial={{
              personaId: modal.deuda.personaId ?? '',
              concepto: modal.deuda.concepto ?? '',
              tipo: modal.deuda.tipo,
              montoOriginal: String(modal.deuda.montoOriginal),
              saldoActual: String(modal.deuda.saldoActual),
              moneda: modal.deuda.moneda,
              fechaInicio: modal.deuda.fechaInicio.slice(0, 10),
              fechaFin: modal.deuda.fechaFin?.slice(0, 10) ?? '',
              tasaInteres: String(modal.deuda.tasaInteres ?? ''),
              tipoPlazo: modal.deuda.tipoPlazo,
              numeroCuotas: String(modal.deuda.numeroCuotas ?? ''),
              diaCobro: String(modal.deuda.diaCobro ?? ''),
              estado: modal.deuda.estado,
              notas: modal.deuda.notas ?? '',
            }}
            personas={personas} onClose={closeModal} loading={update.isPending} error={modal.error}
            onSubmit={(d) => update.mutate({ id: modal.deuda.id, d: toPayload(d) })} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar deuda" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-2">
            ¿Eliminar la deuda <strong className="text-text-primary">
              "{modal.deuda.concepto ?? modal.deuda.persona?.nombre ?? modal.deuda.acreedorTexto ?? '—'}"
            </strong>?
          </p>
          <p className="text-xs text-text-muted mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.deuda.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'pago' && (
        <Modal title={`Aplicar pago — ${modal.deuda.persona ? personaDisplayName(modal.deuda.persona) : modal.deuda.acreedorTexto ?? '—'}`} onClose={closeModal}>
          <PagoFormPanel
            deuda={modal.deuda} onClose={closeModal} loading={pagar.isPending} error={modal.error}
            onSubmit={(monto, notas) => pagar.mutate({ id: modal.deuda.id, monto, notas })} />
        </Modal>
      )}
    </div>
  )
}
