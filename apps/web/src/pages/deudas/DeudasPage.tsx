import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useFmt } from '../../lib/useFmt'
import type {
  Deuda, DireccionDeuda, TipoDeuda, TipoPlazo, EstadoDeuda,
  Persona, PagoDeuda, Categoria, CuentaBancaria, TarjetaCredito,
} from '../../lib/types'
import { TIPOS_DEUDA, MONEDAS } from '../../lib/constants'
import { Icon } from '@iconify/react'
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

const toLocalDateStr = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
      {msg}
    </div>
  )
}

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
  personaId: string; concepto: string; tipo: TipoDeuda; direccion: DireccionDeuda
  cuentaOrigenId: string; tarjetaOrigenId: string
  montoOriginal: string; saldoActual: string
  moneda: string; fechaInicio: string; fechaFin: string; tasaInteres: string; montoCuota: string
  tipoPlazo: TipoPlazo; numeroCuotas: string; diaCobro: string
  estado: EstadoDeuda; notas: string; categoriaId: string; subcategoriaId: string
}
const EMPTY: DeudaForm = {
  personaId: '', concepto: '', tipo: 'PERSONAL', direccion: 'DEBO_YO',
  cuentaOrigenId: '', tarjetaOrigenId: '',
  montoOriginal: '', saldoActual: '',
  moneda: 'DOP', fechaInicio: toLocalDateStr(), fechaFin: '',
  tasaInteres: '', montoCuota: '', tipoPlazo: 'FIJO', numeroCuotas: '', diaCobro: '',
  estado: 'ACTIVA', notas: '', categoriaId: '', subcategoriaId: '',
}

function calcMontoCuota(monto: number, tasaAnual: number, n: number): number {
  if (!monto || !n) return 0
  if (tasaAnual === 0) return monto / n
  const r = (tasaAnual / 100) / 12
  return (monto * r) / (1 - Math.pow(1 + r, -n))
}

function calcTasaAnualDesdeMontos(monto: number, cuota: number, n: number): number | null {
  const minCuota = monto / n
  if (cuota < minCuota - 0.001) return null
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

function addMonthsStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (d.getDate() > lastDay) d.setDate(lastDay)
  return toLocalDateStr(d)
}

