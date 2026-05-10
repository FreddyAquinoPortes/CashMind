import { z } from 'zod'
import { prisma } from '../../shared/prisma'
import { transaccionSchema } from '@cashmind/shared'

const filtersSchema = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  categoriaId: z.string().optional(),
  subcategoriaId: z.string().optional(),
  estado: z.string().optional(),
  tipo: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export class TransaccionesService {
  async list(clienteId: string, query: unknown) {
    const f = filtersSchema.parse(query)
    const where: Record<string, unknown> = { clienteId }
    if (f.desde || f.hasta) where['fecha'] = { gte: f.desde, lte: f.hasta }
    if (f.categoriaId) where['categoriaId'] = f.categoriaId
    if (f.subcategoriaId) where['subcategoriaId'] = f.subcategoriaId
    if (f.estado) where['estado'] = f.estado
    if (f.tipo) where['tipo'] = f.tipo
    if (f.q) where['concepto'] = { contains: f.q, mode: 'insensitive' }

    const [total, items] = await Promise.all([
      prisma.transaccion.count({ where }),
      prisma.transaccion.findMany({
        where,
        include: {
          subcategoria: { include: { categoria: true } },
          cuenta: { select: { alias: true, banco: true } },
          tarjeta: { select: { alias: true, ultimosCuatro: true } },
        },
        orderBy: { fecha: 'desc' },
        take: f.limit,
        skip: f.offset,
      }),
    ])
    return { total, items, limit: f.limit, offset: f.offset }
  }

  async create(clienteId: string, body: unknown) {
    const data = transaccionSchema.parse(body)

    // Prevent negative balance on bank accounts (only credit cards/debts can go negative)
    if (data.cuentaId && data.tipo === 'GASTO') {
      const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: data.cuentaId } })
      if (cuenta && ['CORRIENTE', 'AHORRO', 'INVERSION', 'OTRO'].includes(cuenta.tipo)) {
        const saldo = Number(cuenta.saldo)
        const monto = Number(data.monto)
        if (saldo < monto) {
          throw Object.assign(
            new Error(
              `Saldo insuficiente. La cuenta "${cuenta.alias ?? cuenta.banco}" tiene RD$${saldo.toFixed(2)} disponibles. ` +
              `Solo las tarjetas de crédito y deudas pueden tener balance negativo.`
            ),
            { status: 422 }
          )
        }
      }
    }

    const tx = await prisma.transaccion.create({
      data: {
        clienteId,
        concepto: data.concepto,
        monto: data.monto,
        moneda: data.moneda,
        tipo: data.tipo,
        fecha: data.fecha,
        frecuencia: data.frecuencia,
        estado: data.estado,
        porcentajePropio: data.porcentajePropio,
        tags: data.tags,
        categoriaId: data.categoriaId ?? null,
        subcategoriaId: data.subcategoriaId ?? null,
        cuentaId: data.cuentaId ?? null,
        tarjetaId: data.tarjetaId ?? null,
        detalle: data.detalle ?? null,
        notas: data.notas ?? null,
        comercio: data.comercio ?? null,
        eventoId: data.eventoId ?? null,
        pagadoPorId: data.pagadoPorId ?? null,
      },
    })
    if (data.cuentaId) {
      const delta = data.tipo === 'INGRESO' ? Number(data.monto) : -Number(data.monto)
      if (data.tipo === 'GASTO' || data.tipo === 'INGRESO') {
        await prisma.cuentaBancaria.update({
          where: { id: data.cuentaId },
          data: { saldo: { increment: delta } },
        })
      }
    }
    return tx
  }

  async update(id: string, body: unknown) {
    const data = transaccionSchema.partial().parse(body)
    return prisma.transaccion.update({
      where: { id },
      data: {
        ...(data.concepto !== undefined && { concepto: data.concepto }),
        ...(data.monto !== undefined && { monto: data.monto }),
        ...(data.moneda !== undefined && { moneda: data.moneda }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.fecha !== undefined && { fecha: data.fecha }),
        ...(data.frecuencia !== undefined && { frecuencia: data.frecuencia }),
        ...(data.estado !== undefined && { estado: data.estado }),
        ...(data.porcentajePropio !== undefined && { porcentajePropio: data.porcentajePropio }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.categoriaId !== undefined && { categoriaId: data.categoriaId ?? null }),
        ...(data.subcategoriaId !== undefined && { subcategoriaId: data.subcategoriaId ?? null }),
        ...(data.cuentaId !== undefined && { cuentaId: data.cuentaId ?? null }),
        ...(data.tarjetaId !== undefined && { tarjetaId: data.tarjetaId ?? null }),
        ...(data.detalle !== undefined && { detalle: data.detalle ?? null }),
        ...(data.notas !== undefined && { notas: data.notas ?? null }),
        ...(data.comercio !== undefined && { comercio: data.comercio ?? null }),
        ...(data.eventoId !== undefined && { eventoId: data.eventoId ?? null }),
        ...(data.pagadoPorId !== undefined && { pagadoPorId: data.pagadoPorId ?? null }),
      },
    })
  }

  async remove(id: string) {
    return prisma.transaccion.delete({ where: { id } })
  }
}
