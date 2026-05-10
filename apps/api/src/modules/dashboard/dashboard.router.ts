import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { DashboardService } from './dashboard.service'

export const dashboardRouter = Router()
const svc = new DashboardService()

dashboardRouter.get('/clientes/:clienteId/dashboard', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.getKpis(req.params.clienteId!) })
  } catch (err) { next(err) }
})