function DeudaFormPanel({
  initial, isEdit = false, personas, categorias, cuentas, tarjetas,
  onSubmit, onClose, loading, error,
}: {
  initial?: DeudaForm; isEdit?: boolean; personas: Persona[]; categorias: Categoria[]
  cuentas: CuentaBancaria[]; tarjetas: TarjetaCredito[]
  onSubmit(d: DeudaForm, cuotasPagadasAnteriores: number): void
  onClose(): void; loading: boolean; error?: string | null
}) {
  const [form, setForm] = useState<DeudaForm>(initial ?? EMPTY)
  const [confirmarPagadas, setConfirmarPagadas] = useState(false)
  const [cuotaError, setCuotaError] = useState('')

  const set = (k: keyof DeudaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const selectedCat = categorias.find(c => c.id === form.categoriaId)
  const subcats = selectedCat?.subcategorias ?? []
  const handleCatChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm(p => ({ ...p, categoriaId: e.target.value, subcategoriaId: '' }))

  const isFijo = form.tipoPlazo === 'FIJO'
  const isMeDeben = form.direccion === 'ME_DEBEN'

  useEffect(() => {
    if (!isFijo || !form.fechaInicio || !form.numeroCuotas) return
    const n = parseInt(form.numeroCuotas)
    if (n > 0) setForm(p => ({ ...p, fechaFin: addMonthsStr(p.fechaInicio, n) }))
  }, [form.fechaInicio, form.numeroCuotas, form.tipoPlazo])

  const montoOrig  = parseFloat(form.montoOriginal) || 0
  const saldoAct   = parseFloat(form.saldoActual) || montoOrig
  const nCuotas    = parseInt(form.numeroCuotas) || 0
  const cuotaSimple = nCuotas > 0 && montoOrig > 0 ? montoOrig / nCuotas : 0

  const estimadaPagadas = (isFijo && cuotaSimple > 0 && saldoAct < montoOrig && !isEdit)
    ? Math.max(0, Math.round((montoOrig - saldoAct) / cuotaSimple))
    : 0
  const cuotasPagadasAnteriores = confirmarPagadas ? estimadaPagadas : 0

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

      {/* ── Dirección: quién le debe a quién ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-text-secondary">Dirección de la deuda *</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, direccion: 'DEBO_YO', cuentaOrigenId: '', tarjetaOrigenId: '' }))}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left
              ${form.direccion === 'DEBO_YO'
                ? 'border-danger bg-danger/10 text-danger'
                : 'border-border text-text-muted hover:border-danger/40'}`}
          >
            <Icon icon="tabler:arrow-up-right" className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold">Yo debo</div>
              <div className="text-[10px] opacity-70">Tengo una deuda con esta persona</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, direccion: 'ME_DEBEN' }))}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left
              ${form.direccion === 'ME_DEBEN'
                ? 'border-success bg-success/10 text-success'
                : 'border-border text-text-muted hover:border-success/40'}`}
          >
            <Icon icon="tabler:arrow-down-left" className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold">Me deben</div>
              <div className="text-[10px] opacity-70">Esta persona tiene una deuda conmigo</div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Origen del préstamo (solo para ME_DEBEN) ── */}
      {isMeDeben && (
        <div className="flex flex-col gap-2 bg-success/5 border border-success/20 rounded-xl p-3">
          <p className="text-xs font-semibold text-success uppercase tracking-wider flex items-center gap-1.5">
            <Icon icon="tabler:building-bank" className="w-3.5 h-3.5" />
            ¿De dónde prestaste el dinero?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Cuenta bancaria
              <select
                value={form.cuentaOrigenId}
                onChange={e => setForm(p => ({ ...p, cuentaOrigenId: e.target.value, tarjetaOrigenId: '' }))}
                className="input text-sm"
              >
                <option value="">— Sin cuenta —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.alias ?? c.banco}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Tarjeta de crédito
              <select
                value={form.tarjetaOrigenId}
                onChange={e => setForm(p => ({ ...p, tarjetaOrigenId: e.target.value, cuentaOrigenId: '' }))}
                className="input text-sm"
              >
                <option value="">— Sin tarjeta —</option>
                {tarjetas.filter(t => t.activa).map(t => (
                  <option key={t.id} value={t.id}>{t.alias ?? t.banco} ···{t.ultimosCuatro}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-text-muted">Opcional — para saber qué cuenta/tarjeta usaste al prestar</p>
        </div>
      )}

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
          className="input" placeholder="Ej. Compra tarjeta Visa enero" />
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

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Tasa de interés % anual
        <input type="number" step="0.01" min="0" max="200" value={form.tasaInteres}
          onChange={handleTasaChange} className="input" placeholder="0.00 (sin interés)" />
      </label>

      {isFijo && (
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          <span className="flex items-center gap-2">
            Monto por cuota
            <span className="text-xs text-primary font-normal">
              {form.tasaInteres ? '(calculado desde tasa)' : '(ingresa para derivar la tasa)'}
            </span>
          </span>
          <input type="number" step="0.01" min="0" value={form.montoCuota}
            onChange={handleMontoCuotaChange}
            className={`input ${cuotaError ? 'border-danger' : ''}`}
            placeholder="Se calcula automáticamente" />
          {cuotaError && <span className="text-xs text-danger mt-0.5">{cuotaError}</span>}
          {!cuotaError && form.montoCuota && nCuotas > 0 && (
            <span className="text-xs text-text-muted mt-0.5">
              Total: {form.moneda} {(parseFloat(form.montoCuota) * nCuotas).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </label>
      )}

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

      {estimadaPagadas > 0 && (
        <label className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer">
          <input type="checkbox" checked={confirmarPagadas} onChange={e => setConfirmarPagadas(e.target.checked)}
            className="mt-0.5 accent-amber-500" />
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

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Categoría <span className="text-xs text-text-muted font-normal">(opcional)</span>
          <select value={form.categoriaId} onChange={handleCatChange} className="input">
            <option value="">— Sin categoría —</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>)}
          </select>
        </label>
        {form.categoriaId && subcats.length > 0 && (
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Subcategoría
            <select value={form.subcategoriaId} onChange={set('subcategoriaId')} className="input">
              <option value="">— Sin subcategoría —</option>
              {subcats.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <textarea value={form.notas} onChange={set('notas')} className="input resize-none" rows={2}
          placeholder="Información adicional..." />
      </label>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading || !!cuotaError} className="btn-primary">
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
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

// ── Compensar confirm modal ────────────────────────────────────────────────
function CompensarModal({
  personaName, clienteId, personaId, onClose, onSuccess,
}: {
  personaName: string; clienteId: string; personaId: string
  onClose(): void; onSuccess(): void
}) {
  const fmt = useFmt()
  const { data: deudas = [] } = useQuery<Deuda[]>({
    queryKey: ['deudas', clienteId],
    queryFn: async () => (await api.get(`/clientes/${clienteId}/deudas`)).data.data,
    staleTime: 0,
  })
  const activas = deudas.filter(d => d.personaId === personaId && d.estado === 'ACTIVA')
  const deboYo  = activas.filter(d => (d.direccion ?? 'DEBO_YO') === 'DEBO_YO')
  const meDeben = activas.filter(d => d.direccion === 'ME_DEBEN')
  const totalDeboYo  = deboYo.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const totalMeDeben = meDeben.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const net = Math.round((totalMeDeben - totalDeboYo) * 100) / 100

  const compensar = useMutation({
    mutationFn: () => api.post(`/clientes/${clienteId}/personas/${personaId}/compensar`, {}),
    onSuccess,
  })

  return (
    <Modal title={`Compensar deudas — ${personaName}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Las deudas mutuas se cancelarán entre sí. Así quedan los saldos antes de compensar:
        </p>

        {/* Side-by-side summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-danger/5 border border-danger/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon icon="tabler:arrow-up-right" className="w-3.5 h-3.5 text-danger" />
              <span className="text-xs font-semibold text-danger uppercase tracking-wider">Yo debo</span>
            </div>
            <p className="text-lg font-bold text-danger tabular-nums">{fmt(totalDeboYo)}</p>
            <p className="text-[10px] text-text-muted mt-1">{deboYo.length} deuda{deboYo.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl bg-success/5 border border-success/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon icon="tabler:arrow-down-left" className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-semibold text-success uppercase tracking-wider">Me deben</span>
            </div>
            <p className="text-lg font-bold text-success tabular-nums">{fmt(totalMeDeben)}</p>
            <p className="text-[10px] text-text-muted mt-1">{meDeben.length} deuda{meDeben.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Net result */}
        <div className={`rounded-xl border p-3 flex items-center gap-3
          ${Math.abs(net) < 0.01
            ? 'bg-primary/5 border-primary/20'
            : net > 0 ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}>
          <Icon icon="tabler:scale" className={`w-5 h-5 flex-shrink-0
            ${Math.abs(net) < 0.01 ? 'text-primary' : net > 0 ? 'text-success' : 'text-danger'}`} />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {Math.abs(net) < 0.01
                ? 'Quedan completamente saldados'
                : net > 0
                  ? `${personaName.split(' ')[0]} te quedará debiendo ${fmt(net)}`
                  : `Aún le deberás ${fmt(Math.abs(net))} a ${personaName.split(' ')[0]}`}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {Math.abs(net) < 0.01
                ? 'Todas las deudas se cancelan mutuamente.'
                : 'Se creará automáticamente una nueva deuda por el saldo neto restante.'}
            </p>
          </div>
        </div>

        {compensar.isError && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {(compensar.error as any)?.response?.data?.error ?? 'Error al compensar'}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button
            type="button"
            onClick={() => compensar.mutate()}
            disabled={compensar.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Icon icon="tabler:scale" className="w-4 h-4" />
            {compensar.isPending ? 'Compensando…' : 'Confirmar compensación'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Deuda Row (expandable) ─────────────────────────────────────────────────
function DeudaRow({ d, onEdit, onDelete, onPago }: {
  d: Deuda; onEdit(d: Deuda): void; onDelete(d: Deuda): void; onPago(d: Deuda): void
}) {
  const fmt = useFmt()
  const [open, setOpen] = useState(false)
  const color     = ESTADO_COLORS[d.estado]
  const tipoLabel = TIPOS_DEUDA.find(t => t.value === d.tipo)?.label ?? d.tipo
  const isMeDeben = d.direccion === 'ME_DEBEN'

  const { data: pagos, isLoading: pagosLoading } = useQuery<PagoDeuda[]>({
    queryKey: ['deuda-pagos', d.id],
    queryFn: async () => (await api.get(`/deudas/${d.id}/pagos`)).data.data,
    enabled: open,
    staleTime: 30_000,
  })

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    const [y, m, day] = iso.slice(0, 10).split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="px-4 py-3 flex items-start gap-3">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="mt-1 flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
          title={open ? 'Colapsar' : 'Ver detalles'}>
          {open ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
        </button>

        <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {/* Direction badge */}
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold
              ${isMeDeben ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              <Icon icon={isMeDeben ? 'tabler:arrow-down-left' : 'tabler:arrow-up-right'} className="w-2.5 h-2.5" />
              {isMeDeben ? 'Me deben' : 'Yo debo'}
            </span>
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

        <div className="flex items-center gap-1 flex-shrink-0 ml-2 mt-0.5">
          {d.estado === 'ACTIVA' && (
            <button onClick={() => onPago(d)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors
                ${isMeDeben
                  ? 'bg-success/10 text-success hover:bg-success/20'
                  : 'bg-success/10 text-success hover:bg-success/20'}`}>
              💳 {isMeDeben ? 'Cobrar' : 'Pago'}
            </button>
          )}
          <button onClick={() => onEdit(d)}
            className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors text-sm">✏</button>
          <button onClick={() => onDelete(d)}
            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors text-sm">🗑</button>
        </div>
      </div>

      {open && (
        <div className="mx-4 mb-4 rounded-xl bg-background/60 border border-border/60 overflow-hidden">
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
          {d.notas && (
            <div className="px-3 py-2.5 border-b border-border/60">
              <p className="text-xs text-text-muted mb-0.5">Notas</p>
              <p className="text-sm text-text-secondary">{d.notas}</p>
            </div>
          )}

          <div className="px-3 py-2.5">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Historial de pagos</p>
            {pagosLoading && <p className="text-xs text-text-muted">Cargando…</p>}
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
  personaId, personaName, deudas, filtroEstado,
  clienteId, onNew, onEdit, onDelete, onPago,
}: {
  personaId: string | null; personaName: string
  deudas: Deuda[]; filtroEstado: EstadoDeuda | ''
  clienteId: string
  onNew(): void; onEdit(d: Deuda): void; onDelete(d: Deuda): void; onPago(d: Deuda): void
}) {
  const fmt = useFmt()
  const [open, setOpen] = useState(true)
  const [showCompensar, setShowCompensar] = useState(false)
  const qc = useQueryClient()

  const filtered = deudas.filter(d => !filtroEstado || d.estado === filtroEstado)
  if (filtered.length === 0) return null

  // Separate directions
  const deboYoActivas  = deudas.filter(d => (d.direccion ?? 'DEBO_YO') === 'DEBO_YO' && d.estado === 'ACTIVA')
  const meDebenActivas = deudas.filter(d => d.direccion === 'ME_DEBEN' && d.estado === 'ACTIVA')
  const canCompensar   = personaId !== null && deboYoActivas.length > 0 && meDebenActivas.length > 0

  const totalDeboYoActivo  = deboYoActivas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const totalMeDebenActivo = meDebenActivas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const netActivo = Math.round((totalMeDebenActivo - totalDeboYoActivo) * 100) / 100

  // For header display: net balance
  const totalSaldo    = filtered.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const totalOriginal = filtered.reduce((s, d) => s + parseFloat(String(d.montoOriginal)), 0)
  const hasActive = deudas.some(d => d.estado === 'ACTIVA')

  // Separate filtered debts by direction for display
  const filteredDeboYo  = filtered.filter(d => (d.direccion ?? 'DEBO_YO') === 'DEBO_YO')
  const filteredMeDeben = filtered.filter(d => d.direccion === 'ME_DEBEN')

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Header row */}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
          {open
            ? <ChevronDownIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
            : <ChevronRightIcon className="w-4 h-4 text-text-muted flex-shrink-0" />}

          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-sm">{personaName.charAt(0).toUpperCase()}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary truncate">{personaName}</span>
              <span className="text-xs text-text-muted">{filtered.length} {filtered.length === 1 ? 'deuda' : 'deudas'}</span>
              {/* Net balance pill */}
              {hasActive && (
                <>
                  {totalDeboYoActivo > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-danger/10 text-danger font-medium flex items-center gap-0.5">
                      <Icon icon="tabler:arrow-up-right" className="w-2.5 h-2.5" />
                      {fmt(totalDeboYoActivo)}
                    </span>
                  )}
                  {totalMeDebenActivo > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium flex items-center gap-0.5">
                      <Icon icon="tabler:arrow-down-left" className="w-2.5 h-2.5" />
                      {fmt(totalMeDebenActivo)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Net position + compensar button */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {canCompensar && (
              <button
                type="button"
                onClick={() => setShowCompensar(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20
                  text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                title="Compensar deudas mutuas"
              >
                <Icon icon="tabler:scale" className="w-3.5 h-3.5" />
                Compensar
              </button>
            )}
            <div className="text-right">
              {hasActive && Math.abs(netActivo) >= 0.01 ? (
                <>
                  <p className={`font-bold tabular-nums text-sm ${netActivo > 0 ? 'text-success' : 'text-danger'}`}>
                    {netActivo > 0 ? `+${fmt(netActivo)}` : fmt(netActivo)}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {netActivo > 0 ? 'neto a tu favor' : 'neto en tu contra'}
                  </p>
                </>
              ) : hasActive && Math.abs(netActivo) < 0.01 && totalDeboYoActivo > 0 && totalMeDebenActivo > 0 ? (
                <p className="text-xs text-primary font-semibold">Equilibrado</p>
              ) : (
                <p className={`font-bold tabular-nums ${hasActive ? 'text-danger' : 'text-text-muted'}`}>
                  {fmt(totalSaldo)}
                </p>
              )}
            </div>
          </div>
        </button>

        {!open && hasActive && (
          <div className="px-4 pb-3">
            <DeudaProgress saldo={String(totalSaldo)} original={String(totalOriginal)} compact />
          </div>
        )}

        {open && (
          <div className="border-t border-border">
            {/* DEBO YO section */}
            {filteredDeboYo.length > 0 && (
              <>
                {filteredMeDeben.length > 0 && (
                  <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                    <Icon icon="tabler:arrow-up-right" className="w-3 h-3 text-danger" />
                    <span className="text-[10px] font-semibold text-danger uppercase tracking-wider">
                      Yo debo — {fmt(filteredDeboYo.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0))}
                    </span>
                  </div>
                )}
                {filteredDeboYo.map(d => (
                  <DeudaRow key={d.id} d={d} onEdit={onEdit} onDelete={onDelete} onPago={onPago} />
                ))}
              </>
            )}

            {/* ME DEBEN section */}
            {filteredMeDeben.length > 0 && (
              <>
                <div className={`px-4 pt-3 pb-1 flex items-center gap-2 ${filteredDeboYo.length > 0 ? 'border-t border-border/40' : ''}`}>
                  <Icon icon="tabler:arrow-down-left" className="w-3 h-3 text-success" />
                  <span className="text-[10px] font-semibold text-success uppercase tracking-wider">
                    Me deben — {fmt(filteredMeDeben.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0))}
                  </span>
                </div>
                {filteredMeDeben.map(d => (
                  <DeudaRow key={d.id} d={d} onEdit={onEdit} onDelete={onDelete} onPago={onPago} />
                ))}
              </>
            )}

            <div className="px-4 py-2">
              <button onClick={onNew}
                className="text-xs text-text-muted hover:text-primary transition-colors flex items-center gap-1">
                <PlusIcon className="w-3 h-3" /> Agregar otra deuda a {personaName.split(' ')[0]}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCompensar && personaId && (
        <CompensarModal
          personaName={personaName}
          clienteId={clienteId}
          personaId={personaId}
          onClose={() => setShowCompensar(false)}
          onSuccess={() => {
            setShowCompensar(false)
            qc.invalidateQueries({ queryKey: ['deudas', clienteId] })
          }}
        />
      )}
    </>
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
  direccion: d.direccion,
  cuentaOrigenId: d.cuentaOrigenId || null,
  tarjetaOrigenId: d.tarjetaOrigenId || null,
  montoOriginal: parseFloat(d.montoOriginal),
  saldoActual: d.saldoActual ? parseFloat(d.saldoActual) : undefined,
  moneda: d.moneda,
  fechaInicio: d.fechaInicio ? `${d.fechaInicio}T12:00:00.000Z` : undefined,
  fechaFin: d.fechaFin ? `${d.fechaFin}T12:00:00.000Z` : null,
  tasaInteres: d.tasaInteres ? parseFloat(d.tasaInteres) : null,
  tipoPlazo: d.tipoPlazo,
  numeroCuotas: d.numeroCuotas ? parseInt(d.numeroCuotas) : null,
  diaCobro: d.diaCobro ? parseInt(d.diaCobro) : null,
  estado: d.estado,
  notas: d.notas || null,
  categoriaId: d.categoriaId || null,
  subcategoriaId: d.subcategoriaId || null,
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
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias')).data.data,
  })
  const { data: cuentas = [] } = useQuery<CuentaBancaria[]>({
    queryKey: ['cuentas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/cuentas`)).data.data,
    enabled: !!cid,
  })
  const { data: tarjetas = [] } = useQuery<TarjetaCredito[]>({
    queryKey: ['tarjetas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/tarjetas`)).data.data,
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
  const activasDeudas = deudas.filter(d => d.estado === 'ACTIVA')
  const totalDeboYo  = activasDeudas
    .filter(d => (d.direccion ?? 'DEBO_YO') === 'DEBO_YO')
    .reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const totalMeDeben = activasDeudas
    .filter(d => d.direccion === 'ME_DEBEN')
    .reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
  const netoGlobal = Math.round((totalMeDeben - totalDeboYo) * 100) / 100
  const saldadas = deudas.filter(d => d.estado === 'SALDADA').length

  // ── Group by persona ───────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, { personaId: string | null; name: string; deudas: Deuda[] }>()
    for (const d of deudas) {
      const key = d.personaId ?? `__txt__${d.acreedorTexto ?? 'sin_persona'}`
      if (!map.has(key)) {
        const name = d.persona
          ? personaDisplayName(d.persona)
          : (d.acreedorTexto ?? 'Sin acreedor')
        map.set(key, { personaId: d.personaId, name, deudas: [] })
      }
      map.get(key)!.deudas.push(d)
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const sA = a.deudas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
      const sB = b.deudas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
      return sB - sA
    })
  }, [deudas])

  const newFormInitial = (prePersonaId?: string): DeudaForm =>
    prePersonaId ? { ...EMPTY, personaId: prePersonaId } : EMPTY

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast {...toast} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Deudas</h1>
          <p className="text-text-muted text-sm mt-0.5">Control de préstamos, cuotas y obligaciones financieras</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nueva deuda
        </button>
      </div>

      {/* Summary cards — now bidirectional */}
      {deudas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon icon="tabler:arrow-up-right" className="w-3.5 h-3.5 text-danger" />
              <p className="text-xs text-text-muted uppercase tracking-wider">Yo debo</p>
            </div>
            <p className="text-xl font-bold text-danger">{fmt(totalDeboYo)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon icon="tabler:arrow-down-left" className="w-3.5 h-3.5 text-success" />
              <p className="text-xs text-text-muted uppercase tracking-wider">Me deben</p>
            </div>
            <p className="text-xl font-bold text-success">{fmt(totalMeDeben)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon icon="tabler:scale" className={`w-3.5 h-3.5 ${netoGlobal >= 0 ? 'text-success' : 'text-danger'}`} />
              <p className="text-xs text-text-muted uppercase tracking-wider">Balance neto</p>
            </div>
            <p className={`text-xl font-bold ${netoGlobal >= 0 ? 'text-success' : 'text-danger'}`}>
              {netoGlobal > 0 ? '+' : ''}{fmt(netoGlobal)}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">{saldadas} saldadas</p>
          </div>
        </div>
      )}

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

      <div className="flex flex-col gap-3">
        {groups.map(([key, { personaId, name, deudas: groupDeudas }]) => (
          <PersonaGroupCard
            key={key}
            personaId={personaId}
            personaName={name}
            deudas={groupDeudas}
            filtroEstado={filtroEstado}
            clienteId={cid}
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

      {modal?.type === 'new' && (
        <Modal title="Nueva deuda" onClose={closeModal}>
          <DeudaFormPanel
            initial={newFormInitial(modal.prePersonaId)}
            personas={personas} categorias={categorias} cuentas={cuentas} tarjetas={tarjetas}
            onClose={closeModal} loading={create.isPending} error={modal.error}
            onSubmit={(d, cuotasPagadas) => create.mutate(toPayload(d, cuotasPagadas))} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar deuda" onClose={closeModal}>
          <DeudaFormPanel
            isEdit
            initial={(() => {
              const mOrig = parseFloat(String(modal.deuda.montoOriginal)) || 0
              const nC    = parseInt(String(modal.deuda.numeroCuotas ?? 0)) || 0
              const tasa  = parseFloat(String(modal.deuda.tasaInteres ?? 0)) || 0
              return {
                personaId: modal.deuda.personaId ?? '',
                concepto: modal.deuda.concepto ?? '',
                tipo: modal.deuda.tipo,
                direccion: modal.deuda.direccion ?? 'DEBO_YO',
                cuentaOrigenId: modal.deuda.cuentaOrigenId ?? '',
                tarjetaOrigenId: modal.deuda.tarjetaOrigenId ?? '',
                montoOriginal: String(modal.deuda.montoOriginal),
                saldoActual: String(modal.deuda.saldoActual),
                moneda: modal.deuda.moneda,
                fechaInicio: modal.deuda.fechaInicio.slice(0, 10),
                fechaFin: modal.deuda.fechaFin?.slice(0, 10) ?? '',
                tasaInteres: String(modal.deuda.tasaInteres ?? ''),
                montoCuota: mOrig > 0 && nC > 0 ? calcMontoCuota(mOrig, tasa, nC).toFixed(2) : '',
                tipoPlazo: modal.deuda.tipoPlazo,
                numeroCuotas: String(modal.deuda.numeroCuotas ?? ''),
                diaCobro: String(modal.deuda.diaCobro ?? ''),
                estado: modal.deuda.estado,
                notas: modal.deuda.notas ?? '',
                categoriaId: modal.deuda.categoriaId ?? '',
                subcategoriaId: modal.deuda.subcategoriaId ?? '',
              }
            })()}
            personas={personas} categorias={categorias} cuentas={cuentas} tarjetas={tarjetas}
            onClose={closeModal} loading={update.isPending} error={modal.error}
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
