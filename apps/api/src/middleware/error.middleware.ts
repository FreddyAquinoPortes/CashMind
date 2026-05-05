import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../shared/logger'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.flatten() })
  }

  logger.error({ err }, 'Unhandled error')
  const status = (err as { status?: number }).status ?? 500
  res.status(status).json({ error: err.message ?? 'Error interno del servidor' })
}
