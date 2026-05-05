import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail]       = useState('freddy@cashmind.local')
  const [password, setPassword] = useState('CashMind2026!')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.data)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--border)) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--border)) 1px,transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20">
            <DollarSign size={28} strokeWidth={2} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">CashMind</h1>
          <p className="text-sm text-text-muted mt-1">Tu sistema de finanzas personales</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-text-primary mb-5">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary" htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className={cn('w-full px-3 py-2 rounded-md text-sm bg-background border border-border',
                  'text-text-primary placeholder:text-text-muted',
                  'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary" htmlFor="password">Contraseña</label>
              <div className="relative">
                <input id="password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  className={cn('w-full px-3 py-2 pr-9 rounded-md text-sm bg-background border border-border',
                    'text-text-primary placeholder:text-text-muted',
                    'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors')} />
                <button type="button" onClick={() => setShowPwd(o => !o)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className={cn('w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                'hover:bg-primary-hover active:bg-primary-active transition-colors',
                'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2')}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-text-muted mt-6">v0.1.0 · Datos 100% locales</p>
      </div>
    </div>
  )
}
