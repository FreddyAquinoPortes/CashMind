import { Router } from 'express'
import { prisma } from '../../shared/prisma'

export const categoriasRouter = Router()

categoriasRouter.get('/categorias', async (_req, res, next) => {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { clienteId: null },
      include: { subcategorias: { orderBy: { nombre: 'asc' } } },
      orderBy: { orden: 'asc' },
    })
    res.json({ data: categorias })
  } catch (err) { next(err) }
})
