import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import type { TarjetaCredito, Franquicia, TipoTarjeta, CategoriaTarjeta } from '../../lib/types'
import { BANCOS_RD, FRANQUICIAS, TIPOS_TARJETA, CATEGORIAS_TARJETA, MONEDAS } from '../../lib/constants'
import { PlusIcon, CreditCardIcon } from '@heroicons/react/24/outline'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: string | number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(parseFloat(String(n)))

const FRANQ_COLORS: Record<string, string> = {
  VISA: '#1a1f71', MASTERCARD: '#eb001b', AMEX: '#007bc1', DISCOVER: '#ff6600',
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
      {msg}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

// ── Form ───────────────────────────────────────────────────────────────────
interface TarjetaForm {
  alias: string; banco: string; ultimosCuatro: string
  franquicia: Franquicia | ''; tipoTarjeta: TipoTarjeta | ''; categoriaTarjeta: CategoriaTarjeta | ''
  limite: string; saldoActual: string; tasaInteres: string
  diaCorte: string; diaPago: string; moneda: string; activa: boolean
}

const EMPTY: TarjetaForm = {
  alias: '', banco: '', ultimosCuatro: '', franquicia: '', tipoTarjeta: 'CREDITO', categoriaTarjeta: '',
  limite: '0', saldoActual: '0', tasaInteres: '0', diaCorte: '1', diaPago: '15', moneda: 'DOP', activa: true,
}

function TarjetaFormPanel({
  initial, onSubmit, onClose, loading, error,
}: {
  initial?: TarjetaForm; onSubmit(d: TarjetaForm): void
  onClose(): void; loading: boolean; error?: string | null
}) {
  const [form, setForm] = useState<TarjetaForm>(initial ?? EMPTY)
  const set = (k: keyof TarjetaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre / Alias *
        <input required value={form.alias} onChange={set('alias')} className="input" placeholder="Ej. Visa Oro Popular" autoFocus />
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Banco *
        <select required value={form.banco} onChange={set('banco')} className="input">
          <option value="">— Seleccionar banco —</option>
          {BANCOS_RD.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Últimos 4 dígitos *
        <input required maxLength={4} pattern="\d{4}" value={form.ultimosCuatro} onChange={set('ultimosCuatro')}
          className="input" placeholder="1234" />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Franquicia
          <select value={form.franquicia} onChange={set('franquicia')} className="input">
            <option value="">—</option>
            {FRANQUICIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo
          <select value={form.tipoTarjeta} onChange={set('tipoTarjeta')} className="input">
            <option value="">—</option>
            {TIPOS_TARJETA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Categoría
          <select value={form.categoriaTarjeta} onChange={set('categoriaTarjeta')} className="input">
            <option value="">—</option>
            {CATEGORIAS_TARJETA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Límite de crédito
          <input type="number" step="0.01" min="0" value={form.limite} onChange={set('limite')} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Saldo actual
          <input type="number" step="0.01" min="0" value={form.saldoActual} onChange={set('saldoActual')} className="input" />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tasa interés %
          <input type="number" step="0.01" min="0" max="100" value={form.tasaInteres} onChange={set('tasaInteres')} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Día de corte
          <input type="number" min="1" max="31" value={form.diaCorte} onChange={set('diaCorte')} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Día de pago
          <input type="number" min="1" max="31" value={form.diaPago} onChange={set('diaPago')} className="input" />
        </label>
      </div>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────
function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
  return (
    <div className="w-full bg-border rounded-full h-1.5 mt-2">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new'; error?: string }
  | { type: 'edit'; tarjeta: TarjetaCredito; error?: string }
  | { type: 'delete'; tarjeta: TarjetaCredito }
  | null

export function TarjetasPage() {
  const qc = useQueryClient()
  const cid = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const { data: tarjetas = [], isLoading } = useQuery<TarjetaCredito[]>({
    queryKey: ['tarjetas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/tarjetas`)).data.data,
    enabled: !!cid,
  })

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const closeModal = () => setModal(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tarjetas', cid] })

  const toPayload = (d: TarjetaForm) => ({
    ...d,
    franquicia: d.franquicia || null,
    tipoTarjeta: d.tipoTarjeta || null,
    categoriaTarjeta: d.categoriaTarjeta || null,
    limite: parseFloat(d.limite),
    saldoActual: parseFloat(d.saldoActual),
    tasaInteres: parseFloat(d.tasaInteres),
    diaCorte: parseInt(d.diaCorte),
    diaPago: parseInt(d.diaPago),
  })

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/tarjetas`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta creada') },
    onError: (e: Error) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error') },
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/tarjetas/${id}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta actualizada') },
    onError: (e: Error) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error') },
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/tarjetas/${id}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta eliminada') },
    onError: (e: Error) => { showToast(e.message, 'error') },
  })

  const totalDeuda = tarjetas.reduce((s, t) => s + parseFloat(String(t.saldoActual)), 0)
  const totalLimite = tarjetas.reduce((s, t) => s + parseFloat(String(t.limite)), 0)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast {...toast} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tarjetas</h1>
          <p className="text-text-muted text-sm mt-0.5">Tus tarjetas de crédito y débito</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nueva tarjeta
        </button>
      </div>

      {tarjetas.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Deuda total</p>
            <p className="text-xl font-bold text-danger">{fmt(totalDeuda)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Límite total</p>
            <p className="text-xl font-bold text-text-primary">{fmt(totalLimite)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Disponible</p>
            <p className="text-xl font-bold text-success">{fmt(Math.max(0, totalLimite - totalDeuda))}</p>
          </div>
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center h-32 text-text-muted text-sm">Cargando…</div>}

      <div className="flex flex-col gap-3">
        {tarjetas.map(t => {
          const color = FRANQ_COLORS[t.franquicia ?? ''] ?? '#6366f1'
          const util = typeof t.utilizacion === 'number' ? t.utilizacion : 0
          return (
            <div key={t.id} className="bg-surface border border-border rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: color + '22' }}>
                <CreditCardIcon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{t.alias ?? `····${t.ultimosCuatro}`}</span>
                  {t.franquicia && <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{t.franquicia}</span>}
                  {t.categoriaTarjeta && <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{t.categoriaTarjeta}</span>}
                  {!t.activa && <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">Inactiva</span>}
                </div>
                <div className="text-xs text-text-muted mt-0.5">{t.banco} · ····{t.ultimosCuatro}</div>
                <UtilBar pct={util} />
                <div className="flex items-center justify-between text-xs text-text-muted mt-1">
                  <span>Usado: {fmt(t.saldoActual)}</span>
                  <span>{util}% de {fmt(t.limite)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setModal({ type: 'edit', tarjeta: t })}
                  className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">✏</button>
                <button onClick={() => setModal({ type: 'delete', tarjeta: t })}
                  className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && tarjetas.length === 0 && (
        <div className="text-center text-text-muted py-16 text-sm">
          <CreditCardIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tienes tarjetas registradas</p>
          <button onClick={() => setModal({ type: 'new' })} className="btn-primary mt-4">+ Añadir primera tarjeta</button>
        </div>
      )}

      {modal?.type === 'new' && (
        <Modal title="Nueva tarjeta" onClose={closeModal}>
          <TarjetaFormPanel onClose={closeModal} loading={create.isPending} error={modal.error}
            onSubmit={d => create.mutate(toPayload(d))} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar tarjeta" onClose={closeModal}>
          <TarjetaFormPanel
            initial={{
              alias: modal.tarjeta.alias ?? '', banco: modal.tarjeta.banco,
              ultimosCuatro: modal.tarjeta.ultimosCuatro,
              franquicia: (modal.tarjeta.franquicia ?? '') as Franquicia | '',
              tipoTarjeta: (modal.tarjeta.tipoTarjeta ?? '') as TipoTarjeta | '',
              categoriaTarjeta: (modal.tarjeta.categoriaTarjeta ?? '') as CategoriaTarjeta | '',
              limite: String(modal.tarjeta.limite), saldoActual: String(modal.tarjeta.saldoActual),
              tasaInteres: String(modal.tarjeta.tasaInteres), diaCorte: String(modal.tarjeta.diaCorte),
              diaPago: String(modal.tarjeta.diaPago), moneda: modal.tarjeta.moneda, activa: modal.tarjeta.activa,
            }}
            onClose={closeModal} loading={update.isPending} error={modal.error}
            onSubmit={d => update.mutate({ id: modal.tarjeta.id, d: toPayload(d) })} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar tarjeta" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Eliminar <strong className="text-text-primary">{modal.tarjeta.alias ?? `····${modal.tarjeta.ultimosCuatro}`}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.tarjeta.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
