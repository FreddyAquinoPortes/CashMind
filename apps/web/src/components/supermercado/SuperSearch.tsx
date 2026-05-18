/**
 * SuperSearch — product search & picker for supermercadosrd.com integration.
 *
 * Flow:
 *   1. User types a search term → typeahead suggestions (group names)
 *   2. User picks a group → product list loads (sorted by lowest price)
 *   3. User selects products → they get added to the budget as líneas
 *
 * Products are grouped by store in the final shopping list.
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
  storeName: string // will be resolved later
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

function ProductCard({
  product,
  selected,
  onToggle,
}: {
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
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Icon icon="tabler:check" className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Cheapest badge */}
      {product.isCheaper && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold uppercase">
          Mejor precio
        </div>
      )}

      {/* Product image */}
      <div className="w-full aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden mb-2">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain p-1"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).src = '' }}
          />
        ) : (
          <Icon icon="tabler:shopping-cart" className="w-8 h-8 text-text-muted/30" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col gap-0.5 min-h-[60px]">
        <span className="text-xs text-text-muted">{product.brand?.name ?? ''}</span>
        <span className="text-sm text-text-primary font-medium line-clamp-2 leading-tight">
          {product.name}
        </span>
        <span className="text-xs text-text-muted">{product.unit}</span>
      </div>

      {/* Price */}
      <div className="mt-2 pt-2 border-t border-border/50">
        <span className="text-base font-bold text-primary tabular-nums">
          RD${price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function SuperSearch({
  selectedProducts,
  onProductsChange,
}: {
  selectedProducts: SelectedProduct[]
  onProductsChange: (products: SelectedProduct[]) => void
}) {
  const [query, setQuery] = useState('')
  const [activeSlug, setActiveSlug] = useState('')
  const [offset, setOffset] = useState(0)
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

  const selectGroup = useCallback((slug: string) => {
    setActiveSlug(slug)
    setOffset(0)
    setShowSuggestions(false)
  }, [])

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
          storeName: '', // Will be resolved from per-store pricing
        },
      ])
    }
  }, [selectedProducts, onProductsChange])

  const selectedIds = new Set(selectedProducts.map(p => p.productId))
  const products = productsData?.products ?? []
  const total = productsData?.total ?? 0
  const hasMore = productsData?.nextOffset !== null && productsData?.nextOffset !== undefined

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Icon icon="tabler:search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar productos: arroz, leche, pollo..."
            className="input pl-9 pr-4"
            autoFocus
          />
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={`${s.groupId}-${i}`}
                type="button"
                onClick={() => { setQuery(s.groupName); selectGroup(s.groupHumanId) }}
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

      {/* Active group header */}
      {activeSlug && productsData?.group && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveSlug(''); setQuery('') }}
              className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <Icon icon="tabler:arrow-left" className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold text-text-primary">
              {productsData.group.name}
            </h3>
            <span className="text-xs text-text-muted">
              {total} productos
            </span>
          </div>
          {selectedIds.size > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              {selectedIds.size} seleccionados
            </span>
          )}
        </div>
      )}

      {/* Products grid */}
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

          {/* Pagination */}
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

      {!loadingProducts && activeSlug && products.length === 0 && (
        <div className="text-center py-12 text-text-muted text-sm">
          <Icon icon="tabler:search-off" className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No se encontraron productos en esta categoría.
        </div>
      )}

      {!activeSlug && !loadingProducts && (
        <div className="text-center py-12 text-text-muted text-sm">
          <Icon icon="tabler:shopping-cart" className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Busca productos de supermercados dominicanos</p>
          <p className="text-xs mt-1">Sirena, Nacional, Jumbo, Plaza Lama, Bravo y mas</p>
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
          Lista de compras ({products.length} productos)
        </h3>
        <span className="text-sm font-bold text-primary tabular-nums">
          RD${total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {products.map(p => (
          <div
            key={p.productId}
            className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2"
          >
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg bg-white flex-shrink-0 overflow-hidden">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon icon="tabler:package" className="w-5 h-5 text-text-muted/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-primary font-medium truncate">{p.name}</div>
              <div className="text-xs text-text-muted">
                {p.brand && <span>{p.brand} · </span>}
                {p.unit}
              </div>
            </div>

            {/* Price */}
            <span className="text-sm font-semibold text-primary tabular-nums flex-shrink-0">
              RD${p.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>

            {/* Remove */}
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

export { STORES }
