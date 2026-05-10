import { z } from 'zod'

export const EstadoEvento = z.enum(['PLANIFICADO', 'APARTADO', 'EJECUTADO', 'CANCELADO'])

export const eventoSchema = z.object({
  nombre: z.string().min(1),
  fecha: z.coerce.date(),
  recurrente: z.boolean().default(false),
  tipoRecurrencia: z.string().optional(),
  presupuestoEstimado: z.number().min(0).default(0),
  rangoMin: z.number().min(0).optional(),
  rangoMax: z.number().min(0).optional(),
  prioridad: z.number().int().min(1).max(5).default(3),
  estado: EstadoEvento.default('PLANIFICADO'),
  personaId: z.string().optional(),
  notas: z.string().optional(),
})

export type EventoInput = z.infer<typeof eventoSchema>
