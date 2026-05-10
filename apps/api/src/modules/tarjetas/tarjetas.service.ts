import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const tarjetaSchema = z.object({
  banco: z.string().min(1),
  alias: z.string().optional(),
  ultimosCuatro: z.string().length(4),
  limite: z.number().positive(),
  saldoActual: z.number().default(0),
  tasaInteres: z.number().min(0).default(0),
  tasaMora: z.number().min(0).default(0),
  diaCorte: z.number().int().min(1).max(31),
  diaPago: z.number().int().min(1).max(31),
  penalidadSobregiro: z.number().min(0).default(0),
  moneda: z.string().default('DOP'),
  activa: z.boolean().default(true),
})

export class TarjetasService {
  async list(clienteId: string) {
    const tarjetas = await prisma.tarjetaCredito.findMany({ where: { clienteId }, orderBy: { createdAt: 'asc' } })
    return tarjetas.map(t => ({
      ...t,
      disponible: Number(t.limite) - Number(t.saldoActual),
      sobregiro: Math.max(0, Number(t.saldoActual) - Number(t.limite)),
    }))
  }

  async create(clienteId: string, body: unknown) {
    const d = tarjetaSchema.parse(body)
    return prisma.tarjetaCredito.create({
      data: { clienteId, banco: d.banco, alias: d.alias ?? null, ultimosCuatro: d.ultimosCuatro, limite: d.limite, saldoActual: d.saldoActual, tasaInteres: d.tasaInteres, tasaMora: d.tasaMora, diaCorte: d.diaCorte, diaPago: d.diaPago, penalidadSobregiro: d.penalidadSobregiro, moneda: d.moneda, activa: d.activa },
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
        ...(d.limite !== undefined && { limite: d.limite }),
        ...(d.saldoActual !== undefined && { saldoActual: d.saldoActual }),
        ...(d.tasaInteres !== undefined && { tasaInteres: d.tasaInteres }),
        ...(d.tasaMora !== undefined && { tasaMora: d.tasaMora }),
        ...(d.diaCorte !== undefined && { diaCorte: d.diaCorte }),
        ...(d.diaPago !== undefined && { diaPago: d.diaPago }),
        ...(d.penalidadSobregiro !== undefined && { penalidadSobregiro: d.penalidadSobregiro }),
        ...(d.moneda !== undefined && { moneda: d.moneda }),
        ...(d.activa !== undefined && { activa: d.activa }),
      },
    })
  }

  async remove(id: string) {
    return prisma.tarjetaCredito.delete({ where: { id } })
  }
}
