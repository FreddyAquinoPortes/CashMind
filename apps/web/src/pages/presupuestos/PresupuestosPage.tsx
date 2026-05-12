import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Icon } from '@iconify/react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TipoLinea = 'INGRESO' | 'GASTO'
type TipoPresupuesto = 'NORMAL' | 'ATOMICO'
type EstadoPresupuesto = 'BORRADOR' | 'ACTIVO' | 'CERRADO'

interface EjecucionLinea {
  id: string
  montoEjecutado: number
  fecha: string
  notas: string | null
  eventoId: string | null
  transaccionId: string | null
}

interface LineaPresupuesto {
  id: string
  tipo: TipoLinea
  incluido: boolean
  concepto: string
  categoriaId: string | null
  subcategoriaId: string | null
  montoPlaneado: number
  montoEjecutado: number
  cumplimiento: number
  notas: string | null
  orden: number
  eventoId: string | null
  deudaId: string | null
  rutaId: string | null
  ejecuciones: EjecucionLinea[]
}

interface Presupuesto {
  id: string
  nombre: string
  fechaInicio: string
  fechaFin: string
  tipo: TipoPresupuesto
  estado: EstadoPresupuesto
  notas: string | null
  lineas: LineaPresupuesto[]
  resumen: {
    ingresos: number
    gastos: number
    disponible: number
    ingresosEjecutados: number
    gastosEjecutados: number
    cumplimientoGeneral: number
  }
}

interface Sugerencia {
  tipo: TipoLinea
  concepto: string
  montoPlaneado: number
  categoriaId?: string | null
  subcategoriaId?: string | null
  eventoId?: string | null
  deudaId?: string | null
  rutaId?: string | null
  origen: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

function periodoLabel(p: Presupuesto) {
  const ini = new Date(p.fechaInicio)
  const fin = new Date(p.fechaFin)
  return `${ini.toLocaleDateString('es-DO', { month: 'short', day: 'numeric' })} – ${fin.toLocaleDateString('es-DO', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const ESTADO_COLOR: Record<EstadoPresupuesto, string> = {
  BORRADOR: 'bg-yellow-500/20 text-yellow-400',
  ACTIVO:   'bg-success/20 text-success',
  CERRADO:  'bg-text-muted/20 text-text-muted',
}

const COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#f97316','#84cc16']

const origenIcon: Record<string, string> = {
  evento_recurrente: 'tabler:calendar-repeat',
  deuda:             'tabler:credit-card',
  ruta_combustible:  'tabler:gas-station',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
      {msg}
    </div>
  )
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-surface border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Mini pie chart showing expense distribution ───────────────────────────
function DistribucionChart({ lineas }: { lineas: LineaPresupuesto[] }) {
  const gastos = lineas.filter(l => l.tipo === 'GASTO' && l.montoPlaneado > 0)
  if (gastos.length === 0) return (
    <div className="flex items-center justify-center h-48 text-text-muted text-sm">
      Añade líneas de gastos para ver la distribución
    </div>
  )

  const data = gastos.map(l => ({ name: l.concepto, value: l.montoPlaneado }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
          dataKey="value" nameKey="name" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]!} />)}
        </Pie>
        <Tooltip formatter={(v: number) => fmt(v)} />
        <Legend iconType="circle" iconSize={8} formatter={(v: string) =>
          <span className="text-xs text-text-secondary">{v.length > 18 ? v.slice(0, 17) + '…' : v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Cumplimiento bar chart ────────────────────────────────────────────────
function CumplimientoChart({ lineas }: { lineas: LineaPresupuesto[] }) {
  const data = lineas.filter(l => l.montoPlaneado > 0).map(l => ({
    name: l.concepto.length > 14 ? l.concepto.slice(0, 13) + '…' : l.concepto,
    Planeado: l.montoPlaneado,
    Ejecutado: l.montoEjecutado,
    tipo: l.tipo,
  }))

  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => fmt(v)} />
        <Bar dataKey="Planeado" fill="#3b82f6" radius={[3,3,0,0]} opacity={0.5} />
        <Bar dataKey="Ejecutado" fill="#22c55e" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Line row in budget table ──────────────────────────────────────────────
function LineaRow({
  linea, readOnly, onEdit, onDelete, onEjecutar,
}: {
  linea: LineaPresupuesto
  readOnly: boolean
  onEdit: (l: LineaPresupuesto) => void
  onDelete: (id: string) => void
  onEjecutar: (l: LineaPresupuesto) => void
}) {
  const isIngreso = linea.tipo === 'INGRESO'
  const pct = linea.cumplimiento

  return (
    <tr className="border-b border-border/50 hover:bg-surface-elevated/30 transition-colors">
      <td className="py-2.5 pl-4 pr-2">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
          ${isIngreso ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
          <Icon icon={isIngreso ? 'tabler:arrow-down-circle' : 'tabler:arrow-up-circle'} className="w-3 h-3" />
          {isIngreso ? 'Ingreso' : 'Gasto'}
        </span>
      </td>
      <td className="py-2.5 px-2 text-sm text-text-primary font-medium">{linea.concepto}</td>
      <td className="py-2.5 px-2 text-sm text-right tabular-nums text-text-secondary">{fmt(linea.montoPlaneado)}</td>
      <td className="py-2.5 px-2 text-sm text-right tabular-nums">
        <span className={linea.montoEjecutado > 0 ? 'text-success font-medium' : 'text-text-muted'}>
          {fmt(linea.montoEjecutado)}
        </span>
      </td>
      <td className="py-2.5 px-2 w-32">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-border rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#3b82f6' }} />
          </div>
          <span className="text-xs text-text-muted tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
        </div>
      </td>
      <td className="py-2.5 pr-3 pl-2">
        <div className="flex items-center gap-1 justify-end">
          {!readOnly && (
            <>
              <button onClick={() => onEjecutar(linea)}
                className="p-1 rounded text-text-muted hover:text-success hover:bg-success/10 transition-colors"
                title="Ejecutar">
                <Icon icon="tabler:player-play" className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onEdit(linea)}
                className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                title="Editar">
                <Icon icon="tabler:pencil" className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(linea.id)}
                className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                title="Eliminar">
                <Icon icon="tabler:trash" className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Form to add/edit a line ───────────────────────────────────────────────
function LineaForm({
  initial, onSubmit, onClose, loading,
}: {
  initial?: Partial<LineaPresupuesto>
  onSubmit: (d: { tipo: TipoLinea; concepto: string; montoPlaneado: number; notas?: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const [tipo, setTipo] = useState<TipoLinea>(initial?.tipo ?? 'GASTO')
  const [concepto, setConcepto] = useState(initial?.concepto ?? '')
  const [monto, setMonto] = useState(initial?.montoPlaneado?.toString() ?? '')
  const [notas, setNotas] = useState(initial?.notas ?? '')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ tipo, concepto, montoPlaneado: Number(monto), notas: notas || undefined }) }}
      className="flex flex-col gap-4">
      <div className="flex rounded-lg overflow-hidden border border-border">
        {(['INGRESO', 'GASTO'] as TipoLinea[]).map(t => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${tipo === t
                ? t === 'INGRESO' ? 'bg-success text-white' : 'bg-danger text-white'
                : 'text-text-muted hover:bg-surface-elevated'}`}>
            {t === 'INGRESO' ? '↓ Ingreso' : '↑ Gasto'}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Concepto *
        <input required value={concepto} onChange={e => setConcepto(e.target.value)} className="input" placeholder="Ej. Nómina mayo, Supermercado…" autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Monto planeado (DOP) *
        <input required type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="input" placeholder="0.00" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <input value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Opcional…" />
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── Modal to create/activate a budget ────────────────────────────────────
function PresupuestoForm({
  initial, onSubmit, onClose, loading,
}: {
  initial?: Partial<Presupuesto>
  onSubmit: (d: { nombre: string; fechaInicio: string; fechaFin: string; tipo: TipoPresupuesto; notas?: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()

  const [tipo, setTipo] = useState<TipoPresupuesto>(initial?.tipo ?? 'NORMAL')
  const [nombre, setNombre] = useState(
    initial?.nombre ??
    (tipo === 'ATOMICO'
      ? `Lista ${now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}`
      : `Presupuesto ${now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}`)
  )
  const [ini, setIni] = useState(initial?.fechaInicio?.slice(0, 10) ?? `${y}-${m}-01`)
  const [fin, setFin] = useState(initial?.fechaFin?.slice(0, 10) ?? `${y}-${m}-${lastDay}`)
  const [notas, setNotas] = useState(initial?.notas ?? '')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ nombre, tipo, fechaInicio: ini, fechaFin: fin, notas: notas || undefined }) }}
      className="flex flex-col gap-4">

