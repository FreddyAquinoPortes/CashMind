import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { TransaccionesService } from './transacciones.service'

export const transaccionesRouter = Router()
const svc = new TransaccionesService()

transaccionesRouter.get('/clientes/:clienteId/transacciones', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.list(req.params.clienteId!, req.query) })
  } catch (err) { next(err) }
})

transaccionesRouter.post('/clientes/:clienteId/transacciones', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.create(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

transaccionesRouter.patch('/transacciones/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.update(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

transaccionesRouter.delete('/transacciones/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.remove(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})
