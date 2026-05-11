import { Router } from 'express'
import { prisma } from '../../shared/prisma'

export const categoriasRouter = Router()

// ── Categorías ─────────────────────────────────────────────────────────────────

// GET /categorias  → todas (sistema + del cliente si se pasa ?clienteId=)
categoriasRouter.get('/categorias', async (req, res, next) => {
  try {
    const { clienteId } = req.query as { clienteId?: string }
    const categorias = await prisma.categoria.findMany({
      where: clienteId
        ? { OR: [{ clienteId: null }, { clienteId }] }
        : { clienteId: null },
      include: { subcategorias: { orderBy: { nombre: 'asc' } } },
      orderBy: { orden: 'asc' },
    })
    res.json({ data: categorias })
  } catch (err) { next(err) }
})

// POST /categorias
categoriasRouter.post('/categorias', async (req, res, next) => {
  try {
    const { clienteId, nombre, color, icono, esEsencial, peso, orden } = req.body
    const cat = await prisma.categoria.create({
      data: {
        clienteId: clienteId ?? null,
        nombre,
        color,
        icono,
        esEsencial: esEsencial ?? false,
        peso: peso ?? 5,
        orden: orden ?? 0,
      },
      include: { subcategorias: true },
    })
    res.status(201).json({ data: cat })
  } catch (err) { next(err) }
})

// PUT /categorias/:id
categoriasRouter.put('/categorias/:id', async (req, res, next) => {
  try {
    const { nombre, color, icono, esEsencial, peso, orden } = req.body
    const cat = await prisma.categoria.update({
      where: { id: req.params.id },
      data: { nombre, color, icono, esEsencial, peso, orden },
      include: { subcategorias: true },
    })
    res.json({ data: cat })
  } catch (err) { next(err) }
})

// DELETE /categorias/:id
categoriasRouter.delete('/categorias/:id', async (req, res, next) => {
  try {
    await prisma.categoria.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── Subcategorías ──────────────────────────────────────────────────────────────

// POST /categorias/:catId/subcategorias
categoriasRouter.post('/categorias/:catId/subcategorias', async (req, res, next) => {
  try {
    const { nombre, color, icono, peso } = req.body
    const sub = await prisma.subcategoria.create({
      data: {
        categoriaId: req.params.catId,
        nombre,
        color,
        icono,
        peso: peso ?? 5,
      },
    })
    res.status(201).json({ data: sub })
  } catch (err) { next(err) }
})

// PUT /categorias/:catId/subcategorias/:subId
categoriasRouter.put('/categorias/:catId/subcategorias/:subId', async (req, res, next) => {
  try {
    const { nombre, color, icono, peso } = req.body
    const sub = await prisma.subcategoria.update({
      where: { id: req.params.subId },
      data: { nombre, color, icono, peso },
    })
    res.json({ data: sub })
  } catch (err) { next(err) }
})

// DELETE /categorias/:catId/subcategorias/:subId
categoriasRouter.delete('/categorias/:catId/subcategorias/:subId', async (req, res, next) => {
  try {
    await prisma.subcategoria.delete({ where: { id: req.params.subId } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})
