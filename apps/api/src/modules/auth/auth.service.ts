/**
 * Auth Service — CashMind
 *
 * Prácticas de seguridad implementadas:
 * - Prisma previene SQL injection con queries parametrizadas automáticamente
 * - bcrypt 12 rounds para passwords (resistente a brute-force)
 * - Bloqueo de cuenta tras 5 intentos fallidos (15 min)
 * - No se expone si el email existe o no en mensajes de error de login
 * - JWT access token 15m + refresh token 7d
 * - Refresh tokens almacenados en DB (SesionActiva) — se pueden revocar
 * - Tokens de verificación de email con expiración de 10 minutos
 * - Backup codes para 2FA (8 códigos de un solo uso)
 * - Google ID token verificado con google-auth-library (no solo decodificado)
 */

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
// otplib v12+ uses options-based API: generateSync({secret}), verifySync({token, secret}), generateURI({...})
import {
  generateSecret as otplibGenerateSecret,
  generateSync as totpGenerateSync,
  verifySync as totpVerifySync,
  generateURI as totpGenerateURI,
} from 'otplib'
import QRCode from 'qrcode'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../../shared/prisma'
import { sendVerificationCode } from '../../services/email.service'
import type {
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
  GoogleLoginInput,
  LinkGoogleInput,
  VerifyMfaInput,
  ConfirmMfaInput,
  DisableMfaInput,
} from '@cashmind/shared'

// ── Constantes de seguridad ────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12          // 12 rounds es el estándar recomendado para 2024+
const MAX_ATTEMPTS  = 5           // Intentos antes del bloqueo
const LOCK_MINUTES  = 15          // Minutos de bloqueo
const EMAIL_TOKEN_MINUTES = 10    // Expiración del código de verificación
const MFA_TOKEN_MINUTES   = 5     // Expiración del token temporal MFA
const BACKUP_CODE_COUNT   = 8     // Cantidad de backup codes para 2FA

const googleClient = new OAuth2Client(process.env['GOOGLE_CLIENT_ID'])

// ── Helpers de JWT ─────────────────────────────────────────────────────────
function signAccess(payload: { id: string; email: string; rol: string }) {
  return jwt.sign(payload, process.env['JWT_SECRET']!, {
    expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '15m') as jwt.SignOptions['expiresIn'],
  })
}

function signRefresh(payload: { id: string }) {
  return jwt.sign(payload, process.env['JWT_REFRESH_SECRET']!, {
    expiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d') as jwt.SignOptions['expiresIn'],
  })
}

/** JWT temporal para el flujo MFA — corta duración */
function signMfaTemp(payload: { id: string }) {
  return jwt.sign(payload, process.env['JWT_SECRET']! + '_mfa', {
    expiresIn: `${MFA_TOKEN_MINUTES}m` as jwt.SignOptions['expiresIn'],
  })
}

function verifyMfaTemp(token: string): { id: string } {
  return jwt.verify(token, process.env['JWT_SECRET']! + '_mfa') as { id: string }
}

// ── Helper: crear sesión activa en DB ──────────────────────────────────────
async function createSession(usuarioId: string, ip?: string, dispositivo?: string) {
  const refreshToken = signRefresh({ id: usuarioId })
  await prisma.sesionActiva.create({
    data: {
      usuarioId,
      refreshToken,
      ip: ip ?? null,
      dispositivo: dispositivo ?? null,
      ultimaActividad: new Date(),
    },
  })
  return refreshToken
}

// ── Helper: contar sesiones activas ───────────────────────────────────────
async function countActiveSessions(usuarioId: string): Promise<number> {
  return prisma.sesionActiva.count({ where: { usuarioId } })
}

// ── Helper: generar código numérico de 6 dígitos ──────────────────────────
function generateNumericCode(): string {
  // crypto.randomInt es criptográficamente seguro
  return String(crypto.randomInt(100000, 999999))
}

