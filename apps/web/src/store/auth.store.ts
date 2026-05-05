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
  setAuth: (data: { user: User; clientes: Cliente[]; accessToken: string; refreshToken: string }) => void
  setClienteActivo: (cliente: Cliente) => void
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
      setAuth: ({ user, clientes, accessToken, refreshToken }) => {
        localStorage.setItem('cm_access_token', accessToken)
        localStorage.setItem('cm_refresh_token', refreshToken)
        set({ user, clientes, clienteActivo: clientes[0] ?? null, accessToken, refreshToken })
      },
      setClienteActivo: cliente => set({ clienteActivo: cliente }),
      logout: () => {
        localStorage.removeItem('cm_access_token')
        localStorage.removeItem('cm_refresh_token')
        set({ user: null, clientes: [], clienteActivo: null, accessToken: null, refreshToken: null })
      },
    }),
    { name: 'cashmind-auth', partialize: state => ({ user: state.user, clientes: state.clientes, clienteActivo: state.clienteActivo }) }
  )
)
