import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'

export const clientesRouter = Router()

clientesRouter.use(requireAuth)

clientesRouter.get('/', (_req, res) => {
  res.json({ data: [], message: 'Módulo clientes — en construcción' })
})
