import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { listar, obtener, crear, actualizar, eliminar, listarDeudas } from './personas.controller'

export const personasRouter = Router()

personasRouter.use(requireAuth)

personasRouter.get('/', listar)
personasRouter.get('/:id', obtener)
personasRouter.post('/', crear)
personasRouter.put('/:id', actualizar)
personasRouter.delete('/:id', eliminar)
personasRouter.get('/:id/deudas', listarDeudas)