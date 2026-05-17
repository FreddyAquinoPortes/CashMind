/**
 * VerifyEmailPage — 6 inputs OTP estilo para ingresar el código de verificación.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Loader2, MailCheck, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const CODE_LENGTH = 6

export function VerifyEmailPage() {
  const navigate  = useNavigate()
  const setAuth   = useAuthStore(s => s.setAuth)

  const [digits,   setDigits]   = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendOk,  setResendOk]  = useState(false)
  const [cooldown,  setCooldown]  = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Focus primer input al montar
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cooldown de reenvío
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function handleChange(index: number, value: string) {
    // Aceptar solo dígitos
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit si todos los campos están llenos
    if (digit && index === CODE_LENGTH - 1) {
      const full = next.join('')
      if (full.length === CODE_LENGTH) {
        submitCode(full)
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    const next = [...digits]
    pasted.split('').forEach((d, i) => { next[i] = d })
    setDigits(next)
    // Focus al último campo pegado
    const lastIdx = Math.min(pasted.length, CODE_LENGTH - 1)
    inputRefs.current[lastIdx]?.focus()
    if (pasted.length === CODE_LENGTH) submitCode(pasted)
  }

  async function submitCode(code: string) {
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-email', { token: code })
      setAuth(data.data)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Código incorrecto o expirado')
      // Limpiar inputs ante error
      setDigits(Array(CODE_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    setResending(true)
    setResendOk(false)
    try {
      // El backend necesita el email — si no lo tenemos, redirigir a login
      const email = localStorage.getItem('cm_pending_email') ?? ''
      await api.post('/auth/verify-email/resend', { email })
      setResendOk(true)
      setCooldown(60)
    } catch {
      setError('No se pudo reenviar el código')
    } finally {
      setResending(false)
    }
  }

  const code = digits.join('')

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
              <MailCheck size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Verifica tu correo</h2>
              <p className="text-xs text-text-muted mt-0.5">Ingresa el código de 6 dígitos que enviamos</p>
            </div>
          </div>

          {/* OTP inputs */}
          <div className="flex gap-2 justify-center mb-5" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
                className={cn(
                  'w-11 h-12 rounded-lg border text-center text-lg font-bold tabular-nums',
                  'bg-background text-text-primary transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                  d ? 'border-primary/60' : 'border-border',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              />
            ))}
          </div>

          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2 mb-4">
              {error}
            </div>
          )}

          {resendOk && (
            <div className="text-xs text-success bg-success/10 border border-success/20 rounded-md px-3 py-2 mb-4">
              Código reenviado. Revisa tu correo.
            </div>
          )}

          {/* Submit manual */}
          <button
            onClick={() => submitCode(code)}
            disabled={loading || code.length < CODE_LENGTH}
            className={cn(
              'w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary-hover transition-colors',
              'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4'
            )}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          {/* Reenviar */}
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text-secondary disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
            {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
          </button>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="block text-center text-xs text-text-muted hover:text-text-secondary transition-colors mt-4 mx-auto"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )
}
