import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const TarjetaSchema = z.object({
  alias:            z.string().min(1, 'El nombre es requerido').max(80),
  banco:            z.string().min(1, 'Selecciona un banco'),
  ultimosCuatro:   z.string().length(4, 'Ingresa los últimos 4 dígitos').regex(/^\d{4}$/),
  franquicia:       z.enum(['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER']).optional().nullable(),
  tipoTarjeta:      z.enum(['CREDITO', 'DEBITO']).optional().nullable(),
  categoriaTarjeta: z.enum(['STANDARD', 'GOLD', 'PLATINUM', 'BLACK']).optional().nullable(),
  limite:           z.coerce.number().min(0).default(0),
  saldoActual:      z.coerce.number().min(0).default(0),
  tasaInteres:      z.coerce.number().min(0).max(100).default(0),
  diaCorte:         z.coerce.number().int().min(1).max(31).default(1),
  diaPago:          z.coerce.number().int().min(1).max(31).default(15),
  moneda:           z.string().default('DOP'),
  activa:           z.boolean().default(true),
})

export type TarjetaInput = z.infer<typeof TarjetaSchema>

export class TarjetasService {
  private withUtil(t: { limite: { toNumber(): number }; saldoActual: { toNumber(): number } }) {
    const limite = t.limite.toNumber()
    const saldo  = t.saldoActual.toNumber()
    return {
      ...t,
      utilizacion: limite > 0 ? Math.round(saldo / limite * 100) : 0,
      disponible:  Math.max(0, limite - saldo),
    }
  }

  async listar(clienteId: string) {
    const rows = await prisma.tarjetaCredito.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(t => this.withUtil(t))
  }

  async obtener(id: string, clienteId: string) {
    const t = await prisma.tarjetaCredito.findFirst({ where: { id, clienteId } })
    if (!t) throw Object.assign(new Error('Tarjeta no encontrada'), { status: 404 })
    return this.withUtil(t)
  }

  async crear(clienteId: string, body: unknown) {
    const data = TarjetaSchema.parse(body)
    return prisma.tarjetaCredito.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, body: unknown) {
    await this.obtener(id, clienteId)
    const data = TarjetaSchema.partial().parse(body)
    return prisma.tarjetaCredito.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.tarjetaCredito.delete({ where: { id } })
  }
}
