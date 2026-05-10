import { prisma } from './prisma'

export async function requireCliente(clienteId: string, usuarioId: string) {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, usuarioId } })
  if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 })
  return cliente
}
