import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../../shared/prisma'
import type { LoginInput, RegisterInput } from '@cashmind/shared'

const BCRYPT_ROUNDS = 12
const MAX_ATTEMPTS = 5

export class AuthService {
  private signAccess(payload: { id: string; email: string; rol: string }) {
    return jwt.sign(payload, process.env['JWT_SECRET']!, {
      expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
    } as jwt.SignOptions)
  }

  private signRefresh(payload: { id: string }) {
    return jwt.sign(payload, process.env['JWT_REFRESH_SECRET']!, {
      expiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
    } as jwt.SignOptions)
  }

  async login(input: LoginInput) {
    const user = await prisma.usuario.findUnique({ where: { email: input.email } })
    if (!user) throw Object.assign(new Error('Credenciales inválidas'), { status: 401 })

    if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
      throw Object.assign(new Error('Cuenta bloqueada temporalmente. Intenta más tarde.'), { status: 423 })
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      const intentos = user.intentosFallidos + 1
      const bloqueadoHasta = intentos >= MAX_ATTEMPTS
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null
      await prisma.usuario.update({
        where: { id: user.id },
        data: { intentosFallidos: intentos, bloqueadoHasta },
      })
      throw Object.assign(new Error('Credenciales inválidas'), { status: 401 })
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoLogin: new Date() },
    })

    const clientes = await prisma.cliente.findMany({ where: { usuarioId: user.id } })

    return {
      accessToken: this.signAccess({ id: user.id, email: user.email, rol: user.rol }),
      refreshToken: this.signRefresh({ id: user.id }),
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      clientes,
    }
  }

  async register(input: RegisterInput) {
    const exists = await prisma.usuario.findUnique({ where: { email: input.email } })
    if (exists) throw Object.assign(new Error('Email ya registrado'), { status: 409 })

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const user = await prisma.usuario.create({
      data: { email: input.email, passwordHash, nombre: input.nombre },
    })

    await prisma.cliente.create({
      data: { usuarioId: user.id, nombre: input.nombre, monedaBase: 'DOP' },
    })

    return {
      accessToken: this.signAccess({ id: user.id, email: user.email, rol: user.rol }),
      refreshToken: this.signRefresh({ id: user.id }),
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
    }
  }

  async refresh(token: string) {
    try {
      const payload = jwt.verify(token, process.env['JWT_REFRESH_SECRET']!) as { id: string }
      const user = await prisma.usuario.findUniqueOrThrow({ where: { id: payload.id } })
      return {
        accessToken: this.signAccess({ id: user.id, email: user.email, rol: user.rol }),
      }
    } catch {
      throw Object.assign(new Error('Refresh token inválido'), { status: 401 })
    }
  }
}
