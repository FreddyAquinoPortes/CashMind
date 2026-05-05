import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, Building2, CreditCard,
  TrendingDown, Users, Calendar, Fuel, PieChart,
  LineChart, FileBarChart2, Upload, Settings, X, DollarSign
} from 'lucide-react'

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',    exact: true },
  { to: '/transacciones',icon: ArrowLeftRight,  label: 'Transacciones' },
  { to: '/cuentas',      icon: Building2,       label: 'Cuentas' },
  { to: '/tarjetas',     icon: CreditCard,      label: 'Tarjetas' },
  { to: '/deudas',       icon: TrendingDown,    label: 'Deudas' },
  { to: '/personas',     icon: Users,           label: 'Personas' },
  { to: '/eventos',      icon: Calendar,        label: 'Eventos' },
  { to: '/combustible',  icon: Fuel,            label: 'Combustible' },
  { to: '/presupuestos', icon: PieChart,        label: 'Presupuestos' },
  { to: '/proyecciones', icon: LineChart,       label: 'Proyecciones' },
  { to: '/reportes',     icon: FileBarChart2,   label: 'Reportes' },
  { to: '/importacion',  icon: Upload,          label: 'Importación' },
  { to: '/ajustes',      icon: Settings,        label: 'Ajustes' },
]

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={onClose} />}
      <aside className={cn(
        'flex flex-col bg-surface border-r border-border z-30',
        'transition-all duration-200 ease-out',
        'fixed md:relative inset-y-0 left-0',
        open ? 'w-60 translate-x-0' : 'w-0 md:w-16 -translate-x-full md:translate-x-0',
        'overflow-hidden'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground shrink-0">
            <DollarSign size={16} strokeWidth={2.5} />
          </div>
          {open && <span className="font-semibold text-text-primary text-base tracking-tight whitespace-nowrap">CashMind</span>}
          <button onClick={onClose} className="ml-auto md:hidden text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-elevated',
                isActive ? 'text-primary bg-surface-elevated border-r-2 border-primary font-medium' : 'text-text-secondary'
              )}>
              <item.icon size={16} className="shrink-0" />
              {open && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        {open && <div className="px-4 py-3 border-t border-border text-xs text-text-muted">v0.1.0</div>}
      </aside>
    </>
  )
}
