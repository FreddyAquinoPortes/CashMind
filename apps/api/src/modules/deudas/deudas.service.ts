import { prisma } from '../../shared/prisma'

export class DeudasService {
  async listar(clienteId: string) {
    return prisma.deuda.findMany({ where: { clienteId }, orderBy: { createdAt: 'desc' } })
  }

  async obtener(id: string, clienteId: string) {
    const deuda = await prisma.deuda.findFirst({ where: { id, clienteId } })
    if (!deuda) throw Object.assign(new Error('Deuda no encontrada'), { status: 404 })
    return deuda
  }

  async crear(clienteId: string, data: Record<string, unknown>) {
    return prisma.deuda.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, data: Record<string, unknown>) {
    await this.obtener(id, clienteId)
    return prisma.deuda.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.deuda.delete({ where: { id } })
  }

  async listarCuotas(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.pagoDeuda.findMany({ where: { deudaId: id }, orderBy: { fecha: 'asc' } })
  }
}