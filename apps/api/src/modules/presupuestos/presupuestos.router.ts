import { Router } from 'express'
import * as svc from './presupuestos.service'

export const presupuestosRouter = Router()

// ── Presupuestos ───────────────────────────────────────────────────────────

presupuestosRouter.get('/clientes/:clienteId/presupuestos', async (req, res, next) => {
  try {
    res.json({ data: await svc.listPresupuestos(req.params.clienteId!) })
  } catch (e) { next(e) }
})

presupuestosRouter.post('/clientes/:clienteId/presupuestos', async (req, res, next) => {
  try {
    res.status(201).json({ data: await svc.createPresupuesto(req.params.clienteId!, req.body) })
  } catch (e) { next(e) }
})

presupuestosRouter.get('/clientes/:clienteId/presupuestos/:id', async (req, res, next) => {
  try {
    res.json({ data: await svc.getPresupuesto(req.params.clienteId!, req.params.id!) })
  } catch (e) { next(e) }
})

presupuestosRouter.patch('/clientes/:clienteId/presupuestos/:id', async (req, res, next) => {
  try {
    res.json({ data: await svc.updatePresupuesto(req.params.clienteId!, req.params.id!, req.body) })
  } catch (e) { next(e) }
})

presupuestosRouter.delete('/clientes/:clienteId/presupuestos/:id', async (req, res, next) => {
  try {
    await svc.deletePresupuesto(req.params.clienteId!, req.params.id!)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// Auto-suggest lines from recurring events, debts, fuel routes
presupuestosRouter.get('/clientes/:clienteId/presupuestos/sugerencias', async (req, res, next) => {
  try {
    const { fechaInicio, fechaFin } = req.query as { fechaInicio: string; fechaFin: string }
    res.json({ data: await svc.getSugerencias(req.params.clienteId!, fechaInicio, fechaFin) })
  } catch (e) { next(e) }
})

// ── Líneas ─────────────────────────────────────────────────────────────────

presupuestosRouter.post('/clientes/:clienteId/presupuestos/:id/lineas', async (req, res, next) => {
  try {
    res.status(201).json({ data: await svc.addLinea(req.params.clienteId!, req.params.id!, req.body) })
  } catch (e) { next(e) }
})

presupuestosRouter.post('/clientes/:clienteId/presupuestos/:id/lineas/bulk', async (req, res, next) => {
  try {
    const { items } = req.body as { items: unknown[] }
    res.status(201).json({ data: await svc.addLineasBulk(req.params.clienteId!, req.params.id!, items as any[]) })
  } catch (e) { next(e) }
})

presupuestosRouter.patch('/presupuestos/lineas/:lineaId', async (req, res, next) => {
  try {
    res.json({ data: await svc.updateLinea(req.params.lineaId!, req.body) })
  } catch (e) { next(e) }
})

presupuestosRouter.delete('/presupuestos/lineas/:lineaId', async (req, res, next) => {
  try {
    await svc.deleteLinea(req.params.lineaId!)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// ── Ejecución (línea individual — presupuestos NORMAL) ─────────────────────

presupuestosRouter.post('/clientes/:clienteId/presupuestos/lineas/:lineaId/ejecutar', async (req, res, next) => {
  try {
    res.status(201).json({ data: await svc.ejecutarLinea(req.params.clienteId!, req.params.lineaId!, req.body) })
  } catch (e) { next(e) }
})

// ── Toggle incluido (presupuestos ATOMICO) ─────────────────────────────────

presupuestosRouter.patch('/presupuestos/lineas/:lineaId/incluido', async (req, res, next) => {
  try {
    const { incluido } = req.body as { incluido: boolean }
    res.json({ data: await svc.toggleIncluido(req.params.lineaId!, incluido) })
  } catch (e) { next(e) }
})

// ── Ejecución atómica (todo en una sola transacción) ──────────────────────

presupuestosRouter.post('/clientes/:clienteId/presupuestos/:id/ejecutar-atomico', async (req, res, next) => {
  try {
    res.status(201).json({ data: await svc.ejecutarAtomico(req.params.clienteId!, req.params.id!, req.body) })
  } catch (e) { next(e) }
})
