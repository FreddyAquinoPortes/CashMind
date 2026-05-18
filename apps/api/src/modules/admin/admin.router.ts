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
  const { cuentaId, monto: montoStr, modo } = req.body as {
    cuentaId?: string
    monto?: string | number
    modo?: 'info' | 'ajustar'
  }

  // ── INFO mode: show accounts + last transactions ──────────────────────────
  if (!modo || modo === 'info') {
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: { clienteId },
      select: { id: true, alias: true, banco: true, saldo: true, tipo: true },
    })
    const lastTxs = await prisma.transaccion.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, concepto: true, tipo: true, monto: true, cuentaId: true, createdAt: true },
    })
    res.json({ clienteId, cuentas, ultimasTransacciones: lastTxs })
    return
  }

  // ── AJUSTAR mode: subtract monto from the specified account ──────────────
  if (!cuentaId || !montoStr) {
    res.status(400).json({ error: 'cuentaId y monto son requeridos para modo=ajustar' })
    return
  }

  const monto = Number(montoStr)
  if (isNaN(monto) || monto <= 0) {
    res.status(400).json({ error: 'monto debe ser un número positivo' })
    return
  }

  // Verify the account belongs to this client
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, clienteId },
  })
  if (!cuenta) {
    res.status(404).json({ error: 'Cuenta no encontrada para este cliente' })
    return
  }

  const saldoAntes = Number(cuenta.saldo)
  const cuentaUpdated = await prisma.cuentaBancaria.update({
    where: { id: cuentaId },
    data: { saldo: { decrement: monto } },
  })

  res.json({
    ok: true,
    cuenta: {
      id: cuentaId,
      alias: cuenta.alias ?? cuenta.banco,
      saldoAntes,
      montoDescontado: monto,
      saldoDespues: Number(cuentaUpdated.saldo),
    },
    nota: 'Saldo ajustado directamente. El evento nómina ya no existe.',
  })
})
