import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import * as ctrl from './categorias.controller'

const router = Router()

// Categorias
router.get('/',     requireAuth, ctrl.listar)
router.get('/:id',  requireAuth, ctrl.obtener)
router.post('/',    requireAuth, ctrl.crear)
router.put('/:id',  requireAuth, ctrl.actualizar)
router.delete('/:id', requireAuth, ctrl.eliminar)

// Subcategorias nested under categoria
router.get('/:id/subcategorias',           requireAuth, ctrl.listarSubs)
router.post('/:id/subcategorias',          requireAuth, ctrl.crearSub)
router.put('/:id/subcategorias/:subId',    requireAuth, ctrl.actualizarSub)
router.delete('/:id/subcategorias/:subId', requireAuth, ctrl.eliminarSub)

export default router