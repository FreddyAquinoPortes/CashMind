import { Request, Response, NextFunction } from 'express'
import { loginSchema, registerSchema } from '@cashmind/shared'
import { AuthService } from './auth.service'

const service = new AuthService()

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body)
    const result = await service.login(input)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body)
    const result = await service.register(input)
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken) { res.status(400).json({ error: 'refreshToken requerido' }); return }
    const result = await service.refresh(refreshToken)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function logout(_req: Request, res: Response) {
  res.json({ message: 'Sesión cerrada' })
}
