import { z } from 'zod'

export const TipoCuenta = z.enum(['CORRIENTE', 'AHORRO', 'INVERSION', 'OTRO'])

export const cuentaSchema = z.object({
  banco: z.string().min(1),
  numero: z.string().min(1),
  alias: z.string().optional(),
  tipo: TipoCuenta,
  moneda: z.string().default('DOP'),
  saldo: z.number().default(0),
})

export type CuentaInput = z.infer<typeof cuentaSchema>
