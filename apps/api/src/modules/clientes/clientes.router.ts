import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../shared/prisma'

export const clientesRouter = Router()

clientesRouter.get('/clientes', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { usuarioId: req.user!.id },
      include: {
        cuentas: { select: { id: true, alias: true, banco: true, saldo: true, moneda: true } },
        tarjetas: { select: { id: true, alias: true, banco: true, ultimosCuatro: true, saldoActual: true, limite: true } },
      },
    })
    res.json({ data: clientes })
  } catch (err) { next(err) }
})

clientesRouter.get('/clientes/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = req.params['id']
    if (!id) { res.status(400).json({ error: 'ID requerido' }); return }
    const cliente = await prisma.cliente.findFirst({
      where: { id, usuarioId: req.user!.id },
      include: {
        cuentas: true,
        tarjetas: true,
        _count: { select: { transacciones: true, deudas: true, personas: true } },
      },
    })
    if (!cliente) { res.status(404).json({ error: 'Cliente no encontrado' }); return }
    res.json({ data: cliente })
  } catch (err) { next(err) }
})
