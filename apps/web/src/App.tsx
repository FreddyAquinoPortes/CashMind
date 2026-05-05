import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CategoriasPage } from './pages/categorias/CategoriasPage'
import { TransaccionesPage } from './pages/transacciones/TransaccionesPage'

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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="transacciones" element={<TransaccionesPage />} />
        <Route path="cuentas"       element={<ComingSoon title="Cuentas" />} />
        <Route path="tarjetas"      element={<ComingSoon title="Tarjetas" />} />
        <Route path="deudas"        element={<ComingSoon title="Deudas" />} />
        <Route path="personas"      element={<ComingSoon title="Personas" />} />
        <Route path="eventos"       element={<ComingSoon title="Eventos" />} />
        <Route path="combustible"   element={<ComingSoon title="Combustible" />} />
        <Route path="presupuestos"  element={<ComingSoon title="Presupuestos" />} />
        <Route path="proyecciones"  element={<ComingSoon title="Proyecciones" />} />
        <Route path="reportes"      element={<ComingSoon title="Reportes" />} />
        <Route path="importacion"   element={<ComingSoon title="Importación" />} />
        <Route path="categorias"    element={<CategoriasPage />} />
        <Route path="ajustes"       element={<ComingSoon title="Ajustes" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
