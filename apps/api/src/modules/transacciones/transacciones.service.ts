import { prisma } from '../../shared/prisma'
import { Prisma } from '@prisma/client'

interface ListarQuery {
  cuentaId?: string
  desde?: string
  hasta?: string
  tipo?: string
  categoriaId?: string
  limit?: number
  offset?: number
}

export class TransaccionesService {
  async listar(clienteId: string, query: ListarQuery = {}) {
    const { cuentaId, desde, hasta, tipo, categoriaId, limit = 50, offset = 0 } = query
    const where: Prisma.TransaccionWhereInput = { clienteId }
    if (cuentaId) where.cuentaId = cuentaId
    if (tipo) where.tipo = tipo as any
    if (categoriaId) where.categoriaId = categoriaId
    if (desde || hasta) {
      where.fecha = {}
      if (desde) where.fecha.gte = new Date(desde)
      if (hasta) where.fecha.lte = new Date(hasta)
    }
    const [total, items] = await Promise.all([
      prisma.transaccion.count({ where }),
      prisma.transaccion.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
    ])
    return { total, items }
  }

  async obtener(id: string, clienteId: string) {
    const tx = await prisma.transaccion.findFirst({ where: { id, clienteId } })
    if (!tx) throw Object.assign(new Error('Transacción no encontrada'), { status: 404 })
    return tx
  }

  async crear(clienteId: string, data: Record<string, unknown>) {
    const tx = await prisma.transaccion.create({ data: { ...data, clienteId } as any })
    if (tx.cuentaId && tx.monto) {
      const delta = tx.tipo === 'INGRESO' ? Number(tx.monto) : -Number(tx.monto)
      await prisma.cuentaBancaria.update({
        where: { id: tx.cuentaId },
        data: { saldo: { increment: delta } },
      })
    }
    return tx
  }

  async actualizar(id: string, clienteId: string, data: Record<string, unknown>) {
    await this.obtener(id, clienteId)
    return prisma.transaccion.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    const tx = await this.obtener(id, clienteId)
    if (tx.cuentaId && tx.monto) {
      const delta = tx.tipo === 'INGRESO' ? -Number(tx.monto) : Number(tx.monto)
      await prisma.cuentaBancaria.update({
        where: { id: tx.cuentaId },
        data: { saldo: { increment: delta } },
      })
    }
    return prisma.transaccion.delete({ where: { id } })
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
    for (const tx of sinCategoria) {
      for (const regla of reglas) {
        const match = regla.esRegex
          ? new RegExp(regla.patron, 'i').test(tx.concepto)
          : tx.concepto.toLowerCase().includes(regla.patron.toLowerCase())
        if (match) {
          await prisma.transaccion.update({
            where: { id: tx.id },
            data: { categoriaId: regla.categoriaId, subcategoriaId: regla.subcategoriaId },
          })
          actualizadas++
          break
        }
      }
    }
    return { revisadas: sinCategoria.length, actualizadas }
  }
}