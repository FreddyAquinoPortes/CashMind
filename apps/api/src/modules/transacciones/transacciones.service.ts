import { prisma } from '../../shared/prisma'
import { Prisma } from '@prisma/client'

interface ListarQuery {
  cuentaId?: string
  desde?: string
  hasta?: string
  tipo?: string
  categoriaId?: string
  search?: string
  limit?: number
  offset?: number
}

export class TransaccionesService {
  async listar(clienteId: string, query: ListarQuery = {}) {
    const { cuentaId, desde, hasta, tipo, categoriaId, search, limit = 50, offset = 0 } = query
    const where: Prisma.TransaccionWhereInput = { clienteId }
    if (cuentaId)     where.cuentaId    = cuentaId
    if (tipo)         where.tipo        = tipo as any
    if (categoriaId)  where.categoriaId = categoriaId
    if (desde || hasta) {
      where.fecha = {}
      if (desde) where.fecha.gte = new Date(desde)
      if (hasta) where.fecha.lte = new Date(hasta)
    }
    if (search) where.concepto = { contains: search, mode: 'insensitive' }

    const [total, items] = await Promise.all([
      prisma.transaccion.count({ where }),
      prisma.transaccion.findMany({
        where,
        include: {
          subcategoria: { select: { id: true, nombre: true, color: true } },
          cuenta:       { select: { id: true, alias: true, banco: true } },
        },
        orderBy: { fecha: 'desc' },
        take:  Number(limit),
        skip:  Number(offset),
      }),
    ])
    return { total, items }
  }

  async obtener(id: string, clienteId: string) {
    const tx = await prisma.transaccion.findFirst({
      where: { id, clienteId },
      include: {
        archivosAdjuntos: false,
      },
    })
    if (!tx) throw Object.assign(new Error('Transacción no encontrada'), { status: 404 })
    return tx
  }

  async crear(clienteId: string, body: Record<string, unknown>) {
    // Extract deudaId — not a DB column on Transaccion, handled separately
    const { deudaId, ...txData } = body

    return prisma.$transaction(async (tx) => {
      // 1. Create the transaction record
      const transaccion = await tx.transaccion.create({
        data: { ...txData, clienteId } as any,
      })

      // 2. Update account balance (INGRESO adds, everything else subtracts)
      if (transaccion.cuentaId && transaccion.monto) {
        const delta = transaccion.tipo === 'INGRESO'
          ? Number(transaccion.monto)
          : -Number(transaccion.monto)
        await tx.cuentaBancaria.update({
          where: { id: transaccion.cuentaId },
          data:  { saldo: { increment: delta } },
        })
      }

      // 3. If PAGO_DEUDA + deudaId → reduce debt balance and create PagoDeuda record
      if (transaccion.tipo === 'PAGO_DEUDA' && deudaId) {
        const deuda = await tx.deuda.findFirst({
          where: { id: deudaId as string, clienteId },
        })
        if (!deuda) {
          throw Object.assign(new Error('Deuda no encontrada'), { status: 404 })
        }

        const montoPago  = Number(transaccion.monto)
        const saldoActual = Number(deuda.saldoActual)

        if (montoPago > saldoActual) {
          throw Object.assign(
            new Error(`El pago (${montoPago}) supera el saldo actual de la deuda (${saldoActual.toFixed(2)})`),
            { status: 400 }
          )
        }

        const nuevoSaldo  = parseFloat((saldoActual - montoPago).toFixed(2))
        const nuevoEstado = nuevoSaldo === 0 ? 'SALDADA' : deuda.estado

        // PagoDeuda histórico vinculado a esta transacción
        await tx.pagoDeuda.create({
          data: {
            deudaId:       deudaId as string,
            monto:         montoPago,
            fecha:         transaccion.fecha,
            estado:        'EJECUTADO',
            transaccionId: transaccion.id,   // ← FK que vincula tx → pago
            notas:         `Pago desde transacción: ${transaccion.concepto}`,
          },
        })

        await tx.deuda.update({
          where: { id: deudaId as string },
          data:  { saldoActual: nuevoSaldo, estado: nuevoEstado as any },
        })
      }

      return transaccion
    })
  }

  async actualizar(id: string, clienteId: string, data: Record<string, unknown>) {
    await this.obtener(id, clienteId)
    // Strip deudaId from update (debt adjustments not supported on edit for simplicity)
    const { deudaId, ...txData } = data
    return prisma.transaccion.update({ where: { id }, data: txData as any })
  }

  async eliminar(id: string, clienteId: string) {
    const transaccion = await this.obtener(id, clienteId)

    return prisma.$transaction(async (tx) => {
      // Reverse account balance
      if (transaccion.cuentaId && transaccion.monto) {
        const delta = transaccion.tipo === 'INGRESO'
          ? -Number(transaccion.monto)
          : Number(transaccion.monto)
        await tx.cuentaBancaria.update({
          where: { id: transaccion.cuentaId },
          data:  { saldo: { increment: delta } },
        })
      }

      // Reverse debt payment if this tx was linked to a PagoDeuda
      if (transaccion.tipo === 'PAGO_DEUDA') {
        const pago = await tx.pagoDeuda.findUnique({
          where: { transaccionId: id },
        })
        if (pago) {
          const deuda = await tx.deuda.findUnique({ where: { id: pago.deudaId } })
          if (deuda) {
            const saldoRestaurado = parseFloat(
              (Number(deuda.saldoActual) + Number(pago.monto)).toFixed(2)
            )
            // If debt was marked SALDADA, reactivate it
            const estadoRestaurado = deuda.estado === 'SALDADA' ? 'ACTIVA' : deuda.estado
            await tx.deuda.update({
              where: { id: pago.deudaId },
              data:  { saldoActual: saldoRestaurado, estado: estadoRestaurado },
            })
          }
          await tx.pagoDeuda.delete({ where: { id: pago.id } })
        }
      }

      return tx.transaccion.delete({ where: { id } })
    })
  }

  async categorizarAuto(clienteId: string) {
    const reglas = await prisma.reglaCategorizacion.findMany({
      where: { clienteId, activa: true },
      orderBy: { prioridad: 'desc' },
    })

    const sinCategoria = await prisma.transaccion.findMany({
      where: { clienteId, categoriaId: '' },
    })

    let actualizadas = 0
    for (const t of sinCategoria) {
      for (const regla of reglas) {
        const match = regla.esRegex
          ? new RegExp(regla.patron, 'i').test(t.concepto)
          : t.concepto.toLowerCase().includes(regla.patron.toLowerCase())
        if (match) {
          await prisma.transaccion.update({
            where: { id: t.id },
            data:  { categoriaId: regla.categoriaId, subcategoriaId: regla.subcategoriaId },
          })
          actualizadas++
          break
        }
      }
    }
    return { revisadas: sinCategoria.length, actualizadas }
  }
}
