import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { PersonasService } from './personas.service'

export const personasRouter = Router()
const svc = new PersonasService()

personasRouter.get('/clientes/:clienteId/personas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.list(req.params.clienteId!) })
  } catch (err) { next(err) }
})

personasRouter.post('/clientes/:clienteId/personas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.create(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

personasRouter.patch('/personas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.update(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

personasRouter.delete('/personas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.remove(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

personasRouter.get('/personas/:id/balance', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.balance(req.params.id!) })
  } catch (err) { next(err) }
})
