import { prisma } from '../../shared/prisma'

export class PersonasService {
  async listar(clienteId: string) {
    return prisma.persona.findMany({ where: { clienteId }, orderBy: { nombre: 'asc' } })
  }

  async obtener(id: string, clienteId: string) {
    const persona = await prisma.persona.findFirst({ where: { id, clienteId } })
    if (!persona) throw Object.assign(new Error('Persona no encontrada'), { status: 404 })
    return persona
  }

  async crear(clienteId: string, data: Record<string, unknown>) {
    return prisma.persona.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, data: Record<string, unknown>) {
    await this.obtener(id, clienteId)
    return prisma.persona.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.persona.delete({ where: { id } })
  }

  async listarDeudas(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.deuda.findMany({ where: { personaId: id }, orderBy: { createdAt: 'desc' } })
  }
}