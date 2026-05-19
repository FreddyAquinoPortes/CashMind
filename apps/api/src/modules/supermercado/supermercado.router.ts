import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { SupermercadoService } from './supermercado.service'

export const supermercadoRouter = Router()
const svc = new SupermercadoService()

/**
 * GET /supermercado/suggestions?q=arroz
 * Typeahead search — returns category/group suggestions
 */
supermercadoRouter.get('/supermercado/suggestions', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query['q'] ?? '')
    const data = await svc.suggestions(q)
    res.json({ data })
  } catch (err) { next(err) }
})

/**
 * GET /supermercado/groups/:slug/products?offset=0&limit=40&sort=lowest_price
 * Products within a group/category
 */
supermercadoRouter.get('/supermercado/groups/:slug/products', requireAuth, async (req, res, next) => {
  try {
    const { slug } = req.params
    const offset = Number(req.query['offset'] ?? 0)
    const limit = Number(req.query['limit'] ?? 40)
    const sort = String(req.query['sort'] ?? 'lowest_price')
    const shopIdsRaw = req.query['shop_ids']
    const shopIds = Array.isArray(shopIdsRaw)
      ? shopIdsRaw.map(Number)
      : shopIdsRaw ? [Number(shopIdsRaw)] : undefined

    const data = await svc.products(slug!, { offset, limit, sort, shopIds })
    res.json({ data })
  } catch (err) { next(err) }
})

/**
 * GET /supermercado/groups/:slug/shops
 * Available stores for a product group
 */
supermercadoRouter.get('/supermercado/groups/:slug/shops', requireAuth, async (req, res, next) => {
  try {
    const data = await svc.shops(req.params['slug']!)
    res.json({ data })
  } catch (err) { next(err) }
})

/**
 * GET /supermercado/groups/:slug/products-merged
 * Products deduplicated across stores with per-store pricing
 */
supermercadoRouter.get('/supermercado/groups/:slug/products-merged', requireAuth, async (req, res, next) => {
  try {
    const data = await svc.productsMerged(req.params['slug']!)
    res.json({ data })
  } catch (err) { next(err) }
})
