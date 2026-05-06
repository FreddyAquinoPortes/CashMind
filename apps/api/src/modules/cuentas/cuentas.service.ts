import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const CuentaSchema = z.object({
  alias:   z.string().min(1, 'El nombre es requerido').max(80),
  banco:   z.string().min(1, 'Selecciona un banco'),
  numero:  z.string().min(1, 'El número de cuenta es requerido').max(30),
  tipo:    z.enum(['CORRIENTE', 'AHORRO', 'INVERSION', 'OTRO']),
  moneda:  z.string().default('DOP'),
  saldo:   z.coerce.number().default(0),
  activa:  z.boolean().default(true),
})

export type CuentaInput = z.infer<typeof CuentaSchema>

export class CuentasService {
  async listar(clienteId: string) {
    return prisma.cuentaBancaria.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async obtener(id: string, clienteId: string) {
    const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id, clienteId } })
    if (!cuenta) throw Object.assign(new Error('Cuenta no encontrada'), { status: 404 })
    return cuenta
  }

  async crear(clienteId: string, body: unknown) {
    const data = CuentaSchema.parse(body)
    return prisma.cuentaBancaria.create({
      data: { ...data, clienteId },
    })
  }

  async actualizar(id: string, clienteId: string, body: unknown) {
    await this.obtener(id, clienteId)
    const data = CuentaSchema.partial().parse(body)
    return prisma.cuentaBancaria.update({ where: { id }, data })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.cuentaBancaria.delete({ where: { id } })
  }
}
