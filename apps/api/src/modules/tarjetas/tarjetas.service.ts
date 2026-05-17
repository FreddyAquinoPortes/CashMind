import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const tarjetaSchema = z.object({
  banco: z.string().min(1),
  alias: z.string().optional(),
  ultimosCuatro: z.string().length(4),
  franquicia: z.string().nullish(),
  tipoTarjeta: z.string().nullish(),
  categoriaTarjeta: z.string().nullish(),
  limite: z.number().positive(),
  // Permite negativo: sobregiro, intereses acumulados, extracreditado no pagado
  saldoActual: z.number().default(0),
  tasaInteres: z.number().min(0).default(0),
  tasaMora: z.number().min(0).default(0),
  diaCorte: z.number().int().min(1).max(31),
  diaPago: z.number().int().min(1).max(31),
  penalidadSobregiro: z.number().min(0).default(0),
  moneda: z.string().default('DOP'),
  activa: z.boolean().default(true),
  // Doble balance: tarjetas multi-moneda con límites y saldos independientes
  dobleBalance: z.boolean().default(false),
  monedaSecundaria: z.string().nullish(),
  limiteSecundario: z.number().positive().nullish(),
  saldoSecundario: z.number().nullish(),
  // ExtraCredito
  tieneExtraCredito: z.boolean().default(false),
})

const extraCreditoSchema = z.object({
  descripcion: z.string().optional().nullable(),
  montoOriginal: z.number().positive(),
  tasaInteres: z.number().min(0).default(0),
  numeroCuotas: z.number().int().positive(),
  fechaInicio: z.string(), // ISO date string
  diaPago: z.number().int().min(1).max(31),
  moneda: z.string().default('DOP'),
})

const pagoExtraCreditoSchema = z.object({
  monto: z.number().positive(),
  fecha: z.string(),
  notas: z.string().optional().nullable(),
})

function calcMontoCuota(monto: number, tasaInteres: number, numeroCuotas: number): number {
  if (tasaInteres === 0) return monto / numeroCuotas
  const r = (tasaInteres / 100) / 12
  return (monto * r) / (1 - Math.pow(1 + r, -numeroCuotas))
}

