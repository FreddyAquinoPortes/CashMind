import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, Tooltip,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { Icon } from '@iconify/react'
import {
  ArrowUpRight, TrendingDown, CreditCard, AlertCircle,
  TrendingUp, Wallet, Calendar,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface DashboardData {
  balanceTotal:        number
  ingresosMes:         number
  gastosMes:           number
  deudasActivas:       number
  totalDeudas:         number
  proximosPagos:       ProximoPago[]
  gastosPorCategoria:  GastoCat[]
  tendenciaMensual:    TendenciaMes[]
}
interface ProximoPago  { nombre: string; fecha: string; presupuestoEstimado: string; tipo: string }
interface GastoCat     { categoriaId: string; nombre: string; icono: string | null; total: number }
interface TendenciaMes { mes: string; ingresos: number; gastos: number }

// ── Helpers ────────────────────────────────────────────────────────────────
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function mesLabel(ym: string) {
  const [, m] = ym.split('-')
  return MESES_CORTOS[parseInt(m ?? '0') - 1] ?? ym
}

const fmtK = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))

const PALETTE = [
  '#22c55e','#3b82f6','#f59e0b','#ec4899',
  '#8b5cf6','#06b6d4','#f97316','#84cc16',
]

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon, variant = 'default' }: {
  title: string; value: string; subtitle?: string
  icon: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const colors = { default: 'text-text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger' }
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div>
        <div className={`text-2xl font-bold tabular ${colors[variant]}`}>{value}</div>
        {subtitle && <div className="text-xs text-text-muted mt-0.5">{subtitle}</div>}
      </div>
    </div>
  )
}

// ── Custom tooltip for area chart ──────────────────────────────────────────
function TendenciaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-sm">
      <p className="text-text-muted text-xs mb-2 font-medium">{mesLabel(label)}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary">{p.dataKey === 'ingresos' ? 'Ingresos' : 'Gastos'}:</span>
          <span className="font-semibold text-text-primary">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Custom tooltip for pie chart ───────────────────────────────────────────
function CatTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-sm">
      <p className="font-semibold text-text-primary">{d.name}</p>
      <p className="text-text-muted">{formatCurrency(d.value)}</p>
      <p className="text-xs text-text-muted">{d.payload.pct}% del total</p>
    </div>
  )
}

// ── Health score ───────────────────────────────────────────────────────────
function healthScore(data: DashboardData): { score: number; color: string; label: string } {
  let score = 100
  // Debt/income ratio
  const debtRatio = data.ingresosMes > 0 ? data.totalDeudas / (data.ingresosMes * 12) : 1
  if (debtRatio > 0.5) score -= 30
  else if (debtRatio > 0.3) score -= 15
  // Spending ratio
  const spendRatio = data.ingresosMes > 0 ? data.gastosMes / data.ingresosMes : 1
  if (spendRatio > 0.9) score -= 25
  else if (spendRatio > 0.7) score -= 10
  // Positive balance
  if (data.balanceTotal < 0) score -= 20
  else if (data.balanceTotal < 5000) score -= 5
  // Upcoming payments
  if (data.proximosPagos.length > 5) score -= 5

  score = Math.max(0, Math.min(100, score))
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? 'Finanzas saludables'
    : score >= 40 ? 'Ratio deuda/ingreso elevado. Revisa Proyecciones.'
    : 'Situación crítica. Reduce gastos y deudas.'
  return { score, color, label }
}

