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

    // Fetch categories for transactions that have categoriaId but no subcategoria
    const catIds = items
      .filter((tx: any) => tx.categoriaId && !tx.subcategoria?.categoria)
      .map((tx: any) => tx.categoriaId as string)
    const catsById: Record<string, any> = {}
    if (catIds.length > 0) {
      const cats = await prisma.categoria.findMany({
        where: { id: { in: [...new Set(catIds)] } },
        select: { id: true, nombre: true, color: true, icono: true },
      })
      for (const c of cats) catsById[c.id] = c
    }

    // Map subcategoria.categoria → top-level categoria for the frontend
    const mapped = items.map((tx: any) => {
      const categoria = tx.subcategoria?.categoria ?? (tx.categoriaId ? catsById[tx.categoriaId] : null) ?? null
      const { subcategoria, cuenta, ...rest } = tx
      return {
        ...rest,
        categoria: categoria
          ? { id: categoria.id, nombre: categoria.nombre, color: categoria.color, icono: categoria.icono }
          : null,
        subcategoria: subcategoria
          ? { id: subcategoria.id, nombre: subcategoria.nombre, color: subcategoria.color }
          : null,
        cuentaBancaria: cuenta ?? null,
      }
    })

    return { total, items: mapped, limit: f.limit, offset: f.offset }
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
    // Update bank account balance
    if (data.cuentaId && (data.tipo === 'GASTO' || data.tipo === 'INGRESO')) {
      const delta = data.tipo === 'INGRESO' ? Number(data.monto) : -Number(data.monto)
      await prisma.cuentaBancaria.update({
        where: { id: data.cuentaId },
        data: { saldo: { increment: delta } },
      })
    }

    // Update credit card balance
    // GASTO on card → more debt (saldoActual increases)
    // INGRESO on card → payment/credit received (saldoActual decreases)
    if (data.tarjetaId && (data.tipo === 'GASTO' || data.tipo === 'INGRESO')) {
      const delta = data.tipo === 'GASTO' ? Number(data.monto) : -Number(data.monto)
      await prisma.tarjetaCredito.update({
        where: { id: data.tarjetaId },
        data: { saldoActual: { increment: delta } },
      })
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

  /** IDs of the last N transactions for a client (by creation time) — the only ones deletable */
  async deletables(clienteId: string, n = 5): Promise<string[]> {
    const rows = await prisma.transaccion.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: n,
      select: { id: true },
    })
    return rows.map(r => r.id)
  }

  async remove(id: string) {
    const tx = await prisma.transaccion.findUniqueOrThrow({ where: { id } })

    // Verify this is among the 5 most recently registered transactions
    const allowed = await this.deletables(tx.clienteId)
    if (!allowed.includes(id)) {
      throw Object.assign(
        new Error('Solo puedes eliminar las 5 transacciones registradas más recientemente.'),
        { status: 403 },
      )
    }

    await prisma.$transaction(async trx => {
      // Revert bank account balance
      if (tx.cuentaId && (tx.tipo === 'GASTO' || tx.tipo === 'INGRESO')) {
        const revertDelta = tx.tipo === 'INGRESO' ? -Number(tx.monto) : Number(tx.monto)
        await trx.cuentaBancaria.update({
          where: { id: tx.cuentaId },
          data: { saldo: { increment: revertDelta } },
        })
      }
      // Revert credit card balance
      if (tx.tarjetaId && (tx.tipo === 'GASTO' || tx.tipo === 'INGRESO')) {
        const revertDelta = tx.tipo === 'GASTO' ? -Number(tx.monto) : Number(tx.monto)
        await trx.tarjetaCredito.update({
          where: { id: tx.tarjetaId },
          data: { saldoActual: { increment: revertDelta } },
        })
      }
      await trx.transaccion.delete({ where: { id } })
    })

    return { ok: true, reverted: !!(tx.cuentaId || tx.tarjetaId) }
  }
}