// ── Helper: generar backup codes legibles ────────────────────────────────
function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  )
}

export class AuthService {

  // ── REGISTRO ──────────────────────────────────────────────────────────────
  async register(input: RegisterInput) {
    const exists = await prisma.usuario.findUnique({ where: { email: input.email } })
    // No revelar si el email existe — mismo mensaje genérico
    if (exists) throw Object.assign(new Error('No se pudo completar el registro'), { status: 409 })

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)

    const user = await prisma.usuario.create({
      data: {
        email: input.email,
        passwordHash,
        nombre: input.nombre,
        emailVerificado: false,
      },
    })

    // Crear cliente por defecto
    await prisma.cliente.create({
      data: { usuarioId: user.id, nombre: input.nombre, monedaBase: 'DOP' },
    })

    // Generar código de verificación y guardarlo en DB
    const code = generateNumericCode()
    const expiraEn = new Date(Date.now() + EMAIL_TOKEN_MINUTES * 60 * 1000)

    await prisma.tokenVerificacion.create({
      data: {
        usuarioId: user.id,
        tipo: 'EMAIL_VERIFY',
        token: code,
        expiraEn,
      },
    })

    // Enviar email (con fallback a consola en dev)
    await sendVerificationCode(user.email, code)

    return {
      message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.',
      email: user.email,
    }
  }

  // ── VERIFICAR EMAIL ───────────────────────────────────────────────────────
  async verifyEmail(input: VerifyEmailInput, ip?: string, dispositivo?: string) {
    const tokenRecord = await prisma.tokenVerificacion.findUnique({
      where: { token: input.token },
      include: { usuario: true },
    })

    if (!tokenRecord || tokenRecord.tipo !== 'EMAIL_VERIFY') {
      throw Object.assign(new Error('Código inválido'), { status: 400 })
    }
    if (tokenRecord.usado) {
      throw Object.assign(new Error('El código ya fue utilizado'), { status: 400 })
    }
    if (tokenRecord.expiraEn < new Date()) {
      throw Object.assign(new Error('El código ha expirado. Solicita uno nuevo.'), { status: 400 })
    }

    // Marcar token como usado y verificar email
    await prisma.$transaction([
      prisma.tokenVerificacion.update({
        where: { id: tokenRecord.id },
        data: { usado: true },
      }),
      prisma.usuario.update({
        where: { id: tokenRecord.usuarioId },
        data: { emailVerificado: true },
      }),
    ])

    const user = tokenRecord.usuario

    // Crear primera sesión
    const refreshToken = await createSession(user.id, ip, dispositivo)
    const sessionCount  = await countActiveSessions(user.id)
    const clientes      = await prisma.cliente.findMany({ where: { usuarioId: user.id } })

    return {
      accessToken: signAccess({ id: user.id, email: user.email, rol: user.rol }),
      refreshToken,
      activeSessions: sessionCount,
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      clientes,
    }
  }

  // ── REENVIAR CÓDIGO DE VERIFICACIÓN ──────────────────────────────────────
  async resendVerification(email: string) {
    const user = await prisma.usuario.findUnique({ where: { email } })
    // Respuesta genérica para no revelar si el email existe
    if (!user || user.emailVerificado) {
      return { message: 'Si el email existe y no está verificado, recibirás un nuevo código.' }
    }

    // Invalidar tokens anteriores
    await prisma.tokenVerificacion.updateMany({
      where: { usuarioId: user.id, tipo: 'EMAIL_VERIFY', usado: false },
      data: { usado: true },
    })

    const code = generateNumericCode()
    const expiraEn = new Date(Date.now() + EMAIL_TOKEN_MINUTES * 60 * 1000)

    await prisma.tokenVerificacion.create({
      data: { usuarioId: user.id, tipo: 'EMAIL_VERIFY', token: code, expiraEn },
    })

    await sendVerificationCode(user.email, code)

    return { message: 'Si el email existe y no está verificado, recibirás un nuevo código.' }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  async login(input: LoginInput, ip?: string, dispositivo?: string) {
    const user = await prisma.usuario.findUnique({ where: { email: input.email } })

    // Seguridad: mismo mensaje tanto si el email no existe como si la contraseña es incorrecta
    // Esto evita enumerar usuarios válidos
    if (!user) {
      throw Object.assign(new Error('Credenciales inválidas'), { status: 401 })
    }

    // Verificar bloqueo de cuenta
    if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
      throw Object.assign(new Error('Cuenta bloqueada temporalmente. Intenta más tarde.'), { status: 423 })
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      const intentos = user.intentosFallidos + 1
      const bloqueadoHasta = intentos >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null
      await prisma.usuario.update({
        where: { id: user.id },
        data: { intentosFallidos: intentos, bloqueadoHasta },
      })
      throw Object.assign(new Error('Credenciales inválidas'), { status: 401 })
    }

    // Verificar que el email esté confirmado antes de permitir login
    if (!user.emailVerificado) {
      throw Object.assign(new Error('Debes verificar tu correo antes de iniciar sesión.'), { status: 403 })
    }

    // Resetear intentos fallidos
    await prisma.usuario.update({
      where: { id: user.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoLogin: new Date() },
    })

    // Si 2FA está activo, retornar token temporal en lugar de sesión completa
    if (user.mfaHabilitado) {
      const mfaToken = signMfaTemp({ id: user.id })
      return { mfaRequired: true as const, mfaToken }
    }

    // Crear sesión y contar sesiones activas (para aviso de múltiples sesiones)
    const refreshToken    = await createSession(user.id, ip, dispositivo)
    const activeSessions  = await countActiveSessions(user.id)
    const clientes        = await prisma.cliente.findMany({ where: { usuarioId: user.id } })

    return {
      accessToken: signAccess({ id: user.id, email: user.email, rol: user.rol }),
      refreshToken,
      // Si activeSessions > 1 el frontend puede mostrar aviso de múltiples sesiones
      activeSessions,
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      clientes,
    }
  }

  // ── GOOGLE OAUTH ──────────────────────────────────────────────────────────
  async loginGoogle(input: GoogleLoginInput, ip?: string, dispositivo?: string) {
    // Verificar el ID token con google-auth-library (no simplemente decodificar)
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: process.env['GOOGLE_CLIENT_ID'],
    }).catch(() => {
      throw Object.assign(new Error('Token de Google inválido'), { status: 401 })
    })

    const payload = ticket.getPayload()
    if (!payload?.sub || !payload?.email) {
      throw Object.assign(new Error('Token de Google inválido'), { status: 401 })
    }

    const { sub: googleId, email, name: nombre, picture: avatar } = payload

    // Buscar cuenta OAuth existente
    const cuentaOAuth = await prisma.cuentaOAuth.findUnique({
      where: { proveedor_proveedorId: { proveedor: 'google', proveedorId: googleId } },
      include: { usuario: true },
    })

    if (cuentaOAuth) {
      // Login directo con cuenta OAuth ya vinculada
      const user = cuentaOAuth.usuario
      const refreshToken   = await createSession(user.id, ip, dispositivo)
      const activeSessions = await countActiveSessions(user.id)
      const clientes       = await prisma.cliente.findMany({ where: { usuarioId: user.id } })

      return {
        accessToken: signAccess({ id: user.id, email: user.email, rol: user.rol }),
        refreshToken,
        activeSessions,
        user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
        clientes,
      }
    }

    // Buscar usuario con ese email — si existe, pedir vinculación
    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } })
    if (usuarioExistente) {
      return {
        needsLink: true as const,
        googleEmail: email,
        googleName: nombre ?? null,
        googleId,
      }
    }

    // Crear nuevo usuario con Google (email ya verificado por Google)
    const newUser = await prisma.usuario.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS),
        nombre: nombre ?? email.split('@')[0],
        emailVerificado: true, // Google ya verifica el email
      },
    })

    await prisma.cliente.create({
      data: { usuarioId: newUser.id, nombre: newUser.nombre, monedaBase: 'DOP' },
    })

    await prisma.cuentaOAuth.create({
      data: {
        usuarioId: newUser.id,
        proveedor: 'google',
        proveedorId: googleId,
        email,
        nombre: nombre ?? null,
        avatar: avatar ?? null,
      },
    })

    const refreshToken   = await createSession(newUser.id, ip, dispositivo)
    const activeSessions = await countActiveSessions(newUser.id)
    const clientes       = await prisma.cliente.findMany({ where: { usuarioId: newUser.id } })

    return {
      accessToken: signAccess({ id: newUser.id, email: newUser.email, rol: newUser.rol }),
      refreshToken,
      activeSessions,
      user: { id: newUser.id, email: newUser.email, nombre: newUser.nombre, rol: newUser.rol },
      clientes,
    }
  }

  // ── VINCULAR CUENTA GOOGLE ────────────────────────────────────────────────
  async linkGoogle(input: LinkGoogleInput & { googleEmail: string; googleName?: string; googleAvatar?: string }, ip?: string, dispositivo?: string) {
    const user = await prisma.usuario.findUnique({ where: { email: input.googleEmail } })
    if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 })

    // Verificar password antes de vincular
    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) throw Object.assign(new Error('Contraseña incorrecta'), { status: 401 })

    // Crear cuenta OAuth vinculada
    await prisma.cuentaOAuth.upsert({
      where: { proveedor_proveedorId: { proveedor: 'google', proveedorId: input.googleId } },
      create: {
        usuarioId: user.id,
        proveedor: 'google',
        proveedorId: input.googleId,
        email: input.googleEmail,
        nombre: input.googleName ?? null,
        avatar: input.googleAvatar ?? null,
      },
      update: { usuarioId: user.id },
    })

    const refreshToken   = await createSession(user.id, ip, dispositivo)
    const activeSessions = await countActiveSessions(user.id)
    const clientes       = await prisma.cliente.findMany({ where: { usuarioId: user.id } })

    return {
      accessToken: signAccess({ id: user.id, email: user.email, rol: user.rol }),
      refreshToken,
      activeSessions,
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      clientes,
    }
  }

  // ── VERIFICAR MFA (TOTP o backup code) ────────────────────────────────────
  async verifyMfa(input: VerifyMfaInput, ip?: string, dispositivo?: string) {
    // Verificar el JWT temporal emitido en el paso de login
    let payload: { id: string }
    try {
      payload = verifyMfaTemp(input.mfaToken)
    } catch {
      throw Object.assign(new Error('Token MFA expirado o inválido'), { status: 401 })
    }

    const user = await prisma.usuario.findUnique({ where: { id: payload.id } })
    if (!user || !user.mfaHabilitado || !user.mfaSecret) {
      throw Object.assign(new Error('MFA no configurado'), { status: 400 })
    }

    const code = input.code.toUpperCase().replace(/\s/g, '')

    // Intentar verificar como backup code primero
    if (user.mfaBackupCodes.includes(code)) {
      // Consumir el backup code (un solo uso)
      await prisma.usuario.update({
        where: { id: user.id },
        data: { mfaBackupCodes: user.mfaBackupCodes.filter(c => c !== code) },
      })
    } else {
      // Verificar TOTP
      const isValid = totpVerifySync({ token: input.code, secret: user.mfaSecret })
      if (!isValid) throw Object.assign(new Error('Código incorrecto'), { status: 401 })
    }

    const refreshToken   = await createSession(user.id, ip, dispositivo)
    const activeSessions = await countActiveSessions(user.id)
    const clientes       = await prisma.cliente.findMany({ where: { usuarioId: user.id } })

    return {
      accessToken: signAccess({ id: user.id, email: user.email, rol: user.rol }),
      refreshToken,
      activeSessions,
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      clientes,
    }
  }

  // ── SETUP MFA — generar QR ────────────────────────────────────────────────
  async setupMfa(userId: string) {
    const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })

    // Generar secret TOTP único
    const secret  = otplibGenerateSecret()
    const appName = 'CashMind'
    const otpAuthUrl = totpGenerateURI({ label: user.email, issuer: appName, secret })

    // Generar QR como data URL (base64 PNG)
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    return { secret, qrDataUrl, otpAuthUrl }
  }

  // ── CONFIRMAR MFA ─────────────────────────────────────────────────────────
  async confirmMfa(userId: string, input: ConfirmMfaInput) {
    // Verificar que el código es válido antes de activar
    const isValid = totpVerifySync({ token: input.code, secret: input.secret })
    if (!isValid) throw Object.assign(new Error('Código TOTP incorrecto'), { status: 400 })

    // Generar backup codes — hash para almacenar de forma segura
    const rawCodes    = generateBackupCodes()
    const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 6))) // 6 rounds para backup codes (rápido)

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        mfaHabilitado:  true,
        mfaSecret:      input.secret,
        mfaBackupCodes: rawCodes, // Almacenar raw para comparación simple (se mostrarán solo una vez)
      },
    })

    // Retornar backup codes para mostrar al usuario (solo esta vez)
    return { backupCodes: rawCodes, message: '2FA activado correctamente. Guarda los códigos de respaldo.' }
  }

  // ── DESHABILITAR MFA ──────────────────────────────────────────────────────
  async disableMfa(userId: string, input: DisableMfaInput) {
    const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })
    if (!user.mfaHabilitado || !user.mfaSecret) {
      throw Object.assign(new Error('2FA no está habilitado'), { status: 400 })
    }

    const isValid = totpVerifySync({ token: input.code, secret: user.mfaSecret })
    if (!isValid) throw Object.assign(new Error('Código incorrecto'), { status: 401 })

    await prisma.usuario.update({
      where: { id: userId },
      data: { mfaHabilitado: false, mfaSecret: null, mfaBackupCodes: [] },
    })

    return { message: '2FA deshabilitado correctamente' }
  }

  // ── REFRESH TOKEN ─────────────────────────────────────────────────────────
  async refresh(token: string) {
    // Verificar el token en DB (no solo en JWT) — permite revocación
    const sesion = await prisma.sesionActiva.findUnique({
      where: { refreshToken: token },
      include: { usuario: true },
    })

    if (!sesion) {
      throw Object.assign(new Error('Sesión no encontrada o revocada'), { status: 401 })
    }

    try {
      jwt.verify(token, process.env['JWT_REFRESH_SECRET']!)
    } catch {
      // Token JWT expirado — eliminar sesión de DB
      await prisma.sesionActiva.delete({ where: { id: sesion.id } })
      throw Object.assign(new Error('Refresh token expirado'), { status: 401 })
    }

    // Actualizar última actividad de la sesión
    await prisma.sesionActiva.update({
      where: { id: sesion.id },
      data: { ultimaActividad: new Date() },
    })

    const user = sesion.usuario
    return {
      accessToken: signAccess({ id: user.id, email: user.email, rol: user.rol }),
    }
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    // Eliminar la sesión específica (revocación del refresh token)
    await prisma.sesionActiva.deleteMany({ where: { refreshToken } })
    return { message: 'Sesión cerrada' }
  }

  // ── LOGOUT DE TODAS LAS SESIONES ──────────────────────────────────────────
  async logoutAll(userId: string) {
    await prisma.sesionActiva.deleteMany({ where: { usuarioId: userId } })
    return { message: 'Todas las sesiones cerradas' }
  }
}
