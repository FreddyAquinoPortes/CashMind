/**
 * SuperSearch — product search & picker for supermercadosrd.com integration.
 *
 * Flow A (browse):
 *   Category grid → subcategory tiles → product grid
 *
 * Flow B (search):
 *   Type query → typeahead dropdown → product grid
 */

import { useState, useEffect, useRef, useCallback } from 'react'
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

interface Product {
  id: number
  name: string
  image: string
  unit: string
  categoryId: number
  brand: { id: number; name: string } | null
  currentPrice: string
  isCheaper: boolean
}

interface ProductsResponse {
  group: { id: number; name: string; humanId: string }
  products: Product[]
  total: number
  nextOffset: number | null
}

export interface SelectedProduct {
  productId: number
  name: string
  image: string
  unit: string
  brand: string
  price: number
  storeName: string
}

// ── Store map ─────────────────────────────────────────────────────────────

const STORES: Record<number, string> = {
  1: 'Sirena',
  2: 'Nacional',
  3: 'Jumbo',
  4: 'Plaza Lama',
  5: 'Pricesmart',
  6: 'Bravo',
  7: 'Merca Jumbo',
  8: 'Garrido',
  9: 'Ritmo',
}

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

function useProducts(slug: string, offset = 0) {
  return useQuery<ProductsResponse>({
    queryKey: ['super-products', slug, offset],
    queryFn: async () => {
      const { data } = await api.get(`/supermercado/groups/${slug}/products?offset=${offset}&limit=40&sort=lowest_price`)
      return data.data
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  })
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function ProductCard({ product, selected, onToggle }: {
  product: Product
  selected: boolean
  onToggle: () => void
}) {
  const price = parseFloat(product.currentPrice)

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex flex-col rounded-xl border p-3 text-left transition-all hover:shadow-lg
        ${selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border bg-surface hover:border-primary/40'}`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
          <Icon icon="tabler:check" className="w-3 h-3 text-white" />
        </div>
      )}
      {product.isCheaper && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold uppercase">
          Mejor precio
        </div>
      )}
      <div className="w-full aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden mb-2">
        {product.image
          ? <img src={product.image} alt={product.name} className="w-full h-full object-contain p-1" loading="lazy" onError={e => { (e.target as HTMLImageElement).src = '' }} />
          : <Icon icon="tabler:shopping-cart" className="w-8 h-8 text-text-muted/30" />}
      </div>
      <div className="flex-1 flex flex-col gap-0.5 min-h-[60px]">
        <span className="text-xs text-text-muted">{product.brand?.name ?? ''}</span>
        <span className="text-sm text-text-primary font-medium line-clamp-2 leading-tight">{product.name}</span>
        <span className="text-xs text-text-muted">{product.unit}</span>
      </div>
      <div className="mt-2 pt-2 border-t border-border/50">
        <span className="text-base font-bold text-primary tabular-nums">
          RD${price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </button>
  )
}

