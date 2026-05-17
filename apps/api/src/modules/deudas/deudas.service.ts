import { z } from 'zod'
import { prisma } from '../../shared/prisma'
import { deudaSchema } from '@cashmind/shared'

const pagoSchema = z.object({
  monto: z.number().positive(),
  fecha: z.coerce.date(),
  notas: z.string().optional().nullable(),
})

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map TipoDeuda → hint words to match against subcategory names */
const SUBCATEGORIA_HINTS: Record<string, string[]> = {
  BANCARIA:  ['bancaria', 'banco', 'préstamo', 'prestamo'],
  PERSONAL:  ['personal'],
  COMERCIAL: ['comercial', 'negocio', 'empresa'],
  TARJETA:   ['tarjeta', 'crédito', 'credito'],
  OTRA:      ['otra', 'otro', 'general'],
}

/** Advance a date by N months, clamping to last day of month */
function addMonths(base: Date, n: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (d.getDate() > lastDay) d.setDate(lastDay)
  d.setHours(9, 0, 0, 0)
  return d
}

/** Look up the system "Deuda" category + best-fit subcategory for the given tipo */
async function findDeudaCategory(tipo: string) {
  const cat = await prisma.categoria.findFirst({
    where: {
      clienteId: null,
      OR: [
        { nombre: { contains: 'deuda', mode: 'insensitive' } },
        { nombre: { contains: 'préstamo', mode: 'insensitive' } },
        { nombre: { contains: 'prestamo', mode: 'insensitive' } },
      ],
    },
    include: { subcategorias: true },
  })
  if (!cat) return { categoriaId: null, subcategoriaId: null }

  const hints = SUBCATEGORIA_HINTS[tipo] ?? []
  const sub = cat.subcategorias.find(s =>
    hints.some(h => s.nombre.toLowerCase().includes(h))
  ) ?? cat.subcategorias[0] ?? null

  return { categoriaId: cat.id, subcategoriaId: sub?.id ?? null }
}

// ── Service ────────────────────────────────────────────────────────────────

export class DeudasService {
  async list(clienteId: string) {
    return prisma.deuda.findMany({
      where: { clienteId },
      include: {
        persona: { select: { id: true, nombre: true, apellido: true, tipo: true } },
        _count: { select: { pagos: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(clienteId: string, body: unknown) {
    const d = deudaSchema.parse(body)

    // Auto-calculate fechaFin when FIJO + numeroCuotas
    let fechaFin = d.fechaFin ?? null
    if (d.tipoPlazo === 'FIJO' && d.numeroCuotas && !fechaFin) {
      fechaFin = addMonths(d.fechaInicio, d.numeroCuotas)
    }

    const deuda = await prisma.deuda.create({
      data: {
        clienteId,
        concepto: d.concepto,
        tipo: d.tipo,
        montoOriginal: d.montoOriginal,
        saldoActual: d.saldoActual ?? d.montoOriginal,
        moneda: d.moneda ?? 'DOP',
        fechaInicio: d.fechaInicio,
        fechaFin,
        tipoPlazo: d.tipoPlazo,
        tasaInteres: d.tasaInteres ?? null,
        numeroCuotas: d.numeroCuotas ?? null,
        diaCobro: d.diaCobro ?? null,
        acreedorTexto: d.acreedorTexto ?? null,
        personaId: d.personaId ?? null,
        notas: d.notas ?? null,
      },
    })

    // Generate one PAGO_PROGRAMADO event per remaining cuota
    if (d.tipoPlazo === 'FIJO' && d.numeroCuotas && d.numeroCuotas > 0) {
      const cuotasPagadas = d.cuotasPagadasAnteriores ?? 0
      const cuotasRestantes = d.numeroCuotas - cuotasPagadas
      if (cuotasRestantes > 0) {
        const montoCuota = Number(d.montoOriginal) / d.numeroCuotas
        const { categoriaId, subcategoriaId } = await findDeudaCategory(d.tipo)

        const eventosData = Array.from({ length: cuotasRestantes }, (_, i) => ({
          clienteId,
          nombre: `${d.concepto} — Cuota ${cuotasPagadas + i + 1}/${d.numeroCuotas}`,
          tipo: 'PAGO_PROGRAMADO',
          fecha: addMonths(d.fechaInicio, cuotasPagadas + i + 1),
          recurrente: false,
          presupuestoEstimado: Math.round(montoCuota * 100) / 100,
          moneda: d.moneda ?? 'DOP',
          estado: 'PLANIFICADO' as const,
          prioridad: 3,
          categoriaId,
          subcategoriaId,
          deudaId: deuda.id,
          numeroCuota: cuotasPagadas + i + 1,
        }))
        await prisma.evento.createMany({ data: eventosData })
      }
    }

    return deuda
  }

  async update(id: string, body: unknown) {
    const d = deudaSchema.partial().parse(body)

    // Recalculate fechaFin if numeroCuotas or fechaInicio changed while plazo=FIJO
    let fechaFin = d.fechaFin
    if (d.tipoPlazo === 'FIJO' && d.numeroCuotas && d.fechaInicio && !d.fechaFin) {
      fechaFin = addMonths(d.fechaInicio, d.numeroCuotas)
    }

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
        ...(fechaFin !== undefined && { fechaFin: fechaFin ?? null }),
        ...(d.tasaInteres !== undefined && { tasaInteres: d.tasaInteres ?? null }),
        ...(d.numeroCuotas !== undefined && { numeroCuotas: d.numeroCuotas ?? null }),
        ...(d.diaCobro !== undefined && { diaCobro: d.diaCobro ?? null }),
        ...(d.notas !== undefined && { notas: d.notas ?? null }),
        ...(d.estado !== undefined && { estado: d.estado }),
      },
    })
  }

  async remove(id: string) {
    // Delete linked events first
    await prisma.evento.deleteMany({ where: { deudaId: id } })
    return prisma.deuda.delete({ where: { id } })
  }

  async registrarPago(deudaId: string, body: unknown) {
    const { monto, fecha, notas } = pagoSchema.parse(body)
    const deuda = await prisma.deuda.findUniqueOrThrow({ where: { id: deudaId } })
    const nuevoSaldo = Math.max(0, Number(deuda.saldoActual) - monto)

    await prisma.$transaction(async (tx) => {
      await tx.pagoDeuda.create({
        data: { deudaId, monto, fecha, estado: 'EJECUTADO', notas: notas ?? null },
      })
      await tx.deuda.update({
        where: { id: deudaId },
        data: { saldoActual: nuevoSaldo, estado: nuevoSaldo <= 0 ? 'SALDADA' : deuda.estado },
      })
      // Mark the next pending cuota event as EJECUTADO
      const nextEvento = await tx.evento.findFirst({
        where: { deudaId, estado: 'PLANIFICADO' },
        orderBy: { numeroCuota: 'asc' },
      })
      if (nextEvento) {
        await tx.evento.update({
          where: { id: nextEvento.id },
          data: { estado: 'EJECUTADO' },
        })
      }
    })

    return { deudaId, monto, nuevoSaldo }
  }

  async listPagos(deudaId: string) {
    return prisma.pagoDeuda.findMany({
      where: { deudaId },
      orderBy: { fecha: 'desc' },
    })
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
      const fecha = addMonths(inicio, i + 1)
      const pagado = deuda.pagos[i]
      return {
        numero: i + 1,
        monto: cuotaMonto,
        fecha,
        estado: pagado ? 'PAGADA' : 'PENDIENTE',
        montoPagado: pagado ? Number(pagado.monto) : 0,
      }
    })
    return { tipo: 'FIJO', cuotas }
  }
}
