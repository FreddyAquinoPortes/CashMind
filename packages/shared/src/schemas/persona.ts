import { z } from 'zod'

export const personaSchema = z.object({
  nombre: z.string().min(1),
  relacion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  notas: z.string().optional(),
})

export type PersonaInput = z.infer<typeof personaSchema>
