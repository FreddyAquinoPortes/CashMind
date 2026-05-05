import { Request, Response, NextFunction } from 'express'
import { logger } from '../shared/logger'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on('finish', () => {
    logger.info({ method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - start })
  })
  next()
}
