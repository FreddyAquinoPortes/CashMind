import { prisma } from '../../shared/prisma'

export class TarjetasService {
  async listar(clienteId: string) {
    const tarjetas = await prisma.tarjetaCredito.findMany({ where: { clienteId }, orderBy: { createdAt: 'desc' } })
    return tarjetas.map(t => ({
      ...t,
      utilizacion: t.limite.toNumber() > 0
        ? (t.saldoActual.toNumber() / t.limite.toNumber() * 100).toFixed(1)
        : '0.0',
    }))
  }

  async obtener(id: string, clienteId: string) {
    const tarjeta = await prisma.tarjetaCredito.findFirst({ where: { id, clienteId } })
    if (!tarjeta) throw Object.assign(new Error('Tarjeta no encontrada'), { status: 404 })
    return {
      ...tarjeta,
      utilizacion: tarjeta.limite.toNumber() > 0
        ? (tarjeta.saldoActual.toNumber() / tarjeta.limite.toNumber() * 100).toFixed(1)
        : '0.0',
    }
  }

  async crear(clienteId: string, data: Record<string, unknown>) {
    return prisma.tarjetaCredito.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, data: Record<string, unknown>) {
    await this.obtener(id, clienteId)
    return prisma.tarjetaCredito.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.tarjetaCredito.delete({ where: { id } })
  }
}