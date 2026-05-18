import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const personaSchema = z.object({
  tipo: z.enum(['persona', 'entidad']).default('persona'),
  nombre: z.string().min(1),
  apellido: z.string().nullish(),
  relacion: z.string().nullish(),
  telefono: z.string().nullish(),
  email: z.string().nullish(),
  notas: z.string().nullish(),
})

export class PersonasService {
  async list(clienteId: string) {
    const personas = await prisma.persona.findMany({
      where: { clienteId },
      include: {
        _count: { select: { transaccionesPagadas: true, deudas: true } },
        deudas: { where: { estado: 'ACTIVA' }, select: { saldoActual: true } },
      },
      orderBy: { nombre: 'asc' },
    })
    return personas.map(p => ({
      ...p,
      displayName: p.apellido ? `${p.nombre} ${p.apellido}` : p.nombre,
      balanceTotal: p.deudas.reduce((s, d) => s + Number(d.saldoActual), 0),
      deudas: undefined,
    }))
  }

  async create(clienteId: string, body: unknown) {
    const d = personaSchema.parse(body)
    return prisma.persona.create({
      data: {
        clienteId,
        tipo: d.tipo,
        nombre: d.nombre,
        apellido: d.apellido ?? null,
        relacion: d.relacion ?? null,
        telefono: d.telefono ?? null,
        email: d.email ?? null,
        notas: d.notas ?? null,
      },
    })
  }

  async update(id: string, body: unknown) {
    const d = personaSchema.partial().parse(body)
    return prisma.persona.update({
      where: { id },
      data: {
        ...(d.tipo !== undefined && { tipo: d.tipo }),
        ...(d.nombre !== undefined && { nombre: d.nombre }),
        ...(d.apellido !== undefined && { apellido: d.apellido ?? null }),
        ...(d.relacion !== undefined && { relacion: d.relacion ?? null }),
        ...(d.telefono !== undefined && { telefono: d.telefono ?? null }),
        ...(d.email !== undefined && { email: d.email ?? null }),
        ...(d.notas !== undefined && { notas: d.notas ?? null }),
      },
    })
  }

  async remove(id: string) {
    return prisma.persona.delete({ where: { id } })
  }

  async balance(personaId: string) {
    const deudas = await prisma.deuda.findMany({ where: { personaId, estado: 'ACTIVA' }, select: { saldoActual: true } })
    const total = deudas.reduce((a, d) => a + Number(d.saldoActual), 0)
    return { debeYo: total, neto: -total }
  }
}
