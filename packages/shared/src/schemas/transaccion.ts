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
  cuentaId: z.string().optional(),
  tarjetaId: z.string().optional(),
  detalle: z.string().optional(),
  notas: z.string().optional(),
  comercio: z.string().optional(),
  eventoId: z.string().optional(),
  pagadoPorId: z.string().optional(),
  porcentajePropio: z.number().min(0).max(100).default(100),
  tags: z.array(z.string()).default([]),
})

export type TransaccionInput = z.infer<typeof transaccionSchema>
