import { z } from 'zod'

export const tarjetaSchema = z.object({
  banco: z.string().min(1),
  alias: z.string().optional(),
  ultimosCuatro: z.string().length(4),
  limite: z.number().positive(),
  saldoActual: z.number().default(0),
  tasaInteres: z.number().min(0).default(0),
  tasaMora: z.number().min(0).default(0),
  diaCorte: z.number().int().min(1).max(31),
  diaPago: z.number().int().min(1).max(31),
  penalidadSobregiro: z.number().min(0).default(0),
  moneda: z.string().default('DOP'),
})

export type TarjetaInput = z.infer<typeof tarjetaSchema>
