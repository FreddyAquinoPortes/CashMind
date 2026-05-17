import { Request, Response, NextFunction } from 'express'
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  googleLoginSchema,
  linkGoogleSchema,
  verifyMfaSchema,
  confirmMfaSchema,
  disableMfaSchema,
  refreshSchema,
  logoutSchema,
} from '@cashmind/shared'
import { AuthService } from './auth.service'
import { AuthRequest } from '../../middleware/auth.middleware'

const service = new AuthService()

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown'
}

function getDevice(req: Request): string {
  return (req.headers['user-agent'] ?? 'unknown').slice(0, 200)
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body)
    const result = await service.register(input)
    res.status(201).json({ data: result })
  } catch (err) { next(err) }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const input = verifyEmailSchema.parse(req.body)
    const result = await service.verifyEmail(input, getIp(req), getDevice(req))
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as { email?: string }
    if (!email) { res.status(400).json({ error: 'email requerido' }); return }
    const result = await service.resendVerification(email)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body)
    const result = await service.login(input, getIp(req), getDevice(req))
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function loginGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const input = googleLoginSchema.parse(req.body)
    const result = await service.loginGoogle(input, getIp(req), getDevice(req))
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function linkGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const base  = linkGoogleSchema.parse(req.body)
    const { googleEmail, googleName, googleAvatar } = req.body as {
      googleEmail?: string; googleName?: string; googleAvatar?: string
    }
    if (!googleEmail) { res.status(400).json({ error: 'googleEmail requerido' }); return }
    const result = await service.linkGoogle(
      { ...base, googleEmail, googleName, googleAvatar },
      getIp(req), getDevice(req),
    )
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function verifyMfa(req: Request, res: Response, next: NextFunction) {
  try {
    const input = verifyMfaSchema.parse(req.body)
    const result = await service.verifyMfa(input, getIp(req), getDevice(req))
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function setupMfa(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.setupMfa(req.user!.id)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function confirmMfa(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = confirmMfaSchema.parse(req.body)
    const result = await service.confirmMfa(req.user!.id, input)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function disableMfa(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = disableMfaSchema.parse(req.body)
    const result = await service.disableMfa(req.user!.id, input)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body)
    const result = await service.refresh(refreshToken)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = logoutSchema.parse(req.body)
    const result = await service.logout(refreshToken)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export async function logoutAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.logoutAll(req.user!.id)
    res.json({ data: result })
  } catch (err) { next(err) }
}
