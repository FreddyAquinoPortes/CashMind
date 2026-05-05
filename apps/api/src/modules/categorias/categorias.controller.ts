import { Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { CategoriasService } from './categorias.service'
import { prisma } from '../../shared/prisma'

const service = new CategoriasService()

async function resolveClienteId(usuarioId: string): Promise<string> {
  const cliente = await prisma.cliente.findFirst({ where: { usuarioId } })
  if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 })
  return cliente.id
}

// ── Categorias ─────────────────────────────────────────────────────────────

export async function listar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    res.json({ data: await service.listar(clienteId) })
  } catch (err) { next(err) }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.obtener(req.params['id']!) })
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
    res.status(204).end()
  } catch (err) { next(err) }
}

// ── Subcategorias ──────────────────────────────────────────────────────────

export async function listarSubs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.listarSubcategorias(req.params['id']!) })
  } catch (err) { next(err) }
}

export async function crearSub(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.crearSubcategoria(req.params['id']!, clienteId, req.body)
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

export async function actualizarSub(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const data = await service.actualizarSubcategoria(req.params['subId']!, clienteId, req.body)
    res.json({ data })
  } catch (err) { next(err) }
}

export async function eliminarSub(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    await service.eliminarSubcategoria(req.params['subId']!, clienteId)
    res.status(204).end()
  } catch (err) { next(err) }
}