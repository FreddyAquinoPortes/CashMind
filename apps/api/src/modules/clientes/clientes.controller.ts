import { Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { ClientesService } from './clientes.service'

const service = new ClientesService()

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await service.obtenerPerfil(req.user!.id)
    res.json({ data })
  } catch (err) { next(err) }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await service.actualizarPerfil(req.user!.id, req.body)
    res.json({ data })
  } catch (err) { next(err) }
}

export async function listarTodos(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user!.rol !== 'ADMIN') { res.status(403).json({ error: 'Solo administradores' }); return }
    const data = await service.listarTodos()
    res.json({ data })
  } catch (err) { next(err) }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user!.rol !== 'ADMIN') { res.status(403).json({ error: 'Solo administradores' }); return }
    const data = await service.crear(req.body)
    res.status(201).json({ data })
  } catch (err) { next(err) }
}