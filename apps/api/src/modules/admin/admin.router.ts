/**
 * TEMPORARY admin endpoint — rollback last balance-affecting transaction.
 * Remove this file and its registration in server.ts after use.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../../shared/prisma'

export const adminRouter = Router()

const ADMIN_SECRET = 'rollback-cashmind-2026'

adminRouter.post('/admin/rollback-last-balance', async (req: Request, res: Response) => {
  const { email, secret } = req.body as { email?: string; secret?: string }

  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!email) {
    res.status(400).json({ error: 'email required' })
    return
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { clientes: true },
  })
  if (!usuario || !usuario.clientes.length) {
    res.status(404).json({ error: 'Usuario/cliente not found' })
    return
  }

  const clienteId = usuario.clientes[0].id

  // Find the last transaction that changed an account balance
  const lastTx = await prisma.transaccion.findFirst({
    where: {
      clienteId,
      cuentaId: { not: null },
      tipo: { in: ['INGRESO', 'GASTO'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { cuenta: { select: { alias: true, banco: true, saldo: true } } },
  })

  if (!lastTx) {
    res.status(404).json({ error: 'No qualifying transaction found' })
    return
  }

  const revertDelta = lastTx.tipo === 'INGRESO'
    ? -Number(lastTx.monto)
    : Number(lastTx.monto)

  const saldoAntes = Number((lastTx as any).cuenta?.saldo ?? 0)

  const cuentaUpdated = await prisma.cuentaBancaria.update({
    where: { id: lastTx.cuentaId! },
    data: { saldo: { increment: revertDelta } },
  })

  res.json({
    ok: true,
    transaccion: {
      id: lastTx.id,
      concepto: lastTx.concepto,
      tipo: lastTx.tipo,
      monto: lastTx.monto,
      createdAt: lastTx.createdAt,
    },
    cuenta: {
      id: lastTx.cuentaId,
      alias: (lastTx as any).cuenta?.alias ?? (lastTx as any).cuenta?.banco,
      saldoAntes,
      saldoDespues: Number(cuentaUpdated.saldo),
      delta: revertDelta,
    },
    nota: 'La transacción NO fue eliminada — solo se revirtió el saldo.',
  })
})
