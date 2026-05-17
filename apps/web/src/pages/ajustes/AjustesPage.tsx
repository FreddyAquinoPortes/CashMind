import { useState } from 'react'
import { usePreferenciasStore, type PrecisionDecimal, type FormatoFecha } from '../../store/preferencias.store'
import { useFmt } from '../../lib/useFmt'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../lib/api'
import {
  Hash, Eye, EyeOff, Calendar, AlignJustify,
  BarChart2, RotateCcw, Check, Shield, Loader2, Copy, CheckCheck
} from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Helpers UI ─────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <Icon size={15} className="text-primary" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  )
}

function Row({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange(v: boolean): void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${value ? 'bg-primary' : 'bg-border'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
        ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Chips<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange(v: T): void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap justify-end">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition-colors
            ${value === o.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-text-muted hover:border-primary/40'}`}
        >
          {value === o.value && <Check size={11} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Preview ────────────────────────────────────────────────────────────────
function Preview() {
  const fmt = useFmt()
  const SAMPLE_VALS = [
    { label: 'Transacción',  v: 1234.56,    isTotal: false },
    { label: 'Total ingresos', v: 45678.90, isTotal: true  },
    { label: 'Saldo cuenta',   v: 999.00,   isTotal: false },
    { label: 'Disponible',     v: 7500,     isTotal: true  },
  ]
  return (
    <div className="bg-background/60 rounded-xl border border-border/60 overflow-hidden">
      <p className="text-xs text-text-muted px-4 py-2.5 border-b border-border/60 font-medium uppercase tracking-wider">
        Vista previa
      </p>
      <div className="divide-y divide-border/40">
        {SAMPLE_VALS.map(s => (
          <div key={s.label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-text-muted">{s.label}</span>
            <span className={`text-sm font-semibold tabular-nums ${s.isTotal ? 'text-primary' : 'text-text-primary'}`}>
              {fmt(s.v, s.isTotal)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sección 2FA ───────────────────────────────────────────────────────────
type MfaStep = 'idle' | 'setup' | 'confirm' | 'backupCodes' | 'disabling'

function SecuritySection() {
  const user = useAuthStore(s => s.user)
  const [mfaEnabled, setMfaEnabled] = useState(false) // Se cargaría del perfil real
  const [step, setStep]           = useState<MfaStep>('idle')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret]       = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)

  if (!user) return null

  async function handleEnableMfa() {
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.get('/auth/mfa/setup')
      setQrDataUrl(data.data.qrDataUrl)
      setSecret(data.data.secret)
      setStep('setup')
    } catch {
      setError('Error al iniciar configuración de 2FA')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmMfa(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/mfa/confirm', { code: confirmCode, secret })
      setBackupCodes(data.data.backupCodes)
      setMfaEnabled(true)
      setStep('backupCodes')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.delete('/auth/mfa', { data: { code: disableCode } })
      setMfaEnabled(false)
      setStep('idle')
      setDisableCode('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputCls = cn(
    'w-full px-3 py-2 rounded-md text-sm bg-background border border-border',
    'text-text-primary placeholder:text-text-muted',
    'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors'
  )

  return (
    <Section title="Seguridad" icon={Shield}>
      <Row label="Verificación en dos pasos (2FA)"
        description={mfaEnabled ? 'Activo — se requiere código TOTP al iniciar sesión' : 'Agrega una capa extra de seguridad a tu cuenta'}>
        <Toggle value={mfaEnabled} onChange={v => {
          if (v) { handleEnableMfa() }
          else { setStep('disabling'); setError(null) }
        }} />
      </Row>

      {/* Setup: mostrar QR */}
      {step === 'setup' && (
        <div className="px-5 pb-5 space-y-4">
          <p className="text-xs text-text-muted">
            Escanea este código QR con tu app autenticadora (Google Authenticator, Authy, etc.)
          </p>
          {qrDataUrl && (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="QR 2FA" className="w-48 h-48 rounded-lg border border-border" />
            </div>
          )}
          <p className="text-xs text-text-muted text-center">
            O ingresa manualmente: <code className="bg-background px-1 py-0.5 rounded text-primary text-xs font-mono">{secret}</code>
          </p>
          <form onSubmit={handleConfirmMfa} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary">Código de confirmación</label>
              <input type="text" inputMode="numeric" maxLength={6} value={confirmCode}
                onChange={e => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required className={cn(inputCls, 'text-center text-lg font-bold tracking-widest mt-1')} />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep('idle'); setError(null) }}
                className="flex-1 py-2 rounded-lg text-xs text-text-muted border border-border hover:border-border/70 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading || confirmCode.length < 6}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                {loading && <Loader2 size={12} className="animate-spin" />}
                Activar 2FA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Backup codes */}
      {step === 'backupCodes' && (
        <div className="px-5 pb-5 space-y-3">
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-xs font-medium text-warning mb-1">Guarda estos códigos ahora</p>
            <p className="text-xs text-text-muted">Son de un solo uso y no se mostrarán de nuevo. Úsalos si pierdes acceso a tu autenticadora.</p>
          </div>
          <div className="bg-background border border-border rounded-lg p-3 font-mono text-sm grid grid-cols-2 gap-1">
            {backupCodes.map(c => (
              <span key={c} className="text-text-primary text-xs">{c}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={copyBackupCodes}
              className="flex-1 py-2 rounded-lg text-xs text-text-muted border border-border hover:border-primary/40 flex items-center justify-center gap-1.5 transition-colors">
              {copied ? <CheckCheck size={12} className="text-success" /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button onClick={() => setStep('idle')}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors">
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Deshabilitar */}
      {step === 'disabling' && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-xs text-text-muted">Ingresa tu código TOTP para confirmar que deseas deshabilitar el 2FA.</p>
          <form onSubmit={handleDisableMfa} className="space-y-3">
            <input type="text" inputMode="numeric" maxLength={6} value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" required className={cn(inputCls, 'text-center text-lg font-bold tracking-widest')} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep('idle'); setError(null) }}
                className="flex-1 py-2 rounded-lg text-xs text-text-muted border border-border hover:border-border/70 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading || disableCode.length < 6}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-danger text-white hover:bg-danger/80 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                {loading && <Loader2 size={12} className="animate-spin" />}
                Deshabilitar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && step === 'idle' && (
        <div className="px-5 pb-4 flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin" /> Cargando...
        </div>
      )}
      {error && step === 'idle' && (
        <div className="px-5 pb-4 text-xs text-danger">{error}</div>
      )}
    </Section>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AjustesPage() {
  const prefs = usePreferenciasStore()
  const set   = prefs.set

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Ajustes</h1>
          <p className="text-text-muted text-sm mt-0.5">Personaliza la visualización de la app</p>
        </div>
        <button
          onClick={() => { if (confirm('¿Restaurar todos los ajustes a sus valores por defecto?')) prefs.reset() }}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-danger transition-colors border border-border rounded-lg px-3 py-2"
        >
          <RotateCcw size={13} /> Restaurar
        </button>
      </div>

      {/* ── Sección: Formato de montos ─────────────────────────────────── */}
      <Section title="Formato de montos" icon={Hash}>
        <Row
          label="Precisión decimal"
          description="Cuándo mostrar los centavos (.00) en los montos"
        >
          <Chips<PrecisionDecimal>
            value={prefs.precisionDecimal}
            onChange={v => set('precisionDecimal', v)}
            options={[
              { value: 'siempre',      label: 'Siempre' },
              { value: 'solo_totales', label: 'Solo totales' },
              { value: 'nunca',        label: 'Nunca' },
            ]}
          />
        </Row>

        <Row
          label="Mostrar símbolo de moneda"
          description="Mostrar RD$, USD, EUR antes de los valores"
        >
          <Toggle value={prefs.mostrarSimbolo} onChange={v => set('mostrarSimbolo', v)} />
        </Row>

        <Row
          label="Moneda de visualización"
          description="Solo afecta el símbolo mostrado, no convierte valores"
        >
          <Chips<string>
            value={prefs.monedaVista}
            onChange={v => set('monedaVista', v)}
            options={[
              { value: 'DOP', label: 'DOP' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
            ]}
          />
        </Row>

        <Row label="" >
          <div className="w-72">
            <Preview />
          </div>
        </Row>
      </Section>

      {/* ── Sección: Privacidad visual ─────────────────────────────────── */}
      <Section title="Privacidad visual" icon={EyeOff}>
        <Row
          label="Ocultar montos sensibles"
          description="Reemplaza todos los valores con •••• (útil al compartir pantalla)"
        >
          <Toggle value={prefs.mostrarSaldoOculto} onChange={v => set('mostrarSaldoOculto', v)} />
        </Row>
      </Section>

      {/* ── Sección: Fechas ────────────────────────────────────────────── */}
      <Section title="Formato de fechas" icon={Calendar}>
        <Row
          label="Formato"
          description="Cómo se muestran las fechas en toda la app"
        >
          <Chips<FormatoFecha>
            value={prefs.formatoFecha}
            onChange={v => set('formatoFecha', v)}
            options={[
              { value: 'dd/mm/yyyy', label: 'DD/MM/AAAA' },
              { value: 'mm/dd/yyyy', label: 'MM/DD/AAAA' },
              { value: 'relativo',   label: 'Relativo' },
            ]}
          />
        </Row>
      </Section>

      {/* ── Sección: Listas y tablas ───────────────────────────────────── */}
      <Section title="Listas y tablas" icon={AlignJustify}>
        <Row
          label="Filas por página"
          description="Cantidad de registros visibles por defecto en tablas"
        >
          <Chips<10 | 25 | 50>
            value={prefs.filasPorPagina}
            onChange={v => set('filasPorPagina', v)}
            options={[
              { value: 10, label: '10' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
            ]}
          />
        </Row>
      </Section>

      {/* ── Sección: Dashboard ─────────────────────────────────────────── */}
      <Section title="Dashboard y gráficos" icon={BarChart2}>
        <Row
          label="Animaciones en gráficos"
          description="Desactiva si notas lentitud al cargar el dashboard"
        >
          <Toggle value={prefs.animacionesGraficos} onChange={v => set('animacionesGraficos', v)} />
        </Row>
      </Section>

      {/* ── Sección: Seguridad ─────────────────────────────────────────── */}
      <SecuritySection />

      {/* Footer info */}
      <p className="text-xs text-text-muted text-center pb-4">
        Todos los ajustes se guardan localmente en tu dispositivo · No afectan la base de datos
      </p>
    </div>
  )
}
