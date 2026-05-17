import { Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useAuthStore } from './store/auth.store'
import { useIdleTimer } from './hooks/useIdleTimer'
import { IdleWarning } from './components/IdleWarning'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { TwoFactorPage } from './pages/auth/TwoFactorPage'
import { DashboardPage } from './pages/DashboardPage'
import { CategoriasPage } from './pages/categorias/CategoriasPage'
import { TransaccionesPage } from './pages/transacciones/TransaccionesPage'
import { CuentasPage } from './pages/cuentas/CuentasPage'
import { TarjetasPage } from './pages/tarjetas/TarjetasPage'
import { PersonasPage } from './pages/personas/PersonasPage'
import { DeudasPage } from './pages/deudas/DeudasPage'
import { EventosPage } from './pages/eventos/EventosPage'
import { CombustiblePage } from './pages/combustible/CombustiblePage'
import { PresupuestosPage } from './pages/presupuestos/PresupuestosPage'
import { AjustesPage } from './pages/ajustes/AjustesPage'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

// Idle timeout: 15 minutos en milisegundos
const IDLE_TIMEOUT_MS = 15 * 60 * 1000

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-xl font-semibold text-text-primary">{title}</div>
      <div className="text-text-muted text-sm">Módulo en desarrollo</div>
    </div>
  )
}

/** Envuelve el layout protegido con idle timer */
function AuthenticatedLayout() {
  const logout = useAuthStore(s => s.logout)
  const { isWarning, secondsRemaining, resetTimer } = useIdleTimer(IDLE_TIMEOUT_MS, logout)

  return (
    <>
      {isWarning && (
        <IdleWarning
          secondsRemaining={secondsRemaining}
          onContinue={resetTimer}
          onLogout={logout}
        />
      )}
      <AppLayout />
    </>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Routes>
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/2fa"          element={<TwoFactorPage />} />
        <Route path="/" element={<RequireAuth><AuthenticatedLayout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="transacciones" element={<TransaccionesPage />} />
          <Route path="cuentas"       element={<CuentasPage />} />
          <Route path="tarjetas"      element={<TarjetasPage />} />
          <Route path="deudas"        element={<DeudasPage />} />
          <Route path="personas"      element={<PersonasPage />} />
          <Route path="categorias"    element={<CategoriasPage />} />
          <Route path="eventos"       element={<EventosPage />} />
          <Route path="combustible"   element={<CombustiblePage />} />
          <Route path="presupuestos"  element={<PresupuestosPage />} />
          <Route path="proyecciones"  element={<ComingSoon title="Proyecciones" />} />
          <Route path="reportes"      element={<ComingSoon title="Reportes" />} />
          <Route path="importacion"   element={<ComingSoon title="Importación" />} />
          <Route path="ajustes"       element={<AjustesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  )
}
