import { usePreferenciasStore, type PrecisionDecimal, type FormatoFecha } from '../../store/preferencias.store'
import { useFmt } from '../../lib/useFmt'
import {
  Hash, Eye, EyeOff, Calendar, AlignJustify,
  BarChart2, RotateCcw, Check, DollarSign, Type
} from 'lucide-react'

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

      {/* Footer info */}
      <p className="text-xs text-text-muted text-center pb-4">
        Todos los ajustes se guardan localmente en tu dispositivo · No afectan la base de datos
      </p>
    </div>
  )
}