export class TarjetasService {
  async list(clienteId: string) {
    const tarjetas = await prisma.tarjetaCredito.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'asc' },
      include: {
        extraCreditos: {
          include: { pagos: { orderBy: { fecha: 'desc' } } },
          where: { estado: { not: 'CANCELADO' } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    return tarjetas.map(t => {
      const saldo = Number(t.saldoActual)
      const limite = Number(t.limite)
      const disponible = limite - saldo          // puede ser negativo si hay sobregiro
      const sobregiro  = saldo < 0 ? Math.abs(saldo) : Math.max(0, saldo - limite)
      const utilizacion = limite > 0 ? Math.round((Math.max(0, saldo) / limite) * 100) : 0
      const extraCreditos = t.extraCreditos.map(ec => {
        const cuotasRestantes = ec.numeroCuotas - ec.cuotasPagadas
        const progreso = ec.numeroCuotas > 0 ? Math.round((ec.cuotasPagadas / ec.numeroCuotas) * 100) : 0
        const proximoPago = calcProximoPago(ec.diaPago)
        return { ...ec, cuotasRestantes, progreso, proximoPago }
      })
      const base = { ...t, extraCreditos, disponible, sobregiro, utilizacion }
      if (!t.dobleBalance) return base
      // Doble balance: calcular también el secundario
      const saldo2 = Number(t.saldoSecundario ?? 0)
      const limite2 = Number(t.limiteSecundario ?? 0)
      return {
        ...base,
        disponibleSecundario: limite2 - saldo2,
        sobregiroSecundario: saldo2 < 0 ? Math.abs(saldo2) : Math.max(0, saldo2 - limite2),
        utilizacionSecundaria: limite2 > 0 ? Math.round((Math.max(0, saldo2) / limite2) * 100) : 0,
      }
    })
  }

  async create(clienteId: string, body: unknown) {
    const d = tarjetaSchema.parse(body)
    return prisma.tarjetaCredito.create({
      data: {
        clienteId, banco: d.banco, alias: d.alias ?? null,
        ultimosCuatro: d.ultimosCuatro,
        franquicia: d.franquicia ?? null, tipoTarjeta: d.tipoTarjeta ?? null, categoriaTarjeta: d.categoriaTarjeta ?? null,
        limite: d.limite, saldoActual: d.saldoActual,
        tasaInteres: d.tasaInteres, tasaMora: d.tasaMora,
        diaCorte: d.diaCorte, diaPago: d.diaPago,
        penalidadSobregiro: d.penalidadSobregiro,
        moneda: d.moneda, activa: d.activa,
        dobleBalance: d.dobleBalance,
        monedaSecundaria: d.dobleBalance ? (d.monedaSecundaria ?? null) : null,
        limiteSecundario: d.dobleBalance ? (d.limiteSecundario ?? null) : null,
        saldoSecundario:  d.dobleBalance ? (d.saldoSecundario  ?? null) : null,
        tieneExtraCredito: d.tieneExtraCredito,
      },
    })
  }

  async update(id: string, body: unknown) {
    const d = tarjetaSchema.partial().parse(body)
    return prisma.tarjetaCredito.update({
      where: { id },
      data: {
        ...(d.banco !== undefined && { banco: d.banco }),
        ...(d.alias !== undefined && { alias: d.alias ?? null }),
        ...(d.ultimosCuatro !== undefined && { ultimosCuatro: d.ultimosCuatro }),
        ...(d.franquicia !== undefined && { franquicia: d.franquicia ?? null }),
        ...(d.tipoTarjeta !== undefined && { tipoTarjeta: d.tipoTarjeta ?? null }),
        ...(d.categoriaTarjeta !== undefined && { categoriaTarjeta: d.categoriaTarjeta ?? null }),
        ...(d.limite !== undefined && { limite: d.limite }),
        ...(d.saldoActual !== undefined && { saldoActual: d.saldoActual }),
        ...(d.tasaInteres !== undefined && { tasaInteres: d.tasaInteres }),
        ...(d.tasaMora !== undefined && { tasaMora: d.tasaMora }),
        ...(d.diaCorte !== undefined && { diaCorte: d.diaCorte }),
        ...(d.diaPago !== undefined && { diaPago: d.diaPago }),
        ...(d.penalidadSobregiro !== undefined && { penalidadSobregiro: d.penalidadSobregiro }),
        ...(d.moneda !== undefined && { moneda: d.moneda }),
        ...(d.activa !== undefined && { activa: d.activa }),
        ...(d.dobleBalance !== undefined && { dobleBalance: d.dobleBalance }),
        ...(d.monedaSecundaria !== undefined && { monedaSecundaria: d.monedaSecundaria ?? null }),
        ...(d.limiteSecundario !== undefined && { limiteSecundario: d.limiteSecundario ?? null }),
        ...(d.saldoSecundario  !== undefined && { saldoSecundario:  d.saldoSecundario  ?? null }),
        ...(d.tieneExtraCredito !== undefined && { tieneExtraCredito: d.tieneExtraCredito }),
      },
    })
  }

  async remove(id: string) {
    return prisma.tarjetaCredito.delete({ where: { id } })
  }

  // ── ExtraCredito ────────────────────────────────────────────────────────────

  async createExtraCredito(tarjetaId: string, body: unknown) {
    const d = extraCreditoSchema.parse(body)
    const tarjeta = await prisma.tarjetaCredito.findUniqueOrThrow({ where: { id: tarjetaId } })
    if (d.montoOriginal > Number(tarjeta.limite)) {
      throw Object.assign(new Error('El monto no puede exceder el límite de crédito de la tarjeta'), { status: 422 })
    }
    const montoCuota = calcMontoCuota(d.montoOriginal, d.tasaInteres, d.numeroCuotas)
    const [ec] = await prisma.$transaction([
      prisma.extraCredito.create({
        data: {
          tarjetaId,
          descripcion: d.descripcion ?? null,
          montoOriginal: d.montoOriginal,
          saldoPendiente: d.montoOriginal,
          tasaInteres: d.tasaInteres,
          numeroCuotas: d.numeroCuotas,
          montoCuota: Math.round(montoCuota * 100) / 100,
          fechaInicio: new Date(d.fechaInicio),
          diaPago: d.diaPago,
          moneda: d.moneda,
        },
        include: { pagos: true },
      }),
      // Auto-enable tieneExtraCredito on the card if not already set
      prisma.tarjetaCredito.update({
        where: { id: tarjetaId },
        data: { tieneExtraCredito: true },
      }),
    ])
    return ec
  }

  async listExtraCreditos(tarjetaId: string) {
    const list = await prisma.extraCredito.findMany({
      where: { tarjetaId },
      include: { pagos: { orderBy: { fecha: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return list.map(ec => ({
      ...ec,
      cuotasRestantes: ec.numeroCuotas - ec.cuotasPagadas,
      progreso: ec.numeroCuotas > 0 ? Math.round((ec.cuotasPagadas / ec.numeroCuotas) * 100) : 0,
      proximoPago: calcProximoPago(ec.diaPago),
    }))
  }

  async registrarPagoExtraCredito(extraCreditoId: string, body: unknown) {
    const d = pagoExtraCreditoSchema.parse(body)
    const ec = await prisma.extraCredito.findUniqueOrThrow({ where: { id: extraCreditoId } })
    const nuevoSaldo = Math.max(0, Number(ec.saldoPendiente) - d.monto)
    const nuevasCuotasPagadas = ec.cuotasPagadas + 1
    const estado = nuevoSaldo <= 0 ? ('PAGADO' as const) : ec.estado

    const [pago] = await prisma.$transaction([
      prisma.pagoExtraCredito.create({
        data: {
          extraCreditoId,
          monto: d.monto,
          fecha: new Date(d.fecha),
          notas: d.notas ?? null,
        },
      }),
      prisma.extraCredito.update({
        where: { id: extraCreditoId },
        data: {
          saldoPendiente: nuevoSaldo,
          cuotasPagadas: nuevasCuotasPagadas,
          estado,
        },
      }),
    ])
    return pago
  }

  async updateExtraCredito(id: string, body: unknown) {
    const d = extraCreditoSchema.partial().parse(body)
    const updates: Record<string, unknown> = {}
    if (d.descripcion !== undefined) updates.descripcion = d.descripcion ?? null
    if (d.tasaInteres !== undefined) updates.tasaInteres = d.tasaInteres
    if (d.numeroCuotas !== undefined) updates.numeroCuotas = d.numeroCuotas
    if (d.fechaInicio !== undefined) updates.fechaInicio = new Date(d.fechaInicio)
    if (d.diaPago !== undefined) updates.diaPago = d.diaPago
    if (d.moneda !== undefined) updates.moneda = d.moneda
    // Recalculate montoCuota if relevant fields changed
    if (d.tasaInteres !== undefined || d.numeroCuotas !== undefined || d.montoOriginal !== undefined) {
      const current = await prisma.extraCredito.findUniqueOrThrow({ where: { id } })
      const monto = d.montoOriginal ?? Number(current.montoOriginal)
      const tasa = d.tasaInteres ?? Number(current.tasaInteres)
      const cuotas = d.numeroCuotas ?? current.numeroCuotas
      updates.montoCuota = Math.round(calcMontoCuota(monto, tasa, cuotas) * 100) / 100
    }
    return prisma.extraCredito.update({ where: { id }, data: updates as any })
  }

  async deleteExtraCredito(id: string) {
    return prisma.extraCredito.delete({ where: { id } })
  }
}

function calcProximoPago(diaPago: number): string {
  const hoy = new Date()
  const mes = hoy.getMonth()
  const anio = hoy.getFullYear()
  const candidato = new Date(anio, mes, diaPago)
  if (candidato <= hoy) {
    // Siguiente mes
    return new Date(anio, mes + 1, diaPago).toISOString().slice(0, 10)
  }
  return candidato.toISOString().slice(0, 10)
}
