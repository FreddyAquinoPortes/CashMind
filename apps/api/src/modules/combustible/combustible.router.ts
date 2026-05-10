import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { requireCliente } from '../../shared/cliente.helper'
import { CombustibleService } from './combustible.service'

export const combustibleRouter = Router()
const svc = new CombustibleService()

// ── Vehículos ──────────────────────────────────────────────────────────────
combustibleRouter.get('/clientes/:clienteId/vehiculos', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.listVehiculos(req.params.clienteId!) })
  } catch (err) { next(err) }
})

combustibleRouter.post('/clientes/:clienteId/vehiculos', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.createVehiculo(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

combustibleRouter.patch('/vehiculos/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.updateVehiculo(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

combustibleRouter.delete('/vehiculos/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.removeVehiculo(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Rutas ──────────────────────────────────────────────────────────────────
combustibleRouter.get('/clientes/:clienteId/rutas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.listRutas(req.params.clienteId!) })
  } catch (err) { next(err) }
})

combustibleRouter.post('/clientes/:clienteId/rutas', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.status(201).json({ data: await svc.createRuta(req.params.clienteId!, req.body) })
  } catch (err) { next(err) }
})

combustibleRouter.patch('/rutas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await svc.updateRuta(req.params.id!, req.body) })
  } catch (err) { next(err) }
})

combustibleRouter.delete('/rutas/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.removeRuta(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Precios Combustible ────────────────────────────────────────────────────
combustibleRouter.get('/combustible/precios', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const [lista, latest] = await Promise.all([svc.listPrecios(), svc.latestPrecios()])
    res.json({ data: { lista, latest } })
  } catch (err) { next(err) }
})

combustibleRouter.post('/combustible/precios', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json({ data: await svc.createPrecio(req.body) })
  } catch (err) { next(err) }
})

combustibleRouter.delete('/combustible/precios/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await svc.removePrecio(req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Cálculo ────────────────────────────────────────────────────────────────
combustibleRouter.get('/clientes/:clienteId/combustible/calculo', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await requireCliente(req.params.clienteId!, req.user!.id)
    res.json({ data: await svc.calcular(req.params.clienteId!) })
  } catch (err) { next(err) }
})
