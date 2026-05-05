import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { getMe, updateMe, listarTodos, crear } from './clientes.controller'

export const clientesRouter = Router()

clientesRouter.use(requireAuth)

clientesRouter.get('/me', getMe)
clientesRouter.put('/me', updateMe)
clientesRouter.get('/', listarTodos)
clientesRouter.post('/', crear)