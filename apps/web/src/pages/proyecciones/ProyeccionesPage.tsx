import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useFmt } from '../../lib/useFmt'
import type { Categoria } from '../../lib/types'
import { type SavedPeriod, BUILT_IN_PERIODS, loadSavedPeriods, applySavedPeriod, isMonthAware } from '../../lib/periods'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, ArrowRightCircleIcon,
  ChevronDownIcon, ChevronUpIcon, ExclamationTriangleIcon,
  CheckCircleIcon, InformationCircleIcon, SparklesIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────────────────────

interface ProyeccionItem {
  id: string
  clienteId: string
  nombre: string
  monto: number
  tipo: 'GASTO' | 'INGRESO'
  moneda: string
  periodicidad: string | null
  categoriaId: string | null
  notas: string | null
  count: number
  total: number
  esIngreso: boolean
  createdAt: string
}

interface EventoRow {
  id: string
  nombre: string
  tipo: string
  presupuesto: number
  moneda: string
  recurrente: boolean
  tipoRecurrencia: string | null
  categoria: { id: string; nombre: string; color: string | null; icono: string | null } | null
  subcategoria: { id: string; nombre: string } | null
  fechas: string[]
  count: number
  total: number
  esIngreso: boolean
}

interface TimelineEntry {
  periodo: string
  ingresos: number
  gastos: number
  balance: number
}

interface CatEntry {
  id: string
  nombre: string
  color: string | null
  icono: string | null
  total: number
}

