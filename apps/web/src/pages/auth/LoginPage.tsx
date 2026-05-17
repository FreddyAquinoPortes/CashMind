import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Eye, EyeOff, Loader2, Mail, AlertTriangle } from 'lucide-react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Tab = 'login' | 'register'
type FlowState = 'form' | 'emailSent' | 'needsLink'

interface NeedsLinkState {
  googleEmail: string
  googleName: string | null
  googleId: string
}

export function LoginPage() {
  const navigate   = useNavigate()
  const setAuth    = useAuthStore(s => s.setAuth)
  const setMfaToken = useAuthStore(s => s.setMfaToken)

  const [tab, setTab]   = useState<Tab>('login')
  const [flow, setFlow] = useState<FlowState>('form')
  const [linkState, setLinkState] = useState<NeedsLinkState | null>(null)

  // Form fields
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [nombre,   setNombre]   = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [linkPwd,  setLinkPwd]  = useState('')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [activeSessions, setActiveSessions] = useState(0)

  function clearError() { setError(null) }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const result = data.data

      if (result.mfaRequired) {
        setMfaToken(result.mfaToken)
        navigate('/2fa')
        return
      }

      if (result.activeSessions > 1) {
        setActiveSessions(result.activeSessions - 1)
      }
      setAuth(result)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      await api.post('/auth/register', { email, password, nombre })
      setFlow('emailSent')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return
    clearError()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/google', { idToken: credentialResponse.credential })
      const result = data.data

      if (result.needsLink) {
        setLinkState({ googleEmail: result.googleEmail, googleName: result.googleName, googleId: result.googleId })
        setFlow('needsLink')
        return
      }

      if (result.mfaRequired) {
        setMfaToken(result.mfaToken)
        navigate('/2fa')
        return
      }

      setAuth(result)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error con Google')
    } finally {
      setLoading(false)
    }
  }

  async function handleLinkGoogle(e: React.FormEvent) {
    e.preventDefault()
    if (!linkState) return
    clearError()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/google/link', {
        googleId: linkState.googleId,
        googleEmail: linkState.googleEmail,
        googleName: linkState.googleName,
        password: linkPwd,
      })
      setAuth(data.data)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al vincular cuenta')
    } finally {
      setLoading(false)
    }
  }

  // ── Render: Email enviado ─────────────────────────────────────────────────
  if (flow === 'emailSent') {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Mail size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Revisa tu correo</h2>
            <p className="text-sm text-text-muted mt-1">
              Enviamos un código de verificación a <strong className="text-text-secondary">{email}</strong>.
            </p>
            <p className="text-xs text-text-muted mt-2">El código expira en 10 minutos.</p>
          </div>
          <button
            onClick={() => navigate('/verify-email')}
            className="w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            Ingresar código
          </button>
          <button
            onClick={() => { setFlow('form'); setTab('register') }}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Volver
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ── Render: Vincular Google ───────────────────────────────────────────────
  if (flow === 'needsLink' && linkState) {
    return (
      <AuthLayout>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Cuenta existente</p>
              <p className="text-xs text-text-muted mt-0.5">
                Ya existe una cuenta con el correo <strong>{linkState.googleEmail}</strong>.
                Ingresa tu contraseña para vincular Google.
              </p>
            </div>
          </div>
          <form onSubmit={handleLinkGoogle} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Contraseña de tu cuenta</label>
              <input
                type="password"
                value={linkPwd}
                onChange={e => setLinkPwd(e.target.value)}
                required
                placeholder="Tu contraseña actual"
                className={inputCls}
              />
            </div>
            {error && <ErrorBox message={error} />}
            <button type="submit" disabled={loading} className={submitCls}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Vinculando...' : 'Vincular con Google'}
            </button>
          </form>
          <button
            onClick={() => { setFlow('form'); setLinkState(null); clearError() }}
            className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancelar
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ── Render: Form principal ────────────────────────────────────────────────
  return (
    <AuthLayout>
      {/* Aviso de sesiones múltiples */}
      {activeSessions > 0 && (
        <div className="flex items-start gap-3 p-3 mb-4 bg-warning/10 border border-warning/20 rounded-lg">
          <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted">
            Tienes {activeSessions} {activeSessions === 1 ? 'sesión activa' : 'sesiones activas'} en otros dispositivos.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-lg bg-background border border-border p-1 mb-5">
        {(['login', 'register'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); clearError(); setActiveSessions(0) }}
            className={cn(
              'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
              tab === t
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
          </button>
        ))}
      </div>

      {/* Google button */}
      <div className="flex justify-center mb-4">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Error al iniciar con Google')}
          useOneTap={false}
          theme="filled_black"
          shape="rectangular"
          size="large"
          text={tab === 'login' ? 'signin_with' : 'signup_with'}
        />
      </div>

      {/* Separator */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">o</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Email / password form */}
      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <Field label="Correo electrónico" htmlFor="email">
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
              autoComplete="email" className={inputCls} />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <PasswordInput value={password} onChange={setPassword} showPwd={showPwd} onToggle={() => setShowPwd(p => !p)} />
          </Field>
          {error && <ErrorBox message={error} />}
          <button type="submit" disabled={loading} className={submitCls}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <Field label="Nombre" htmlFor="nombre">
            <input id="nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} required
              autoComplete="name" className={inputCls} />
          </Field>
          <Field label="Correo electrónico" htmlFor="email">
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
              autoComplete="email" className={inputCls} />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <PasswordInput value={password} onChange={setPassword} showPwd={showPwd} onToggle={() => setShowPwd(p => !p)} />
          </Field>
          {error && <ErrorBox message={error} />}
          <button type="submit" disabled={loading} className={submitCls}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────
function AuthLayout({ children }: { children: React.ReactNode }) {
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
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20">
            <DollarSign size={28} strokeWidth={2} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">CashMind</h1>
          <p className="text-sm text-text-muted mt-1">Tu sistema de finanzas personales</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">{children}</div>
        <p className="text-center text-xs text-text-muted mt-6">v0.1.0 · Datos 100% locales</p>
      </div>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

function PasswordInput({ value, onChange, showPwd, onToggle }: {
  value: string; onChange: (v: string) => void; showPwd: boolean; onToggle: () => void
}) {
  return (
    <div className="relative">
      <input id="password" type={showPwd ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)} required autoComplete="current-password"
        className={cn(inputCls, 'pr-9')} />
      <button type="button" onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
      {message}
    </div>
  )
}

const inputCls = cn(
  'w-full px-3 py-2 rounded-md text-sm bg-background border border-border',
  'text-text-primary placeholder:text-text-muted',
  'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors'
)

const submitCls = cn(
  'w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground',
  'hover:bg-primary-hover active:bg-primary-active transition-colors',
  'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2'
)
