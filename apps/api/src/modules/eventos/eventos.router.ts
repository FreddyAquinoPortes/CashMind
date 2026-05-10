import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { EventosService } from './eventos.service'

export const eventosRouter = Router()
const svc = new EventosService()

eventosRouter.get('/clientes/:clienteId/eventos', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.listar(
      req.params.clienteId!,
      req.query.mes as string | undefined,
      req.query.inicio as string | undefined,
      req.query.fin as string | undefined,
    ) })
  } catch (err) { next(err) }
})

eventosRouter.post('/clientes/:clienteId/eventos', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.crear(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

eventosRouter.patch('/eventos/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const clienteId = req.query.clienteId as string || ''
    res.json({ data: await svc.actualizar(req.params.id!, clienteId, req.body) })
  } catch (err) { next(err) }
})

eventosRouter.delete('/eventos/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const clienteId = req.query.clienteId as string || ''
    await svc.eliminar(req.params.id!, clienteId)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

eventosRouter.post('/eventos/:id/ejecutar', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    // clienteId can come from body or query; fall back to looking up the event by id+user
    const clienteId = (req.body.clienteId as string) || (req.query.clienteId as string) || ''
    res.json({ data: await svc.ejecutar(req.params.id!, clienteId, req.body) })
  } catch (err) { next(err) }
})
