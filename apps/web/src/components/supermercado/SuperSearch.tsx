/**
 * SuperSearch — product search & picker for supermercadosrd.com integration.
 *
 * Flow A (browse):  Category grid → subcategory tiles → merged product list
 * Flow B (search):  Type query → typeahead dropdown → merged product list
 *
 * Features:
 * - Merged products: one card per product (name+unit) across all stores
 * - Per-store price comparison with "Mejor precio" badge
 * - Quantity selector per product (unit price × qty = line total)
 * - Binary sort toggles: Precio ↑↓ and Supermercados ↑↓
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────

interface Suggestion {
  phrase: string
  groupId: number
  groupName: string
  groupHumanId: string
  parentGroupName: string
}

export interface StorePrice {
  shopId: number
  shopName: string
  productId: number
  price: number
}

export interface MergedProduct {
  name: string
  image: string
  unit: string
  brand: { id: number; name: string } | null
  lowestPrice: number
  storeCount: number
  stores: StorePrice[]
}

interface MergedProductsResponse {
  group: { id: number; name: string; humanId: string }
  products: MergedProduct[]
  total: number
}

export interface SelectedProduct {
  productId: number   // store-specific product ID
  name: string
  image: string
  unit: string
  brand: string       // product brand
  price: number       // unit price
  quantity: number    // how many units
  storeName: string   // which supermarket
}

type SortDir = null | 'asc' | 'desc'

// ── Category definitions ──────────────────────────────────────────────────

const CATEGORIAS_SUPER = [
  { id: 'carnes',     label: 'Carnes & Aves',      icon: 'tabler:meat',          color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25 hover:bg-red-500/20',        seedQuery: 'pollo' },
  { id: 'lacteos',    label: 'Lácteos y Huevos',   icon: 'tabler:egg',           color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25 hover:bg-yellow-500/20', seedQuery: 'leche' },
  { id: 'panaderia',  label: 'Pan y Repostería',   icon: 'tabler:bread',         color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/20',   seedQuery: 'pan sobao' },
  { id: 'frutas',     label: 'Frutas y Vegetales', icon: 'tabler:apple',         color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25 hover:bg-green-500/20',   seedQuery: 'tomate' },
  { id: 'bebidas',    label: 'Bebidas',             icon: 'tabler:cup',           color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20',     seedQuery: 'jugo' },
  { id: 'despensa',   label: 'Despensa',            icon: 'tabler:basket',        color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25 hover:bg-orange-500/20', seedQuery: 'arroz' },
  { id: 'snacks',     label: 'Snacks y Dulces',     icon: 'tabler:cookie',        color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/25 hover:bg-pink-500/20',     seedQuery: 'galletas' },
  { id: 'congelados', label: 'Congelados',          icon: 'tabler:snowflake',     color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/20',        seedQuery: 'congelado' },
  { id: 'limpieza',   label: 'Limpieza del Hogar',  icon: 'tabler:spray',         color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/20',     seedQuery: 'detergente' },
  { id: 'cuidado',    label: 'Cuidado Personal',    icon: 'tabler:heart',         color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/20',     seedQuery: 'champu' },
  { id: 'bebe',       label: 'Bebé y Niños',        icon: 'tabler:baby-carriage', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/20', seedQuery: 'panal' },
  { id: 'mascotas',   label: 'Mascotas',            icon: 'tabler:paw',           color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/25 hover:bg-teal-500/20',     seedQuery: 'alimento mascota' },
] as const

type CategoryDef = typeof CATEGORIAS_SUPER[number]

// ── Hooks ─────────────────────────────────────────────────────────────────

function useSuggestions(query: string) {
  return useQuery<Suggestion[]>({
    queryKey: ['super-suggestions', query],
    queryFn: async () => {
      const { data } = await api.get(`/supermercado/suggestions?q=${encodeURIComponent(query)}`)
      return data.data
    },
    enabled: query.length >= 2,
    staleTime: 60_000,
  })
}

function useMergedProducts(slug: string) {
  return useQuery<MergedProductsResponse>({
    queryKey: ['super-products-merged', slug],
    queryFn: async () => {
      const { data } = await api.get(`/supermercado/groups/${slug}/products-merged`)
      return data.data
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  })
}

// ── SortButton ────────────────────────────────────────────────────────────

function SortButton({
  label,
  icon,
  value,
  onChange,
}: {
  label: string
  icon: string
  value: SortDir
  onChange: (next: SortDir) => void
}) {
  const cycle = () => {
    if (value === null)   onChange('desc')
    else if (value === 'desc') onChange('asc')
    else                       onChange(null)
  }

  const arrowIcon =
    value === 'desc' ? 'tabler:arrow-up'
    : value === 'asc' ? 'tabler:arrow-down'
    : 'tabler:arrows-sort'

  return (
    <button
      type="button"
      onClick={cycle}
      title={value === 'desc' ? `${label}: mayor primero` : value === 'asc' ? `${label}: menor primero` : `Ordenar por ${label}`}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all
        ${value
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-text-muted hover:border-primary/40 hover:text-text-secondary'}`}
    >
      <Icon icon={icon} className="w-3.5 h-3.5" />
      <span>{label}</span>
      <Icon
        icon={arrowIcon}
        className={`w-3 h-3 transition-transform ${value ? 'opacity-100' : 'opacity-40'}`}
      />
    </button>
  )
}

// ── MergedProductCard ─────────────────────────────────────────────────────

function MergedProductCard({
  product,
  selectedProducts,
  onAddStore,
  onRemoveStore,
  onUpdateQuantity,
}: {
  product: MergedProduct
  selectedProducts: SelectedProduct[]
  onAddStore: (store: StorePrice, product: MergedProduct) => void
  onRemoveStore: (productId: number) => void
  onUpdateQuantity: (productId: number, qty: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const selectedEntry = selectedProducts.find(sp =>
    product.stores.some(s => s.productId === sp.productId)
  )
  const selectedStore = selectedEntry
    ? product.stores.find(s => s.productId === selectedEntry.productId)
    : null
  const qty = selectedEntry?.quantity ?? 1
  const selectedIds = new Set(selectedProducts.map(p => p.productId))

  const fmtPrice = (n: number) =>
    'RD$' + n.toLocaleString('es-DO', { minimumFractionDigits: 2 })

  return (
    <div className={`rounded-xl border transition-all overflow-hidden
      ${selectedEntry ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-primary/40'}`}>

      {/* ── Product header row ── */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {/* Image */}
        <div className="w-14 h-14 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-border/20">
          {product.image
            ? <img src={product.image} alt={product.name} className="w-full h-full object-contain p-0.5" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center">
                <Icon icon="tabler:shopping-cart" className="w-6 h-6 text-text-muted/30" />
              </div>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {product.brand && (
            <div className="text-[10px] text-text-muted font-medium mb-0.5">{product.brand.name}</div>
          )}
          <div className="text-sm font-semibold text-text-primary leading-tight line-clamp-2">{product.name}</div>
          <div className="text-xs text-text-muted mt-0.5">{product.unit}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-primary tabular-nums">
              desde {fmtPrice(product.lowestPrice)}
            </span>
            <span className="text-[10px] text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded-full">
              {product.storeCount} {product.storeCount === 1 ? 'supermercado' : 'supermercados'}
            </span>
          </div>
        </div>

        {/* Chevron / check */}
        {selectedEntry
          ? <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Icon icon="tabler:check" className="w-3 h-3 text-white" />
            </div>
          : <Icon
              icon={expanded ? 'tabler:chevron-up' : 'tabler:chevron-down'}
              className="w-4 h-4 text-text-muted flex-shrink-0"
            />}
      </button>

      {/* ── Selected store + quantity stepper ── */}
      {selectedStore && selectedEntry && (
        <div className="mx-3 mb-2 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-2">
          {/* Store info */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Icon icon="tabler:building-store" className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="text-xs text-primary font-semibold truncate">{selectedStore.shopName}</span>
            <span className="text-[10px] text-primary/60 tabular-nums flex-shrink-0">
              · {fmtPrice(selectedStore.price)} /u
            </span>
          </div>

          {/* Quantity stepper */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onUpdateQuantity(selectedEntry.productId, qty - 1) }}
              disabled={qty <= 1}
              className="w-6 h-6 rounded-md border border-primary/40 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon icon="tabler:minus" className="w-3 h-3" />
            </button>
            <span className="text-xs font-bold text-primary tabular-nums w-6 text-center select-none">{qty}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onUpdateQuantity(selectedEntry.productId, qty + 1) }}
              className="w-6 h-6 rounded-md border border-primary/40 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            >
              <Icon icon="tabler:plus" className="w-3 h-3" />
            </button>
          </div>

          {/* Total price */}
          <span className="text-xs font-bold text-primary tabular-nums flex-shrink-0">
            = {fmtPrice(selectedStore.price * qty)}
          </span>

          {/* Remove */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemoveStore(selectedEntry.productId) }}
            className="text-text-muted hover:text-danger transition-colors ml-1 flex-shrink-0"
          >
            <Icon icon="tabler:x" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Store picker (expanded) ── */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-border/40 pt-2.5">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1">
            Elige dónde comprar
          </div>
          {product.stores.map(store => {
            const isCheapest    = store.price === product.lowestPrice
            const isThisSelected = selectedIds.has(store.productId)
            return (
              <button
                key={store.shopId}
                type="button"
                onClick={() => {
                  if (isThisSelected) onRemoveStore(store.productId)
                  else { onAddStore(store, product); setExpanded(false) }
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left
                  ${isThisSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40 hover:bg-primary/5'}`}
              >
                <div className="flex items-center gap-2">
                  <Icon icon="tabler:building-store"
                    className={`w-3.5 h-3.5 flex-shrink-0 ${isThisSelected ? 'text-primary' : 'text-text-muted'}`} />
                  <span className={`text-xs font-semibold ${isThisSelected ? 'text-primary' : 'text-text-primary'}`}>
                    {store.shopName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isCheapest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-bold">
                      Mejor precio
                    </span>
                  )}
                  <span className={`text-sm font-bold tabular-nums ${isCheapest ? 'text-success' : 'text-text-primary'}`}>
                    {fmtPrice(store.price)}
                  </span>
                  {isThisSelected && <Icon icon="tabler:check" className="w-3.5 h-3.5 text-primary" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── CategoryGrid ──────────────────────────────────────────────────────────

function CategoryGrid({ onSelect }: { onSelect: (cat: CategoryDef) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Explorar por categoría</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {CATEGORIAS_SUPER.map(cat => (
          <button key={cat.id} type="button" onClick={() => onSelect(cat)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${cat.bg}`}>
            <Icon icon={cat.icon} className={`w-6 h-6 ${cat.color}`} />
            <span className="text-[11px] text-text-secondary text-center leading-tight font-medium">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── SubcategoryList ───────────────────────────────────────────────────────

function SubcategoryList({ category, onSelectSlug, onBack }: {
  category: CategoryDef
  onSelectSlug: (slug: string, name: string) => void
  onBack: () => void
}) {
  const { data: suggestions = [], isLoading } = useSuggestions(category.seedQuery)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors">
          <Icon icon="tabler:arrow-left" className="w-3.5 h-3.5" />
          <span>Categorías</span>
        </button>
        <Icon icon="tabler:chevron-right" className="w-3 h-3 text-text-muted" />
        <span className={`font-semibold ${category.color}`}>{category.label}</span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse h-12 rounded-xl bg-surface-elevated border border-border/30" />
          ))}
        </div>
      )}

      {!isLoading && suggestions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {suggestions.map((s, i) => (
            <button key={`${s.groupId}-${i}`} type="button"
              onClick={() => onSelectSlug(s.groupHumanId, s.groupName)}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
              <Icon icon="tabler:tag" className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">{s.groupName}</div>
                {s.parentGroupName !== s.groupName && (
                  <div className="text-[10px] text-text-muted truncate mt-0.5">{s.parentGroupName}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && suggestions.length === 0 && (
        <div className="text-center py-8 text-text-muted text-sm">
          <Icon icon="tabler:category-off" className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No se encontraron subcategorías.
        </div>
      )}
    </div>
  )
}

// ── Main SuperSearch ───────────────────────────────────────────────────────

export function SuperSearch({
  selectedProducts,
  onProductsChange,
}: {
  selectedProducts: SelectedProduct[]
  onProductsChange: (products: SelectedProduct[]) => void
}) {
  const [query,           setQuery]           = useState('')
  const [activeSlug,      setActiveSlug]      = useState('')
  const [activeGroupName, setActiveGroupName] = useState('')
  const [browseCategory,  setBrowseCategory]  = useState<CategoryDef | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [sortPrice,       setSortPrice]       = useState<SortDir>(null)
  const [sortStores,      setSortStores]      = useState<SortDir>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const { data: suggestions = [] } = useSuggestions(query)
  const { data: mergedData, isLoading: loadingProducts } = useMergedProducts(activeSlug)

  // Reset sort when navigating to a new group
  useEffect(() => { setSortPrice(null); setSortStores(null) }, [activeSlug])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectGroup = useCallback((slug: string, name: string) => {
    setActiveSlug(slug)
    setActiveGroupName(name)
    setShowSuggestions(false)
  }, [])

  const goBack = useCallback(() => {
    if (activeSlug) {
      setActiveSlug(''); setActiveGroupName(''); setQuery('')
    } else if (browseCategory) {
      setBrowseCategory(null)
    }
  }, [activeSlug, browseCategory])

  // Sort products
  const products = useMemo(() => {
    const base = mergedData?.products ?? []
    if (!sortPrice && !sortStores) return base
    return [...base].sort((a, b) => {
      if (sortPrice) {
        const d = a.lowestPrice - b.lowestPrice
        return sortPrice === 'desc' ? -d : d
      }
      if (sortStores) {
        const d = a.storeCount - b.storeCount
        return sortStores === 'desc' ? -d : d
      }
      return 0
    })
  }, [mergedData, sortPrice, sortStores])

  const total = mergedData?.total ?? 0
  const selectedIds = new Set(selectedProducts.map(p => p.productId))

  const handleAddStore = useCallback((store: StorePrice, product: MergedProduct) => {
    const withoutOld = selectedProducts.filter(p =>
      !product.stores.some(s => s.productId === p.productId)
    )
    onProductsChange([
      ...withoutOld,
      {
        productId: store.productId,
        name: product.name,
        image: product.image,
        unit: product.unit,
        brand: product.brand?.name ?? '',
        price: store.price,
        quantity: 1,
        storeName: store.shopName,
      },
    ])
  }, [selectedProducts, onProductsChange])

  const handleRemoveStore = useCallback((productId: number) => {
    onProductsChange(selectedProducts.filter(p => p.productId !== productId))
  }, [selectedProducts, onProductsChange])

  const handleUpdateQuantity = useCallback((productId: number, qty: number) => {
    if (qty < 1) return
    onProductsChange(
      selectedProducts.map(p => p.productId === productId ? { ...p, quantity: qty } : p)
    )
  }, [selectedProducts, onProductsChange])

  const screen: 'home' | 'sub' | 'products' =
    activeSlug ? 'products' : browseCategory ? 'sub' : 'home'

  return (
    <div className="flex flex-col gap-4">

      {/* ── Search bar ── */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Icon icon="tabler:search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar productos: arroz, leche, pollo..."
            className="input pl-9 pr-8"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setShowSuggestions(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <Icon icon="tabler:x" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button key={`${s.groupId}-${i}`} type="button"
                onClick={() => { setQuery(s.groupName); selectGroup(s.groupHumanId, s.groupName) }}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-elevated transition-colors flex items-center gap-3 border-b border-border/30 last:border-0">
                <Icon icon="tabler:category" className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary font-medium">{s.groupName}</div>
                  <div className="text-xs text-text-muted">{s.parentGroupName}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Home ── */}
      {screen === 'home' && !query.trim() && (
        <CategoryGrid onSelect={cat => { setBrowseCategory(cat); setQuery('') }} />
      )}

      {/* ── Subcategories ── */}
      {screen === 'sub' && browseCategory && !query.trim() && (
        <SubcategoryList
          category={browseCategory}
          onSelectSlug={(slug, name) => selectGroup(slug, name)}
          onBack={() => setBrowseCategory(null)}
        />
      )}

      {/* ── Products ── */}
      {screen === 'products' && (
        <div className="flex flex-col gap-3">

          {/* Breadcrumb + sort controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={goBack}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
                <Icon icon="tabler:arrow-left" className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 text-sm">
                {browseCategory && (
                  <>
                    <span className="text-text-muted">{browseCategory.label}</span>
                    <Icon icon="tabler:chevron-right" className="w-3 h-3 text-text-muted" />
                  </>
                )}
                <span className="font-semibold text-text-primary">
                  {mergedData?.group?.name ?? activeGroupName}
                </span>
                {total > 0 && <span className="text-xs text-text-muted">({total})</span>}
              </div>
              {selectedIds.size > 0 && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {selectedIds.size} en lista
                </span>
              )}
            </div>

            {/* Sort buttons */}
            {!loadingProducts && products.length > 0 && (
              <div className="flex items-center gap-1.5">
                <SortButton
                  label="Precio"
                  icon="tabler:currency-dollar"
                  value={sortPrice}
                  onChange={v => { setSortPrice(v); if (v) setSortStores(null) }}
                />
                <SortButton
                  label="Supermercados"
                  icon="tabler:building-store"
                  value={sortStores}
                  onChange={v => { setSortStores(v); if (v) setSortPrice(null) }}
                />
              </div>
            )}
          </div>

          {/* Loading skeleton */}
          {loadingProducts && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-3 flex gap-3">
                  <div className="w-14 h-14 rounded-lg bg-surface-elevated flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 justify-center">
                    <div className="h-3 bg-surface-elevated rounded w-1/4" />
                    <div className="h-4 bg-surface-elevated rounded w-3/4" />
                    <div className="h-3 bg-surface-elevated rounded w-1/2" />
                  </div>
                </div>
              ))}
              <p className="text-xs text-text-muted text-center py-1 flex items-center justify-center gap-1.5">
                <Icon icon="tabler:loader-2" className="w-3.5 h-3.5 animate-spin" />
                Consultando precios en todos los supermercados…
              </p>
            </div>
          )}

          {/* Product list */}
          {!loadingProducts && products.length > 0 && (
            <div className="flex flex-col gap-2">
              {products.map((p, i) => (
                <MergedProductCard
                  key={`${p.name}-${p.unit}-${i}`}
                  product={p}
                  selectedProducts={selectedProducts}
                  onAddStore={handleAddStore}
                  onRemoveStore={handleRemoveStore}
                  onUpdateQuantity={handleUpdateQuantity}
                />
              ))}
            </div>
          )}

          {!loadingProducts && products.length === 0 && (
            <div className="text-center py-12 text-text-muted text-sm">
              <Icon icon="tabler:search-off" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No se encontraron productos.
            </div>
          )}
        </div>
      )}

      {/* No search results */}
      {!activeSlug && query.trim().length > 0 && !showSuggestions && suggestions.length === 0 && (
        <div className="text-center py-10 text-text-muted text-sm">
          <Icon icon="tabler:search-off" className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No se encontraron resultados para "{query}"
        </div>
      )}
    </div>
  )
}

// ── SuperShoppingList ─────────────────────────────────────────────────────

export function SuperShoppingList({
  products,
  onRemove,
  onUpdateQuantity,
}: {
  products: SelectedProduct[]
  onRemove: (productId: number) => void
  onUpdateQuantity?: (productId: number, qty: number) => void
}) {
  if (products.length === 0) return null

  const total = products.reduce((s, p) => s + p.price * p.quantity, 0)

  const byStore = products.reduce((acc, p) => {
    const key = p.storeName || 'Sin tienda'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {} as Record<string, SelectedProduct[]>)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="tabler:list-check" className="w-4 h-4 text-primary" />
          Lista ({products.length})
        </h3>
        <span className="text-sm font-bold text-primary tabular-nums">
          RD${total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {Object.entries(byStore).map(([store, items]) => {
        const storeTotal = items.reduce((s, p) => s + p.price * p.quantity, 0)
        return (
          <div key={store}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon icon="tabler:building-store" className="w-3 h-3 text-text-muted" />
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{store}</span>
              <span className="text-[10px] text-text-muted ml-auto tabular-nums">
                RD${storeTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {items.map(p => (
                <div key={p.productId} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2.5 py-1.5">
                  <div className="w-8 h-8 rounded-md bg-white flex-shrink-0 overflow-hidden border border-border/20">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-0.5" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Icon icon="tabler:package" className="w-4 h-4 text-text-muted/30" />
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-primary font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-text-muted">{p.unit}</div>
                  </div>
                  {/* Inline qty stepper */}
                  {onUpdateQuantity && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => onUpdateQuantity(p.productId, p.quantity - 1)}
                        disabled={p.quantity <= 1}
                        className="w-5 h-5 rounded border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Icon icon="tabler:minus" className="w-2.5 h-2.5" />
                      </button>
                      <span className="text-xs font-semibold text-text-primary tabular-nums w-5 text-center">{p.quantity}</span>
                      <button type="button" onClick={() => onUpdateQuantity(p.productId, p.quantity + 1)}
                        className="w-5 h-5 rounded border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors">
                        <Icon icon="tabler:plus" className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                  <span className="text-xs font-bold text-primary tabular-nums flex-shrink-0 ml-1">
                    RD${(p.price * p.quantity).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                  <button type="button" onClick={() => onRemove(p.productId)}
                    className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0">
                    <Icon icon="tabler:x" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── SuperPickerInline ──────────────────────────────────────────────────────

export function SuperPickerInline({
  presupuestoNombre,
  loading,
  onBack,
  onSubmit,
}: {
  presupuestoNombre: string
  loading: boolean
  onBack: () => void
  onSubmit: (items: object[]) => void
}) {
  const [selected, setSelected] = useState<SelectedProduct[]>([])

  const handleAdd = () => {
    const items = selected.map(p => ({
      tipo: 'GASTO' as const,
      concepto: p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name,
      montoPlaneado: p.price * p.quantity,
      productoExterno: {
        productId: p.productId,
        name: p.name,
        image: p.image,
        unit: p.unit,
        brand: p.brand,
        storeName: p.storeName,
        price: p.price,
      },
    }))
    onSubmit(items)
  }

  const updateQty = (productId: number, qty: number) => {
    if (qty < 1) return
    setSelected(prev => prev.map(p => p.productId === productId ? { ...p, quantity: qty } : p))
  }

  const total = selected.reduce((s, p) => s + p.price * p.quantity, 0)

  return (
    <div className="flex flex-col bg-surface border border-border rounded-xl overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/60 flex-shrink-0">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors flex-shrink-0">
          <Icon icon="tabler:arrow-left" className="w-4 h-4" />
          <span className="hidden sm:inline">Volver a lista</span>
        </button>
        <div className="flex-1 flex items-center gap-2 justify-center min-w-0">
          <Icon icon="tabler:building-store" className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-text-primary truncate">{presupuestoNombre}</span>
        </div>
        {selected.length > 0
          ? <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap">
              {selected.length} {selected.length === 1 ? 'producto' : 'productos'}
            </span>
          : <div className="w-20 flex-shrink-0" />}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col lg:flex-row" style={{ minHeight: '520px' }}>
        <div className="flex-1 overflow-y-auto p-5 border-b lg:border-b-0 lg:border-r border-border/60">
          <SuperSearch selectedProducts={selected} onProductsChange={setSelected} />
        </div>
        <div className="lg:w-72 flex-shrink-0 flex flex-col p-4 bg-background/30">
          {selected.length > 0
            ? <SuperShoppingList
                products={selected}
                onRemove={id => setSelected(prev => prev.filter(p => p.productId !== id))}
                onUpdateQuantity={updateQty}
              />
            : <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-10">
                <div className="w-14 h-14 rounded-full bg-surface-elevated flex items-center justify-center">
                  <Icon icon="tabler:shopping-cart-off" className="w-7 h-7 text-text-muted opacity-40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Tu lista está vacía</p>
                  <p className="text-xs text-text-muted mt-0.5">Selecciona productos para agregarlos</p>
                </div>
              </div>}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/60 flex-shrink-0">
        <div className="text-sm text-text-secondary">
          {selected.length > 0 && (
            <span>
              <strong className="text-text-primary tabular-nums">{selected.length}</strong>{' '}
              producto{selected.length !== 1 ? 's' : ''} ·{' '}
              <strong className="text-primary tabular-nums">
                RD${total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="btn-ghost text-sm">Cancelar</button>
          <button type="button" onClick={handleAdd} disabled={loading || selected.length === 0}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Icon icon="tabler:plus" className="w-4 h-4" />
            {loading ? 'Agregando...' : `Agregar ${selected.length > 0 ? selected.length : ''} producto${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
