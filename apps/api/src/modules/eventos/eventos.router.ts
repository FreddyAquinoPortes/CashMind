import { Router } from 'express'
import { requireAuth, AuthRequest } from '../../middleware/auth.middleware'
import { EventosService } from './eventos.service'
import { prisma } from '../../shared/prisma'

export const eventosRouter = Router()
const svc = new EventosService()

async function resolveClienteId(userId: string): Promise<string> {
  const cliente = await prisma.cliente.findFirst({ where: { usuarioId: userId } })
  if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 })
  return cliente.id
}

eventosRouter.use(requireAuth)

eventosRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const mes = req.query['mes'] as string | undefined
    res.json({ data: await svc.listar(clienteId, mes) })
  } catch (e) { next(e) }
})

eventosRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    res.json({ data: await svc.obtener(req.params['id']!, clienteId) })
  } catch (e) { next(e) }
})

eventosRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    res.status(201).json({ data: await svc.crear(clienteId, req.body) })
  } catch (e) { next(e) }
})

eventosRouter.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    res.json({ data: await svc.actualizar(req.params['id']!, clienteId, req.body) })
  } catch (e) { next(e) }
})

eventosRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    await svc.eliminar(req.params['id']!, clienteId)
    res.json({ data: { ok: true } })
  } catch (e) { next(e) }
})

eventosRouter.post('/:id/ejecutar', async (req: AuthRequest, res, next) => {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    res.json({ data: await svc.ejecutar(req.params['id']!, clienteId, req.body) })
  } catch (e) { next(e) }
})
