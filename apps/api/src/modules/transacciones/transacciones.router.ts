import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { listar, obtener, crear, actualizar, eliminar, categorizarAuto } from './transacciones.controller'

export const transaccionesRouter = Router()

transaccionesRouter.use(requireAuth)

transaccionesRouter.get('/', listar)
transaccionesRouter.get('/:id', obtener)
transaccionesRouter.post('/', crear)
transaccionesRouter.put('/:id', actualizar)
transaccionesRouter.delete('/:id', eliminar)
transaccionesRouter.post('/categorizar-auto', categorizarAuto)