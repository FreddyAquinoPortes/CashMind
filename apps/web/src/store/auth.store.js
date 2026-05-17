import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist(set => ({
    user: null,
    clientes: [],
    clienteActivo: null,
    accessToken: null,
    refreshToken: null,
    mfaToken: null,
    activeSessions: 0,
    setAuth: ({ user, clientes, accessToken, refreshToken, activeSessions = 0 }) => {
        localStorage.setItem('cm_access_token', accessToken);
        localStorage.setItem('cm_refresh_token', refreshToken);
        set({
            user,
            clientes,
            clienteActivo: clientes[0] ?? null,
            accessToken,
            refreshToken,
            mfaToken: null,
            activeSessions,
        });
    },
    setClienteActivo: cliente => set({ clienteActivo: cliente }),
    // Guardar token MFA temporal (no persiste en localStorage)
    setMfaToken: (token) => set({ mfaToken: token }),
    clearMfaToken: () => set({ mfaToken: null }),
    logout: () => {
        // Intentar notificar al backend antes de limpiar (fire-and-forget)
        const refresh = localStorage.getItem('cm_refresh_token');
        if (refresh) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refresh }),
            }).catch(() => { });
        }
        localStorage.removeItem('cm_access_token');
        localStorage.removeItem('cm_refresh_token');
        set({ user: null, clientes: [], clienteActivo: null, accessToken: null, refreshToken: null, mfaToken: null, activeSessions: 0 });
    },
}), {
    name: 'cashmind-auth',
    // mfaToken y activeSessions son estado temporal — no persiste
    partialize: state => ({
        user: state.user,
        clientes: state.clientes,
        clienteActivo: state.clienteActivo,
    }),
}));
