import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { previewCSV, previewExcel, confirmar } from './importacion.controller'

const router = Router()
router.use(requireAuth)
router.post('/preview-csv',   previewCSV)
router.post('/preview-excel', previewExcel)
router.post('/confirmar',     confirmar)

export default router