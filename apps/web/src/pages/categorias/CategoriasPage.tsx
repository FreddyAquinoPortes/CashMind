import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Categoria, Subcategoria } from '../../lib/types'
import {
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@iconify/react'
import { IconPicker, suggestIcon } from '../../components/ui/IconPicker'

// ── API helpers ────────────────────────────────────────────────────────────
const fetchCategorias = async (): Promise<Categoria[]> => {
  const { data } = await api.get('/categorias')
  return data.data
}

// ── Toast ──────────────────────────────────────────────────────────────────
interface ToastState { msg: string; type: 'success' | 'error' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all
        ${toast.type === 'success'
          ? 'bg-success text-white'
          : 'bg-danger text-white'}`}
    >
      {toast.msg}
    </div>
  )
}

// ── Small reusable modal ───────────────────────────────────────────────────
interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}
function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header fijo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none">&times;</button>
        </div>
        {/* Contenido con scroll */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {children}
        </div>
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
  error,
}: {
  initial?: Partial<CatFormState>
  onSubmit: (d: CatFormState) => void
  onClose: () => void
  loading: boolean
  error?: string | null
}) {
  const [form, setForm] = useState<CatFormState>({
    nombre: initial?.nombre ?? '',
    color: initial?.color ?? '#22c55e',
    icono: initial?.icono ?? '',
    esEsencial: initial?.esEsencial ?? false,
  })
  // true = icon was auto-suggested (not manually chosen by user)
  const [autoSuggested, setAutoSuggested] = useState(!initial?.icono)

  // Auto-suggest icon as user types the name
  useEffect(() => {
    if (!autoSuggested) return          // user manually chose — don't override
    const suggested = suggestIcon(form.nombre)
    if (suggested) setForm(p => ({ ...p, icono: suggested }))
  }, [form.nombre, autoSuggested])

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="flex flex-col gap-4"
    >
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre *
        <input
          required
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          className="input"
          placeholder="Ej. Supermercado, Combustible, Salud…"
          autoFocus
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <span>Ícono</span>
          {autoSuggested && form.icono && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              ✨ Sugerido
            </span>
          )}
        </div>
        <IconPicker
          value={form.icono}
          onChange={icono => {
            setForm(p => ({ ...p, icono }))
            setAutoSuggested(false)   // user manually picked
          }}
        />
      </div>
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
  error,
}: {
  initial?: Partial<SubFormState>
  onSubmit: (d: SubFormState) => void
  onClose: () => void
  loading: boolean
  error?: string | null
}) {
  const [form, setForm] = useState<SubFormState>({
    nombre: initial?.nombre ?? '',
    color: initial?.color ?? '#4ade80',
    icono: initial?.icono ?? '',
  })
  const [autoSuggested, setAutoSuggested] = useState(!initial?.icono)

  useEffect(() => {
    if (!autoSuggested) return
    const suggested = suggestIcon(form.nombre)
    if (suggested) setForm(p => ({ ...p, icono: suggested }))
  }, [form.nombre, autoSuggested])

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="flex flex-col gap-4"
    >
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre *
        <input
          required
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          className="input"
          placeholder="Ej. Restaurantes, Gasolina, Gym…"
          autoFocus
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <span>Ícono</span>
          {autoSuggested && form.icono && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              ✨ Sugerido
            </span>
          )}
        </div>
        <IconPicker
          value={form.icono}
          onChange={icono => {
            setForm(p => ({ ...p, icono }))
            setAutoSuggested(false)
          }}
        />
      </div>
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

// ── 3-dot dropdown menu ───────────────────────────────────────────────────
interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}
interface DropdownMenuProps {
  menuId: string
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  actions: MenuAction[]
}
function DropdownMenu({ menuId, openMenu, setOpenMenu, actions }: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = openMenu === menuId

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, setOpenMenu])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpenMenu(isOpen ? null : menuId) }}
        className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors text-base leading-none font-bold tracking-widest"
        title="Más opciones"
      >
        ···
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[200px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={e => { e.stopPropagation(); action.onClick(); setOpenMenu(null) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5
                ${action.danger
                  ? 'text-danger hover:bg-danger/10'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SubcategoriaRow ───────────────────────────────────────────────────────
function SubcategoriaRow({
  sub,
  isSystem,
  menuId,
  openMenu,
  setOpenMenu,
  onEdit,
  onDelete,
}: {
  sub: Subcategoria
  isSystem: boolean
  menuId: string
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onEdit: (s: Subcategoria) => void
  onDelete: (s: Subcategoria) => void
}) {
  const actions: MenuAction[] = [
    { label: '✏ Editar subcategoría',    onClick: () => onEdit(sub) },
    { label: '🗑 Eliminar subcategoría', onClick: () => onDelete(sub), danger: true },
  ]

  return (
    <div className="flex items-center gap-3 py-2 pl-10 pr-3 rounded-lg hover:bg-background/50 transition-colors">
      <span className="text-sm text-text-muted select-none">•</span>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color ?? '#94a3b8' }} />
      <span className="text-sm text-text-secondary flex-1 flex items-center gap-1.5">
        {sub.icono
          ? <Icon
              icon={sub.icono.includes(':') ? sub.icono : `tabler:${sub.icono}`}
              className="w-4 h-4"
              style={{ color: sub.color ?? '#94a3b8' }}
            />
          : <span className="text-text-muted">•</span>
        }
        {sub.nombre}
      </span>
      <DropdownMenu
        menuId={menuId}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        actions={actions}
      />
    </div>
  )
}

// ── CategoriaRow ──────────────────────────────────────────────────────────
function CategoriaRow({
  cat,
  expandedIds,
  toggleExpand,
  openMenu,
  setOpenMenu,
  onEdit,
  onDelete,
  onAddSub,
  onEditSub,
  onDeleteSub,
}: {
  cat: Categoria
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onEdit: (c: Categoria) => void
  onDelete: (c: Categoria) => void
  onAddSub: (c: Categoria) => void
  onEditSub: (c: Categoria, s: Subcategoria) => void
  onDeleteSub: (c: Categoria, s: Subcategoria) => void
}) {
  const isSystem = cat.clienteId === null
  const expanded = expandedIds.has(cat.id)

  const catMenuActions: MenuAction[] = [
    { label: '+ Añadir subcategoría', onClick: () => onAddSub(cat) },
    { label: '✏ Editar categoría',    onClick: () => onEdit(cat) },
    { label: '🗑 Eliminar categoría', onClick: () => onDelete(cat), danger: true as const },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-background/30 transition-colors select-none"
        onClick={() => toggleExpand(cat.id)}
      >
        <span className="flex-shrink-0 text-text-muted">
          {expanded
            ? <ChevronDownIcon className="w-4 h-4" />
            : <ChevronRightIcon className="w-4 h-4" />}
        </span>

        {/* Color dot + icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
          style={{ backgroundColor: (cat.color ?? '#1e8e5a') + '33' }}
        >
          {cat.icono
            ? <Icon
                icon={cat.icono.includes(':') ? cat.icono : `tabler:${cat.icono}`}
                className="w-5 h-5"
                style={{ color: cat.color ?? '#22c55e' }}
              />
            : <Icon icon="tabler:tag" className="w-5 h-5" style={{ color: cat.color ?? '#22c55e' }} />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text-primary">{cat.nombre}</span>
            {isSystem && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Sistema</span>
            )}
            {cat.esEsencial && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">Esencial</span>
            )}
            <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted font-medium">
              {cat.subcategorias.length} sub{cat.subcategorias.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Add sub button (always visible) */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onAddSub(cat) }}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-success hover:bg-success/10 transition-colors"
          title="Añadir subcategoría"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sub</span>
        </button>

        {/* 3-dot menu */}
        <div onClick={e => e.stopPropagation()}>
          <DropdownMenu
            menuId={`cat-${cat.id}`}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            actions={catMenuActions}
          />
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
              menuId={`sub-${sub.id}`}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onEdit={s => onEditSub(cat, s)}
              onDelete={s => onDeleteSub(cat, s)}
            />
          ))}
        </div>
      )}

      {expanded && cat.subcategorias.length === 0 && (
        <div className="border-t border-border/50 py-3 px-10 text-xs text-text-muted">
          Sin subcategorías. Usa el botón "+ Sub" para añadir una.
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

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Open dropdown menu
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Modal state (also stores mutation error per modal)
  const [modal, setModal] = useState<
    | { type: 'newCat'; error?: string }
    | { type: 'editCat'; cat: Categoria; error?: string }
    | { type: 'deleteCat'; cat: Categoria }
    | { type: 'newSub'; cat: Categoria; error?: string }
    | { type: 'editSub'; cat: Categoria; sub: Subcategoria; error?: string }
    | { type: 'deleteSub'; cat: Categoria; sub: Subcategoria }
    | null
  >(null)

  const closeModal = () => setModal(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categorias'] })

  // Mutations
  const createCat = useMutation({
    mutationFn: (d: object) => api.post('/categorias', d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Categoría creada') },
    onError: (err: Error) => {
      setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev)
      showToast(err.message || 'Error al guardar', 'error')
    },
  })
  const updateCat = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/categorias/${id}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Categoría actualizada') },
    onError: (err: Error) => {
      setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev)
      showToast(err.message || 'Error al guardar', 'error')
    },
  })
  const deleteCat = useMutation({
    mutationFn: (id: string) => api.delete(`/categorias/${id}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Categoría eliminada') },
    onError: (err: Error) => { showToast(err.message || 'Error al eliminar', 'error') },
  })
  const createSub = useMutation({
    mutationFn: ({ catId, d }: { catId: string; d: object }) => api.post(`/categorias/${catId}/subcategorias`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Subcategoría creada') },
    onError: (err: Error) => {
      setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev)
      showToast(err.message || 'Error al guardar', 'error')
    },
  })
  const updateSub = useMutation({
    mutationFn: ({ catId, subId, d }: { catId: string; subId: string; d: object }) =>
      api.put(`/categorias/${catId}/subcategorias/${subId}`, d),
    onSuccess: () => { invalidate(); closeModal(); showToast('Subcategoría actualizada') },
    onError: (err: Error) => {
      setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev)
      showToast(err.message || 'Error al guardar', 'error')
    },
  })
  const deleteSub = useMutation({
    mutationFn: ({ catId, subId }: { catId: string; subId: string }) =>
      api.delete(`/categorias/${catId}/subcategorias/${subId}`),
    onSuccess: () => { invalidate(); closeModal(); showToast('Subcategoría eliminada') },
    onError: (err: Error) => { showToast(err.message || 'Error al eliminar', 'error') },
  })

  const [search, setSearch] = useState('')
  const filtered = categorias.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  )
  const system = filtered.filter(c => c.clienteId === null)
  const custom = filtered.filter(c => c.clienteId !== null)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {toast && <Toast toast={toast} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
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
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
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
        <Modal title="Nueva categoría" onClose={closeModal}>
          <CategoriaForm
            onClose={closeModal}
            loading={createCat.isPending}
            error={modal.error}
            onSubmit={d => createCat.mutate(d)}
          />
        </Modal>
      )}

      {modal?.type === 'editCat' && (
        <Modal title="Editar categoría" onClose={closeModal}>
          <CategoriaForm
            initial={{ ...modal.cat, color: modal.cat.color ?? undefined, icono: modal.cat.icono ?? undefined }}
            onClose={closeModal}
            loading={updateCat.isPending}
            error={modal.error}
            onSubmit={d => updateCat.mutate({ id: modal.cat.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'deleteCat' && (
        <Modal title="Eliminar categoría" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Seguro que quieres eliminar <strong className="text-text-primary">{modal.cat.nombre}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
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
        <Modal title={`Añadir subcategoría a "${modal.cat.nombre}"`} onClose={closeModal}>
          <SubcategoriaForm
            onClose={closeModal}
            loading={createSub.isPending}
            error={modal.error}
            onSubmit={d => createSub.mutate({ catId: modal.cat.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'editSub' && (
        <Modal title="Editar subcategoría" onClose={closeModal}>
          <SubcategoriaForm
            initial={{ ...modal.sub, color: modal.sub.color ?? undefined, icono: modal.sub.icono ?? undefined }}
            onClose={closeModal}
            loading={updateSub.isPending}
            error={modal.error}
            onSubmit={d => updateSub.mutate({ catId: modal.cat.id, subId: modal.sub.id, d })}
          />
        </Modal>
      )}

      {modal?.type === 'deleteSub' && (
        <Modal title="Eliminar subcategoría" onClose={closeModal}>
          <p className="text-text-secondary text-sm mb-6">
            ¿Seguro que quieres eliminar <strong className="text-text-primary">{modal.sub.nombre}</strong>?
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
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
