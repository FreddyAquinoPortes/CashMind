import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { ProyeccionesService } from './proyecciones.service'

export const proyeccionesRouter = Router()
const svc = new ProyeccionesService()

const rangeSchema = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
})

// ── Resumen de proyección ──────────────────────────────────────────────────
proyeccionesRouter.get('/clientes/:clienteId/proyecciones/resumen', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    const { desde, hasta } = rangeSchema.parse(req.query)
    res.json({ data: await svc.resumen(req.params.clienteId!, desde, hasta) })
  } catch (err) { next(err) }
})

// ── Items personalizados ───────────────────────────────────────────────────

// IMPORTANT: /items must come before /:id to avoid route collision
proyeccionesRouter.get('/clientes/:clienteId/proyecciones/items', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.listItems(req.params.clienteId!) })
  } catch (err) { next(err) }
})

proyeccionesRouter.post('/clientes/:clienteId/proyecciones/items', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.createItem(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

proyeccionesRouter.patch('/proyecciones/items/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const clienteId = (req.query.clienteId as string) || req.body.clienteId || ''
    res.json({ data: await svc.updateItem(req.params.id!, clienteId, req.body) })
  } catch (err) { next(err) }
})

proyeccionesRouter.delete('/proyecciones/items/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const clienteId = (req.query.clienteId as string) || req.body.clienteId || ''
    await svc.deleteItem(req.params.id!, clienteId)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Convertir item a evento ────────────────────────────────────────────────
proyeccionesRouter.post('/proyecciones/items/:id/convertir', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const clienteId = (req.query.clienteId as string) || req.body.clienteId || ''
    res.status(201).json({ data: await svc.convertirAEvento(req.params.id!, clienteId, req.body) })
  } catch (err) { next(err) }
})
