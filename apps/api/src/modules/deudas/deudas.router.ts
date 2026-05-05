import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { listar, obtener, crear, actualizar, eliminar, listarCuotas } from './deudas.controller'

export const deudasRouter = Router()

deudasRouter.use(requireAuth)

deudasRouter.get('/', listar)
deudasRouter.get('/:id', obtener)
deudasRouter.post('/', crear)
deudasRouter.put('/:id', actualizar)
deudasRouter.delete('/:id', eliminar)
deudasRouter.get('/:id/cuotas', listarCuotas)