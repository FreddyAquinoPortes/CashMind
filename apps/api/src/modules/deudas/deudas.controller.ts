import { Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { DeudasService } from './deudas.service'
import { prisma } from '../../shared/prisma'

const service = new DeudasService()

async function resolveClienteId(userId: string): Promise<string> {
  const cliente = await prisma.cliente.findFirst({ where: { usuarioId: userId } })
  if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 })
  return cliente.id
}

export async function listar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.listar(clienteId)
    res.json({ data })
  } catch (err) { next(err) }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.obtener(req.params['id']!, clienteId)
    res.json({ data })
  } catch (err) { next(err) }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.crear(clienteId, req.body)
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

export async function actualizar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.actualizar(req.params['id']!, clienteId, req.body)
    res.json({ data })
  } catch (err) { next(err) }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    await service.eliminar(req.params['id']!, clienteId)
    res.json({ message: 'Deuda eliminada' })
  } catch (err) { next(err) }
}

export async function listarCuotas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.listarCuotas(req.params['id']!, clienteId)
    res.json({ data })
  } catch (err) { next(err) }
}