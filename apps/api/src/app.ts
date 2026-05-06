import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { authRouter } from './modules/auth/auth.router'
import { clientesRouter } from './modules/clientes/clientes.router'
import { cuentasRouter } from './modules/cuentas/cuentas.router'
import { tarjetasRouter } from './modules/tarjetas/tarjetas.router'
import { deudasRouter } from './modules/deudas/deudas.router'
import { transaccionesRouter } from './modules/transacciones/transacciones.router'
import categoriasRouter from './modules/categorias/categorias.router'
import { personasRouter } from './modules/personas/personas.router'
import { eventosRouter } from './modules/eventos/eventos.router'
import importacionRouter from './modules/importacion/importacion.router'
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
  app.use('/api/cuentas', cuentasRouter)
  app.use('/api/tarjetas', tarjetasRouter)
  app.use('/api/deudas', deudasRouter)
  app.use('/api/transacciones', transaccionesRouter)
  app.use('/api/categorias', categoriasRouter)
  app.use('/api/personas', personasRouter)
  app.use('/api/eventos', eventosRouter)
  app.use('/api/importacion', importacionRouter)

  app.use(errorHandler)

  return app
}