// ── Main page ─────────────────────────────────────────────────────────────
export function DashboardPage() {
  const cliente = useAuthStore(s => s.clienteActivo)
  const cid     = cliente?.id ?? ''

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', cid],
    queryFn:  async () => (await api.get(`/clientes/${cid}/dashboard`)).data.data,
    enabled:  !!cid,
    staleTime: 60_000,
  })

  // Pie chart data
  const pieData = useMemo(() => {
    if (!data?.gastosPorCategoria?.length) return []
    const total = data.gastosPorCategoria.reduce((s, c) => s + c.total, 0)
    return data.gastosPorCategoria.map((c, i) => ({
      name:        c.nombre,
      value:       c.total,
      icono:       c.icono,
      pct:         total > 0 ? Math.round((c.total / total) * 100) : 0,
      fill:        PALETTE[i % PALETTE.length],
    }))
  }, [data])

  const health = useMemo(() => data ? healthScore(data) : null, [data])
  const ahorro = data ? data.ingresosMes - data.gastosMes : 0
  const tasaAhorro = data?.ingresosMes ? Math.round((ahorro / data.ingresosMes) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {cliente?.nombre} · {new Date().toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard
              title="Balance total"
              value={formatCurrency(data?.balanceTotal ?? 0)}
              subtitle="Cuentas activas"
              icon={<Wallet size={16} />}
              variant={( data?.balanceTotal ?? 0) >= 0 ? 'success' : 'danger'}
            />
            <KpiCard
              title="Deuda activa"
              value={formatCurrency(data?.totalDeudas ?? 0)}
              subtitle={`${data?.deudasActivas ?? 0} deuda${(data?.deudasActivas ?? 0) !== 1 ? 's' : ''} activa${(data?.deudasActivas ?? 0) !== 1 ? 's' : ''}`}
              icon={<TrendingDown size={16} />}
              variant="danger"
            />
            <KpiCard
              title="Gastos del mes"
              value={formatCurrency(data?.gastosMes ?? 0)}
              subtitle={`Ingresos: ${formatCurrency(data?.ingresosMes ?? 0)}`}
              icon={<CreditCard size={16} />}
              variant={(data?.gastosMes ?? 0) > (data?.ingresosMes ?? 0) ? 'danger' : 'warning'}
            />
            <KpiCard
              title="Próx. pagos"
              value={String(data?.proximosPagos?.length ?? 0)}
              subtitle="Próximos 7 días"
              icon={<AlertCircle size={16} />}
              variant={(data?.proximosPagos?.length ?? 0) > 0 ? 'warning' : 'default'}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Tendencia mensual — Area chart */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Tendencia mensual</h2>
              <p className="text-xs text-text-muted mt-0.5">Ingresos vs. gastos — últimos 6 meses</p>
            </div>
            <TrendingUp size={16} className="text-text-muted" />
          </div>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : (data?.tendenciaMensual?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">Sin transacciones registradas</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data!.tendenciaMensual} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip content={<TendenciaTooltip />} />
                <Area type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} fill="url(#gradIngresos)" dot={false} />
                <Area type="monotone" dataKey="gastos"   stroke="#ef4444" strokeWidth={2} fill="url(#gradGastos)"   dot={false} />
                <Legend
                  formatter={(v) => v === 'ingresos' ? 'Ingresos' : 'Gastos'}
                  wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gastos por categoría — Pie + legend */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Gastos por categoría</h2>
              <p className="text-xs text-text-muted mt-0.5">Distribución del mes actual</p>
            </div>
            <ArrowUpRight size={16} className="text-text-muted" />
          </div>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : pieData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-text-muted text-sm">
              <Icon icon="tabler:chart-pie" className="w-10 h-10 opacity-20" />
              Sin gastos categorizados este mes
            </div>
          ) : (
            <div className="flex gap-4 items-center">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<CatTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend list */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    {d.icono && (
                      <Icon
                        icon={d.icono.includes(':') ? d.icono : `tabler:${d.icono}`}
                        className="w-3.5 h-3.5 flex-shrink-0 text-text-muted"
                      />
                    )}
                    <span className="text-xs text-text-secondary truncate flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-text-primary tabular flex-shrink-0">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Ingresos vs Gastos — bar */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Este mes</h2>
              <p className="text-xs text-text-muted mt-0.5">Ingresos · Gastos · Ahorro</p>
            </div>
          </div>
          {isLoading ? <Skeleton className="h-36" /> : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={[{ name: 'Mes', ingresos: data?.ingresosMes ?? 0, gastos: data?.gastosMes ?? 0 }]}
                  margin={{ top: 0, right: 0, left: -30, bottom: 0 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatCurrency(v), name === 'ingresos' ? 'Ingresos' : 'Gastos']}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar dataKey="ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos"   fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-xs text-text-muted">Tasa de ahorro</p>
                  <p className={`text-base font-bold ${tasaAhorro >= 0 ? 'text-success' : 'text-danger'}`}>
                    {tasaAhorro}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Neto</p>
                  <p className={`text-base font-bold ${ahorro >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(ahorro)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Próximos pagos */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Próximos pagos</h2>
              <p className="text-xs text-text-muted mt-0.5">Eventos pendientes — 7 días</p>
            </div>
            <Calendar size={15} className="text-text-muted" />
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (data?.proximosPagos?.length ?? 0) === 0 ? (
            <div className="h-32 flex items-center justify-center text-text-muted text-sm">Sin pagos próximos</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data!.proximosPagos.slice(0, 5).map((p, i) => {
                const fecha = new Date(p.fecha)
                const hoy   = new Date()
                const diff  = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000)
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="w-9 h-9 rounded-lg bg-warning/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-warning leading-none">{MESES_CORTOS[fecha.getMonth()]}</span>
                      <span className="text-sm font-bold text-warning leading-none">{fecha.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-medium truncate">{p.nombre}</p>
                      <p className="text-xs text-text-muted">en {diff} día{diff !== 1 ? 's' : ''}</p>
                    </div>
                    {Number(p.presupuestoEstimado) > 0 && (
                      <span className="text-sm font-bold text-danger flex-shrink-0">
                        -{formatCurrency(Number(p.presupuestoEstimado))}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Salud financiera */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Salud financiera</h2>
              <p className="text-xs text-text-muted mt-0.5">Indicadores del período</p>
            </div>
          </div>
          {isLoading || !health ? <Skeleton className="h-36" /> : (
            <div className="flex flex-col gap-4">
              {/* Score ring */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#ffffff0a" strokeWidth="8" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke={health.color} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(health.score / 100) * 163.4} 163.4`}
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: health.color }}>
                    {health.score}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-muted leading-relaxed">{health.label}</p>
                </div>
              </div>

              {/* Mini indicators */}
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    label: 'Ratio deuda/ingreso anual',
                    value: data!.ingresosMes > 0
                      ? `${Math.round((data!.totalDeudas / (data!.ingresosMes * 12)) * 100)}%`
                      : '—',
                    ok: data!.ingresosMes > 0 && (data!.totalDeudas / (data!.ingresosMes * 12)) < 0.3,
                  },
                  {
                    label: 'Tasa de gasto mensual',
                    value: data!.ingresosMes > 0
                      ? `${Math.round((data!.gastosMes / data!.ingresosMes) * 100)}%`
                      : '—',
                    ok: data!.ingresosMes > 0 && data!.gastosMes < data!.ingresosMes * 0.7,
                  },
                  {
                    label: 'Balance positivo',
                    value: data!.balanceTotal >= 0 ? 'Sí' : 'No',
                    ok: data!.balanceTotal >= 0,
                  },
                ].map((ind, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-text-muted truncate flex-1">{ind.label}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-semibold text-text-secondary">{ind.value}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${ind.ok ? 'bg-success' : 'bg-danger'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
