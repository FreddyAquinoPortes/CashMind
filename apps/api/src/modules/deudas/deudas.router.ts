import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { DeudasService } from './deudas.service'

export const deudasRouter = Router()
const svc = new DeudasService()

deudasRouter.get('/clientes/:clienteId/deudas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.list(req.params.clienteId!) })
  } catch (err) { next(err) }
})

deudasRouter.post('/clientes/:clienteId/deudas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.create(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

deudasRouter.patch('/deudas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.update(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

deudasRouter.delete('/deudas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.remove(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

deudasRouter.get('/deudas/:id/pagos', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.listPagos(req.params.id!) })
  } catch (err) { next(err) }
})

deudasRouter.post('/deudas/:id/pagos', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json({ data: await svc.registrarPago(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

deudasRouter.get('/deudas/:id/amortizacion', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.amortizacion(req.params.id!) })
  } catch (err) { next(err) }
})
