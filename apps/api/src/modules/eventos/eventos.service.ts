import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const TIPOS_EVENTO = ['PAGO_PROGRAMADO', 'NOMINA', 'CUMPLEANOS', 'FERIADO', 'OTRO'] as const
const TIPO_TX: Record<string, string> = {
  PAGO_PROGRAMADO: 'GASTO',
  NOMINA:          'INGRESO',
  CUMPLEANOS:      'GASTO',
  FERIADO:         'GASTO',
  OTRO:            'GASTO',
}

const EventoBaseSchema = z.object({
  nombre:              z.string().min(1).max(150),
  tipo:                z.enum(TIPOS_EVENTO).default('PAGO_PROGRAMADO'),
  fecha:               z.string().transform(s => new Date(s + (s.length === 10 ? 'T00:00:00' : ''))),
  recurrente:          z.boolean().default(false),
  tipoRecurrencia:     z.enum(['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL']).optional().nullable(),
  presupuestoEstimado: z.coerce.number().min(0).default(0),
  moneda:              z.string().default('DOP'),
  rangoMin:            z.coerce.number().min(0).optional().nullable(),
  rangoMax:            z.coerce.number().min(0).optional().nullable(),
  prioridad:           z.coerce.number().int().min(1).max(5).default(3),
  estado:              z.enum(['PLANIFICADO', 'APARTADO', 'EJECUTADO', 'CANCELADO']).default('PLANIFICADO'),
  personaId:           z.string().optional().nullable(),
  notas:               z.string().max(500).optional().nullable(),
})

const EventoUpdateSchema = EventoBaseSchema.partial()

const EjecutarSchema = z.object({
  cuentaId:      z.string().optional().nullable(),
  categoriaId:   z.string().optional().nullable(),
  subcategoriaId: z.string().optional().nullable(),
  notas:         z.string().optional().nullable(),
})

export class EventosService {
  async listar(clienteId: string, mes?: string) {
    const where: any = { clienteId }

    if (mes) {
      // mes = "2026-05"  → traer eventos del mes Y recurrentes
      const [y, m] = mes.split('-').map(Number)
      const inicio = new Date(y, m - 1, 1)
      const fin    = new Date(y, m, 0, 23, 59, 59)
      where.OR = [
        { fecha: { gte: inicio, lte: fin } },       // eventos del mes
        { recurrente: true },                         // todos los recurrentes (frontend los expande)
      ]
    }

    return prisma.evento.findMany({
      where,
      include: { persona: { select: { id: true, nombre: true, apellido: true } } },
      orderBy: { fecha: 'asc' },
    })
  }

  async obtener(id: string, clienteId: string) {
    const ev = await prisma.evento.findFirst({
      where: { id, clienteId },
      include: { persona: { select: { id: true, nombre: true, apellido: true } } },
    })
    if (!ev) throw Object.assign(new Error('Evento no encontrado'), { status: 404 })
    return ev
  }

  async crear(clienteId: string, body: unknown) {
    const data = EventoBaseSchema.parse(body)
    return prisma.evento.create({ data: { ...data, clienteId } as any })
  }

  async actualizar(id: string, clienteId: string, body: unknown) {
    await this.obtener(id, clienteId)
    const data = EventoUpdateSchema.parse(body)
    return prisma.evento.update({ where: { id }, data: data as any })
  }

  async eliminar(id: string, clienteId: string) {
    await this.obtener(id, clienteId)
    return prisma.evento.delete({ where: { id } })
  }

  async ejecutar(id: string, clienteId: string, body: unknown) {
    const evento = await this.obtener(id, clienteId)

    if (evento.estado === 'EJECUTADO') {
      throw Object.assign(new Error('El evento ya fue ejecutado'), { status: 400 })
    }
    if (!['PAGO_PROGRAMADO', 'NOMINA'].includes(evento.tipo)) {
      throw Object.assign(new Error('Solo eventos de pago pueden ejecutarse'), { status: 400 })
    }

    const { cuentaId, categoriaId, subcategoriaId, notas } = EjecutarSchema.parse(body)
    const tipoTx = TIPO_TX[evento.tipo] ?? 'GASTO'

    return prisma.$transaction(async (tx) => {
      // 1. Create transaction
      const transaccion = await tx.transaccion.create({
        data: {
          clienteId,
          concepto:        evento.nombre,
          monto:           evento.presupuestoEstimado,
          moneda:          evento.moneda,
          tipo:            tipoTx as any,
          estado:          'EJECUTADO',
          fecha:           evento.fecha,
          frecuencia:      'UNICA',
          eventoId:        evento.id,
          cuentaId:        cuentaId ?? null,
          categoriaId:     categoriaId ?? null,
          subcategoriaId:  subcategoriaId ?? null,
          notas:           notas ?? `Ejecución del evento: ${evento.nombre}`,
        },
      })

      // 2. Update account balance if cuenta provided
      if (cuentaId && evento.presupuestoEstimado) {
        const delta = tipoTx === 'INGRESO'
          ? Number(evento.presupuestoEstimado)
          : -Number(evento.presupuestoEstimado)
        await tx.cuentaBancaria.update({
          where: { id: cuentaId },
          data:  { saldo: { increment: delta } },
        })
      }

      // 3. Mark event as EJECUTADO
      await tx.evento.update({
        where: { id },
        data:  { estado: 'EJECUTADO' },
      })

      return transaccion
    })
  }
}
