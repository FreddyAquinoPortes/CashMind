/**
 * Auth Router — CashMind
 *
 * Seguridad: Rate limiting estricto en rutas de autenticación
 * - Login: 5 intentos / 15 minutos (previene brute-force)
 * - Register: 3 intentos / hora (previene spam de cuentas)
 * - Google/MFA: 10 intentos / 15 minutos
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  loginGoogle,
  linkGoogle,
  verifyMfa,
  setupMfa,
  confirmMfa,
  disableMfa,
  refresh,
  logout,
  logoutAll,
} from './auth.controller'

// Rate limiter para login — 5 intentos por IP en 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' },
  skipSuccessfulRequests: true, // Solo contar intentos fallidos
})

// Rate limiter para registro — 3 por IP por hora
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas cuentas creadas. Intenta en una hora.' },
})

// Rate limiter general para rutas auth — 10 por 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta más tarde.' },
})

export const authRouter = Router()

authRouter.post('/register',         registerLimiter, register)
authRouter.post('/verify-email',     authLimiter,     verifyEmail)
authRouter.post('/verify-email/resend', authLimiter,  resendVerification)
authRouter.post('/login',            loginLimiter,    login)
authRouter.post('/google',           authLimiter,     loginGoogle)
authRouter.post('/google/link',      authLimiter,     linkGoogle)
authRouter.post('/verify-mfa',       authLimiter,     verifyMfa)
authRouter.post('/refresh',          refresh)
authRouter.post('/logout',           logout)
authRouter.post('/logout-all',       requireAuth,     logoutAll)

// Rutas MFA — requieren autenticación
authRouter.get ('/mfa/setup',        requireAuth,     setupMfa)
authRouter.post('/mfa/confirm',      requireAuth,     confirmMfa)
authRouter.delete('/mfa',            requireAuth,     disableMfa)
