import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { listar, obtener, crear, actualizar, eliminar } from './cuentas.controller'

export const cuentasRouter = Router()

cuentasRouter.use(requireAuth)

cuentasRouter.get('/', listar)
cuentasRouter.get('/:id', obtener)
cuentasRouter.post('/', crear)
cuentasRouter.put('/:id', actualizar)
cuentasRouter.delete('/:id', eliminar)