import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useFmt } from '../../lib/useFmt'
import type { TarjetaCredito, Franquicia, TipoTarjeta, CategoriaTarjeta, ExtraCredito } from '../../lib/types'
import { BANCOS_RD, FRANQUICIAS, TIPOS_TARJETA, CATEGORIAS_TARJETA, MONEDAS } from '../../lib/constants'
import { PlusIcon, CreditCardIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

const FRANQ_COLORS: Record<string, string> = {
  VISA: '#1a1f71', MASTERCARD: '#eb001b', AMEX: '#007bc1', DISCOVER: '#ff6600',
}


function calcMontoCuota(monto: number, tasaInteres: number, numeroCuotas: number): number {
  if (!monto || !numeroCuotas) return 0
  if (tasaInteres === 0) return monto / numeroCuotas
  const r = (tasaInteres / 100) / 12
  return (monto * r) / (1 - Math.pow(1 + r, -numeroCuotas))
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

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
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

// ── Form ───────────────────────────────────────────────────────────────────
interface TarjetaForm {
  alias: string; banco: string; ultimosCuatro: string
  franquicia: Franquicia | ''; tipoTarjeta: TipoTarjeta | ''; categoriaTarjeta: CategoriaTarjeta | ''
  limite: string; saldoActual: string; tasaInteres: string
  diaCorte: string; diaPago: string; moneda: string; activa: boolean
  // Doble balance
  dobleBalance: boolean
  monedaSecundaria: string
  limiteSecundario: string
  saldoSecundario: string
}

const EMPTY: TarjetaForm = {
  alias: '', banco: '', ultimosCuatro: '', franquicia: '', tipoTarjeta: 'CREDITO', categoriaTarjeta: '',
  limite: '0', saldoActual: '0', tasaInteres: '0', diaCorte: '1', diaPago: '15', moneda: 'DOP', activa: true,
  dobleBalance: false, monedaSecundaria: 'USD', limiteSecundario: '0', saldoSecundario: '0',
}

function TarjetaFormPanel({
  initial, onSubmit, onClose, loading, error,
}: {
  initial?: TarjetaForm; onSubmit(d: TarjetaForm): void
  onClose(): void; loading: boolean; error?: string | null
}) {
  const [form, setForm] = useState<TarjetaForm>(initial ?? EMPTY)
  const set = (k: keyof TarjetaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre / Alias *
        <input required value={form.alias} onChange={set('alias')} className="input" placeholder="Ej. Visa Oro Popular" autoFocus />
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Banco *
        <select required value={form.banco} onChange={set('banco')} className="input">
          <option value="">— Seleccionar banco —</option>
          {BANCOS_RD.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Últimos 4 dígitos *
        <input required maxLength={4} pattern="\d{4}" value={form.ultimosCuatro} onChange={set('ultimosCuatro')}
          className="input" placeholder="1234" />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Franquicia
          <select value={form.franquicia} onChange={set('franquicia')} className="input">
            <option value="">—</option>
            {FRANQUICIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo
          <select value={form.tipoTarjeta} onChange={set('tipoTarjeta')} className="input">
            <option value="">—</option>
            {TIPOS_TARJETA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Categoría
          <select value={form.categoriaTarjeta} onChange={set('categoriaTarjeta')} className="input">
            <option value="">—</option>
            {CATEGORIAS_TARJETA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {/* Balance principal */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Moneda
          <select value={form.moneda} onChange={set('moneda')} className="input">
            {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Límite de crédito
          <input type="number" step="0.01" min="0" value={form.limite} onChange={set('limite')} className="input" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Saldo actual
        <input type="number" step="0.01" value={form.saldoActual} onChange={set('saldoActual')} className="input" />
        <span className="text-xs text-text-muted">Puede ser negativo por sobregiro, intereses o extracreditado no pagado</span>
      </label>

      {/* Toggle doble balance */}
      <div className="flex items-center justify-between py-2 border-t border-border">
        <div>
          <p className="text-sm font-medium text-text-primary">Doble balance (multi-moneda)</p>
          <p className="text-xs text-text-muted">Activa si la tarjeta maneja dos monedas con límites independientes</p>
        </div>
        <button type="button" onClick={() => setForm(p => ({ ...p, dobleBalance: !p.dobleBalance }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
            ${form.dobleBalance ? 'bg-primary' : 'bg-border'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${form.dobleBalance ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Balance secundario */}
      {form.dobleBalance && (
        <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Balance secundario</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Moneda secundaria
              <select value={form.monedaSecundaria} onChange={set('monedaSecundaria')} className="input">
                {MONEDAS.filter(m => m.value !== form.moneda).map(m =>
                  <option key={m.value} value={m.value}>{m.label}</option>
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Límite secundario
              <input type="number" step="0.01" min="0" value={form.limiteSecundario} onChange={set('limiteSecundario')} className="input" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Saldo secundario actual
            <input type="number" step="0.01" value={form.saldoSecundario} onChange={set('saldoSecundario')} className="input" />
            <span className="text-xs text-text-muted">Puede ser negativo por sobregiro o intereses</span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tasa interés %
          <input type="number" step="0.01" min="0" max="100" value={form.tasaInteres} onChange={set('tasaInteres')} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Día de corte
          <input type="number" min="1" max="31" value={form.diaCorte} onChange={set('diaCorte')} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Día de pago
          <input type="number" min="1" max="31" value={form.diaPago} onChange={set('diaPago')} className="input" />
        </label>
      </div>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────
function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
  return (
    <div className="w-full bg-border rounded-full h-1.5 mt-2">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

// ── ExtraCredito progress bar ──────────────────────────────────────────────
function CuotasBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-border rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ── Nuevo ExtraCredito Modal ───────────────────────────────────────────────
interface ExtraCreditoForm {
  descripcion: string
  montoOriginal: string
  tasaInteres: string
  montoCuota: string
  numeroCuotas: string
  fechaInicio: string
  diaPago: string
  moneda: string
  categoriaId: string
  subcategoriaId: string
}

function NuevoExtraCreditoModal({
  tarjeta, onClose, onSuccess,
}: {
  tarjeta: TarjetaCredito
  onClose: () => void
  onSuccess: () => void
}) {
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/categorias`)).data.data,
    enabled: !!cid,
  })

  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<ExtraCreditoForm>({
    descripcion: '',
    montoOriginal: '',
    tasaInteres: '0',
    montoCuota: '',
    numeroCuotas: '12',
    fechaInicio: hoy,
    diaPago: String(tarjeta.diaPago),
    moneda: tarjeta.moneda,
    categoriaId: '',
    subcategoriaId: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cuotaError, setCuotaError] = useState('')

  const set = (k: keyof ExtraCreditoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const monto = parseFloat(form.montoOriginal) || 0
  const tasa = parseFloat(form.tasaInteres) || 0
  const cuotas = parseInt(form.numeroCuotas) || 1

  const toStr = (v: number) => v > 0 ? v.toFixed(2) : ''

  const handleTasaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTasa = e.target.value
    const cuota = toStr(calcMontoCuota(monto, parseFloat(newTasa) || 0, cuotas))
    setCuotaError('')
    setForm(p => ({ ...p, tasaInteres: newTasa, montoCuota: cuota }))
  }

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const m = parseFloat(val) || 0
    const cuota = toStr(calcMontoCuota(m, tasa, cuotas))
    setForm(p => ({ ...p, montoOriginal: val, montoCuota: cuota }))
  }

  const handleCuotasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const n = parseInt(val) || 1
    const cuota = toStr(calcMontoCuota(monto, tasa, n))
    setForm(p => ({ ...p, numeroCuotas: val, montoCuota: cuota }))
  }

  const handleMontoCuotaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const c = parseFloat(val) || 0
    let newTasa = form.tasaInteres
    let err = ''
    if (c > 0 && monto > 0 && cuotas > 0) {
      const minC = monto / cuotas
      if (c < minC - 0.001) {
        err = `Cuota mínima sin interés: ${minC.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — un valor menor implica tasa negativa`
      } else {
        const anual = calcTasaAnualDesdeMontos(monto, c, cuotas)
        if (anual !== null) newTasa = anual.toFixed(2)
      }
    }
    setCuotaError(err)
    setForm(p => ({ ...p, montoCuota: val, tasaInteres: newTasa }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cuotaError) return
    setError(null)
    setLoading(true)
    try {
      await api.post(`/tarjetas/${tarjeta.id}/extracredito`, {
        descripcion: form.descripcion || null,
        montoOriginal: monto,
        tasaInteres: tasa,
        numeroCuotas: cuotas,
        fechaInicio: form.fechaInicio,
        diaPago: parseInt(form.diaPago),
        moneda: form.moneda,
        categoriaId: form.categoriaId || null,
        subcategoriaId: form.subcategoriaId || null,
      })
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Error al crear ExtraCredito')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Nuevo ExtraCredito" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Descripción (opcional)
          <input value={form.descripcion} onChange={set('descripcion')} className="input" placeholder="Ej. Compra electrodoméstico" autoFocus />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Moneda
            <select value={form.moneda} onChange={set('moneda')} className="input">
              {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Monto *
            <input required type="number" step="0.01" min="0.01" max={String(tarjeta.limite)}
              value={form.montoOriginal} onChange={handleMontoChange} className="input" placeholder="0.00" />
            <span className="text-xs text-text-muted">Máx: {parseFloat(String(tarjeta.limite)).toLocaleString()}</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Tasa de interés % anual
            <input type="number" step="0.01" min="0" max="200" value={form.tasaInteres} onChange={handleTasaChange} className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Número de cuotas
            <input
              required type="number" min="1" max="360" step="1"
              value={form.numeroCuotas} onChange={handleCuotasChange}
              className="input" placeholder="Ej. 12"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Categoría
            <select value={form.categoriaId} onChange={set('categoriaId')} className="input"
              onClick={() => setForm(p => ({ ...p, subcategoriaId: '' }))}>
              <option value="">— Sin categoría —</option>
              {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Subcategoría
            <select value={form.subcategoriaId} onChange={set('subcategoriaId')} className="input"
              disabled={!form.categoriaId}>
              <option value="">— Sin subcategoría —</option>
              {(categorias.find((c: any) => c.id === form.categoriaId)?.subcategorias ?? [])
                .map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Fecha de inicio
            <input type="date" value={form.fechaInicio} onChange={set('fechaInicio')} className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Día de pago
            <input type="number" min="1" max="31" value={form.diaPago} onChange={set('diaPago')} className="input" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          <span className="flex items-center gap-2">
            Monto por cuota
            <span className="text-xs text-primary font-normal">
              {form.tasaInteres && parseFloat(form.tasaInteres) > 0 ? '(calculado desde tasa)' : '(ingresa para derivar la tasa)'}
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
          {!cuotaError && form.montoCuota && (
            <span className="text-xs text-text-muted mt-0.5">
              Total: {form.moneda} {(parseFloat(form.montoCuota) * cuotas).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </label>

        <div className="flex gap-2 justify-end mt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading || !!cuotaError} className="btn-primary">{loading ? 'Creando…' : 'Crear ExtraCredito'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Registrar Pago Modal ───────────────────────────────────────────────────
function RegistrarPagoModal({
  ec, onClose, onSuccess,
}: {
  ec: ExtraCredito
  onClose: () => void
  onSuccess: () => void
}) {
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/cuentas`)).data.data,
    enabled: !!cid,
  })

  const hoy = new Date().toISOString().slice(0, 10)
  const [monto, setMonto] = useState(parseFloat(String(ec.montoCuota)).toFixed(2))
  const [fecha, setFecha] = useState(hoy)
  const [notas, setNotas] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post(`/extracredito/${ec.id}/pago`, {
        monto: parseFloat(monto),
        fecha,
        notas: notas || null,
        cuentaId: cuentaId || null,
      })
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Error al registrar pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Registrar pago ExtraCredito" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

        <div className="bg-surface border border-border rounded-lg px-4 py-3 text-sm">
          <p className="text-text-muted text-xs">ExtraCredito</p>
          <p className="font-medium text-text-primary">{ec.descripcion ?? `EC-${ec.id.slice(-6)}`}</p>
          <p className="text-text-muted text-xs mt-1">
            Saldo pendiente: {ec.moneda} {parseFloat(String(ec.saldoPendiente)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Account selector */}
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Cuenta para el pago *
          <select
            value={cuentaId}
            onChange={e => setCuentaId(e.target.value)}
            className="input"
            required
          >
            <option value="">— Seleccionar cuenta —</option>
            {cuentas.filter((c: any) => c.activa).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.alias ?? c.banco} — {c.moneda} {parseFloat(String(c.saldo)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </option>
            ))}
          </select>
          {/* Balance warning */}
          {(() => {
            const sel = cuentas.find((c: any) => c.id === cuentaId)
            if (!sel) return null
            const saldo = parseFloat(String(sel.saldo))
            const montoNum = parseFloat(monto) || 0
            if (saldo < montoNum) {
              return <span className="text-xs text-danger">⚠ Saldo insuficiente: {sel.moneda} {saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            }
            return <span className="text-xs text-success">Disponible: {sel.moneda} {saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          })()}
        </div>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Monto a pagar *
          <input required type="number" step="0.01" min="0.01"
            value={monto} onChange={e => setMonto(e.target.value)} className="input" autoFocus />
          <span className="text-xs text-text-muted">Cuota sugerida: {ec.moneda} {parseFloat(String(ec.montoCuota)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input" />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Notas (opcional)
          <input value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Ej. Pago parcial" />
        </label>

        <div className="flex gap-2 justify-end mt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Registrando…' : 'Registrar pago'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── ExtraCredito section in card ───────────────────────────────────────────
function ExtraCreditoSection({ tarjeta, onRefresh }: { tarjeta: TarjetaCredito; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showNuevoModal, setShowNuevoModal] = useState(false)
  const [pagoEc, setPagoEc] = useState<ExtraCredito | null>(null)

  const extraCreditos = tarjeta.extraCreditos ?? []
  const activos = extraCreditos.filter(ec => ec.estado === 'ACTIVO' || ec.estado === 'EN_MORA')

  const handleDelete = async (ecId: string) => {
    if (!confirm('¿Eliminar este ExtraCredito?')) return
    try {
      await api.delete(`/extracredito/${ecId}`)
      onRefresh()
    } catch {
      // silently ignore
    }
  }

  return (
    <>
      {showNuevoModal && (
        <NuevoExtraCreditoModal
          tarjeta={tarjeta}
          onClose={() => setShowNuevoModal(false)}
          onSuccess={() => { setShowNuevoModal(false); onRefresh() }}
        />
      )}
      {pagoEc && (
        <RegistrarPagoModal
          ec={pagoEc}
          onClose={() => setPagoEc(null)}
          onSuccess={() => { setPagoEc(null); onRefresh() }}
        />
      )}

      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(p => !p)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-primary transition-colors flex-1"
          >
            {expanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            <span>ExtraCreditos</span>
            {activos.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{activos.length} activo{activos.length !== 1 ? 's' : ''}</span>
            )}
          </button>
          {!expanded && (
            <button
              onClick={() => setShowNuevoModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/25
                transition-colors"
            >
              <PlusIcon className="w-3 h-3" /> Nuevo
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-2 flex flex-col gap-2">
            {extraCreditos.length === 0 && (
              <p className="text-xs text-text-muted py-2">No hay ExtraCreditos registrados</p>
            )}
            {extraCreditos.map(ec => (
              <div key={ec.id} className="bg-background/60 border border-border/60 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {ec.descripcion ?? `EC-${ec.id.slice(-6)}`}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        ec.estado === 'ACTIVO' ? 'bg-success/10 text-success' :
                        ec.estado === 'PAGADO' ? 'bg-primary/10 text-primary' :
                        ec.estado === 'EN_MORA' ? 'bg-danger/10 text-danger' :
                        'bg-border text-text-muted'
                      }`}>{ec.estado}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {ec.moneda} {parseFloat(String(ec.montoOriginal)).toLocaleString('es-DO', { minimumFractionDigits: 2 })} ·
                      Cuota: {parseFloat(String(ec.montoCuota)).toLocaleString('es-DO', { minimumFractionDigits: 2 })} ·
                      Próx. pago: {ec.proximoPago}
                    </div>
                    <CuotasBar pct={ec.progreso} />
                    <div className="flex items-center justify-between text-xs text-text-muted mt-0.5">
                      <span>{ec.cuotasPagadas}/{ec.numeroCuotas} cuotas pagadas ({ec.progreso}%)</span>
                      <span>Saldo: {ec.moneda} {parseFloat(String(ec.saldoPendiente)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {ec.estado !== 'PAGADO' && ec.estado !== 'CANCELADO' && (
                      <button
                        onClick={() => setPagoEc(ec)}
                        className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Pagar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(ec.id)}
                      className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >🗑</button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowNuevoModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/25
                transition-colors self-start"
            >
              <PlusIcon className="w-3 h-3" /> Nuevo ExtraCredito
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new'; error?: string }
  | { type: 'edit'; tarjeta: TarjetaCredito; error?: string }
  | { type: 'delete'; tarjeta: TarjetaCredito }
  | null

export function TarjetasPage() {
  const fmt = useFmt()
  const qc = useQueryClient()
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const { data: tarjetas = [], isLoading } = useQuery<TarjetaCredito[]>({
    queryKey: ['tarjetas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/tarjetas`)).data.data,
    enabled: !!cid,
  })

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const closeModal = () => setModal(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tarjetas', cid] })

  const toPayload = (d: TarjetaForm) => ({
    ...d,
    franquicia: d.franquicia || null,
    tipoTarjeta: d.tipoTarjeta || null,
    categoriaTarjeta: d.categoriaTarjeta || null,
    limite: parseFloat(d.limite),
    saldoActual: parseFloat(d.saldoActual),
    tasaInteres: parseFloat(d.tasaInteres),
    diaCorte: parseInt(d.diaCorte),
    diaPago: parseInt(d.diaPago),
    dobleBalance: d.dobleBalance,
    monedaSecundaria: d.dobleBalance ? d.monedaSecundaria : null,
    limiteSecundario: d.dobleBalance ? parseFloat(d.limiteSecundario) : null,
    saldoSecundario:  d.dobleBalance ? parseFloat(d.saldoSecundario)  : null,
  })

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/tarjetas`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta creada') },
    onError: (e: Error) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error') },
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/tarjetas/${id}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta actualizada') },
    onError: (e: Error) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error') },
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/tarjetas/${id}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta eliminada') },
    onError: (e: Error) => { showToast(e.message, 'error') },
  })

  const totalDeuda = tarjetas.reduce((s, t) => s + parseFloat(String(t.saldoActual)), 0)
  const totalLimite = tarjetas.reduce((s, t) => s + parseFloat(String(t.limite)), 0)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast {...toast} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tarjetas</h1>
          <p className="text-text-muted text-sm mt-0.5">Tus tarjetas de crédito y débito</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nueva tarjeta
        </button>
      </div>

      {tarjetas.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Deuda total</p>
            <p className="text-xl font-bold text-danger">{fmt(totalDeuda)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Límite total</p>
            <p className="text-xl font-bold text-text-primary">{fmt(totalLimite)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Disponible</p>
            <p className="text-xl font-bold text-success">{fmt(Math.max(0, totalLimite - totalDeuda))}</p>
          </div>
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center h-32 text-text-muted text-sm">Cargando…</div>}

      <div className="flex flex-col gap-3">
        {tarjetas.map(t => {
          const color = FRANQ_COLORS[t.franquicia ?? ''] ?? '#6366f1'
          const util = typeof t.utilizacion === 'number' ? t.utilizacion : 0
          return (
            <div key={t.id} className="bg-surface border border-border rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: color + '22' }}>
                <CreditCardIcon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{t.alias ?? `····${t.ultimosCuatro}`}</span>
                  {t.franquicia && <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{t.franquicia}</span>}
                  {t.categoriaTarjeta && <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{t.categoriaTarjeta}</span>}
                  {t.dobleBalance && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">Multi-moneda</span>}
                  {t.tieneExtraCredito && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">ExtraCredito</span>}
                  {!t.activa && <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">Inactiva</span>}
                </div>
                <div className="text-xs text-text-muted mt-0.5">{t.banco} · ····{t.ultimosCuatro}</div>

                {/* Balance principal */}
                <UtilBar pct={util} />
                <div className="flex items-center justify-between text-xs text-text-muted mt-1">
                  {parseFloat(String(t.saldoActual)) < 0
                    ? <span className="text-danger font-medium">⚠ Sobregiro: {fmt(Math.abs(parseFloat(String(t.saldoActual))))}</span>
                    : <span>Usado: <span className={util >= 90 ? 'text-danger font-medium' : ''}>{fmt(t.saldoActual)}</span></span>
                  }
                  <span className="text-text-muted">{t.moneda} · {util}% de {fmt(t.limite)}</span>
                </div>

                {/* Balance secundario */}
                {t.dobleBalance && t.monedaSecundaria && (
                  <>
                    <UtilBar pct={t.utilizacionSecundaria ?? 0} />
                    <div className="flex items-center justify-between text-xs text-text-muted mt-1">
                      {parseFloat(String(t.saldoSecundario ?? 0)) < 0
                        ? <span className="text-danger font-medium">⚠ Sobregiro: {fmt(Math.abs(parseFloat(String(t.saldoSecundario ?? 0))))}</span>
                        : <span>Usado: {fmt(t.saldoSecundario ?? 0)}</span>
                      }
                      <span className="text-text-muted">{t.monedaSecundaria} · {t.utilizacionSecundaria ?? 0}% de {fmt(t.limiteSecundario ?? 0)}</span>
                    </div>
                  </>
                )}

                {/* ExtraCredito section — always visible for credit cards */}
                {(t.tipoTarjeta === 'CREDITO' || t.tipoTarjeta === null) && (
                  <ExtraCreditoSection tarjeta={t} onRefresh={invalidate} />
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setModal({ type: 'edit', tarjeta: t })}
                  className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">✏</button>
                <button onClick={() => setModal({ type: 'delete', tarjeta: t })}
                  className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && tarjetas.length === 0 && (
        <div className="text-center text-text-muted py-16 text-sm">
          <CreditCardIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tienes tarjetas registradas</p>
          <button onClick={() => setModal({ type: 'new' })} className="btn-primary mt-4">+ Añadir primera tarjeta</button>
        </div>
      )}

      {modal?.type === 'new' && (
        <Modal title="Nueva tarjeta" onClose={closeModal}>
          <TarjetaFormPanel onClose={closeModal} loading={create.isPending} error={modal.error}
            onSubmit={d => create.mutate(toPayload(d))} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar tarjeta" onClose={closeModal}>
          <TarjetaFormPanel
            initial={{
              alias: modal.tarjeta.alias ?? '', banco: modal.tarjeta.banco,
              ultimosCuatro: modal.tarjeta.ultimosCuatro,
              franquicia: (modal.tarjeta.franquicia ?? '') as Franquicia | '',
              tipoTarjeta: (modal.tarjeta.tipoTarjeta ?? '') as TipoTarjeta | '',
              categoriaTarjeta: (modal.tarjeta.categoriaTarjeta ?? '') as CategoriaTarjeta | '',
              limite: String(modal.tarjeta.limite), saldoActual: String(modal.tarjeta.saldoActual),
              tasaInteres: String(modal.tarjeta.tasaInteres), diaCorte: String(modal.tarjeta.diaCorte),
              diaPago: String(modal.tarjeta.diaPago), moneda: modal.tarjeta.moneda, activa: modal.tarjeta.activa,
              dobleBalance: modal.tarjeta.dobleBalance ?? false,
              monedaSecundaria: modal.tarjeta.monedaSecundaria ?? 'USD',
              limiteSecundario: String(modal.tarjeta.limiteSecundario ?? '0'),
              saldoSecundario: String(modal.tarjeta.saldoSecundario ?? '0'),
            }}
            onClose={closeModal} loading={update.isPending} error={modal.error}
            onSubmit={d => update.mutate({ id: modal.tarjeta.id, d: toPayload(d) })} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar tarjeta" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Eliminar <strong className="text-text-primary">{modal.tarjeta.alias ?? `····${modal.tarjeta.ultimosCuatro}`}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.tarjeta.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
