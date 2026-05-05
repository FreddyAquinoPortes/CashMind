import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { TrendingUp, TrendingDown, CreditCard, AlertCircle, ArrowUpRight } from 'lucide-react'

interface KpiCardProps {
  title: string; value: string; subtitle?: string
  icon: React.ReactNode; variant?: 'default'|'success'|'warning'|'danger'
}

function KpiCard({ title, value, subtitle, icon, variant = 'default' }: KpiCardProps) {
  const colors = { default:'text-text-primary', success:'text-success', warning:'text-warning', danger:'text-danger' }
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

export function DashboardPage() {
  const cliente = useAuthStore(s => s.clienteActivo)
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {cliente?.nombre} · {new Date().toLocaleDateString('es-DO', { month:'long', year:'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Balance"        value={formatCurrency(634.61)}   subtitle="Banreservas"           icon={<ArrowUpRight size={16}/>}  variant="warning" />
        <KpiCard title="Deuda activa"   value={formatCurrency(33593.70)} subtitle="Banco Unión + Personal" icon={<TrendingDown size={16}/>}  variant="danger"  />
        <KpiCard title="TC utilizada"   value={formatCurrency(15779.29)} subtitle="Límite DOP 15,000"     icon={<CreditCard size={16}/>}   variant="danger"  />
        <KpiCard title="Próx. pagos"    value="3"                        subtitle="Próximos 7 días"        icon={<AlertCircle size={16}/>}  variant="warning" />
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 min-h-[200px]">
          <TrendingUp size={32} className="text-text-muted opacity-30" />
          <p className="text-sm text-text-muted">Gastos por categoría</p>
          <p className="text-xs text-text-muted opacity-50">Disponible — Fase 6</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 min-h-[200px]">
          <TrendingDown size={32} className="text-text-muted opacity-30" />
          <p className="text-sm text-text-muted">Tendencia mensual</p>
          <p className="text-xs text-text-muted opacity-50">Disponible — Fase 6</p>
        </div>
      </div>

      {/* Health score */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-secondary">Salud financiera</span>
          <span className="text-xs text-warning font-mono">42 / 100</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <div className="h-full w-[42%] bg-warning rounded-full transition-all duration-500" />
        </div>
        <p className="text-xs text-text-muted mt-2">Ratio deuda/ingreso elevado. Revisa Proyecciones.</p>
      </div>
    </div>
  )
}
