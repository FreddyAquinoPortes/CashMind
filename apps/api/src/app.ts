import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { authRouter } from './modules/auth/auth.router'
import { clientesRouter } from './modules/clientes/clientes.router'
import { errorHandler } from './middleware/error.middleware'
import { requestLogger } from './middleware/logger.middleware'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173', credentials: true }))
  app.use(compression())
  app.use(express.json({ limit: '10mb' }))
  app.use(requestLogger)

  const limiter = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false })
  app.use('/api', limiter)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/clientes', clientesRouter)

  app.use(errorHandler)

  return app
}
