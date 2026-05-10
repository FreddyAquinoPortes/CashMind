import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const cuentaSchema = z.object({
  banco: z.string().min(1),
  numero: z.string().min(1),
  alias: z.string().optional(),
  tipo: z.enum(['CORRIENTE', 'AHORRO', 'INVERSION', 'OTRO']),
  moneda: z.string().default('DOP'),
  saldo: z.number().default(0),
  activa: z.boolean().default(true),
})

export class CuentasService {
  async list(clienteId: string) {
    return prisma.cuentaBancaria.findMany({ where: { clienteId }, orderBy: { createdAt: 'asc' } })
  }

  async create(clienteId: string, body: unknown) {
    const d = cuentaSchema.parse(body)
    return prisma.cuentaBancaria.create({
      data: { banco: d.banco, numero: d.numero, alias: d.alias ?? null, tipo: d.tipo, moneda: d.moneda, saldo: d.saldo, activa: d.activa, clienteId },
    })
  }

  async update(id: string, body: unknown) {
    const d = cuentaSchema.partial().parse(body)
    return prisma.cuentaBancaria.update({
      where: { id },
      data: {
        ...(d.banco !== undefined && { banco: d.banco }),
        ...(d.numero !== undefined && { numero: d.numero }),
        ...(d.alias !== undefined && { alias: d.alias ?? null }),
        ...(d.tipo !== undefined && { tipo: d.tipo }),
        ...(d.moneda !== undefined && { moneda: d.moneda }),
        ...(d.saldo !== undefined && { saldo: d.saldo }),
        ...(d.activa !== undefined && { activa: d.activa }),
      },
    })
  }

  async remove(id: string) {
    const count = await prisma.transaccion.count({ where: { cuentaId: id } })
    if (count > 0) throw Object.assign(new Error('La cuenta tiene transacciones asociadas'), { status: 409 })
    return prisma.cuentaBancaria.delete({ where: { id } })
  }
}
