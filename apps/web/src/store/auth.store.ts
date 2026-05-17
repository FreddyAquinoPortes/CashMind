import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  nombre: string
  rol: string
}

interface Cliente {
  id: string
  nombre: string
  monedaBase: string
}

interface AuthState {
  user: User | null
  clientes: Cliente[]
  clienteActivo: Cliente | null
  accessToken: string | null
  refreshToken: string | null
  // Estado temporal para el flujo MFA (no se persiste)
  mfaToken: string | null
  // Número de sesiones activas al hacer login (para mostrar aviso)
  activeSessions: number
  setAuth: (data: { user: User; clientes: Cliente[]; accessToken: string; refreshToken: string; activeSessions?: number }) => void
  setClienteActivo: (cliente: Cliente) => void
  setMfaToken: (token: string) => void
  clearMfaToken: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      clientes: [],
      clienteActivo: null,
      accessToken: null,
      refreshToken: null,
      mfaToken: null,
      activeSessions: 0,

      setAuth: ({ user, clientes, accessToken, refreshToken, activeSessions = 0 }) => {
        localStorage.setItem('cm_access_token', accessToken)
        localStorage.setItem('cm_refresh_token', refreshToken)
        set({
          user,
          clientes,
          clienteActivo: clientes[0] ?? null,
          accessToken,
          refreshToken,
          mfaToken: null,
          activeSessions,
        })
      },

      setClienteActivo: cliente => set({ clienteActivo: cliente }),

      // Guardar token MFA temporal (no persiste en localStorage)
      setMfaToken: (token: string) => set({ mfaToken: token }),
      clearMfaToken: () => set({ mfaToken: null }),

      logout: () => {
        // Intentar notificar al backend antes de limpiar (fire-and-forget)
        const refresh = localStorage.getItem('cm_refresh_token')
        if (refresh) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refresh }),
          }).catch(() => {/* ignorar errores de red al hacer logout */})
        }
        localStorage.removeItem('cm_access_token')
        localStorage.removeItem('cm_refresh_token')
        set({ user: null, clientes: [], clienteActivo: null, accessToken: null, refreshToken: null, mfaToken: null, activeSessions: 0 })
      },
    }),
    {
      name: 'cashmind-auth',
      // mfaToken y activeSessions son estado temporal — no persiste
      partialize: state => ({
        user: state.user,
        clientes: state.clientes,
        clienteActivo: state.clienteActivo,
      }),
    }
  )
)
