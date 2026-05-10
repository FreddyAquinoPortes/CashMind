import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { TarjetasService } from './tarjetas.service'

export const tarjetasRouter = Router()
const svc = new TarjetasService()

tarjetasRouter.get('/clientes/:clienteId/tarjetas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.list(req.params.clienteId!) })
  } catch (err) { next(err) }
})

tarjetasRouter.post('/clientes/:clienteId/tarjetas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.create(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

tarjetasRouter.patch('/tarjetas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.update(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

tarjetasRouter.delete('/tarjetas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.remove(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})
