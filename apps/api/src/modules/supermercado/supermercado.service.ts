/**
 * Proxy service for supermercadosrd.com API.
 *
 * All product data belongs to supermercadosrd.com — we only cache responses
 * in-memory for a short TTL to reduce latency and respect their servers.
 */

const BASE = 'https://supermercadosrd.com/api'

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
  Referer: 'https://supermercadosrd.com/',
  Origin: 'https://supermercadosrd.com',
}

// ── Simple TTL cache ──────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  // Prevent memory leaks — cap at 500 entries
  if (cache.size > 500) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

// ── Fetch helper ──────────────────────────────────────────────────────────
async function proxyFetch<T>(path: string): Promise<T> {
  const cached = getCached<T>(path)
  if (cached) return cached

  const res = await fetch(`${BASE}${path}`, { headers: BROWSER_HEADERS })
  if (!res.ok) {
    throw Object.assign(
      new Error(`supermercadosrd.com returned ${res.status}`),
      { status: res.status },
    )
  }
  const data = (await res.json()) as T
  setCache(path, data)
  return data
}

// ── Public types ──────────────────────────────────────────────────────────

export interface SuggestionItem {
  phrase: string
  sml: number
  groupId: number
  groupName: string
  groupHumanId: string
  parentGroupName: string
}

export interface ProductBrand {
  id: number
  name: string
}

export interface ProductItem {
  id: number
  name: string
  image: string
  unit: string
  categoryId: number
  brand: ProductBrand | null
  currentPrice: string
  isCheaper: boolean
}

export interface GroupInfo {
  id: number
  name: string
  description: string | null
  humanId: string
  imageUrl: string | null
  isComparable: boolean
}

export interface ProductsResponse {
  group: GroupInfo
  products: ProductItem[]
  total: number
  nextOffset: number | null
}

export interface ShopInfo {
  id: number
  name: string
  count: number
}

// ── Service ───────────────────────────────────────────────────────────────

export class SupermercadoService {
  /** Search suggestions (typeahead) */
  async suggestions(query: string): Promise<SuggestionItem[]> {
    if (query.length < 2) return []
    const encoded = encodeURIComponent(query)
    return proxyFetch<SuggestionItem[]>(`/suggestions?value=${encoded}`)
  }

  /** Get products for a group/category slug */
  async products(
    slug: string,
    opts: { offset?: number; limit?: number; sort?: string; shopIds?: number[] } = {},
  ): Promise<ProductsResponse> {
    const params = new URLSearchParams()
    if (opts.offset) params.set('offset', String(opts.offset))
    params.set('limit', String(opts.limit ?? 40))
    if (opts.sort) params.set('sort', opts.sort)
    if (opts.shopIds) {
      for (const id of opts.shopIds) params.append('shop_ids', String(id))
    }
    const qs = params.toString()
    return proxyFetch<ProductsResponse>(`/groups/${slug}/products?${qs}`)
  }

  /** Get available shops for a group */
  async shops(slug: string): Promise<ShopInfo[]> {
    return proxyFetch<ShopInfo[]>(`/groups/${slug}/shops`)
  }
}
