import { Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { ImportacionService } from './importacion.service'
import { prisma } from '../../shared/prisma'

const service = new ImportacionService()

async function resolveClienteId(userId: string) {
  const c = await prisma.cliente.findFirst({ where: { usuarioId: userId } })
  if (!c) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 })
  return c.id
}

export async function previewCSV(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const content = req.body.content as string
    if (!content) { res.status(400).json({ error: 'Falta el contenido CSV' }); return }
    const filas = service.parseCSV(content)
    const result = await service.preview(clienteId, filas)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function previewExcel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    if (!req.body || !req.body.data) { res.status(400).json({ error: 'Falta el archivo' }); return }
    const buffer = Buffer.from(req.body.data, 'base64')
    const filas = service.parseExcel(buffer)
    const result = await service.preview(clienteId, filas)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function confirmar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clienteId = await resolveClienteId(req.user!.id)
    const { filas } = req.body as { filas: any[] }
    if (!Array.isArray(filas) || filas.length === 0) {
      res.status(400).json({ error: 'No hay filas para importar' }); return
    }
    const result = await service.confirmar(clienteId, filas)
    res.json({ data: result })
  } catch (err) { next(err) }
}