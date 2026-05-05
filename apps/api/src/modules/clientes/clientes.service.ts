import { prisma } from '../../shared/prisma'

export class ClientesService {
  async obtenerPerfil(userId: string) {
    const cliente = await prisma.cliente.findFirst({ where: { usuarioId: userId } })
    if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 })
    return cliente
  }

  async actualizarPerfil(userId: string, data: Record<string, unknown>) {
    const cliente = await this.obtenerPerfil(userId)
    return prisma.cliente.update({ where: { id: cliente.id }, data: data as any })
  }

  async listarTodos() {
    return prisma.cliente.findMany({ include: { usuario: { select: { email: true, nombre: true, rol: true } } }, orderBy: { createdAt: 'desc' } })
  }

  async crear(data: Record<string, unknown>) {
    return prisma.cliente.create({ data: data as any })
  }
}