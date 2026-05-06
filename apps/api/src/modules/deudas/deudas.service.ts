import { z } from 'zod'
import { prisma } from '../../shared/prisma'

// Base schema without refine — allows .partial() for updates
const DeudaBaseSchema = z.object({
  personaId:     z.string().min(1, 'Selecciona una persona/entidad'),
  concepto:      z.string().min(1, 'El concepto es requerido').max(150),
  acreedorTexto: z.string().max(100).optional().nullable(),
  tipo:          z.enum(['BANCARIA', 'TARJETA', 'PERSONAL', 'COMERCIAL', 'OTRA']),
  montoOriginal: z.coerce.number().positive('El monto debe ser mayor a 0'),
  saldoActual:   z.coerce.number().min(0).optional(),
  moneda:        z.string().default('DOP'),
  fechaInicio:   z.string().transform(s => new Date(s)),
  fechaFin:      z.string().transform(s => new Date(s)).optional().nullable(),
  tasaInteres:   z.coerce.number().min(0).max(100).optional().nullable(),
  tipoPlazo:     z.enum(['FIJO', 'FLEXIBLE']),
  numeroCuotas:  z.coerce.number().int().positive().optional().nullable(),
  diaCobro:      z.coerce.number().int().min(1).max(31).optional().nullable(),
  estado:        z.enum(['ACTIVA', 'SALDADA', 'EN_MORA', 'RENEGOCIADA', 'CANCELADA']).default('ACTIVA'),
  notas:         z.string().max(500).optional().nullable(),
})

// Full schema for creation — validates cuotas required when plazo=FIJO
const DeudaSchema = DeudaBaseSchema.refine(
  d => d.tipoPlazo !== 'FIJO' || (d.numeroCuotas && d.numeroCuotas > 0),
  { message: 'Número de cuotas requerido para plazo fijo', path: ['numeroCuotas'] }
)

// Update schema — all fields optional, lighter validation
const DeudaUpdateSchema = DeudaBaseSchema.partial().refine(
  d => !d.tipoPlazo || d.tipoPlazo !== 'FIJO' || !d.numeroCuotas || d.numeroCuotas > 0,
  { message: 'Número de cuotas requerido para plazo fijo', path: ['numeroCuotas'] }
)

const PagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  fecha: z.string().optional().transform(s => s ? new Date(s) : new Date()),
  notas: z.string().max(200).optional().nullable(),
})

export type DeudaInput = z.infer<typeof DeudaSchema>

export class DeudasService {
  async listar(clienteId: string) {
    return prisma.deuda.findMany({
      where: { clienteId },
      include: { persona: { select: { id: true, nombre: true, apellido: true, tipo: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async obtener(id: string, clienteId: string) {
    const deuda = await prisma.deuda.findFirst({
      where: { id, clienteId },
      include: {
        persona: { select: { id: true, nombre: true, apellido: true, tipo: true } },
        pagos: { orderBy: { fecha: 'desc' }, take: 10 },
      },
    })
    if (!deuda) throw Object.assign(new Error('Deuda no encontrada'), { status: 404 })
    return deuda
  }

  async crear(clienteId: string, body: unknown) {
    const data = DeudaSchema.parse(body)
    return prisma.deuda.create({
      data: {
        ...data,
        clienteId,
        saldoActual: data.saldoActual ?? data.montoOriginal,
      } as any,
    })
  }

  async actualizar(id: string, clienteId: string, body: unknown) {
    await this.obtener(id, clienteId)
    const data = DeudaUpdateSchema.parse(body)
    return prisma.deuda.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.deuda.delete({ where: { id } })
  }

  async listarPagos(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.pagoDeuda.findMany({
      where: { deudaId: id },
      orderBy: { fecha: 'desc' },
    })
  }

  async aplicarPago(id: string, clienteId: string, body: unknown) {
    const deuda = await this.obtener(id, clienteId)
    const { monto, fecha, notas } = PagoSchema.parse(body)

    const saldoActual = parseFloat(String(deuda.saldoActual))
    if (monto > saldoActual) {
      throw Object.assign(
        new Error(`El pago (${monto}) supera el saldo actual (${saldoActual})`),
        { status: 400 }
      )
    }

    const nuevoSaldo = parseFloat((saldoActual - monto).toFixed(2))
    const nuevoEstado = nuevoSaldo === 0 ? 'SALDADA' : deuda.estado

    const [pago] = await prisma.$transaction([
      prisma.pagoDeuda.create({
        data: { deudaId: id, monto, fecha, estado: 'EJECUTADO', notas: notas ?? null },
      }),
      prisma.deuda.update({
        where: { id },
        data: { saldoActual: nuevoSaldo, estado: nuevoEstado as any },
      }),
    ])

    return { pago, nuevoSaldo, estado: nuevoEstado }
  }
}
