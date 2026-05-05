import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Categoria, Subcategoria } from '../../lib/types'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  TagIcon,
} from '@heroicons/react/24/outline'

// ── API helpers ────────────────────────────────────────────────────────────
const fetchCategorias = async (): Promise<Categoria[]> => {
  const { data } = await api.get('/categorias')
  return data.data
}

// ── Small reusable modal ───────────────────────────────────────────────────
interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}
function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Color picker ──────────────────────────────────────────────────────────
const PALETTE = [
  '#22c55e','#16a34a','#15803d','#4ade80',
  '#3b82f6','#6366f1','#8b5cf6','#a78bfa',
  '#f59e0b','#f97316','#ef4444','#ec4899',
  '#06b6d4','#14b8a6','#84cc16','#94a3b8',
]
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {PALETTE.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
          style={{ backgroundColor: c, borderColor: value === c ? '#fff' : 'transparent' }}
        />
      ))}
    </div>
  )
}

// ── CategoriaForm ─────────────────────────────────────────────────────────
interface CatFormState { nombre: string; color: string; icono: string; esEsencial: boolean }

function CategoriaForm({
  initial,
  onSubmit,
  onClose,
  loading,
}: {
  initial?: Partial<CatFormState>
  onSubmit: (d: CatFormState) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<CatFormState>({
    nombre: initial?.nombre ?? '',
    color: initial?.color ?? '#22c55e',
    icono: initial?.icono ?? '',
    esEsencial: initial?.esEsencial ?? false,
  })

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre *
        <input
          required
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          className="input"
          placeholder="Ej. Alimentación"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Ícono (emoji)
        <input
          value={form.icono}
          onChange={e => setForm(p => ({ ...p, icono: e.target.value }))}
          className="input"
          placeholder="🍔"
          maxLength={4}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Color
        <ColorPicker value={form.color} onChange={c => setForm(p => ({ ...p, color: c }))} />
      </div>
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={form.esEsencial}
          onChange={e => setForm(p => ({ ...p, esEsencial: e.target.checked }))}
          className="accent-primary w-4 h-4"
        />
        Categoría esencial (incluida en health score)
      </label>
      <div className="flex gap-2 justify-end mt-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── SubcategoriaForm ──────────────────────────────────────────────────────
interface SubFormState { nombre: string; color: string; icono: string }

function SubcategoriaForm({
  initial,
  onSubmit,
  onClose,
  loading,
}: {
  initial?: Partial<SubFormState>
  onSubmit: (d: SubFormState) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<SubFormState>({
    nombre: initial?.nombre ?? '',
    color: initial?.color ?? '#4ade80',
    icono: initial?.icono ?? '',
  })

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre *
        <input
          required
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          className="input"
          placeholder="Ej. Restaurantes"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Ícono (emoji)
        <input
          value={form.icono}
          onChange={e => setForm(p => ({ ...p, icono: e.target.value }))}
          className="input"
          placeholder="🍽️"
          maxLength={4}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Color
        <ColorPicker value={form.color} onChange={c => setForm(p => ({ ...p, color: c }))} />
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

// ── SubcategoriaRow ───────────────────────────────────────────────────────
function SubcategoriaRow({
  sub,
  isSystem,
  onEdit,
  onDelete,
}: {
  sub: Subcategoria
  isSystem: boolean
  onEdit: (s: Subcategoria) => void
  onDelete: (s: Subcategoria) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2 pl-8 pr-3 rounded-lg hover:bg-background/50 group transition-colors">
      <span className="text-base">{sub.icono || '•'}</span>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color ?? '#94a3b8' }} />
      <span className="text-sm text-text-secondary flex-1">{sub.nombre}</span>
      {!isSystem && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(sub)}
            className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(sub)}
            className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── CategoriaRow ──────────────────────────────────────────────────────────
function CategoriaRow({
  cat,
  onEdit,
  onDelete,
  onAddSub,
  onEditSub,
  onDeleteSub,
}: {
  cat: Categoria
  onEdit: (c: Categoria) => void
  onDelete: (c: Categoria) => void
  onAddSub: (c: Categoria) => void
  onEditSub: (c: Categoria, s: Subcategoria) => void
  onDeleteSub: (c: Categoria, s: Subcategoria) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isSystem = cat.clienteId === null

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-background/30 transition-colors group">
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
        >
          {expanded
            ? <ChevronDownIcon className="w-4 h-4" />
            : <ChevronRightIcon className="w-4 h-4" />}
        </button>

        {/* Color dot + icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
          style={{ backgroundColor: (cat.color ?? '#1e8e5a') + '33' }}>
          {cat.icono || <TagIcon className="w-4 h-4" style={{ color: cat.color ?? '#22c55e' }} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{cat.nombre}</span>
            {isSystem && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Sistema</span>
            )}
            {cat.esEsencial && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">Esencial</span>
            )}
          </div>
          <span className="text-xs text-text-muted">
            {cat.subcategorias.length} subcategoría{cat.subcategorias.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddSub(cat)}
            className="p-1.5 rounded text-text-muted hover:text-success hover:bg-success/10 transition-colors"
            title="Añadir subcategoría"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          {!isSystem && (
            <>
              <button
                onClick={() => onEdit(cat)}
                className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                title="Editar"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(cat)}
                className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                title="Eliminar"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subcategorias */}
      {expanded && cat.subcategorias.length > 0 && (
        <div className="border-t border-border/50 py-1 px-2">
          {cat.subcategorias.map(sub => (
            <SubcategoriaRow
              key={sub.id}
              sub={sub}
              isSystem={isSystem}
              onEdit={s => onEditSub(cat, s)}
              onDelete={s => onDeleteSub(cat, s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export function CategoriasPage() {
  const qc = useQueryClient()
  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: fetchCategorias,
  })

  // Modal state
  const [modal, setModal] = useState<
    | { type: 'newCat' }
    | { type: 'editCat'; cat: Categoria }
    | { type: 'deleteCat'; cat: Categoria }
    | { type: 'newSub'; cat: Categoria }
    | { type: 'editSub'; cat: Categoria; sub: Subcategoria }
    | { type: 'deleteSub'; cat: Categoria; sub: Subcategoria }
    | null
  >(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categorias'] })

  // Mutations
  const createCat = useMutation({
    mutationFn: (d: object) => api.post('/categorias', d),
    onSuccess: () => { invalidate(); setModal(null) },
  })
  const updateCat = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/categorias/${id}`, d),
    onSuccess: () => { invalidate(); setModal(null) },
  })
  const deleteCat = useMutation({
    mutationFn: (id: string) => api.delete(`/categorias/${id}`),
    onSuccess: () => { invalidate(); setModal(null) },
  })
  const createSub = useMutation({
    mutationFn: ({ catId, d }: { catId: string; d: object }) => api.post(`/categorias/${catId}/subcategorias`, d),
    onSuccess: () => { invalidate(); setModal(null) },
  })
  const updateSub = useMutation({
    mutationFn: ({ catId, subId, d }: { catId: string; subId: string; d: object }) =>
      api.put(`/categorias/${catId}/subcategorias/${subId}`, d),
    onSuccess: () => { invalidate(); setModal(null) },
  })
  const deleteSub = useMutation({
    mutationFn: ({ catId, subId }: { catId: string; subId: string }) =>
      api.delete(`/categorias/${catId}/subcategorias/${subId}`),
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const [search, setSearch] = useState('')
  const filtered = categorias.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  )
  const system = filtered.filter(c => c.clienteId === null)
  const custom = filtered.filter(c => c.clienteId !== null)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Categorías</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Organiza tus transacciones con categorías y subcategorías personalizadas
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'newCat' })}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar categoría…"
        className="input"
      />

      {isLoading && (
        <div className="flex items-center justify-center h-32 text-text-muted text-sm">Cargando…</div>
      )}

      {/* Custom categories */}
      {custom.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Mis categorías</h2>
          {custom.map(cat => (
            <CategoriaRow
              key={cat.id}
              cat={cat}
              onEdit={c => setModal({ type: 'editCat', cat: c })}
              onDelete={c => setModal({ type: 'deleteCat', cat: c })}
              onAddSub={c => setModal({ type: 'newSub', cat: c })}
              onEditSub={(c, s) => setModal({ type: 'editSub', cat: c, sub: s })}
              onDeleteSub={(c, s) => setModal({ type: 'deleteSub', cat: c, sub: s })}
            />
          ))}
        </section>
      )}

      {/* System categories */}
      {system.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Categorías del sistema</h2>
          {system.map(cat => (
            <CategoriaRow
              key={cat.id}
              cat={cat}
              onEdit={c => setModal({ type: 'editCat', cat: c })}
              onDelete={c => setModal({ type: 'deleteCat', cat: c })}
              onAddSub={c => setModal({ type: 'newSub', cat: c })}
              onEditSub={(c, s) => setModal({ type: 'editSub', cat: c, sub: s })}
              onDeleteSub={(c, s) => setModal({ type: 'deleteSub', cat: c, sub: s })}
            />
          ))}
        </section>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center text-text-muted py-12 text-sm">
          {search ? 'Sin resultados para tu búsqueda' : 'No hay categorías todavía'}
        </div>
      )}

      {/* ── Modals ── */}

      {modal?.type === 'newCat' && (
        <Modal title="Nueva categoría" onClose={() => setModal(null)}>
          <CategoriaForm
            onClose={() => setModal(null)}
            loading={createCat.isPending}
            onSubmit={d => createCat.mutate(d)}
          />
        </Modal>
      )}

      {modal?.type === 'editCat' && (
        <Modal title="Editar categoría" onClose={() => setModal(null)}>
          <CategoriaForm
            initial={{ ...modal.cat, color: modal.cat.color ?? undefined, icono: modal.cat.icono ?? undefined }}
            onClose={() => setModal(null)}
            loading={updateCat.isPending}
            onSubmit={d => updateCat.mutate({ id: modal.cat.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'deleteCat' && (
        <Modal title="Eliminar categoría" onClose={() => setModal(null)}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Seguro que quieres eliminar <strong className="text-text-primary">{modal.cat.nombre}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button
              className="btn-danger"
              disabled={deleteCat.isPending}
              onClick={() => deleteCat.mutate(modal.cat.id)}
            >
              {deleteCat.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}

      {modal?.type === 'newSub' && (
        <Modal title={`Añadir subcategoría a "${modal.cat.nombre}"`} onClose={() => setModal(null)}>
          <SubcategoriaForm
            onClose={() => setModal(null)}
            loading={createSub.isPending}
            onSubmit={d => createSub.mutate({ catId: modal.cat.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'editSub' && (
        <Modal title="Editar subcategoría" onClose={() => setModal(null)}>
          <SubcategoriaForm
            initial={{ ...modal.sub, color: modal.sub.color ?? undefined, icono: modal.sub.icono ?? undefined }}
            onClose={() => setModal(null)}
            loading={updateSub.isPending}
            onSubmit={d => updateSub.mutate({ catId: modal.cat.id, subId: modal.sub.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'deleteSub' && (
        <Modal title="Eliminar subcategoría" onClose={() => setModal(null)}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Seguro que quieres eliminar <strong className="text-text-primary">{modal.sub.nombre}</strong>?
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button
              className="btn-danger"
              disabled={deleteSub.isPending}
              onClick={() => deleteSub.mutate({ catId: modal.cat.id, subId: modal.sub.id })}
            >
              {deleteSub.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}