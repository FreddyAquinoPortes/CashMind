import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { CuentaBancaria, TipoCuenta } from '../../lib/types'
import { BANCOS_RD, TIPOS_CUENTA, MONEDAS } from '../../lib/constants'
import { PlusIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: string | number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(
    parseFloat(String(n))
  )

const TIPO_LABELS: Record<TipoCuenta, string> = {
  CORRIENTE: 'Corriente',
  AHORRO: 'Ahorro',
  INVERSION: 'Inversión',
  OTRO: 'Otro',
}

const TIPO_COLORS: Record<TipoCuenta, string> = {
  CORRIENTE: '#3b82f6',
  AHORRO:    '#22c55e',
  INVERSION: '#a78bfa',
  OTRO:      '#94a3b8',
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
interface CuentaForm {
  alias: string; banco: string; numero: string
  tipo: TipoCuenta; moneda: string; saldo: string; activa: boolean
}

const EMPTY: CuentaForm = { alias: '', banco: '', numero: '', tipo: 'AHORRO', moneda: 'DOP', saldo: '0', activa: true }

function CuentaFormPanel({
  initial, onSubmit, onClose, loading, error,
}: {
  initial?: CuentaForm; onSubmit(d: CuentaForm): void
  onClose(): void; loading: boolean; error?: string | null
}) {
  const [form, setForm] = useState<CuentaForm>(initial ?? EMPTY)
  const set = (k: keyof CuentaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="flex flex-col gap-4">
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>}

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre / Alias *
        <input required value={form.alias} onChange={set('alias')} className="input" placeholder="Ej. Cuenta nómina, Ahorros..." autoFocus />
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Banco *
        <select required value={form.banco} onChange={set('banco')} className="input">
          <option value="">— Seleccionar banco —</option>
          {BANCOS_RD.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Número de cuenta *
        <input required value={form.numero} onChange={set('numero')} className="input" placeholder="Ej. 1234567890" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo
          <select value={form.tipo} onChange={set('tipo')} className="input">
            {TIPOS_CUENTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Moneda
          <select value={form.moneda} onChange={set('moneda')} className="input">
            {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.value}</option>)}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Balance inicial
        <input type="number" step="0.01" value={form.saldo} onChange={set('saldo')} className="input" placeholder="0.00" />
      </label>

      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input type="checkbox" checked={form.activa} onChange={e => setForm(p => ({ ...p, activa: e.target.checked }))} className="accent-primary w-4 h-4" />
        Cuenta activa
      </label>

      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'new'; error?: string }
  | { type: 'edit'; cuenta: CuentaBancaria; error?: string }
  | { type: 'delete'; cuenta: CuentaBancaria }
  | null

export function CuentasPage() {
  const qc = useQueryClient()
  const { data: cuentas = [], isLoading } = useQuery<CuentaBancaria[]>({
    queryKey: ['cuentas'],
    queryFn: async () => (await api.get('/cuentas')).data.data,
  })

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const closeModal = () => setModal(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['cuentas'] })

  const create = useMutation({
    mutationFn: (d: object) => api.post('/cuentas', d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Cuenta creada') },
    onError: (e: Error) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error') },
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/cuentas/${id}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Cuenta actualizada') },
    onError: (e: Error) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error') },
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/cuentas/${id}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Cuenta eliminada') },
    onError: (e: Error) => { showToast(e.message, 'error') },
  })

  const totalSaldo = cuentas.filter(c => c.activa).reduce((s, c) => s + parseFloat(String(c.saldo)), 0)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast {...toast} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Cuentas</h1>
          <p className="text-text-muted text-sm mt-0.5">Tus cuentas bancarias y billeteras</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Nueva cuenta
        </button>
      </div>

      {/* Summary */}
      {cuentas.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Balance total</p>
            <p className="text-xl font-bold text-success">{fmt(totalSaldo)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Cuentas activas</p>
            <p className="text-xl font-bold text-text-primary">{cuentas.filter(c => c.activa).length}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total cuentas</p>
            <p className="text-xl font-bold text-text-primary">{cuentas.length}</p>
          </div>
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center h-32 text-text-muted text-sm">Cargando…</div>}

      {/* List */}
      <div className="flex flex-col gap-3">
        {cuentas.map(c => {
          const color = TIPO_COLORS[c.tipo] ?? '#94a3b8'
          return (
            <div key={c.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: color + '22' }}>
                <BuildingLibraryIcon className="w-5 h-5" style={{ color }} />
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{c.alias ?? c.banco}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{TIPO_LABELS[c.tipo]}</span>
                  {!c.activa && <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">Inactiva</span>}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {c.banco} · ···{c.numero.slice(-4)}
                </div>
              </div>
              {/* Balance */}
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-success">{fmt(c.saldo)}</div>
                <div className="text-xs text-text-muted">{c.moneda}</div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setModal({ type: 'edit', cuenta: c })}
                  className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors" title="Editar">
                  ✏
                </button>
                <button onClick={() => setModal({ type: 'delete', cuenta: c })}
                  className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Eliminar">
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && cuentas.length === 0 && (
        <div className="text-center text-text-muted py-16 text-sm">
          <BuildingLibraryIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tienes cuentas registradas todavía</p>
          <button onClick={() => setModal({ type: 'new' })} className="btn-primary mt-4">+ Añadir primera cuenta</button>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'new' && (
        <Modal title="Nueva cuenta" onClose={closeModal}>
          <CuentaFormPanel onClose={closeModal} loading={create.isPending} error={modal.error}
            onSubmit={d => create.mutate({ ...d, saldo: parseFloat(d.saldo) })} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Editar cuenta" onClose={closeModal}>
          <CuentaFormPanel
            initial={{ alias: modal.cuenta.alias ?? '', banco: modal.cuenta.banco, numero: modal.cuenta.numero,
              tipo: modal.cuenta.tipo, moneda: modal.cuenta.moneda, saldo: String(modal.cuenta.saldo), activa: modal.cuenta.activa }}
            onClose={closeModal} loading={update.isPending} error={modal.error}
            onSubmit={d => update.mutate({ id: modal.cuenta.id, d: { ...d, saldo: parseFloat(d.saldo) } })} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar cuenta" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Eliminar <strong className="text-text-primary">{modal.cuenta.alias ?? modal.cuenta.banco}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.cuenta.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
