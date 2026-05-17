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
})

export class TarjetasService {
  async list(clienteId: string) {
    const tarjetas = await prisma.tarjetaCredito.findMany({ where: { clienteId }, orderBy: { createdAt: 'asc' } })
    return tarjetas.map(t => {
      const saldo = Number(t.saldoActual)
      const limite = Number(t.limite)
      const disponible = limite - saldo          // puede ser negativo si hay sobregiro
      const sobregiro  = saldo < 0 ? Math.abs(saldo) : Math.max(0, saldo - limite)
      const utilizacion = limite > 0 ? Math.round((Math.max(0, saldo) / limite) * 100) : 0
      const base = { ...t, disponible, sobregiro, utilizacion }
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
      },
    })
  }

  async remove(id: string) {
    return prisma.tarjetaCredito.delete({ where: { id } })
  }
}
