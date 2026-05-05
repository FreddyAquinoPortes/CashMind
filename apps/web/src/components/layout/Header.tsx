import { Menu, Bell, Sun, Moon, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface HeaderProps { onMenuClick: () => void }

export function Header({ onMenuClick }: HeaderProps) {
  const { user, clientes, clienteActivo, setClienteActivo, logout } = useAuthStore()
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const [menuOpen, setMenuOpen] = useState(false)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.className = next
  }

  return (
    <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-surface shrink-0">
      <button onClick={onMenuClick} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Menu">
        <Menu size={18} />
      </button>

      {clientes.length > 1 ? (
        <select value={clienteActivo?.id ?? ''} onChange={e => { const c = clientes.find(x => x.id === e.target.value); if(c) setClienteActivo(c) }}
          className="text-sm bg-surface-elevated border border-border rounded px-2 py-1 text-text-primary">
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      ) : clienteActivo && (
        <span className="text-sm text-text-secondary hidden md:block truncate max-w-[200px]">{clienteActivo.nombre}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button onClick={toggleTheme} className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="relative p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger" />
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-elevated transition-colors">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {user?.nombre?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-sm text-text-primary hidden md:block max-w-[120px] truncate">{user?.nombre}</span>
            <ChevronDown size={14} className="text-text-muted" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-xs font-medium text-text-primary truncate">{user?.nombre}</div>
                <div className="text-xs text-text-muted truncate">{user?.email}</div>
              </div>
              <button onClick={() => { logout(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-surface-elevated transition-colors">
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