      {/* Tipo selector */}
      {!initial?.id && (
        <div className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <span>Tipo de presupuesto</span>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'NORMAL', icon: 'tabler:layout-list', label: 'Normal', desc: 'Ingresos y gastos por período, ejecución línea por línea' },
              { key: 'ATOMICO', icon: 'tabler:shopping-cart', label: 'Atómico', desc: 'Lista de ítems que se ejecuta como una sola transacción' },
            ] as const).map(t => (
              <button key={t.key} type="button" onClick={() => setTipo(t.key)}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all
                  ${tipo === t.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
                <div className="flex items-center gap-1.5">
                  <Icon icon={t.icon} className={`w-4 h-4 ${tipo === t.key ? 'text-primary' : 'text-text-muted'}`} />
                  <span className={`font-semibold text-sm ${tipo === t.key ? 'text-primary' : 'text-text-primary'}`}>{t.label}</span>
                </div>
                <span className="text-xs text-text-muted leading-snug">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre *
        <input required value={nombre} onChange={e => setNombre(e.target.value)} className="input" autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha inicio *
          <input required type="date" value={ini} onChange={e => setIni(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha fin *
          <input required type="date" value={fin} onChange={e => setFin(e.target.value)} className="input" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <textarea value={notas} onChange={e => setNotas(e.target.value)} className="input resize-none" rows={2} />
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Creando…' : 'Crear'}</button>
      </div>
    </form>
  )
}

// ── Sugerencias panel ─────────────────────────────────────────────────────
function SugerenciasPanel({
  sugerencias, onAgregar, onCerrar,
}: {
  sugerencias: Sugerencia[]
  onAgregar: (s: Sugerencia) => void
  onCerrar: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(sugerencias.map((_, i) => i)))

  const toggle = (i: number) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i); else next.add(i)
    return next
  })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">
        Selecciona las líneas a importar a tu presupuesto. Las sugerencias provienen de eventos recurrentes, cuotas de deudas y rutas de combustible.
      </p>
      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
        {sugerencias.length === 0 && (
          <div className="text-center text-text-muted text-sm py-6">No se encontraron sugerencias para este período.</div>
        )}
        {sugerencias.map((s, i) => (
          <label key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface-elevated cursor-pointer transition-colors">
            <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="accent-primary" />
            <Icon icon={origenIcon[s.origen] ?? 'tabler:circle-dot'} className="w-4 h-4 text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-primary font-medium truncate">{s.concepto}</div>
              <div className="text-xs text-text-muted capitalize">{s.origen.replace(/_/g, ' ')}</div>
            </div>
            <span className={`text-sm font-semibold tabular-nums ${s.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}`}>
              {s.tipo === 'INGRESO' ? '+' : '-'}{fmt(s.montoPlaneado)}
            </span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 justify-between pt-2 border-t border-border">
        <button onClick={onCerrar} className="btn-ghost">Cancelar</button>
        <button
          onClick={() => {
            sugerencias.forEach((s, i) => { if (selected.has(i)) onAgregar(s) })
            onCerrar()
          }}
          className="btn-primary">
          Importar {selected.size} línea{selected.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

// ── Ejecutar linea modal ──────────────────────────────────────────────────
function EjecutarLineaForm({
  linea, onSubmit, onClose, loading,
}: {
  linea: LineaPresupuesto
  onSubmit: (d: { montoEjecutado: number; fecha: string; crearEvento: boolean; notas?: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const [monto, setMonto] = useState(linea.montoPlaneado.toString())
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [crearEvento, setCrearEvento] = useState(false)
  const [notas, setNotas] = useState('')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ montoEjecutado: Number(monto), fecha, crearEvento, notas: notas || undefined }) }}
      className="flex flex-col gap-4">
      <div className="rounded-lg bg-background p-3 text-sm">
        <div className="font-medium text-text-primary">{linea.concepto}</div>
        <div className="text-text-muted mt-0.5">Planeado: <span className="font-semibold tabular-nums">{fmt(linea.montoPlaneado)}</span></div>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Monto ejecutado (DOP) *
        <input required type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="input" autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Fecha
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input" />
      </label>
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input type="checkbox" checked={crearEvento} onChange={e => setCrearEvento(e.target.checked)} className="accent-primary w-4 h-4" />
        Crear evento pendiente (en lugar de transacción directa)
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <input value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Opcional…" />
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Ejecutando…' : crearEvento ? 'Crear evento' : 'Registrar transacción'}
        </button>
      </div>
    </form>
  )
}

// ── Atomic budget checklist view ──────────────────────────────────────────
function AtomicoView({
  presupuesto,
  onToggle,
  onDelete,
  onAddItem,
  onEjecutarTodo,
  ejecutando,
}: {
  presupuesto: Presupuesto
  onToggle: (lineaId: string, incluido: boolean) => void
  onDelete: (lineaId: string) => void
  onAddItem: () => void
  onEjecutarTodo: () => void
  ejecutando: boolean
}) {
  const lineas = presupuesto.lineas
  const incluidas = lineas.filter(l => l.incluido)
  const total = incluidas.reduce((s, l) => s + l.montoPlaneado, 0)
  const totalTodo = lineas.reduce((s, l) => s + l.montoPlaneado, 0)
  const yaEjecutado = lineas.some(l => l.ejecuciones.length > 0)
  const cerrado = presupuesto.estado === 'CERRADO'

  return (
    <div className="flex flex-col gap-4">
      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-start gap-2">
        <Icon icon="tabler:info-circle" className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Presupuesto atómico</strong> — Desmarca los artículos que no compraste, luego
          ejecuta todo de una vez. Se creará <strong>una sola transacción</strong> por el total de los ítems marcados.
        </span>
      </div>

      {/* Checklist */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Icon icon="tabler:shopping-cart" className="w-4 h-4 text-primary" />
            {presupuesto.nombre}
          </span>
          {!cerrado && (
            <button onClick={onAddItem}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Icon icon="tabler:plus" className="w-3.5 h-3.5" /> Añadir ítem
            </button>
          )}
        </div>

        {lineas.length === 0 && (
          <div className="py-10 text-center text-text-muted text-sm">
            Lista vacía. Añade ítems para comenzar.
          </div>
        )}

        <div className="divide-y divide-border/40">
          {lineas.map(l => {
            const tachado = !l.incluido
            return (
              <div key={l.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors
                  ${tachado ? 'opacity-50 bg-background/40' : 'hover:bg-surface-elevated/30'}`}>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={l.incluido}
                  disabled={cerrado || l.ejecuciones.length > 0}
                  onChange={e => onToggle(l.id, e.target.checked)}
                  className="accent-primary w-4 h-4 flex-shrink-0 cursor-pointer"
                />
                {/* Concepto */}
                <span className={`flex-1 text-sm ${tachado ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {l.concepto}
                </span>
                {/* Execution badge */}
                {l.ejecuciones.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium flex-shrink-0">
                    ✓ ejecutado
                  </span>
                )}
                {/* Monto */}
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0
                  ${tachado ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                  {fmt(l.montoPlaneado)}
                </span>
                {/* Delete */}
                {!cerrado && l.ejecuciones.length === 0 && (
                  <button onClick={() => onDelete(l.id)}
                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0">
                    <Icon icon="tabler:x" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer totals */}
        {lineas.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-background/50">
            <div className="text-xs text-text-muted">
              {incluidas.length} de {lineas.length} ítems · descartado: {fmt(totalTodo - total)}
            </div>
            <div className="text-base font-bold text-text-primary tabular-nums">
              Total: <span className="text-primary">{fmt(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Execute button */}
      {!cerrado && !yaEjecutado && (
        <div className="flex justify-end">
          <button
            onClick={onEjecutarTodo}
            disabled={ejecutando || incluidas.length === 0 || presupuesto.estado === 'BORRADOR'}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Icon icon="tabler:check" className="w-4 h-4" />
            {ejecutando ? 'Ejecutando…' : `Ejecutar lista · ${fmt(total)}`}
          </button>
        </div>
      )}
      {presupuesto.estado === 'BORRADOR' && !cerrado && (
        <p className="text-xs text-text-muted text-right">Activa el presupuesto para poder ejecutarlo.</p>
      )}
      {yaEjecutado && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success flex items-center gap-2">
          <Icon icon="tabler:circle-check" className="w-4 h-4" />
          Lista ejecutada. Transacción registrada en tus movimientos.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function PresupuestosPage() {
  const qc = useQueryClient()
  const clienteId = useAuthStore(s => s.clienteActivo?.id) ?? ''

  const [tab, setTab] = useState<'planificar' | 'ejecutar' | 'historial'>('planificar')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<
    | { type: 'newPresupuesto' }
    | { type: 'editPresupuesto'; presupuesto: Presupuesto }
    | { type: 'newLinea'; presupuestoId: string; tipoDefecto?: TipoLinea }
    | { type: 'editLinea'; linea: LineaPresupuesto; presupuestoId: string }
    | { type: 'sugerencias'; presupuestoId: string; sugerencias: Sugerencia[] }
    | { type: 'ejecutarLinea'; linea: LineaPresupuesto; presupuestoId: string }
    | { type: 'ejecutarAtomico'; presupuesto: Presupuesto }
    | null
  >(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['presupuestos', clienteId] })

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: presupuestos = [], isLoading } = useQuery<Presupuesto[]>({
    queryKey: ['presupuestos', clienteId],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${clienteId}/presupuestos`)
      return data.data
    },
    enabled: !!clienteId,
  })

  const presupuesto = useMemo(
    () => presupuestos.find(p => p.id === selectedId) ?? presupuestos[0] ?? null,
    [presupuestos, selectedId]
  )

  // Auto-select first
  const currentId = presupuesto?.id ?? null

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createPres = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${clienteId}/presupuestos`, d),
    onSuccess: (res) => { invalidate(); setModal(null); setSelectedId(res.data.data.id); showToast('Presupuesto creado') },
    onError: () => showToast('Error al crear presupuesto', 'error'),
  })

  const updatePres = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/clientes/${clienteId}/presupuestos/${id}`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Presupuesto actualizado') },
    onError: () => showToast('Error al actualizar', 'error'),
  })

  const deletePres = useMutation({
    mutationFn: (id: string) => api.delete(`/clientes/${clienteId}/presupuestos/${id}`),
    onSuccess: () => { invalidate(); setSelectedId(null); showToast('Presupuesto eliminado') },
    onError: () => showToast('Error al eliminar', 'error'),
  })

  const addLinea = useMutation({
    mutationFn: ({ presupuestoId, d }: { presupuestoId: string; d: object }) =>
      api.post(`/clientes/${clienteId}/presupuestos/${presupuestoId}/lineas`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Línea añadida') },
    onError: () => showToast('Error al añadir línea', 'error'),
  })

  const editLinea = useMutation({
    mutationFn: ({ lineaId, d }: { lineaId: string; d: object }) =>
      api.patch(`/presupuestos/lineas/${lineaId}`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('Línea actualizada') },
    onError: () => showToast('Error al actualizar línea', 'error'),
  })

  const deleteLinea = useMutation({
    mutationFn: (lineaId: string) => api.delete(`/presupuestos/lineas/${lineaId}`),
    onSuccess: () => { invalidate(); showToast('Línea eliminada') },
    onError: () => showToast('Error al eliminar', 'error'),
  })

  const toggleIncluido = useMutation({
    mutationFn: ({ lineaId, incluido }: { lineaId: string; incluido: boolean }) =>
      api.patch(`/presupuestos/lineas/${lineaId}/incluido`, { incluido }),
    onSuccess: () => invalidate(),
    onError: () => showToast('Error al actualizar', 'error'),
  })

  const ejecutarAtomico = useMutation({
    mutationFn: ({ presupuestoId, d }: { presupuestoId: string; d: object }) =>
      api.post(`/clientes/${clienteId}/presupuestos/${presupuestoId}/ejecutar-atomico`, d),
    onSuccess: (res) => {
      invalidate()
      setModal(null)
      showToast(`✓ Ejecutado: ${res.data.data.itemsEjecutados} ítems · ${fmt(res.data.data.total)}`)
    },
    onError: (e: Error) => showToast(e.message || 'Error al ejecutar', 'error'),
  })

  const ejecutarLinea = useMutation({
    mutationFn: ({ lineaId, d }: { lineaId: string; d: object }) =>
      api.post(`/clientes/${clienteId}/presupuestos/lineas/${lineaId}/ejecutar`, d),
    onSuccess: () => { invalidate(); setModal(null); showToast('¡Ejecutado! Transacción/evento creado') },
    onError: () => showToast('Error al ejecutar', 'error'),
  })

  // ── Sugerencias ───────────────────────────────────────────────────────────

  const fetchSugerencias = async (p: Presupuesto) => {
    try {
      const { data } = await api.get(`/clientes/${clienteId}/presupuestos/sugerencias`, {
        params: { fechaInicio: p.fechaInicio.slice(0, 10), fechaFin: p.fechaFin.slice(0, 10) },
      })
      setModal({ type: 'sugerencias', presupuestoId: p.id, sugerencias: data.data })
    } catch { showToast('Error al obtener sugerencias', 'error') }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const lineas = presupuesto?.lineas ?? []
  const ingresos = lineas.filter(l => l.tipo === 'INGRESO')
  const gastos = lineas.filter(l => l.tipo === 'GASTO')
  const readOnly = presupuesto?.estado === 'CERRADO'

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {toast && <Toast {...toast} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Presupuestos</h1>
          <p className="text-text-muted text-sm mt-0.5">Planifica, ejecuta y evalúa tus finanzas por período</p>
        </div>
        <button onClick={() => setModal({ type: 'newPresupuesto' })} className="btn-primary flex items-center gap-2">
          <Icon icon="tabler:plus" className="w-4 h-4" />
          Nuevo presupuesto
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-text-muted">Cargando…</div>
      )}

      {!isLoading && presupuestos.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Icon icon="tabler:calculator" className="w-14 h-14 text-text-muted opacity-40" />
          <div>
            <div className="text-text-primary font-medium text-lg">Sin presupuestos aún</div>
            <div className="text-text-muted text-sm mt-1">Crea tu primer presupuesto para distribuir tus ingresos</div>
          </div>
          <button onClick={() => setModal({ type: 'newPresupuesto' })} className="btn-primary">
            Crear mi primer presupuesto
          </button>
        </div>
      )}

      {presupuestos.length > 0 && (
        <div className="flex gap-6 flex-col xl:flex-row">

          {/* ── Sidebar: lista de presupuestos ── */}
          <aside className="xl:w-64 flex-shrink-0 flex flex-col gap-2">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Períodos</div>
            {presupuestos.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all
                  ${currentId === p.id
                    ? 'border-primary bg-primary/10 text-text-primary'
                    : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-surface-elevated'}`}
              >
                <div className="flex items-center gap-1.5">
                  {p.tipo === 'ATOMICO' && <Icon icon="tabler:shopping-cart" className="w-3 h-3 text-text-muted flex-shrink-0" />}
                  <span className="font-medium text-sm truncate">{p.nombre}</span>
                </div>
                <div className="text-xs text-text-muted mt-0.5">{periodoLabel(p)}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-xs font-semibold inline-block px-1.5 py-0.5 rounded-full ${ESTADO_COLOR[p.estado]}`}>
                    {p.estado}
                  </span>
                  {p.tipo === 'ATOMICO' && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Atómico</span>
                  )}
                </div>
              </button>
            ))}
          </aside>

          {/* ── Main area ── */}
          {presupuesto && (
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Presupuesto header card */}
              <div className="bg-surface border border-border rounded-xl px-5 py-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-text-primary">{presupuesto.nombre}</h2>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[presupuesto.estado]}`}>
                        {presupuesto.estado}
                      </span>
                    </div>
                    <div className="text-text-muted text-sm mt-0.5">{periodoLabel(presupuesto)}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {presupuesto.estado === 'BORRADOR' && (
                      <button onClick={() => fetchSugerencias(presupuesto)}
                        className="btn-ghost flex items-center gap-1.5 text-sm">
                        <Icon icon="tabler:sparkles" className="w-4 h-4 text-yellow-400" />
                        Autocompletar
                      </button>
                    )}
                    {presupuesto.estado === 'BORRADOR' && (
                      <button onClick={() => updatePres.mutate({ id: presupuesto.id, d: { estado: 'ACTIVO' } })}
                        className="btn-primary text-sm flex items-center gap-1.5">
                        <Icon icon="tabler:player-play" className="w-4 h-4" />
                        Activar
                      </button>
                    )}
                    {presupuesto.estado === 'ACTIVO' && (
                      <button onClick={() => updatePres.mutate({ id: presupuesto.id, d: { estado: 'CERRADO' } })}
                        className="btn-ghost text-sm flex items-center gap-1.5">
                        <Icon icon="tabler:lock" className="w-4 h-4" />
                        Cerrar período
                      </button>
                    )}
                    <button onClick={() => setModal({ type: 'editPresupuesto', presupuesto })}
                      className="btn-ghost text-sm flex items-center gap-1.5">
                      <Icon icon="tabler:pencil" className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm('¿Eliminar este presupuesto?')) deletePres.mutate(presupuesto.id) }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <Icon icon="tabler:trash" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Summary numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: 'Ingresos planeados', value: presupuesto.resumen.ingresos, color: 'text-success' },
                    { label: 'Gastos planeados', value: presupuesto.resumen.gastos, color: 'text-danger' },
                    { label: 'Disponible', value: presupuesto.resumen.disponible, color: presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger' },
                    { label: 'Cumplimiento', value: null, pct: presupuesto.resumen.cumplimientoGeneral, color: 'text-primary' },
                  ].map((item, i) => (
                    <div key={i} className="bg-background rounded-lg px-3 py-2.5">
                      <div className="text-xs text-text-muted">{item.label}</div>
                      {item.value !== null
                        ? <div className={`text-base font-bold tabular-nums mt-0.5 ${item.color}`}>{fmt(item.value)}</div>
                        : <div className={`text-base font-bold mt-0.5 ${item.color}`}>{item.pct!.toFixed(0)}%</div>
                      }
                    </div>
                  ))}
                </div>
              </div>

              {/* ── ATÓMICO: checklist view (no tabs) ── */}
              {presupuesto.tipo === 'ATOMICO' && (
                <AtomicoView
                  presupuesto={presupuesto}
                  onToggle={(lineaId, incluido) => toggleIncluido.mutate({ lineaId, incluido })}
                  onDelete={id => deleteLinea.mutate(id)}
                  onAddItem={() => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'GASTO' })}
                  onEjecutarTodo={() => setModal({ type: 'ejecutarAtomico', presupuesto })}
                  ejecutando={ejecutarAtomico.isPending}
                />
              )}

              {/* ── NORMAL: tabs ── */}
              {presupuesto.tipo === 'NORMAL' && (<><div className="flex border-b border-border gap-1">
                {([
                  { key: 'planificar', label: 'Planificación', icon: 'tabler:layout-list' },
                  { key: 'ejecutar',   label: 'Ejecución',     icon: 'tabler:player-play' },
                  { key: 'historial',  label: 'Gráficas',      icon: 'tabler:chart-pie' },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
                    <Icon icon={t.icon} className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Tab: Planificación ── */}
              {tab === 'planificar' && (
                <div className="flex flex-col gap-4">
                  {/* Ingresos table */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-success/5">
                      <div className="flex items-center gap-2 text-success font-semibold text-sm">
                        <Icon icon="tabler:arrow-down-circle" className="w-4 h-4" />
                        Ingresos
                        <span className="text-xs font-normal text-text-muted">({ingresos.length} líneas)</span>
                      </div>
                      {!readOnly && (
                        <button onClick={() => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'INGRESO' })}
                          className="flex items-center gap-1 text-xs text-success hover:text-success/80 transition-colors">
                          <Icon icon="tabler:plus" className="w-3.5 h-3.5" /> Añadir
                        </button>
                      )}
                    </div>
                    {ingresos.length > 0 ? (
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-text-muted border-b border-border/50">
                            <th className="py-2 pl-4 pr-2 text-left w-24">Tipo</th>
                            <th className="py-2 px-2 text-left">Concepto</th>
                            <th className="py-2 px-2 text-right">Planeado</th>
                            <th className="py-2 px-2 text-right">Ejecutado</th>
                            <th className="py-2 px-2 text-left w-36">Progreso</th>
                            <th className="py-2 pr-3 pl-2 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingresos.map(l => (
                            <LineaRow key={l.id} linea={l} readOnly={readOnly}
                              onEdit={l => setModal({ type: 'editLinea', linea: l, presupuestoId: presupuesto.id })}
                              onDelete={id => deleteLinea.mutate(id)}
                              onEjecutar={l => setModal({ type: 'ejecutarLinea', linea: l, presupuestoId: presupuesto.id })}
                            />
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border/50 bg-success/5">
                            <td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-success">Total ingresos</td>
                            <td className="py-2 px-2 text-right text-sm font-bold text-success tabular-nums">{fmt(presupuesto.resumen.ingresos)}</td>
                            <td className="py-2 px-2 text-right text-sm font-bold text-success tabular-nums">{fmt(presupuesto.resumen.ingresosEjecutados)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="py-6 text-center text-text-muted text-sm">
                        Sin ingresos definidos.{' '}
                        {!readOnly && <button onClick={() => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'INGRESO' })} className="text-success underline">Añadir ingreso</button>}
                      </div>
                    )}
                  </div>

                  {/* Gastos table */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-danger/5">
                      <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                        <Icon icon="tabler:arrow-up-circle" className="w-4 h-4" />
                        Gastos
                        <span className="text-xs font-normal text-text-muted">({gastos.length} líneas)</span>
                      </div>
                      {!readOnly && (
                        <button onClick={() => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'GASTO' })}
                          className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors">
                          <Icon icon="tabler:plus" className="w-3.5 h-3.5" /> Añadir
                        </button>
                      )}
                    </div>
                    {gastos.length > 0 ? (
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-text-muted border-b border-border/50">
                            <th className="py-2 pl-4 pr-2 text-left w-24">Tipo</th>
                            <th className="py-2 px-2 text-left">Concepto</th>
                            <th className="py-2 px-2 text-right">Planeado</th>
                            <th className="py-2 px-2 text-right">Ejecutado</th>
                            <th className="py-2 px-2 text-left w-36">Progreso</th>
                            <th className="py-2 pr-3 pl-2 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {gastos.map(l => (
                            <LineaRow key={l.id} linea={l} readOnly={readOnly}
                              onEdit={l => setModal({ type: 'editLinea', linea: l, presupuestoId: presupuesto.id })}
                              onDelete={id => deleteLinea.mutate(id)}
                              onEjecutar={l => setModal({ type: 'ejecutarLinea', linea: l, presupuestoId: presupuesto.id })}
                            />
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border/50 bg-danger/5">
                            <td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-danger">Total gastos</td>
                            <td className="py-2 px-2 text-right text-sm font-bold text-danger tabular-nums">{fmt(presupuesto.resumen.gastos)}</td>
                            <td className="py-2 px-2 text-right text-sm font-bold text-danger tabular-nums">{fmt(presupuesto.resumen.gastosEjecutados)}</td>
                            <td colSpan={2}></td>
                          </tr>
                          <tr className="border-t-2 border-border bg-background">
                            <td colSpan={2} className={`py-2.5 pl-4 text-sm font-bold ${presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger'}`}>
                              {presupuesto.resumen.disponible >= 0 ? '✓ Disponible' : '⚠ Déficit'}
                            </td>
                            <td className={`py-2.5 px-2 text-right text-sm font-bold tabular-nums ${presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger'}`}>
                              {fmt(Math.abs(presupuesto.resumen.disponible))}
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="py-6 text-center text-text-muted text-sm">
                        Sin gastos definidos.{' '}
                        {!readOnly && <button onClick={() => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'GASTO' })} className="text-danger underline">Añadir gasto</button>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab: Ejecución ── */}
              {tab === 'ejecutar' && (
                <div className="flex flex-col gap-4">
                  {presupuesto.estado === 'BORRADOR' && (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400 flex items-center gap-2">
                      <Icon icon="tabler:info-circle" className="w-4 h-4 flex-shrink-0" />
                      Activa el presupuesto primero para comenzar a ejecutar líneas.
                    </div>
                  )}

                  {/* Overall progress */}
                  <div className="bg-surface border border-border rounded-xl px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-text-secondary">Cumplimiento general</span>
                      <span className="text-lg font-bold text-primary tabular-nums">
                        {presupuesto.resumen.cumplimientoGeneral.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 bg-border rounded-full overflow-hidden">
                      <div className="h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, presupuesto.resumen.cumplimientoGeneral)}%`,
                          backgroundColor: presupuesto.resumen.cumplimientoGeneral >= 90 ? '#22c55e'
                            : presupuesto.resumen.cumplimientoGeneral >= 60 ? '#f59e0b' : '#3b82f6',
                        }} />
                    </div>
                    <div className="flex justify-between text-xs text-text-muted mt-1.5">
                      <span>Ejecutado: {fmt(presupuesto.resumen.gastosEjecutados)}</span>
                      <span>Planeado: {fmt(presupuesto.resumen.gastos)}</span>
                    </div>
                  </div>

                  {/* Lines execution list */}
                  <div className="flex flex-col gap-2">
                    {lineas.filter(l => l.tipo === 'GASTO').map(l => (
                      <div key={l.id} className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">{l.concepto}</span>
                            {l.ejecuciones.length > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">
                                {l.ejecuciones.length}✓
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex-1 h-1.5 bg-border rounded-full">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, l.cumplimiento)}%`,
                                  backgroundColor: l.cumplimiento >= 100 ? '#22c55e' : l.cumplimiento >= 60 ? '#f59e0b' : '#3b82f6',
                                }} />
                            </div>
                            <span className="text-xs text-text-muted tabular-nums whitespace-nowrap">
                              {fmt(l.montoEjecutado)} / {fmt(l.montoPlaneado)}
                            </span>
                          </div>
                        </div>
                        {presupuesto.estado === 'ACTIVO' && (
                          <button onClick={() => setModal({ type: 'ejecutarLinea', linea: l, presupuestoId: presupuesto.id })}
                            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors">
                            <Icon icon="tabler:player-play" className="w-3.5 h-3.5" />
                            Ejecutar
                          </button>
                        )}
                      </div>
                    ))}
                    {gastos.length === 0 && (
                      <div className="text-center text-text-muted text-sm py-8">No hay líneas de gastos definidas.</div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab: Gráficas ── */}
              {tab === 'historial' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <div className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                      <Icon icon="tabler:chart-pie" className="w-4 h-4 text-primary" />
                      Distribución de gastos
                    </div>
                    <DistribucionChart lineas={lineas} />
                  </div>

                  <div className="bg-surface border border-border rounded-xl p-4">
                    <div className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                      <Icon icon="tabler:chart-bar" className="w-4 h-4 text-primary" />
                      Planeado vs Ejecutado
                    </div>
                    <CumplimientoChart lineas={lineas} />
                  </div>

                  {/* Insight box */}
                  <div className="md:col-span-2 bg-surface border border-border rounded-xl p-4">
                    <div className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                      <Icon icon="tabler:bulb" className="w-4 h-4 text-yellow-400" />
                      Análisis del período
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <div className="bg-background rounded-lg p-3">
                        <div className="text-text-muted text-xs">Ratio ahorro</div>
                        <div className={`text-lg font-bold mt-0.5 ${presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger'}`}>
                          {presupuesto.resumen.ingresos > 0
                            ? `${((presupuesto.resumen.disponible / presupuesto.resumen.ingresos) * 100).toFixed(1)}%`
                            : '—'}
                        </div>
                        <div className="text-text-muted text-xs mt-0.5">del ingreso disponible</div>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <div className="text-text-muted text-xs">Líneas ejecutadas</div>
                        <div className="text-lg font-bold mt-0.5 text-primary">
                          {lineas.filter(l => l.ejecuciones.length > 0).length} / {lineas.length}
                        </div>
                        <div className="text-text-muted text-xs mt-0.5">líneas con al menos 1 ejecución</div>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <div className="text-text-muted text-xs">Mayor gasto</div>
                        <div className="text-base font-bold mt-0.5 text-danger truncate">
                          {gastos.sort((a, b) => b.montoPlaneado - a.montoPlaneado)[0]?.concepto ?? '—'}
                        </div>
                        <div className="text-text-muted text-xs mt-0.5 tabular-nums">
                          {gastos[0] ? fmt(gastos.sort((a, b) => b.montoPlaneado - a.montoPlaneado)[0]!.montoPlaneado) : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </>)}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {modal?.type === 'newPresupuesto' && (
        <Modal title="Nuevo presupuesto" onClose={() => setModal(null)}>
          <PresupuestoForm loading={createPres.isPending} onClose={() => setModal(null)} onSubmit={d => createPres.mutate(d)} />
        </Modal>
      )}

      {modal?.type === 'editPresupuesto' && (
        <Modal title="Editar presupuesto" onClose={() => setModal(null)}>
          <PresupuestoForm initial={modal.presupuesto} loading={updatePres.isPending} onClose={() => setModal(null)}
            onSubmit={d => updatePres.mutate({ id: modal.presupuesto.id, d })} />
        </Modal>
      )}

      {modal?.type === 'newLinea' && (
        <Modal title="Nueva línea" onClose={() => setModal(null)}>
          <LineaForm
            initial={{ tipo: modal.tipoDefecto ?? 'GASTO' }}
            loading={addLinea.isPending}
            onClose={() => setModal(null)}
            onSubmit={d => addLinea.mutate({ presupuestoId: modal.presupuestoId, d })}
          />
        </Modal>
      )}

      {modal?.type === 'editLinea' && (
        <Modal title="Editar línea" onClose={() => setModal(null)}>
          <LineaForm
            initial={modal.linea}
            loading={editLinea.isPending}
            onClose={() => setModal(null)}
            onSubmit={d => editLinea.mutate({ lineaId: modal.linea.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'sugerencias' && (
        <Modal title="✨ Autocompletar desde tu historial" onClose={() => setModal(null)} wide>
          <SugerenciasPanel
            sugerencias={modal.sugerencias}
            onCerrar={() => setModal(null)}
            onAgregar={s => addLinea.mutate({ presupuestoId: modal.presupuestoId, d: s })}
          />
        </Modal>
      )}

      {modal?.type === 'ejecutarLinea' && (
        <Modal title={`Ejecutar: ${modal.linea.concepto}`} onClose={() => setModal(null)}>
          <EjecutarLineaForm
            linea={modal.linea}
            loading={ejecutarLinea.isPending}
            onClose={() => setModal(null)}
            onSubmit={d => ejecutarLinea.mutate({ lineaId: modal.linea.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'ejecutarAtomico' && (() => {
        const p = modal.presupuesto
        const incluidas = p.lineas.filter(l => l.incluido)
        const total = incluidas.reduce((s, l) => s + l.montoPlaneado, 0)
        return (
          <Modal title="Ejecutar lista completa" onClose={() => setModal(null)}>
            <EjecutarAtomicoConfirm
              presupuesto={p}
              total={total}
              itemCount={incluidas.length}
              loading={ejecutarAtomico.isPending}
              onClose={() => setModal(null)}
              onSubmit={d => ejecutarAtomico.mutate({ presupuestoId: p.id, d })}
            />
          </Modal>
        )
      })()}
    </div>
  )
}

// ── Confirm modal for atomic execution ───────────────────────────────────────
function EjecutarAtomicoConfirm({
  presupuesto, total, itemCount, loading, onClose, onSubmit,
}: {
  presupuesto: Presupuesto
  total: number
  itemCount: number
  loading: boolean
  onClose: () => void
  onSubmit: (d: { fecha: string; notas?: string; cuentaId?: string }) => void
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ fecha, notas: notas || undefined }) }}
      className="flex flex-col gap-4">
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex flex-col gap-1">
        <div className="text-sm text-text-secondary">{itemCount} ítems marcados se registrarán como una sola transacción:</div>
        <div className="text-2xl font-bold text-primary tabular-nums">{fmt(total)}</div>
        <div className="text-xs text-text-muted">{presupuesto.nombre}</div>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Fecha de transacción
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas adicionales
        <input value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Opcional…" />
      </label>
      <p className="text-xs text-text-muted">
        El presupuesto se cerrará automáticamente tras la ejecución.
        Los ítems desmarcados <strong>no</strong> se incluirán en la transacción.
      </p>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading || itemCount === 0} className="btn-primary">
          {loading ? 'Ejecutando…' : `Confirmar · ${fmt(total)}`}
        </button>
      </div>
    </form>
  )
}
