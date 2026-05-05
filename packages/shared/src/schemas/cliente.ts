import { z } from 'zod'

export const clienteSchema = z.object({
  nombre: z.string().min(2),
  monedaBase: z.string().default('DOP'),
  diaCorteCiclo: z.number().int().min(1).max(31).optional(),
})

export type ClienteInput = z.infer<typeof clienteSchema>
