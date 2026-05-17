/**
 * TwoFactorPage — Solicita el código TOTP (o backup code) después del login.
 * Usa el mfaToken temporal guardado en el store.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Loader2, ShieldCheck, Key } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function TwoFactorPage() {
  const navigate        = useNavigate()
  const mfaToken        = useAuthStore(s => s.mfaToken)
  const clearMfaToken   = useAuthStore(s => s.clearMfaToken)
  const setAuth         = useAuthStore(s => s.setAuth)

  const [code,        setCode]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [useBackup,   setUseBackup]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Redirigir si no hay token MFA (acceso directo a la ruta)
  useEffect(() => {
    if (!mfaToken) navigate('/login', { replace: true })
  }, [mfaToken, navigate])

  useEffect(() => {
    inputRef.current?.focus()
  }, [useBackup])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaToken) return
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-mfa', { mfaToken, code })
      clearMfaToken()
      setAuth(data.data)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Código incorrecto')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit al completar 6 dígitos TOTP
  function handleCodeChange(val: string) {
    const clean = useBackup
      ? val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
      : val.replace(/\D/g, '').slice(0, 6)
    setCode(clean)
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
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              {useBackup ? <Key size={18} className="text-primary" /> : <ShieldCheck size={18} className="text-primary" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {useBackup ? 'Código de respaldo' : 'Verificación en dos pasos'}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {useBackup
                  ? 'Ingresa uno de tus códigos de respaldo'
                  : 'Ingresa el código de tu app autenticadora'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                {useBackup ? 'Código de respaldo (8 caracteres)' : 'Código TOTP (6 dígitos)'}
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode={useBackup ? 'text' : 'numeric'}
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder={useBackup ? 'XXXXXXXX' : '000000'}
                required
                disabled={loading}
                className={cn(
                  'w-full px-3 py-3 rounded-md text-center text-xl font-bold tracking-widest tabular-nums',
                  'bg-background border border-border text-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors',
                  'disabled:opacity-50'
                )}
              />
            </div>

            {error && (
              <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (useBackup ? code.length < 8 : code.length < 6)}
              className={cn(
                'w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                'hover:bg-primary-hover transition-colors',
                'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2'
              )}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </form>

          {/* Toggle backup code */}
          <button
            type="button"
            onClick={() => { setUseBackup(u => !u); setCode(''); setError(null) }}
            className="w-full mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {useBackup ? 'Usar código de autenticadora' : 'Usar código de respaldo'}
          </button>
        </div>

        <button
          onClick={() => { clearMfaToken(); navigate('/login') }}
          className="block text-center text-xs text-text-muted hover:text-text-secondary transition-colors mt-4 mx-auto"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )
}
