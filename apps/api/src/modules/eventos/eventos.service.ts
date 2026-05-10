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
const TIPO_TX_DIR: Record<string, 1 | -1> = {
  PAGO_PROGRAMADO: -1,
  NOMINA:           1,
  CUMPLEANOS:      -1,
  FERIADO:         -1,
  OTRO:            -1,
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
  categoriaId:         z.string().optional().nullable(),
  subcategoriaId:      z.string().optional().nullable(),
  notas:               z.string().max(500).optional().nullable(),
})

const EventoUpdateSchema = EventoBaseSchema.partial()

const EjecutarSchema = z.object({
  cuentaId:       z.string().optional().nullable(),
  categoriaId:    z.string().optional().nullable(),
  subcategoriaId: z.string().optional().nullable(),
  notas:          z.string().optional().nullable(),
  clienteId:      z.string().optional(),
})

export class EventosService {
  async listar(clienteId: string, mes?: string, inicio?: string, fin?: string) {
    const where: any = { clienteId }

    if (inicio && fin) {
      where.OR = [
        { fecha: { gte: new Date(inicio + 'T00:00:00'), lte: new Date(fin + 'T23:59:59') } },
        { recurrente: true },
      ]
    } else if (mes) {
      const [y, m] = mes.split('-').map(Number)
      const i = new Date(y!, m! - 1, 1)
      const f = new Date(y!, m!, 0, 23, 59, 59)
      where.OR = [
        { fecha: { gte: i, lte: f } },
        { recurrente: true },
      ]
    }

    return prisma.evento.findMany({
      where,
      include: {
        persona:      { select: { id: true, nombre: true, apellido: true } },
        categoria:    { select: { id: true, nombre: true, color: true, icono: true } },
        subcategoria: { select: { id: true, nombre: true, color: true } },
      },
      orderBy: { fecha: 'asc' },
    })
  }

  async obtener(id: string, clienteId: string) {
    const ev = await prisma.evento.findFirst({
      where: { id, clienteId },
      include: {
        persona:      { select: { id: true, nombre: true, apellido: true } },
        categoria:    { select: { id: true, nombre: true, color: true, icono: true } },
        subcategoria: { select: { id: true, nombre: true, color: true } },
      },
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
    if (Number(evento.presupuestoEstimado) === 0) {
      throw Object.assign(new Error('Este evento es solo de recordatorio (monto 0) y no puede ejecutarse'), { status: 400 })
    }

    const { cuentaId, categoriaId, subcategoriaId, notas } = EjecutarSchema.parse(body)
    const tipoTx = TIPO_TX[evento.tipo] ?? 'GASTO'
    const dir    = TIPO_TX_DIR[evento.tipo] ?? -1

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
          categoriaId:     categoriaId ?? (evento as any).categoriaId ?? null,
          subcategoriaId:  subcategoriaId ?? (evento as any).subcategoriaId ?? null,
          notas:           notas ?? `Ejecución del evento: ${evento.nombre}`,
        },
      })

      // 2. Update account balance if cuenta provided
      if (cuentaId && evento.presupuestoEstimado) {
        const delta = dir * Number(evento.presupuestoEstimado)
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
