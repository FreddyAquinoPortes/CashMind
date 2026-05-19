import { z } from 'zod'

export const TipoDeuda = z.enum(['BANCARIA', 'TARJETA', 'PERSONAL', 'COMERCIAL', 'OTRA'])
export const TipoPlazo = z.enum(['FIJO', 'FLEXIBLE'])
export const EstadoDeuda = z.enum(['ACTIVA', 'SALDADA', 'EN_MORA', 'RENEGOCIADA', 'CANCELADA'])
export const DireccionDeuda = z.enum(['DEBO_YO', 'ME_DEBEN'])

export const deudaSchema = z.object({
  concepto: z.string().min(1),
  acreedorTexto: z.string().optional(),
  personaId: z.string().optional(),
  tipo: TipoDeuda,
  direccion: DireccionDeuda.default('DEBO_YO'),
  cuentaOrigenId: z.string().nullish(),
  tarjetaOrigenId: z.string().nullish(),
  estado: EstadoDeuda.optional(),
  montoOriginal: z.number().positive(),
  saldoActual: z.number().min(0).optional(),
  moneda: z.string().default('DOP'),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().optional().nullable(),
  tasaInteres: z.number().min(0).nullish(),
  tipoPlazo: TipoPlazo,
  numeroCuotas: z.number().int().positive().nullish(),
  diaCobro: z.number().int().min(1).max(31).nullish(),
  notas: z.string().nullish(),
  categoriaId: z.string().nullish(),
  subcategoriaId: z.string().nullish(),
  cuotasPagadasAnteriores: z.number().int().min(0).default(0),
})

export type DeudaInput = z.infer<typeof deudaSchema>
