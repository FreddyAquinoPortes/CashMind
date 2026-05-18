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
  // Diagnostic: show all accounts and last 5 transactions regardless of type
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { clienteId },
    select: { id: true, alias: true, banco: true, saldo: true, tipo: true },
  })

  const lastTxs = await prisma.transaccion.findMany({
    where: { clienteId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, concepto: true, tipo: true, monto: true, cuentaId: true, tarjetaId: true, createdAt: true, estado: true },
  })

  const lastPagosEC = await prisma.pagoExtraCredito.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    include: { extraCredito: { include: { tarjeta: { select: { clienteId: true, alias: true } } } }, cuenta: { select: { alias: true, saldo: true } } },
  }).then(rows => rows.filter(r => r.extraCredito?.tarjeta?.clienteId === clienteId))

  res.json({
    clienteId,
    cuentas,
    ultimasTransacciones: lastTxs,
    ultimosPagosExtraCredito: lastPagosEC.map(p => ({
      id: p.id,
      monto: p.monto,
      fecha: p.fecha,
      cuenta: p.cuenta,
      extraCredito: p.extraCredito?.descripcion,
    })),
  })
})
