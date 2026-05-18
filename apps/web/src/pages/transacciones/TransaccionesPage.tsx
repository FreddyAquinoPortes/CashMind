import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import type {
  Transaccion,
  TipoTransaccion,
  EstadoTransaccion,
  Categoria,
  CuentaBancaria,
  TarjetaCredito,
  Persona,
  Deuda,
  PaginatedResponse,
} from '../../lib/types'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@iconify/react'

// ── Constants ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 50

const TIPO_LABELS: Record<TipoTransaccion, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  TRANSFERENCIA: 'Transferencia',
  PAGO_DEUDA: 'Pago deuda',
  AJUSTE: 'Ajuste',
}

const TIPO_COLORS: Record<TipoTransaccion, string> = {
  GASTO: 'bg-red-500/15 text-red-400',
  INGRESO: 'bg-green-500/15 text-green-400',
  TRANSFERENCIA: 'bg-blue-500/15 text-blue-400',
  PAGO_DEUDA: 'bg-orange-500/15 text-orange-400',
  AJUSTE: 'bg-gray-500/15 text-gray-400',
}

const ESTADO_COLORS: Record<EstadoTransaccion, string> = {
  EJECUTADO: 'bg-green-500/10 text-green-400',
  PENDIENTE: 'bg-yellow-500/10 text-yellow-400',
  CANCELADO: 'bg-red-500/10 text-red-400',
  PROYECTADO: 'bg-blue-500/10 text-blue-400',
  PROGRAMADO: 'bg-purple-500/10 text-purple-400',
}

const TODAY = new Date().toISOString().slice(0, 10)

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatMonto(monto: number | string, tipo: TipoTransaccion): JSX.Element {
  const formatted = new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Math.abs(parseFloat(String(monto))))

  const isNeg = tipo === 'GASTO' || tipo === 'PAGO_DEUDA'
  const isPos = tipo === 'INGRESO'

  return (
    <span className={`tabular font-medium ${isNeg ? 'amount-negative' : isPos ? 'amount-positive' : 'text-text-secondary'}`}>
      {isNeg ? '-' : isPos ? '+' : ''}{formatted}
    </span>
  )
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

// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-surface border border-border rounded-xl w-full shadow-2xl mx-4 flex flex-col max-h-[90vh] ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        {/* Fixed header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none">&times;</button>
        </div>
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton rows ──────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-surface-elevated w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Transaction form ───────────────────────────────────────────────────────
interface TxFormState {
  fecha: string
  concepto: string
  monto: string
  tipo: TipoTransaccion
  estado: EstadoTransaccion
  cuentaId: string
  tarjetaId: string
  categoriaId: string
  subcategoriaId: string
  notas: string
  // PAGO_DEUDA extras (not sent to API as columns — handled server-side)
  personaId: string
  deudaIds: string[]   // multi-select: one or more debts to pay
}

const EMPTY_FORM: TxFormState = {
  fecha: TODAY,
  concepto: '',
  monto: '',
  tipo: 'GASTO',
  estado: 'EJECUTADO',
  cuentaId: '',
  tarjetaId: '',
  categoriaId: '',
  subcategoriaId: '',
  notas: '',
  personaId: '',
  deudaIds: [],
}

const fmtCOP = (n: string | number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 })
    .format(parseFloat(String(n)))