interface ResumenData {
  periodo: { desde: string; hasta: string; diffDays: number; useWeeks: boolean }
  balanceActual: number
  cuentas: { id: string; alias: string | null; banco: string; saldo: string; moneda: string }[]
  proyeccion: {
    totalIngresos: number
    totalGastos: number
    balanceFinal: number
    deficit: boolean
    superavit: number
    deficitMonto: number
  }
  eventos: EventoRow[]
  items: ProyeccionItem[]
  timeline: TimelineEntry[]
  porCategoria: CatEntry[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const PERIODICIDAD_LABELS: Record<string, string> = {
  DIARIA: 'Diaria', SEMANAL: 'Semanal', MENSUAL: 'Mensual', ANUAL: 'Anual',
}

const RECURRENCIA_LABELS: Record<string, string> = {
  DIARIA: 'Diaria', SEMANAL: 'Semanal', MENSUAL: 'Mensual', ANUAL: 'Anual',
}

const PRIORIDAD_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Muy baja', color: 'text-gray-400' },
  2: { label: 'Baja',     color: 'text-blue-400' },
  3: { label: 'Media',    color: 'text-amber-400' },
  4: { label: 'Alta',     color: 'text-orange-400' },
  5: { label: 'Crítica',  color: 'text-red-400' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function addDays(d: Date, n: number): Date {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}

const today = () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

// ── Period presets ─────────────────────────────────────────────────────────

type PeriodKey = '30d' | '60d' | '90d' | '180d' | '1a' | 'custom'

const PERIODS: { key: PeriodKey; label: string; days?: number }[] = [
  { key: '30d',    label: '30 días',  days: 30  },
  { key: '60d',    label: '60 días',  days: 60  },
  { key: '90d',    label: '90 días',  days: 90  },
  { key: '180d',   label: '6 meses',  days: 180 },
  { key: '1a',     label: '1 año',    days: 365 },
  { key: 'custom', label: 'Personalizado' },
]

// ── Item form ──────────────────────────────────────────────────────────────

interface ItemForm {
  nombre: string
  monto: string
  tipo: 'GASTO' | 'INGRESO'
  moneda: string
  periodicidad: string
  categoriaId: string
  notas: string
}

const ITEM_EMPTY: ItemForm = {
  nombre: '', monto: '', tipo: 'GASTO', moneda: 'DOP',
  periodicidad: '', categoriaId: '', notas: '',
}

// ── Convert form ───────────────────────────────────────────────────────────

interface ConvertForm {
  fecha: string
  tipoRecurrencia: string
  prioridad: number
  categoriaId: string
  subcategoriaId: string
}

const CONVERT_EMPTY: ConvertForm = {
  fecha: toDateStr(today()), tipoRecurrencia: '', prioridad: 3,
  categoriaId: '', subcategoriaId: '',
}

// ══════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════

export function ProyeccionesPage() {
  const cid   = useAuthStore(s => s.clienteActivo?.id)
  const fmt   = useFmt()
  const qc    = useQueryClient()

  // ── Period state ──────────────────────────────────────────────────────
  const [periodKey, setPeriodKey] = useState<PeriodKey>('90d')
  const [customDesde, setCustomDesde] = useState(toDateStr(today()))
  const [customHasta, setCustomHasta] = useState(toDateStr(addDays(today(), 90)))
  const [savedPeriods] = useState<SavedPeriod[]>(() => loadSavedPeriods())
  const [activeSavedPeriod, setActiveSavedPeriod] = useState<SavedPeriod | null>(null)
  const [savedPeriodAnchor, setSavedPeriodAnchor] = useState<{ year: number; month: number } | null>(null)
  const [savedPeriodActive, setSavedPeriodActive] = useState<string | null>(null)

  const { desde, hasta } = useMemo(() => {
    if (periodKey === 'custom') return { desde: customDesde, hasta: customHasta }
    const preset = PERIODS.find(p => p.key === periodKey)!
    return {
      desde: toDateStr(today()),
      hasta: toDateStr(addDays(today(), preset.days!)),
    }
  }, [periodKey, customDesde, customHasta])

  const handleApplySaved = (p: SavedPeriod) => {
    const { start, end } = applySavedPeriod(p)
    setSavedPeriodActive(p.id)
    setPeriodKey('custom')
    setCustomDesde(toDateStr(start))
    setCustomHasta(toDateStr(end))
    if (isMonthAware(p)) {
      setActiveSavedPeriod(p)
      setSavedPeriodAnchor({ year: start.getFullYear(), month: start.getMonth() })
    }
  }

  // ── Data fetching ─────────────────────────────────────────────────────
  const { data: resumen, isLoading, isError, refetch } = useQuery<ResumenData>({
    queryKey: ['proyecciones-resumen', cid, desde, hasta],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${cid}/proyecciones/resumen`, {
        params: { desde, hasta },
      })
      return data.data
    },
    enabled: !!cid,
    staleTime: 30_000,
  })

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias', cid],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${cid}/categorias`)
      return data.data
    },
    enabled: !!cid,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['proyecciones-resumen', cid] })

  // ── Item mutations ─────────────────────────────────────────────────────
  const createItem  = useMutation({
    mutationFn: (body: object) => api.post(`/clientes/${cid}/proyecciones/items`, body),
    onSuccess: invalidate,
  })
  const updateItem  = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.patch(`/proyecciones/items/${id}?clienteId=${cid}`, body),
    onSuccess: invalidate,
  })
  const deleteItem  = useMutation({
    mutationFn: (id: string) => api.delete(`/proyecciones/items/${id}?clienteId=${cid}`),
    onSuccess: invalidate,
  })
  const convertItem = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.post(`/proyecciones/items/${id}/convertir?clienteId=${cid}`, body),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['eventos'] })
    },
  })

  // ── UI state ──────────────────────────────────────────────────────────
  const [showItemModal, setShowItemModal]       = useState(false)
  const [editingItem,   setEditingItem]         = useState<ProyeccionItem | null>(null)
  const [itemForm,      setItemForm]            = useState<ItemForm>(ITEM_EMPTY)
  const [deletingItemId, setDeletingItemId]     = useState<string | null>(null)

  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertingItem,   setConvertingItem]   = useState<ProyeccionItem | null>(null)
  const [convertForm,      setConvertForm]      = useState<ConvertForm>(CONVERT_EMPTY)

  const [expandedEventos, setExpandedEventos]   = useState(false)
  const [expandedTimeline, setExpandedTimeline] = useState(true)
  const [expandedCat, setExpandedCat]           = useState(true)

  // ── Open/close item modal ─────────────────────────────────────────────
  const openAddItem = () => { setEditingItem(null); setItemForm(ITEM_EMPTY); setShowItemModal(true) }
  const openEditItem = (item: ProyeccionItem) => {
    setEditingItem(item)
    setItemForm({
      nombre: item.nombre, monto: String(item.monto), tipo: item.tipo,
      moneda: item.moneda, periodicidad: item.periodicidad ?? '',
      categoriaId: item.categoriaId ?? '', notas: item.notas ?? '',
    })
    setShowItemModal(true)
  }
  const closeItemModal = () => { setShowItemModal(false); setEditingItem(null) }

  const handleSaveItem = () => {
    const body = {
      nombre: itemForm.nombre.trim(),
      monto: parseFloat(itemForm.monto),
      tipo: itemForm.tipo,
      moneda: itemForm.moneda,
      periodicidad: itemForm.periodicidad || null,
      categoriaId: itemForm.categoriaId || null,
      notas: itemForm.notas.trim() || null,
    }
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, body }, { onSuccess: closeItemModal })
    } else {
      createItem.mutate(body, { onSuccess: closeItemModal })
    }
  }

  // ── Convert to event ──────────────────────────────────────────────────
  const openConvert = (item: ProyeccionItem) => {
    setConvertingItem(item)
    setConvertForm({
      ...CONVERT_EMPTY,
      categoriaId: item.categoriaId ?? '',
    })
    setShowConvertModal(true)
  }
  const closeConvertModal = () => { setShowConvertModal(false); setConvertingItem(null) }

  const handleConvert = () => {
    if (!convertingItem) return
    convertItem.mutate({
      id: convertingItem.id,
      body: {
        clienteId: cid,
        fecha: convertForm.fecha,
        tipoRecurrencia: convertForm.tipoRecurrencia || null,
        prioridad: convertForm.prioridad,
        categoriaId: convertForm.categoriaId || null,
        subcategoriaId: convertForm.subcategoriaId || null,
      },
    }, { onSuccess: closeConvertModal })
  }

  // ── Subcategory helper ─────────────────────────────────────────────────
  const subcatsForConvert = useMemo(() => {
    if (!convertForm.categoriaId) return []
    return categorias.find(c => c.id === convertForm.categoriaId)?.subcategorias ?? []
  }, [categorias, convertForm.categoriaId])

  const subcatsForItem = useMemo(() => {
    if (!itemForm.categoriaId) return []
    return categorias.find(c => c.id === itemForm.categoriaId)?.subcategorias ?? []
  }, [categorias, itemForm.categoriaId])
  void subcatsForItem // used in form below

  // ── Timeline max for bar scaling ──────────────────────────────────────
  const timelineMax = useMemo(() => {
    if (!resumen?.timeline?.length) return 1
    return Math.max(...resumen.timeline.map(t => Math.max(t.ingresos, t.gastos)), 1)
  }, [resumen])

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" />
            Proyecciones Financieras
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Estima tu flujo de caja futuro basado en eventos y gastos planificados
          </p>
        </div>
        <button
          onClick={openAddItem}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Agregar ítem
        </button>
      </div>

      {/* ── Period selector ──────────────────────────────────────────────── */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriodKey(p.key); setSavedPeriodActive(null) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodKey === p.key && !savedPeriodActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {([...BUILT_IN_PERIODS, ...savedPeriods]).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
            <span className="text-xs text-text-muted self-center pr-1">Guardados:</span>
            {[...BUILT_IN_PERIODS, ...savedPeriods].map(p => (
              <button
                key={p.id}
                onClick={() => handleApplySaved(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  savedPeriodActive === p.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}
        {periodKey === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <label className="text-text-muted">Desde</label>
              <input
                type="date"
                value={customDesde}
                onChange={e => setCustomDesde(e.target.value)}
                className="bg-surface-elevated border border-border rounded-lg px-2 py-1 text-sm text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-text-muted">Hasta</label>
              <input
                type="date"
                value={customHasta}
                onChange={e => setCustomHasta(e.target.value)}
                className="bg-surface-elevated border border-border rounded-lg px-2 py-1 text-sm text-text-primary"
              />
            </div>
          </div>
        )}
        {!isLoading && resumen && (
          <p className="text-xs text-text-muted">
            Período: {new Date(resumen.periodo.desde).toLocaleDateString('es-DO')} →{' '}
            {new Date(resumen.periodo.hasta).toLocaleDateString('es-DO')} ({resumen.periodo.diffDays} días)
          </p>
        )}
      </div>

      {/* ── Loading / Error ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center h-40 text-text-muted text-sm">
          Calculando proyección…
        </div>
      )}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
          Error al cargar la proyección.{' '}
          <button onClick={() => refetch()} className="underline">Reintentar</button>
        </div>
      )}

      {resumen && (
        <>
          {/* ── Summary cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Balance actual */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide">Balance actual</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {fmt(resumen.balanceActual, true)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {resumen.cuentas.length} cuenta{resumen.cuentas.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Ingresos proyectados */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide">Ingresos proyectados</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                +{fmt(resumen.proyeccion.totalIngresos, true)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {resumen.eventos.filter(e => e.esIngreso).length} evento{resumen.eventos.filter(e => e.esIngreso).length !== 1 ? 's' : ''}
                {resumen.items.filter(i => i.esIngreso).length > 0 && ` + ${resumen.items.filter(i => i.esIngreso).length} ítem${resumen.items.filter(i => i.esIngreso).length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Gastos proyectados */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide">Gastos proyectados</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                -{fmt(resumen.proyeccion.totalGastos, true)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {resumen.eventos.filter(e => !e.esIngreso).length} evento{resumen.eventos.filter(e => !e.esIngreso).length !== 1 ? 's' : ''}
                {resumen.items.filter(i => !i.esIngreso).length > 0 && ` + ${resumen.items.filter(i => !i.esIngreso).length} ítem${resumen.items.filter(i => !i.esIngreso).length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Balance final / Déficit */}
            <div className={`rounded-xl border p-4 ${
              resumen.proyeccion.deficit
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <p className={`text-xs uppercase tracking-wide ${resumen.proyeccion.deficit ? 'text-red-400' : 'text-green-400'}`}>
                {resumen.proyeccion.deficit ? '⚠ Déficit proyectado' : '✓ Superávit proyectado'}
              </p>
              <p className={`text-2xl font-bold mt-1 ${resumen.proyeccion.deficit ? 'text-red-400' : 'text-green-400'}`}>
                {resumen.proyeccion.deficit
                  ? `-${fmt(resumen.proyeccion.deficitMonto, true)}`
                  : `+${fmt(resumen.proyeccion.superavit, true)}`}
              </p>
              <p className={`text-xs mt-1 ${resumen.proyeccion.deficit ? 'text-red-400/70' : 'text-green-400/70'}`}>
                Balance final: {fmt(resumen.proyeccion.balanceFinal, true)}
              </p>
            </div>
          </div>

          {/* ── Deficit alert ───────────────────────────────────────────── */}
          {resumen.proyeccion.deficit && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Déficit proyectado detectado</p>
                <p className="text-xs text-red-400/80 mt-0.5">
                  Con los ingresos y gastos planificados en este período, tu saldo llegaría a{' '}
                  <span className="font-semibold">{fmt(resumen.proyeccion.balanceFinal, true)}</span>.
                  Considera reducir gastos o agregar fuentes de ingreso.
                </p>
              </div>
            </div>
          )}

          {/* ── Timeline chart ──────────────────────────────────────────── */}
          <div className="bg-surface rounded-xl border border-border">
            <button
              className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setExpandedTimeline(v => !v)}
            >
              <span className="text-sm font-semibold text-text-primary">
                Flujo de caja — {resumen.periodo.useWeeks ? 'por semana' : 'por mes'}
              </span>
              {expandedTimeline ? <ChevronUpIcon className="w-4 h-4 text-text-muted" /> : <ChevronDownIcon className="w-4 h-4 text-text-muted" />}
            </button>

            {expandedTimeline && resumen.timeline.length > 0 && (
              <div className="px-5 pb-5 space-y-1 overflow-x-auto">
                {/* Legend */}
                <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-green-500/70 inline-block" />Ingresos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500/70 inline-block" />Gastos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-500/50 inline-block" />Balance
                  </span>
                </div>

                <div className="min-w-[500px] space-y-2">
                  {resumen.timeline.map(t => (
                    <div key={t.periodo} className="group">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted w-16 shrink-0 font-mono">{t.periodo}</span>
                        <div className="flex-1 space-y-0.5">
                          {/* Ingresos bar */}
                          {t.ingresos > 0 && (
                            <div className="flex items-center gap-1">
                              <div
                                className="h-3 rounded-sm bg-green-500/70 transition-all"
                                style={{ width: `${Math.min(100, (t.ingresos / timelineMax) * 100)}%` }}
                              />
                              <span className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                +{fmt(t.ingresos)}
                              </span>
                            </div>
                          )}
                          {/* Gastos bar */}
                          {t.gastos > 0 && (
                            <div className="flex items-center gap-1">
                              <div
                                className="h-3 rounded-sm bg-red-500/70 transition-all"
                                style={{ width: `${Math.min(100, (t.gastos / timelineMax) * 100)}%` }}
                              />
                              <span className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                -{fmt(t.gastos)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={`text-xs font-medium w-20 text-right shrink-0 ${t.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {t.balance >= 0 ? '+' : ''}{fmt(t.balance)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expandedTimeline && resumen.timeline.length === 0 && (
              <div className="px-5 pb-5 text-sm text-text-muted text-center py-6">
                No hay datos para el período seleccionado.
              </div>
            )}
          </div>

          {/* ── Events from the period ──────────────────────────────────── */}
          {resumen.eventos.length > 0 && (
            <div className="bg-surface rounded-xl border border-border">
              <button
                className="w-full flex items-center justify-between px-5 py-4"
                onClick={() => setExpandedEventos(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">Eventos en el período</span>
                  <span className="text-xs bg-surface-elevated text-text-muted px-2 py-0.5 rounded-full">
                    {resumen.eventos.length}
                  </span>
                </div>
                {expandedEventos ? <ChevronUpIcon className="w-4 h-4 text-text-muted" /> : <ChevronDownIcon className="w-4 h-4 text-text-muted" />}
              </button>

              {expandedEventos && (
                <div className="px-5 pb-5 space-y-2">
                  {resumen.eventos.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface-elevated border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{ev.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.categoria && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                background: ev.categoria.color ? `${ev.categoria.color}22` : undefined,
                                color: ev.categoria.color ?? undefined,
                              }}
                            >
                              {ev.categoria.nombre}
                            </span>
                          )}
                          {ev.recurrente && ev.tipoRecurrencia && (
                            <span className="text-xs text-text-muted">
                              {RECURRENCIA_LABELS[ev.tipoRecurrencia]} · {ev.count}×
                            </span>
                          )}
                          {!ev.recurrente && (
                            <span className="text-xs text-text-muted">
                              {new Date(ev.fechas[0]!).toLocaleDateString('es-DO')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold shrink-0 ${ev.esIngreso ? 'text-green-400' : 'text-red-400'}`}>
                        {ev.esIngreso ? '+' : '-'}{fmt(ev.total, true)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Custom items ────────────────────────────────────────────── */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">Ítems de proyección</span>
                {resumen.items.length > 0 && (
                  <span className="text-xs bg-surface-elevated text-text-muted px-2 py-0.5 rounded-full">
                    {resumen.items.length}
                  </span>
                )}
              </div>
              <button
                onClick={openAddItem}
                className="flex items-center gap-1 text-xs text-primary hover:opacity-80"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            {resumen.items.length === 0 ? (
              <div className="px-5 pb-5 text-center text-sm text-text-muted py-4">
                <InformationCircleIcon className="w-8 h-8 mx-auto text-text-muted/50 mb-2" />
                <p>Sin ítems personalizados.</p>
                <p className="text-xs mt-1">Agrega gastos o ingresos que no estén en tus eventos.</p>
              </div>
            ) : (
              <div className="px-5 pb-5 space-y-2">
                {resumen.items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-elevated border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{item.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                        <span>{item.moneda} {fmt(item.monto)}</span>
                        {item.periodicidad && (
                          <span>· {PERIODICIDAD_LABELS[item.periodicidad]} × {item.count}</span>
                        )}
                        {item.notas && <span>· {item.notas}</span>}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold shrink-0 ${item.esIngreso ? 'text-green-400' : 'text-red-400'}`}>
                      {item.esIngreso ? '+' : '-'}{fmt(item.total, true)}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openConvert(item)}
                        title="Convertir a evento"
                        className="p-1 rounded hover:bg-surface text-text-muted hover:text-primary transition-colors"
                      >
                        <ArrowRightCircleIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditItem(item)}
                        className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingItemId(item.id)}
                        className="p-1 rounded hover:bg-surface text-text-muted hover:text-red-400 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Items totals row */}
                {resumen.items.length > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-text-muted">
                    <span>Total ítems</span>
                    <div className="flex gap-4">
                      {resumen.items.some(i => i.esIngreso) && (
                        <span className="text-green-400">+{fmt(resumen.items.filter(i => i.esIngreso).reduce((s, i) => s + i.total, 0), true)}</span>
                      )}
                      {resumen.items.some(i => !i.esIngreso) && (
                        <span className="text-red-400">-{fmt(resumen.items.filter(i => !i.esIngreso).reduce((s, i) => s + i.total, 0), true)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Category breakdown ──────────────────────────────────────── */}
          {resumen.porCategoria.length > 0 && (
            <div className="bg-surface rounded-xl border border-border">
              <button
                className="w-full flex items-center justify-between px-5 py-4"
                onClick={() => setExpandedCat(v => !v)}
              >
                <span className="text-sm font-semibold text-text-primary">Gastos por categoría</span>
                {expandedCat ? <ChevronUpIcon className="w-4 h-4 text-text-muted" /> : <ChevronDownIcon className="w-4 h-4 text-text-muted" />}
              </button>

              {expandedCat && (
                <div className="px-5 pb-5 space-y-2">
                  {(() => {
                    const totalGastos = resumen.porCategoria.reduce((s, c) => s + c.total, 0) || 1
                    return resumen.porCategoria.map(cat => (
                      <div key={cat.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary flex items-center gap-1.5">
                            {cat.icono && <span>{cat.icono}</span>}
                            {cat.nombre}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-muted">
                              {((cat.total / totalGastos) * 100).toFixed(1)}%
                            </span>
                            <span className="text-sm font-medium text-text-primary">
                              {fmt(cat.total, true)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(cat.total / totalGastos) * 100}%`,
                              background: cat.color ?? '#6b7280',
                            }}
                          />
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── Bank accounts used ──────────────────────────────────────── */}
          {resumen.cuentas.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Cuentas consideradas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {resumen.cuentas.map(c => (
                  <div key={c.id} className="bg-surface-elevated rounded-lg px-3 py-2.5 border border-border/50">
                    <p className="text-xs text-text-muted truncate">{c.alias ?? c.banco}</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">
                      {fmt(Number(c.saldo), true)}
                    </p>
                    <p className="text-xs text-text-muted">{c.moneda}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Modal: Add/Edit Item
      ══════════════════════════════════════════════════════════════════ */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">
                {editingItem ? 'Editar ítem' : 'Nuevo ítem de proyección'}
              </h2>
              <button onClick={closeItemModal} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Nombre *</label>
                <input
                  value={itemForm.nombre}
                  onChange={e => setItemForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Seguro de auto, Bono navideño…"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Tipo + Monto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tipo *</label>
                  <select
                    value={itemForm.tipo}
                    onChange={e => setItemForm(f => ({ ...f, tipo: e.target.value as 'GASTO' | 'INGRESO' }))}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="GASTO">Gasto</option>
                    <option value="INGRESO">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Monto *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={itemForm.monto}
                    onChange={e => setItemForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Moneda + Periodicidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Moneda</label>
                  <select
                    value={itemForm.moneda}
                    onChange={e => setItemForm(f => ({ ...f, moneda: e.target.value }))}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="DOP">DOP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Periodicidad</label>
                  <select
                    value={itemForm.periodicidad}
                    onChange={e => setItemForm(f => ({ ...f, periodicidad: e.target.value }))}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Una vez</option>
                    <option value="DIARIA">Diaria</option>
                    <option value="SEMANAL">Semanal</option>
                    <option value="MENSUAL">Mensual</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Categoría</label>
                <select
                  value={itemForm.categoriaId}
                  onChange={e => setItemForm(f => ({ ...f, categoriaId: e.target.value }))}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Notas</label>
                <input
                  value={itemForm.notas}
                  onChange={e => setItemForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Opcional…"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={closeItemModal} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleSaveItem}
                disabled={!itemForm.nombre.trim() || !itemForm.monto || createItem.isPending || updateItem.isPending}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {editingItem ? 'Guardar cambios' : 'Agregar ítem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Modal: Delete item confirmation
      ══════════════════════════════════════════════════════════════════ */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface rounded-xl border border-border w-full max-w-sm shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <TrashIcon className="w-5 h-5 text-red-400 shrink-0" />
              <h2 className="text-base font-semibold text-text-primary">Eliminar ítem</h2>
            </div>
            <p className="text-sm text-text-secondary">
              ¿Seguro que deseas eliminar este ítem de proyección? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingItemId(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteItem.mutate(deletingItemId, { onSuccess: () => setDeletingItemId(null) })}
                disabled={deleteItem.isPending}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Modal: Convert to event
      ══════════════════════════════════════════════════════════════════ */}
      {showConvertModal && convertingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Convertir a evento</h2>
                <p className="text-xs text-text-muted mt-0.5">{convertingItem.nombre}</p>
              </div>
              <button onClick={closeConvertModal} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-400">
                  El ítem se convertirá en un evento real con estado <strong>PLANIFICADO</strong> y será eliminado de los ítems de proyección.
                </p>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Fecha del evento *</label>
                <input
                  type="date"
                  value={convertForm.fecha}
                  onChange={e => setConvertForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Recurrencia */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Recurrencia</label>
                <select
                  value={convertForm.tipoRecurrencia}
                  onChange={e => setConvertForm(f => ({ ...f, tipoRecurrencia: e.target.value }))}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Sin recurrencia (evento único)</option>
                  <option value="DIARIA">Diaria</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="MENSUAL">Mensual</option>
                  <option value="ANUAL">Anual</option>
                </select>
              </div>

              {/* Prioridad */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Prioridad</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(p => (
                    <button
                      key={p}
                      onClick={() => setConvertForm(f => ({ ...f, prioridad: p }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        convertForm.prioridad === p
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-text-muted hover:border-primary/50'
                      }`}
                    >
                      <span className={PRIORIDAD_LABELS[p]!.color}>{p}</span>
                      <span className="block text-[10px] text-text-muted">{PRIORIDAD_LABELS[p]!.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Categoría</label>
                  <select
                    value={convertForm.categoriaId}
                    onChange={e => setConvertForm(f => ({ ...f, categoriaId: e.target.value, subcategoriaId: '' }))}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Subcategoría</label>
                  <select
                    value={convertForm.subcategoriaId}
                    onChange={e => setConvertForm(f => ({ ...f, subcategoriaId: e.target.value }))}
                    disabled={subcatsForConvert.length === 0}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {subcatsForConvert.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={closeConvertModal} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleConvert}
                disabled={!convertForm.fecha || convertItem.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                <ArrowRightCircleIcon className="w-4 h-4" />
                Convertir a evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
