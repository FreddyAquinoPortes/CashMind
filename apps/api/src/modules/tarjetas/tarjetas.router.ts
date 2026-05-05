import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { listar, obtener, crear, actualizar, eliminar } from './tarjetas.controller'

export const tarjetasRouter = Router()

tarjetasRouter.use(requireAuth)

tarjetasRouter.get('/', listar)
tarjetasRouter.get('/:id', obtener)
tarjetasRouter.post('/', crear)
tarjetasRouter.put('/:id', actualizar)
tarjetasRouter.delete('/:id', eliminar)