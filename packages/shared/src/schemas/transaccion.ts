import { z } from 'zod'

export const TipoTransaccion = z.enum(['GASTO', 'INGRESO', 'TRANSFERENCIA', 'PAGO_DEUDA', 'AJUSTE'])
export const EstadoTransaccion = z.enum(['PENDIENTE', 'EJECUTADO', 'CANCELADO', 'PROYECTADO', 'PROGRAMADO'])
export const Frecuencia = z.enum(['UNICA', 'DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'])

export const transaccionSchema = z.object({
  concepto: z.string().min(1),
  monto: z.number().positive(),
  moneda: z.string().default('DOP'),
  tipo: TipoTransaccion,
  categoriaId: z.string().nullish(),
  subcategoriaId: z.string().nullish(),
  fecha: z.coerce.date(),
  frecuencia: Frecuencia,
  estado: EstadoTransaccion,
  cuentaId: z.string().nullish(),
  tarjetaId: z.string().nullish(),
  detalle: z.string().nullish(),
  notas: z.string().nullish(),
  comercio: z.string().nullish(),
  eventoId: z.string().nullish(),
  pagadoPorId: z.string().nullish(),
  porcentajePropio: z.number().min(0).max(100).default(100),
  tags: z.array(z.string()).default([]),
  // PAGO_DEUDA: one or multiple debt IDs to pay off (pay smallest first)
  deudaIds: z.array(z.string()).optional(),
})

export type TransaccionInput = z.infer<typeof transaccionSchema>
