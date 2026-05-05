import { prisma } from '../../shared/prisma'

export class CuentasService {
  async listar(clienteId: string) {
    return prisma.cuentaBancaria.findMany({ where: { clienteId }, orderBy: { createdAt: 'desc' } })
  }

  async obtener(id: string, clienteId: string) {
    const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id, clienteId } })
    if (!cuenta) throw Object.assign(new Error('Cuenta no encontrada'), { status: 404 })
    return cuenta
  }

  async crear(clienteId: string, data: Record<string, unknown>) {
    return prisma.cuentaBancaria.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, data: Record<string, unknown>) {
    await this.obtener(id, clienteId)
    return prisma.cuentaBancaria.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.cuentaBancaria.delete({ where: { id } })
  }
}