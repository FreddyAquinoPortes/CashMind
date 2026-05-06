import { z } from 'zod'
import { prisma } from '../../shared/prisma'

// Only letters, spaces, accents, hyphens — no digits or symbols
const nameRegex = /^[a-zA-ZÀ-ÿñÑ\s'-]+$/

// Base schema without refine — supports .partial() for updates
const PersonaBaseSchema = z.object({
  tipo:     z.enum(['persona', 'entidad']).default('persona'),
  nombre:   z.string()
    .min(1, 'El nombre es requerido')
    .max(100)
    .regex(nameRegex, 'Solo se permiten letras, espacios y guiones'),
  apellido: z.string()
    .max(100)
    .regex(nameRegex, 'Solo se permiten letras, espacios y guiones')
    .optional()
    .nullable(),
  relacion: z.string().max(80).optional().nullable(),
  telefono: z.string().max(50).optional().nullable(),
  email: z.preprocess(
    v => (v === '' || v == null) ? null : String(v).trim(),
    z.string()
      .email('Formato de correo inválido (ej. usuario@dominio.com)')
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'El correo debe tener formato usuario@dominio.ext')
      .nullable()
  ),
  notas: z.string().max(500).optional().nullable(),
})

// Full schema with apellido required for personas (create)
const PersonaSchema = PersonaBaseSchema.refine(
  d => d.tipo !== 'persona' || (d.apellido && d.apellido.trim().length > 0),
  { message: 'El apellido es requerido para personas', path: ['apellido'] }
)

// Update schema — all fields optional, lighter refine
const PersonaUpdateSchema = PersonaBaseSchema.partial().refine(
  d => !d.tipo || d.tipo !== 'persona' || !d.nombre || (d.apellido && d.apellido.trim().length > 0) || d.apellido === undefined,
  { message: 'El apellido es requerido para personas', path: ['apellido'] }
)

export type PersonaInput = z.infer<typeof PersonaSchema>

export class PersonasService {
  private displayName(p: { tipo: string; nombre: string; apellido: string | null }) {
    return p.tipo === 'persona' && p.apellido
      ? `${p.nombre} ${p.apellido}`
      : p.nombre
  }

  async listar(clienteId: string) {
    const personas = await prisma.persona.findMany({
      where: { clienteId },
      orderBy: { nombre: 'asc' },
      include: { deudas: { select: { saldoActual: true, estado: true } } },
    })
    return personas.map(p => ({
      ...p,
      displayName: this.displayName(p),
      balanceTotal: p.deudas
        .filter(d => d.estado === 'ACTIVA')
        .reduce((s, d) => s + d.saldoActual.toNumber(), 0),
    }))
  }

  async obtener(id: string, clienteId: string) {
    const p = await prisma.persona.findFirst({
      where: { id, clienteId },
      include: { deudas: { select: { saldoActual: true, estado: true } } },
    })
    if (!p) throw Object.assign(new Error('Persona no encontrada'), { status: 404 })
    return {
      ...p,
      displayName: this.displayName(p),
      balanceTotal: p.deudas
        .filter(d => d.estado === 'ACTIVA')
        .reduce((s, d) => s + d.saldoActual.toNumber(), 0),
    }
  }

  async crear(clienteId: string, body: unknown) {
    const data = PersonaSchema.parse(body)
    return prisma.persona.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, body: unknown) {
    await this.obtener(id, clienteId)
    const data = PersonaUpdateSchema.parse(body)
    return prisma.persona.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.persona.delete({ where: { id } })
  }

  async listarDeudas(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.deuda.findMany({
      where: { personaId: id },
      orderBy: { createdAt: 'desc' },
    })
  }
}
