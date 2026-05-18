import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { authRouter }         from './modules/auth/auth.router'
import { clientesRouter }     from './modules/clientes/clientes.router'
import { categoriasRouter }   from './modules/categorias/categorias.router'
import { cuentasRouter }      from './modules/cuentas/cuentas.router'
import { tarjetasRouter }     from './modules/tarjetas/tarjetas.router'
import { personasRouter }     from './modules/personas/personas.router'
import { transaccionesRouter } from './modules/transacciones/transacciones.router'
import { deudasRouter }       from './modules/deudas/deudas.router'
import { eventosRouter }      from './modules/eventos/eventos.router'
import { dashboardRouter }    from './modules/dashboard/dashboard.router'
import { combustibleRouter }  from './modules/combustible/combustible.router'
import { presupuestosRouter }  from './modules/presupuestos/presupuestos.router'
import { proyeccionesRouter }  from './modules/proyecciones/proyecciones.router'
import { errorHandler }        from './middleware/error.middleware'
import { requestLogger }      from './middleware/logger.middleware'

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

  // Auth
  app.use('/api/auth', authRouter)

  // Todos los demás routers montan rutas completas bajo /api
  app.use('/api', clientesRouter)
  app.use('/api', categoriasRouter)
  app.use('/api', cuentasRouter)
  app.use('/api', tarjetasRouter)
  app.use('/api', personasRouter)
  app.use('/api', transaccionesRouter)
  app.use('/api', deudasRouter)
  app.use('/api', eventosRouter)
  app.use('/api', dashboardRouter)
  app.use('/api', combustibleRouter)
  app.use('/api', presupuestosRouter)
  app.use('/api', proyeccionesRouter)

  app.use(errorHandler)

  return app
}
