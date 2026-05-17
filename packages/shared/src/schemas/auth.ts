import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  nombre: z.string().min(2, 'Nombre requerido'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(6, 'Código inválido'),
})

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'ID token requerido'),
})

export const linkGoogleSchema = z.object({
  googleId: z.string().min(1, 'Google ID requerido'),
  password: z.string().min(1, 'Password requerido'),
})

export const verifyMfaSchema = z.object({
  mfaToken: z.string().min(1, 'MFA token requerido'),
  code: z.string().min(6, 'Código requerido'),
})

export const confirmMfaSchema = z.object({
  code: z.string().length(6, 'Código de 6 dígitos requerido'),
  secret: z.string().min(1, 'Secret requerido'),
})

export const disableMfaSchema = z.object({
  code: z.string().min(6, 'Código requerido'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>
export type LinkGoogleInput = z.infer<typeof linkGoogleSchema>
export type VerifyMfaInput = z.infer<typeof verifyMfaSchema>
export type ConfirmMfaInput = z.infer<typeof confirmMfaSchema>
export type DisableMfaInput = z.infer<typeof disableMfaSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type LogoutInput = z.infer<typeof logoutSchema>
