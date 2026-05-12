import { z } from 'zod'

export const TipoDeuda = z.enum(['BANCARIA', 'TARJETA', 'PERSONAL', 'COMERCIAL', 'OTRA'])
export const TipoPlazo = z.enum(['FIJO', 'FLEXIBLE'])
export const EstadoDeuda = z.enum(['ACTIVA', 'SALDADA', 'EN_MORA', 'RENEGOCIADA', 'CANCELADA'])

export const deudaSchema = z.object({
  concepto: z.string().min(1),
  acreedorTexto: z.string().optional(),
  personaId: z.string().optional(),
  tipo: TipoDeuda,
  montoOriginal: z.number().positive(),
  saldoActual: z.number().min(0).optional(),
  moneda: z.string().default('DOP'),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().optional(),
  tasaInteres: z.number().min(0).nullish(),
  tipoPlazo: TipoPlazo,
  numeroCuotas: z.number().int().positive().nullish(),
  notas: z.string().nullish(),
})

export type DeudaInput = z.infer<typeof deudaSchema>