function TransaccionForm({
  initial,
  cuentas,
  tarjetas,
  categorias,
  personas,
  deudas,
  onSubmit,
  onClose,
  loading,
}: {
  initial?: Partial<TxFormState>
  cuentas: CuentaBancaria[]
  tarjetas: TarjetaCredito[]
  categorias: Categoria[]
  personas: Persona[]
  deudas: Deuda[]
  onSubmit: (d: TxFormState) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<TxFormState>({ ...EMPTY_FORM, ...initial })

  const set = (key: keyof TxFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  // Selecting a cuenta clears tarjeta and vice versa (mutually exclusive)
  const handleCuentaChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm(p => ({ ...p, cuentaId: e.target.value, tarjetaId: '' }))

  const handleTarjetaChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm(p => ({ ...p, tarjetaId: e.target.value, cuentaId: '' }))

  // When persona changes, clear deuda selection
  const handlePersonaChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm(p => ({ ...p, personaId: e.target.value, deudaIds: [], monto: '' }))

  // Toggle a debt in/out of the selected set; auto-update monto and concepto
  const handleDeudaToggle = (deudaId: string) => {
    const persona = personas.find(p => p.id === form.personaId)
    setForm(prev => {
      const already = prev.deudaIds.includes(deudaId)
      const newIds = already
        ? prev.deudaIds.filter(id => id !== deudaId)
        : [...prev.deudaIds, deudaId]

      // Sum saldos of all selected debts
      const totalSaldo = deudas
        .filter(d => newIds.includes(d.id))
        .reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)

      return {
        ...prev,
        deudaIds: newIds,
        monto: newIds.length > 0 ? totalSaldo.toFixed(2) : '',
        concepto: newIds.length > 0 && persona
          ? `Pago deuda — ${persona.displayName}`
          : prev.concepto,
      }
    })
  }

  const selectedCat = categorias.find(c => c.id === form.categoriaId)
  const subcats = selectedCat?.subcategorias ?? []

  const handleCatChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm(p => ({ ...p, categoriaId: e.target.value, subcategoriaId: '' }))

  const isPagoDeuda = form.tipo === 'PAGO_DEUDA'

  // Deudas filtradas por persona seleccionada (solo activas)
  const deudasPersona = deudas.filter(
    d => d.personaId === form.personaId && d.estado === 'ACTIVA'
  )

  // Distribution preview: simulate smallest-first payment
  const distributionPreview = (() => {
    if (!isPagoDeuda || form.deudaIds.length === 0) return []
    const monto = parseFloat(form.monto) || 0
    const selected = deudas
      .filter(d => form.deudaIds.includes(d.id))
      .sort((a, b) => parseFloat(String(a.saldoActual)) - parseFloat(String(b.saldoActual)))
    let remaining = monto
    return selected.map(d => {
      const saldo = parseFloat(String(d.saldoActual))
      const payment = Math.min(remaining, saldo)
      remaining = Math.max(0, Math.round((remaining - payment) * 100) / 100)
      return { deuda: d, payment, saldoRest: Math.max(0, saldo - payment) }
    })
  })()

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Fecha */}
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha *
          <input type="date" required value={form.fecha} onChange={set('fecha')} className="input" />
        </label>

        {/* Tipo */}
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo *
          <select value={form.tipo} onChange={set('tipo')} className="input">
            {(Object.keys(TIPO_LABELS) as TipoTransaccion[]).map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── PAGO_DEUDA: persona + multi-deuda selectors ── */}
      {isPagoDeuda && (
        <div className="flex flex-col gap-3 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 uppercase tracking-wider">
            <span>💳</span> Vinculación de deuda
          </div>

          {/* Persona */}
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Persona / Entidad acreedora *
            <select
              required={isPagoDeuda}
              value={form.personaId}
              onChange={handlePersonaChange}
              className="input"
            >
              <option value="">— Seleccionar persona —</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </label>

          {/* Multi-deuda checkboxes — appears only when persona is selected */}
          {form.personaId && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-text-secondary">
                Deudas a pagar{' '}
                <span className="text-xs text-text-muted">(selecciona una o más)</span>
              </p>
              {deudasPersona.length === 0 && (
                <p className="text-xs text-text-muted italic">Sin deudas activas con esta persona</p>
              )}
              {deudasPersona.map(d => {
                const checked = form.deudaIds.includes(d.id)
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors
                      ${checked
                        ? 'border-orange-500/50 bg-orange-500/10'
                        : 'border-border/60 hover:border-orange-500/30'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleDeudaToggle(d.id)}
                      className="accent-orange-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {d.concepto ?? d.tipo}
                      </p>
                      <p className="text-xs text-text-muted">
                        {d.tipo}{d.numeroCuotas ? ` · ${d.numeroCuotas} cuotas` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-danger tabular-nums flex-shrink-0">
                      {fmtCOP(d.saldoActual)}
                    </span>
                  </label>
                )
              })}

              {/* Payment distribution preview */}
              {distributionPreview.length > 0 && (
                <div className="mt-1 rounded-lg bg-background/60 border border-border/60 overflow-hidden">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-2 border-b border-border/60">
                    Distribución del pago (menor saldo primero)
                  </p>
                  {distributionPreview.map(({ deuda, payment, saldoRest }) => (
                    <div key={deuda.id} className="flex items-center justify-between px-3 py-2 text-xs border-b border-border/40 last:border-0">
                      <span className="text-text-secondary truncate max-w-[160px]">
                        {deuda.concepto ?? deuda.tipo}
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-success">−{fmtCOP(payment)}</span>
                        <span className={`${saldoRest <= 0 ? 'text-success font-semibold' : 'text-text-muted'}`}>
                          {saldoRest <= 0 ? '✓ Saldada' : `Resta: ${fmtCOP(saldoRest)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const totalSaldo = distributionPreview.reduce((s, r) => s + parseFloat(String(r.deuda.saldoActual)), 0)
                    const totalPago = parseFloat(form.monto) || 0
                    if (totalPago < totalSaldo) {
                      return (
                        <div className="px-3 py-2 bg-amber-500/10 text-xs text-amber-400">
                          ⚠ Pago parcial: {fmtCOP(Math.max(0, totalSaldo - totalPago))} restante sin cubrir
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Concepto */}
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Concepto *
        <input required value={form.concepto} onChange={set('concepto')} className="input"
          placeholder="Ej. Supermercado Nacional" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        {/* Monto */}
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Monto *
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={form.monto}
            onChange={set('monto')}
            className="input"
            placeholder="0.00"
          />
          {isPagoDeuda && form.deudaIds.length > 0 && (
            <span className="text-xs text-text-muted">
              Saldo total seleccionado: {fmtCOP(
                deudas.filter(d => form.deudaIds.includes(d.id))
                  .reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0)
              )}
            </span>
          )}
        </label>

        {/* Estado */}
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Estado *
          <select value={form.estado} onChange={set('estado')} className="input">
            <option value="EJECUTADO">Ejecutado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PROYECTADO">Proyectado</option>
          </select>
        </label>
      </div>

      {/* Cuenta / Tarjeta — mutually exclusive */}
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        <span className="font-medium">Origen del movimiento</span>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Cuenta bancaria</span>
            <select
              value={form.cuentaId}
              onChange={handleCuentaChange}
              className={`input ${form.cuentaId ? 'border-primary/50' : ''}`}
            >
              <option value="">— Sin cuenta —</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.alias ?? c.banco}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Tarjeta de crédito</span>
            <select
              value={form.tarjetaId}
              onChange={handleTarjetaChange}
              className={`input ${form.tarjetaId ? 'border-primary/50' : ''}`}
            >
              <option value="">— Sin tarjeta —</option>
              {tarjetas.filter(t => t.activa).map(t => (
                <option key={t.id} value={t.id}>
                  {t.alias ?? t.banco} ···{t.ultimosCuatro}
                </option>
              ))}
            </select>
          </label>
        </div>
        {form.cuentaId && form.tarjetaId === '' && (
          <p className="text-xs text-text-muted">Selecciona tarjeta para limpiar la cuenta, o viceversa.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Categoría */}
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Categoría
          <select value={form.categoriaId} onChange={handleCatChange} className="input">
            <option value="">— Sin categoría —</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
            ))}
          </select>
        </label>

        {/* Subcategoría inline when available */}
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

      {/* Notas */}
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <textarea value={form.notas} onChange={set('notas')} className="input resize-none" rows={2}
          placeholder="Observaciones opcionales…" />
      </label>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── Filter state ───────────────────────────────────────────────────────────
interface Filters {
  search: string
  desde: string
  hasta: string
  tipo: TipoTransaccion | ''
  cuentaId: string
  categoriaId: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  desde: '',
  hasta: '',
  tipo: '',
  cuentaId: '',
  categoriaId: '',
}

// ── Main page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new' }
  | { type: 'edit'; tx: Transaccion }
  | { type: 'delete'; tx: Transaccion }
  | null

export function TransaccionesPage() {
  const qc = useQueryClient()
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Queries
  const { data: deletables = [] } = useQuery<string[]>({
    queryKey: ['transacciones-deletables', cid],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${cid}/transacciones/deletables`)
      return data.data.ids as string[]
    },
    enabled: !!cid,
    staleTime: 0,  // always fresh after mutations
  })

  const { data: txData, isLoading: txLoading } = useQuery<PaginatedResponse<Transaccion>>({
    queryKey: ['transacciones', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))
      if (filters.search) params.set('q', filters.search)
      if (filters.desde) params.set('desde', filters.desde)
      if (filters.hasta) params.set('hasta', filters.hasta)
      if (filters.tipo) params.set('tipo', filters.tipo)
      if (filters.cuentaId) params.set('cuentaId', filters.cuentaId)
      if (filters.categoriaId) params.set('categoriaId', filters.categoriaId)
      const { data } = await api.get(`/clientes/${cid}/transacciones?${params.toString()}`)
      return data.data
    },
    enabled: !!cid,
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

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias')).data.data,
  })

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ['personas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
    enabled: !!cid,
  })

  const { data: deudas = [] } = useQuery<Deuda[]>({
    queryKey: ['deudas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/deudas`)).data.data,
    enabled: !!cid,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transacciones'] })
    qc.invalidateQueries({ queryKey: ['transacciones-deletables'] })
    qc.invalidateQueries({ queryKey: ['deudas'] })
    qc.invalidateQueries({ queryKey: ['cuentas'] })
  }

  // Build API payload from form — extract PAGO_DEUDA fields separately
  const buildPayload = (f: TxFormState) => {
    const { personaId, deudaIds, ...rest } = f
    return {
      ...rest,
      monto: parseFloat(f.monto),
      fecha: f.fecha ? new Date(f.fecha + 'T00:00:00').toISOString() : new Date().toISOString(),
      cuentaId:       f.cuentaId       || null,
      tarjetaId:      f.tarjetaId      || null,
      categoriaId:    f.categoriaId    || null,
      subcategoriaId: f.subcategoriaId || null,
      frecuencia: 'UNICA',
      // Send deudaIds array when tipo=PAGO_DEUDA
      ...(f.tipo === 'PAGO_DEUDA' && deudaIds.length > 0 ? { deudaIds } : {}),
    }
  }

  const createTx = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/transacciones`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Transacción creada') },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error al crear la transacción'
      showToast(msg, 'error')
    },
  })

  const updateTx = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/transacciones/${id}`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Transacción actualizada') },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error al actualizar la transacción'
      showToast(msg, 'error')
    },
  })

  const deleteTx = useMutation({
    mutationFn: (id: string) => api.delete(`/transacciones/${id}`),
    onSuccess: () => { invalidate(); setModal(null); showToast('Transacción eliminada') },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error al eliminar la transacción'
      showToast(msg, 'error')
    },
  })

  const transactions = txData?.items ?? []
  const total = txData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Summary cards computed from current page
  const summary = useMemo(() => {
    const ingresos = transactions
      .filter(t => t.tipo === 'INGRESO')
      .reduce((s, t) => s + parseFloat(String(t.monto)), 0)
    const gastos = transactions
      .filter(t => t.tipo === 'GASTO')
      .reduce((s, t) => s + parseFloat(String(t.monto)), 0)
    return { ingresos, gastos, balance: ingresos - gastos }
  }, [transactions])

  const setFilter = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPage(0)
    setFilters(p => ({ ...p, [key]: e.target.value }))
  }

  const clearFilters = () => {
    setPage(0)
    setFilters(EMPTY_FILTERS)
  }

  const hasFilters = Object.values(filters).some(v => v !== '')

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n)

  const fromItem = total === 0 ? 0 : page * PAGE_SIZE + 1
  const toItem = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-5">
      {toast && <Toast {...toast} />}
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Transacciones</h1>
          <p className="text-text-muted text-sm mt-0.5">Registro completo de movimientos financieros</p>
        </div>
        <button
          onClick={() => setModal({ type: 'new' })}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva transacción
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <FunnelIcon className="w-4 h-4" />
          <span className="font-medium">Filtros</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-text-muted hover:text-text-primary underline transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <input
              value={filters.search}
              onChange={setFilter('search')}
              placeholder="Buscar por concepto…"
              className="input"
            />
          </div>

          {/* Desde */}
          <div>
            <input
              type="date"
              value={filters.desde}
              onChange={setFilter('desde')}
              className="input"
              title="Desde"
            />
          </div>

          {/* Hasta */}
          <div>
            <input
              type="date"
              value={filters.hasta}
              onChange={setFilter('hasta')}
              className="input"
              title="Hasta"
            />
          </div>

          {/* Tipo */}
          <div>
            <select value={filters.tipo} onChange={setFilter('tipo')} className="input">
              <option value="">Todos los tipos</option>
              {(Object.keys(TIPO_LABELS) as TipoTransaccion[]).map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Cuenta */}
          <div>
            <select value={filters.cuentaId} onChange={setFilter('cuentaId')} className="input">
              <option value="">Todas las cuentas</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.alias ?? c.banco}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Categoría filter on second row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <select value={filters.categoriaId} onChange={setFilter('categoriaId')} className="input">
              <option value="">Todas las categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Ingresos (página)</p>
          <p className="text-lg font-semibold amount-positive tabular">{formatCurrency(summary.ingresos)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Gastos (página)</p>
          <p className="text-lg font-semibold amount-negative tabular">{formatCurrency(summary.gastos)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Balance neto</p>
          <p className={`text-lg font-semibold tabular ${summary.balance >= 0 ? 'amount-positive' : 'amount-negative'}`}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-zebra">
            <thead>
              <tr className="border-b border-border bg-background/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Concepto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Cuenta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {txLoading && <SkeletonRows />}

              {!txLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-text-muted text-sm">
                    No hay transacciones para los filtros seleccionados
                  </td>
                </tr>
              )}

              {!txLoading && transactions.map(tx => (
                <tr key={tx.id} className="border-b border-border/30 hover:bg-surface-elevated transition-colors">
                  {/* Fecha */}
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{formatDate(tx.fecha)}</td>

                  {/* Concepto */}
                  <td className="px-4 py-3">
                    <span className="text-text-primary font-medium">{tx.concepto}</span>
                    {tx.notas && (
                      <p className="text-xs text-text-muted mt-0.5 truncate max-w-[200px]">{tx.notas}</p>
                    )}
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-3">
                    {tx.categoria ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tx.categoria.color ?? '#94a3b8' }}
                        />
                        <span className="text-text-secondary text-xs flex items-center gap-1">
                          {tx.categoria.icono && (
                            <Icon
                              icon={tx.categoria.icono.includes(':') ? tx.categoria.icono : `tabler:${tx.categoria.icono}`}
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: tx.categoria.color ?? '#94a3b8' }}
                            />
                          )}
                          {tx.categoria.nombre}
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>

                  {/* Cuenta */}
                  <td className="px-4 py-3">
                    {tx.cuentaBancaria ? (
                      <span className="text-text-secondary text-xs">
                        {tx.cuentaBancaria.alias ?? tx.cuentaBancaria.banco}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>

                  {/* Monto */}
                  <td className="px-4 py-3 text-right">
                    {formatMonto(tx.monto, tx.tipo)}
                  </td>

                  {/* Tipo badge */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[tx.tipo]}`}>
                      {TIPO_LABELS[tx.tipo]}
                    </span>
                  </td>

                  {/* Estado badge */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[tx.estado]}`}>
                      {tx.estado.charAt(0) + tx.estado.slice(1).toLowerCase()}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ type: 'edit', tx })}
                        className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      {deletables.includes(tx.id) ? (
                        <button
                          onClick={() => setModal({ type: 'delete', tx })}
                          className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Eliminar (revierte saldo)"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          className="p-1.5 rounded text-text-muted/30 cursor-not-allowed"
                          title="Solo puedes eliminar las 5 transacciones más recientes"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/30">
            <span className="text-xs text-text-muted">
              Mostrando {fromItem}–{toItem} de {total} transacciones
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="btn-ghost px-2 py-1.5 flex items-center gap-1 text-xs disabled:opacity-40"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-xs text-text-muted px-1">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="btn-ghost px-2 py-1.5 flex items-center gap-1 text-xs disabled:opacity-40"
              >
                Siguiente
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Nueva transacción modal ── */}
      {modal?.type === 'new' && (
        <Modal title="Nueva transacción" onClose={() => setModal(null)} wide>
          <TransaccionForm
            cuentas={cuentas}
            tarjetas={tarjetas}
            categorias={categorias}
            personas={personas}
            deudas={deudas}
            onClose={() => setModal(null)}
            loading={createTx.isPending}
            onSubmit={d => createTx.mutate(buildPayload(d))}
          />
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {modal?.type === 'edit' && (
        <Modal title="Editar transacción" onClose={() => setModal(null)} wide>
          <TransaccionForm
            initial={{
              fecha: modal.tx.fecha.slice(0, 10),
              concepto: modal.tx.concepto,
              monto: String(modal.tx.monto),
              tipo: modal.tx.tipo,
              estado: modal.tx.estado,
              cuentaId: modal.tx.cuentaId ?? '',
              tarjetaId: modal.tx.tarjetaId ?? '',
              categoriaId: modal.tx.categoriaId ?? '',
              subcategoriaId: modal.tx.subcategoriaId ?? '',
              notas: modal.tx.notas ?? '',
              personaId: '',
              deudaIds: [],
            }}
            cuentas={cuentas}
            tarjetas={tarjetas}
            categorias={categorias}
            personas={personas}
            deudas={deudas}
            onClose={() => setModal(null)}
            loading={updateTx.isPending}
            onSubmit={d => updateTx.mutate({ id: modal.tx.id, d: buildPayload(d) })}
          />
        </Modal>
      )}

      {/* ── Delete confirmation modal ── */}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar transacción" onClose={() => setModal(null)}>
          <p className="text-text-secondary text-sm mb-2">
            ¿Seguro que quieres eliminar{' '}
            <strong className="text-text-primary">{modal.tx.concepto}</strong>?
          </p>
          {modal.tx.cuentaId && (modal.tx.tipo === 'GASTO' || modal.tx.tipo === 'INGRESO') && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-3">
              <span className="text-amber-400 text-base leading-none mt-0.5">↩</span>
              <p className="text-xs text-amber-300">
                El saldo de la cuenta asociada será revertido:
                {' '}<strong>{modal.tx.tipo === 'GASTO' ? `+${parseFloat(String(modal.tx.monto)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : `-${parseFloat(String(modal.tx.monto)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`}</strong>{' '}
                DOP.
              </p>
            </div>
          )}
          <p className="text-text-muted text-xs mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button
              className="btn-danger"
              disabled={deleteTx.isPending}
              onClick={() => deleteTx.mutate(modal.tx.id)}
            >
              {deleteTx.isPending ? 'Eliminando…' : 'Sí, eliminar y revertir'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}