function CategoryGrid({ onSelect }: { onSelect: (cat: CategoryDef) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Explorar por categoría</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {CATEGORIAS_SUPER.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${cat.bg}`}
          >
            <Icon icon={cat.icon} className={`w-6 h-6 ${cat.color}`} />
            <span className="text-[11px] text-text-secondary text-center leading-tight font-medium">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SubcategoryList({ category, onSelectSlug, onBack }: {
  category: CategoryDef
  onSelectSlug: (slug: string, name: string) => void
  onBack: () => void
}) {
  const { data: suggestions = [], isLoading } = useSuggestions(category.seedQuery)

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors"
        >
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
            <button
              key={`${s.groupId}-${i}`}
              type="button"
              onClick={() => onSelectSlug(s.groupHumanId, s.groupName)}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
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

// ── Main SuperSearch component ─────────────────────────────────────────────

export function SuperSearch({
  selectedProducts,
  onProductsChange,
}: {
  selectedProducts: SelectedProduct[]
  onProductsChange: (products: SelectedProduct[]) => void
}) {
  const [query, setQuery]                 = useState('')
  const [activeSlug, setActiveSlug]       = useState('')
  const [activeGroupName, setActiveGroupName] = useState('')
  const [browseCategory, setBrowseCategory] = useState<CategoryDef | null>(null)
  const [offset, setOffset]               = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const { data: suggestions = [] } = useSuggestions(query)
  const { data: productsData, isLoading: loadingProducts } = useProducts(activeSlug, offset)

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
    setOffset(0)
    setShowSuggestions(false)
  }, [])

  const goBack = useCallback(() => {
    if (activeSlug) {
      setActiveSlug('')
      setActiveGroupName('')
      setOffset(0)
      setQuery('')
      // Stay in category browse if we came from there
    } else if (browseCategory) {
      setBrowseCategory(null)
    }
  }, [activeSlug, browseCategory])

  const toggleProduct = useCallback((product: Product) => {
    const exists = selectedProducts.find(p => p.productId === product.id)
    if (exists) {
      onProductsChange(selectedProducts.filter(p => p.productId !== product.id))
    } else {
      onProductsChange([
        ...selectedProducts,
        {
          productId: product.id,
          name: product.name,
          image: product.image,
          unit: product.unit,
          brand: product.brand?.name ?? '',
          price: parseFloat(product.currentPrice),
          storeName: '',
        },
      ])
    }
  }, [selectedProducts, onProductsChange])

  const selectedIds = new Set(selectedProducts.map(p => p.productId))
  const products    = productsData?.products ?? []
  const total       = productsData?.total ?? 0
  const hasMore     = productsData?.nextOffset !== null && productsData?.nextOffset !== undefined

  // Determine current "screen"
  const screen: 'home' | 'sub' | 'products' =
    activeSlug ? 'products'
    : browseCategory ? 'sub'
    : 'home'

  return (
    <div className="flex flex-col gap-4">

      {/* ── Search bar (always visible) ── */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Icon icon="tabler:search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar productos: arroz, leche, pollo..."
            className="input pl-9 pr-4"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setShowSuggestions(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <Icon icon="tabler:x" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={`${s.groupId}-${i}`}
                type="button"
                onClick={() => { setQuery(s.groupName); selectGroup(s.groupHumanId, s.groupName) }}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-elevated transition-colors flex items-center gap-3 border-b border-border/30 last:border-0"
              >
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

      {/* ── Screen: Home — Category grid ── */}
      {screen === 'home' && !query.trim() && (
        <CategoryGrid onSelect={cat => { setBrowseCategory(cat); setQuery('') }} />
      )}

      {/* ── Screen: Subcategories ── */}
      {screen === 'sub' && browseCategory && !query.trim() && (
        <SubcategoryList
          category={browseCategory}
          onSelectSlug={(slug, name) => selectGroup(slug, name)}
          onBack={() => setBrowseCategory(null)}
        />
      )}

      {/* ── Screen: Products ── */}
      {screen === 'products' && (
        <>
          {/* Product list header with breadcrumb */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={goBack}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <Icon icon="tabler:arrow-left" className="w-4 h-4" />
              </button>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm">
                {browseCategory && (
                  <>
                    <span className="text-text-muted">{browseCategory.label}</span>
                    <Icon icon="tabler:chevron-right" className="w-3 h-3 text-text-muted" />
                  </>
                )}
                <h3 className="font-semibold text-text-primary">
                  {productsData?.group?.name ?? activeGroupName}
                </h3>
                {total > 0 && <span className="text-xs text-text-muted">({total} productos)</span>}
              </div>
            </div>
            {selectedIds.size > 0 && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full flex-shrink-0">
                {selectedIds.size} seleccionados
              </span>
            )}
          </div>

          {/* Loading skeletons */}
          {loadingProducts && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-3">
                  <div className="w-full aspect-square rounded-lg bg-surface-elevated mb-2" />
                  <div className="h-3 bg-surface-elevated rounded w-1/3 mb-1" />
                  <div className="h-4 bg-surface-elevated rounded w-full mb-1" />
                  <div className="h-3 bg-surface-elevated rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loadingProducts && products.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {products.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedIds.has(p.id)}
                    onToggle={() => toggleProduct(p)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(o => Math.max(0, o - 40))}
                  className="btn-ghost text-sm disabled:opacity-30"
                >
                  <Icon icon="tabler:chevron-left" className="w-4 h-4 mr-1" />
                  Anterior
                </button>
                <span className="text-xs text-text-muted">
                  {offset + 1}–{Math.min(offset + 40, total)} de {total}
                </span>
                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={() => setOffset(productsData?.nextOffset ?? offset)}
                  className="btn-ghost text-sm disabled:opacity-30"
                >
                  Siguiente
                  <Icon icon="tabler:chevron-right" className="w-4 h-4 ml-1" />
                </button>
              </div>
            </>
          )}

          {!loadingProducts && products.length === 0 && (
            <div className="text-center py-12 text-text-muted text-sm">
              <Icon icon="tabler:search-off" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No se encontraron productos en esta categoría.
            </div>
          )}
        </>
      )}

      {/* Empty search state (typed but no suggestion clicked yet) */}
      {!activeSlug && query.trim().length > 0 && !showSuggestions && suggestions.length === 0 && (
        <div className="text-center py-10 text-text-muted text-sm">
          <Icon icon="tabler:search-off" className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No se encontraron resultados para "{query}"
        </div>
      )}
    </div>
  )
}

// ── Shopping list grouped by store ────────────────────────────────────────

export function SuperShoppingList({
  products,
  onRemove,
}: {
  products: SelectedProduct[]
  onRemove: (productId: number) => void
}) {
  if (products.length === 0) return null

  const total = products.reduce((s, p) => s + p.price, 0)

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

      <div className="flex flex-col gap-1.5">
        {products.map(p => (
          <div key={p.productId} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2">
            <div className="w-9 h-9 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-border/30">
              {p.image
                ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-0.5" />
                : <div className="w-full h-full flex items-center justify-center"><Icon icon="tabler:package" className="w-4 h-4 text-text-muted/30" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-primary font-medium truncate">{p.name}</div>
              <div className="text-[10px] text-text-muted">
                {p.brand && <span>{p.brand} · </span>}
                {p.unit}
              </div>
            </div>
            <span className="text-xs font-semibold text-primary tabular-nums flex-shrink-0">
              RD${p.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>
            <button
              type="button"
              onClick={() => onRemove(p.productId)}
              className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
            >
              <Icon icon="tabler:x" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SuperPickerInline — replaces the modal, renders inline in the page ─────

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
      concepto: p.name,
      montoPlaneado: p.price,
      productoExterno: {
        productId: p.productId,
        name: p.name,
        image: p.image,
        unit: p.unit,
        brand: p.brand,
        price: p.price,
      },
    }))
    onSubmit(items)
  }

  const total = selected.reduce((s, p) => s + p.price, 0)

  return (
    <div className="flex flex-col bg-surface border border-border rounded-xl overflow-hidden">

      {/* ── Top bar with back arrow ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/60 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
        >
          <Icon icon="tabler:arrow-left" className="w-4 h-4" />
          <span className="hidden sm:inline">Volver a lista</span>
        </button>

        <div className="flex-1 flex items-center gap-2 justify-center min-w-0">
          <Icon icon="tabler:building-store" className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-text-primary truncate">{presupuestoNombre}</span>
        </div>

        {selected.length > 0 ? (
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap">
            {selected.length} {selected.length === 1 ? 'producto' : 'productos'}
          </span>
        ) : (
          <div className="w-20 flex-shrink-0" />
        )}
      </div>

      {/* ── Body: search panel + list panel ── */}
      <div className="flex flex-col lg:flex-row" style={{ minHeight: '520px' }}>

        {/* Left: search + browse */}
        <div className="flex-1 overflow-y-auto p-5 border-b lg:border-b-0 lg:border-r border-border/60">
          <SuperSearch
            selectedProducts={selected}
            onProductsChange={setSelected}
          />
        </div>

        {/* Right: shopping list */}
        <div className="lg:w-72 flex-shrink-0 flex flex-col p-4 bg-background/30">
          {selected.length > 0 ? (
            <SuperShoppingList
              products={selected}
              onRemove={id => setSelected(prev => prev.filter(p => p.productId !== id))}
            />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-surface-elevated flex items-center justify-center">
                <Icon icon="tabler:shopping-cart-off" className="w-7 h-7 text-text-muted opacity-40" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">Tu lista está vacía</p>
                <p className="text-xs text-text-muted mt-0.5">Selecciona productos para agregarlos</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/60 flex-shrink-0">
        <div className="text-sm text-text-secondary">
          {selected.length > 0 && (
            <span>
              <strong className="text-text-primary tabular-nums">{selected.length}</strong> producto{selected.length !== 1 ? 's' : ''}{' '}
              ·{' '}
              <strong className="text-primary tabular-nums">
                RD${total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading || selected.length === 0}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon="tabler:plus" className="w-4 h-4" />
            {loading ? 'Agregando...' : `Agregar ${selected.length > 0 ? selected.length : ''} producto${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export { STORES }
