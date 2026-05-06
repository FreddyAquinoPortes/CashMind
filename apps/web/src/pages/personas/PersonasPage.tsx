import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Persona, TipoPersona } from '../../lib/types'
import { PlusIcon, UserIcon, BuildingOfficeIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n)

// ── Country codes ──────────────────────────────────────────────────────────
interface Country { code: string; flag: string; name: string; nanp?: boolean }

const COUNTRY_CODES: Country[] = [
  { code: '+1',    flag: '🇩🇴', name: 'Rep. Dominicana (809/829/849)', nanp: true },
  { code: '+1',    flag: '🇺🇸', name: 'EE.UU. / Canadá', nanp: true },
  { code: '+54',   flag: '🇦🇷', name: 'Argentina' },
  { code: '+591',  flag: '🇧🇴', name: 'Bolivia' },
  { code: '+55',   flag: '🇧🇷', name: 'Brasil' },
  { code: '+56',   flag: '🇨🇱', name: 'Chile' },
  { code: '+57',   flag: '🇨🇴', name: 'Colombia' },
  { code: '+506',  flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+53',   flag: '🇨🇺', name: 'Cuba' },
  { code: '+593',  flag: '🇪🇨', name: 'Ecuador' },
  { code: '+503',  flag: '🇸🇻', name: 'El Salvador' },
  { code: '+502',  flag: '🇬🇹', name: 'Guatemala' },
  { code: '+509',  flag: '🇭🇹', name: 'Haití' },
  { code: '+504',  flag: '🇭🇳', name: 'Honduras' },
  { code: '+52',   flag: '🇲🇽', name: 'México' },
  { code: '+505',  flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+507',  flag: '🇵🇦', name: 'Panamá' },
  { code: '+595',  flag: '🇵🇾', name: 'Paraguay' },
  { code: '+51',   flag: '🇵🇪', name: 'Perú' },
  { code: '+1787', flag: '🇵🇷', name: 'Puerto Rico', nanp: true },
  { code: '+598',  flag: '🇺🇾', name: 'Uruguay' },
  { code: '+58',   flag: '🇻🇪', name: 'Venezuela' },
  { code: '+34',   flag: '🇪🇸', name: 'España' },
  { code: '+39',   flag: '🇮🇹', name: 'Italia' },
  { code: '+33',   flag: '🇫🇷', name: 'Francia' },
  { code: '+49',   flag: '🇩🇪', name: 'Alemania' },
  { code: '+44',   flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+351',  flag: '🇵🇹', name: 'Portugal' },
  { code: '+1868', flag: '🇹🇹', name: 'Trinidad y Tobago', nanp: true },
  { code: '+1876', flag: '🇯🇲', name: 'Jamaica', nanp: true },
  { code: '+1246', flag: '🇧🇧', name: 'Barbados', nanp: true },
]

const DEFAULT_COUNTRY = COUNTRY_CODES[0]!

// ── Phone formatting ───────────────────────────────────────────────────────
function fmtNANP(d: string) {
  const s = d.slice(0, 10)
  if (s.length <= 3) return `(${s}`
  if (s.length <= 6) return `(${s.slice(0,3)}) ${s.slice(3)}`
  return `(${s.slice(0,3)}) ${s.slice(3,6)}-${s.slice(6)}`
}

function fmtIntl(d: string) {
  const s = d.slice(0, 12)
  return s.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim()
}

function buildPhone(c: Country, digits: string): string | null {
  if (!digits) return null
  const display = c.nanp ? fmtNANP(digits) : fmtIntl(digits)
  return `${c.code} ${display}`
}

function parsePhone(tel: string | null): { country: Country; digits: string } {
  if (!tel) return { country: DEFAULT_COUNTRY, digits: '' }
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (tel.startsWith(c.code)) {
      return { country: c, digits: tel.slice(c.code.length).replace(/\D/g, '') }
    }
  }
  return { country: DEFAULT_COUNTRY, digits: tel.replace(/\D/g, '') }
}

// ── PhoneInput ─────────────────────────────────────────────────────────────
function PhoneInput({ country, digits, onCountryChange, onDigitsChange }: {
  country: Country; digits: string
  onCountryChange(c: Country): void; onDigitsChange(d: string): void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const list = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  )

  const rawDigits = digits.replace(/\D/g, '')
  const displayVal = country.nanp ? fmtNANP(rawDigits) : fmtIntl(rawDigits)
  const preview    = rawDigits ? `${country.code} ${displayVal}` : ''

  return (
    <div className="flex gap-2">
      {/* Country dropdown */}
      <div className="relative flex-shrink-0" ref={ref}>
        <button type="button" onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 px-3 py-2 h-[42px] rounded-lg border border-border bg-background text-sm hover:border-primary transition-colors">
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-mono text-xs text-text-muted">{country.code}</span>
          <ChevronDownIcon className="w-3 h-3 text-text-muted" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-[200] w-72 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar país…" className="input text-sm" />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {list.map((c, i) => (
                <button key={i} type="button"
                  onClick={() => { onCountryChange(c); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors
                    ${c === country ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-elevated'}`}>
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-text-muted flex-shrink-0">{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Number input */}
      <div className="flex-1 flex flex-col gap-0.5">
        <input
          type="tel"
          inputMode="numeric"
          value={displayVal}
          onChange={e => onDigitsChange(e.target.value.replace(/\D/g, ''))}
          className="input w-full"
          placeholder={country.nanp ? '(809) 000-0000' : '000 000 0000'}
        />
        {preview && (
          <span className="text-xs text-primary font-mono">{preview}</span>
        )}
      </div>
    </div>
  )
}

// ── Validation ─────────────────────────────────────────────────────────────
const NAME_RE  = /^[a-zA-ZÀ-ÿñÑ\s'-]+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface PForm {
  tipo: TipoPersona; nombre: string; apellido: string; relacion: string
  country: Country; digits: string; email: string; notas: string
}

const EMPTY_FORM: PForm = {
  tipo: 'persona', nombre: '', apellido: '', relacion: '',
  country: DEFAULT_COUNTRY, digits: '', email: '', notas: '',
}

function validate(f: PForm): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.nombre.trim())             e['nombre']   = 'El nombre es requerido'
  else if (!NAME_RE.test(f.nombre)) e['nombre']   = 'Solo letras, espacios y guiones'
  if (f.tipo === 'persona') {
    if (!f.apellido.trim())               e['apellido'] = 'El apellido es requerido'
    else if (!NAME_RE.test(f.apellido))   e['apellido'] = 'Solo letras, espacios y guiones'
  }
  if (f.email && !EMAIL_RE.test(f.email)) e['email'] = 'Formato inválido — ej: usuario@dominio.com'
  const raw = f.digits.replace(/\D/g, '')
  if (raw && f.country.nanp && raw.length !== 10) e['tel'] = 'Ingresa exactamente 10 dígitos (ej. 8094659444)'
  else if (raw && !f.country.nanp && raw.length < 6)   e['tel'] = 'Número muy corto'
  return e
}

// ── Toast / Modal ──────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success'|'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type==='success'?'bg-success text-white':'bg-danger text-white'}`}>{msg}</div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

// ── PersonaForm component ──────────────────────────────────────────────────
function PersonaForm({ initial, onSubmit, onClose, loading, serverError }: {
  initial?: PForm; onSubmit(d: PForm): void
  onClose(): void; loading: boolean; serverError?: string|null
}) {
  const [f, setF] = useState<PForm>(initial ?? EMPTY_FORM)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  const upd = <K extends keyof PForm>(k: K, v: PForm[K]) => setF(p => ({ ...p, [k]: v }))
  const txt = (k: keyof PForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => upd(k, e.target.value as any)

  useEffect(() => { if (dirty) setErrs(validate(f)) }, [f, dirty])

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setDirty(true)
    const v = validate(f); setErrs(v)
    if (Object.keys(v).length) return
    onSubmit(f)
  }

  const blockNonLetters = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1 && /[^a-zA-ZÀ-ÿñÑ\s'-]/.test(e.key)) e.preventDefault()
  }

  const Err = ({ k }: { k: string }) => errs[k]
    ? <span className="text-xs text-danger">{errs[k]}</span> : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {serverError && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{serverError}</div>
      )}

      {/* Tipo */}
      <div className="flex gap-2">
        {(['persona','entidad'] as TipoPersona[]).map(t => (
          <button key={t} type="button" onClick={() => upd('tipo', t)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${f.tipo===t?'border-primary bg-primary/10 text-primary':'border-border text-text-muted hover:border-primary/50'}`}>
            {t==='persona' ? <UserIcon className="w-4 h-4"/> : <BuildingOfficeIcon className="w-4 h-4"/>}
            {t==='persona' ? 'Persona' : 'Entidad'}
          </button>
        ))}
      </div>

      {/* Nombre + Apellido */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          {f.tipo==='persona' ? 'Nombre(s) *' : 'Nombre *'}
          <input autoFocus required value={f.nombre} onChange={txt('nombre')} onKeyDown={blockNonLetters}
            className={`input ${errs['nombre']?'border-danger':''}`}
            placeholder={f.tipo==='persona' ? 'Ej. Jhonniel' : 'Empresa XYZ'} />
          <Err k="nombre" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Apellido(s){f.tipo==='persona' ? ' *' : ''}
          <input required={f.tipo==='persona'} disabled={f.tipo!=='persona'} value={f.apellido}
            onChange={txt('apellido')} onKeyDown={blockNonLetters}
            className={`input ${errs['apellido']?'border-danger':''}`}
            placeholder={f.tipo==='persona' ? 'Ej. García' : '—'}
            style={{opacity: f.tipo==='persona'?1:0.4}} />
          <Err k="apellido" />
        </div>
      </div>

      {/* Relación */}
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Relación / Descripción
        <input value={f.relacion} onChange={txt('relacion')} className="input"
          placeholder={f.tipo==='persona' ? 'Amigo, Familiar, Socio…' : 'Proveedor, Cliente…'} />
      </div>

      {/* Teléfono */}
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Teléfono
        <PhoneInput country={f.country} digits={f.digits}
          onCountryChange={c => upd('country', c)}
          onDigitsChange={d => upd('digits', d)} />
        <Err k="tel" />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Correo electrónico
        <input type="text" value={f.email} onChange={txt('email')}
          className={`input ${errs['email']?'border-danger':''}`}
          placeholder="usuario@dominio.com" />
        <Err k="email" />
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Notas
        <textarea value={f.notas} onChange={txt('notas')} className="input resize-none" rows={2}
          placeholder="Información adicional…" />
      </div>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new'; err?: string }
  | { type: 'edit'; persona: Persona; initial: PForm; err?: string }
  | { type: 'delete'; persona: Persona }
  | null

export function PersonasPage() {
  const qc = useQueryClient()
  const { data: personas = [], isLoading } = useQuery<Persona[]>({
    queryKey: ['personas'],
    queryFn: async () => (await api.get('/personas')).data.data,
  })

  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' }|null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [search, setSearch] = useState('')

  const closeModal = () => setModal(null)
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3200)
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['personas'] })

  const toPayload = (f: PForm) => ({
    tipo: f.tipo,
    nombre: f.nombre.trim(),
    apellido: f.tipo === 'persona' ? (f.apellido.trim() || null) : null,
    relacion: f.relacion.trim() || null,
    telefono: buildPhone(f.country, f.digits.replace(/\D/g, '')),
    email: f.email.trim() || null,
    notas: f.notas.trim() || null,
  })

  const create = useMutation({
    mutationFn: (d: object) => api.post('/personas', d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Persona creada') },
    onError: (e: Error) => setModal(p => p ? { ...p, err: e.message } : p),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/personas/${id}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Actualizado') },
    onError: (e: Error) => setModal(p => p ? { ...p, err: e.message } : p),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/personas/${id}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Eliminado') },
    onError: (e: Error) => showToast(e.message, 'error'),
  })

  const openEdit = (p: Persona) => {
    const { country, digits } = parsePhone(p.telefono)
    setModal({
      type: 'edit', persona: p,
      initial: {
        tipo: p.tipo as TipoPersona, nombre: p.nombre, apellido: p.apellido ?? '',
        relacion: p.relacion ?? '', country, digits, email: p.email ?? '', notas: p.notas ?? '',
      },
    })
  }

  const filtered = personas.filter(p =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (p.relacion ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const totalDeudas = personas.reduce((s, p) => s + p.balanceTotal, 0)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast {...toast} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Personas y Entidades</h1>
          <p className="text-text-muted text-sm mt-0.5">Contactos asociados a deudas y transacciones</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nueva persona
        </button>
      </div>

      {personas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total contactos</p>
            <p className="text-xl font-bold text-text-primary">{personas.length}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Personas</p>
            <p className="text-xl font-bold text-text-primary">{personas.filter(p => p.tipo==='persona').length}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Deudas activas</p>
            <p className="text-xl font-bold text-warning">{fmtMoney(totalDeudas)}</p>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} className="input"
        placeholder="Buscar persona o entidad…" />

      {isLoading && <div className="flex items-center justify-center h-32 text-text-muted text-sm">Cargando…</div>}

      <div className="flex flex-col gap-3">
        {filtered.map(p => {
          const isPersona = p.tipo === 'persona'
          const Ico = isPersona ? UserIcon : BuildingOfficeIcon
          return (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                <Ico className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{p.displayName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                    ${isPersona?'bg-primary/10 text-primary':'bg-warning/10 text-warning'}`}>
                    {isPersona ? 'Persona' : 'Entidad'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {p.relacion && <span className="text-xs text-text-muted">{p.relacion}</span>}
                  {p.telefono && <span className="text-xs text-text-muted font-mono">{p.telefono}</span>}
                  {p.email && <span className="text-xs text-text-muted">{p.email}</span>}
                </div>
              </div>
              {p.balanceTotal > 0 && (
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-text-muted">Deuda activa</div>
                  <div className="font-semibold text-danger text-sm">{fmtMoney(p.balanceTotal)}</div>
                </div>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(p)}
                  className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">✏</button>
                <button onClick={() => setModal({ type: 'delete', persona: p })}
                  className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="text-center text-text-muted py-16 text-sm">
          <UserIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search ? 'Sin resultados' : 'No hay personas ni entidades registradas'}</p>
          {!search && (
            <button onClick={() => setModal({ type: 'new' })} className="btn-primary mt-4">
              + Añadir primera persona
            </button>
          )}
        </div>
      )}

      {modal?.type === 'new' && (
        <Modal title="Nueva persona / entidad" onClose={closeModal}>
          <PersonaForm onClose={closeModal} loading={create.isPending} serverError={modal.err}
            onSubmit={f => create.mutate(toPayload(f))} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar persona / entidad" onClose={closeModal}>
          <PersonaForm initial={modal.initial} onClose={closeModal} loading={update.isPending}
            serverError={modal.err}
            onSubmit={f => update.mutate({ id: modal.persona.id, d: toPayload(f) })} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar contacto" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Eliminar <strong className="text-text-primary">{modal.persona.displayName}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.persona.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
