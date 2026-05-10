import { z } from 'zod'
import { prisma } from '../../shared/prisma'
import { deudaSchema } from '@cashmind/shared'

const pagoSchema = z.object({
  monto: z.number().positive(),
  fecha: z.coerce.date(),
  notas: z.string().optional(),
})

export class DeudasService {
  async list(clienteId: string) {
    return prisma.deuda.findMany({
      where: { clienteId },
      include: { persona: { select: { nombre: true } }, _count: { select: { pagos: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(clienteId: string, body: unknown) {
    const d = deudaSchema.parse(body)
    return prisma.deuda.create({
      data: {
        clienteId,
        tipo: d.tipo,
        montoOriginal: d.montoOriginal,
        saldoActual: d.saldoActual,
        moneda: d.moneda ?? 'DOP',
        fechaInicio: d.fechaInicio,
        tipoPlazo: d.tipoPlazo,
        acreedorTexto: d.acreedorTexto ?? null,
        personaId: d.personaId ?? null,
        fechaFin: d.fechaFin ?? null,
        tasaInteres: d.tasaInteres ?? null,
        numeroCuotas: d.numeroCuotas ?? null,
        notas: d.notas ?? null,
      },
    })
  }

  async update(id: string, body: unknown) {
    const d = deudaSchema.partial().parse(body)
    return prisma.deuda.update({
      where: { id },
      data: {
        ...(d.tipo !== undefined && { tipo: d.tipo }),
        ...(d.montoOriginal !== undefined && { montoOriginal: d.montoOriginal }),
        ...(d.saldoActual !== undefined && { saldoActual: d.saldoActual }),
        ...(d.moneda !== undefined && { moneda: d.moneda }),
        ...(d.fechaInicio !== undefined && { fechaInicio: d.fechaInicio }),
        ...(d.tipoPlazo !== undefined && { tipoPlazo: d.tipoPlazo }),
        ...(d.acreedorTexto !== undefined && { acreedorTexto: d.acreedorTexto ?? null }),
        ...(d.personaId !== undefined && { personaId: d.personaId ?? null }),
        ...(d.fechaFin !== undefined && { fechaFin: d.fechaFin ?? null }),
        ...(d.tasaInteres !== undefined && { tasaInteres: d.tasaInteres ?? null }),
        ...(d.numeroCuotas !== undefined && { numeroCuotas: d.numeroCuotas ?? null }),
        ...(d.notas !== undefined && { notas: d.notas ?? null }),
      },
    })
  }

  async remove(id: string) {
    return prisma.deuda.delete({ where: { id } })
  }

  async registrarPago(deudaId: string, body: unknown) {
    const { monto, fecha, notas } = pagoSchema.parse(body)
    const deuda = await prisma.deuda.findUniqueOrThrow({ where: { id: deudaId } })
    const nuevoSaldo = Math.max(0, Number(deuda.saldoActual) - monto)
    await prisma.$transaction([
      prisma.pagoDeuda.create({
        data: { deudaId, monto, fecha, estado: 'EJECUTADO', notas: notas ?? null },
      }),
      prisma.deuda.update({
        where: { id: deudaId },
        data: { saldoActual: nuevoSaldo, estado: nuevoSaldo <= 0 ? 'SALDADA' : deuda.estado },
      }),
    ])
    return { deudaId, monto, nuevoSaldo }
  }

  async amortizacion(deudaId: string) {
    const deuda = await prisma.deuda.findUniqueOrThrow({
      where: { id: deudaId },
      include: { pagos: { orderBy: { fecha: 'asc' } } },
    })
    if (deuda.tipoPlazo !== 'FIJO' || !deuda.numeroCuotas) return { tipo: 'FLEXIBLE', pagos: deuda.pagos }
    const cuotaMonto = Number(deuda.montoOriginal) / deuda.numeroCuotas
    const inicio = new Date(deuda.fechaInicio)
    const cuotas = Array.from({ length: deuda.numeroCuotas }, (_, i) => {
      const fecha = new Date(inicio)
      fecha.setMonth(fecha.getMonth() + i + 1)
      const pagado = deuda.pagos[i]
      return { numero: i + 1, monto: cuotaMonto, fecha, estado: pagado ? 'PAGADA' : 'PENDIENTE', montoPagado: pagado ? Number(pagado.monto) : 0 }
    })
    return { tipo: 'FIJO', cuotas }
  }
}
