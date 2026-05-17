import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './store/auth.store';
import { useIdleTimer } from './hooks/useIdleTimer';
import { IdleWarning } from './components/IdleWarning';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { TwoFactorPage } from './pages/auth/TwoFactorPage';
import { DashboardPage } from './pages/DashboardPage';
import { CategoriasPage } from './pages/categorias/CategoriasPage';
import { TransaccionesPage } from './pages/transacciones/TransaccionesPage';
import { CuentasPage } from './pages/cuentas/CuentasPage';
import { TarjetasPage } from './pages/tarjetas/TarjetasPage';
import { PersonasPage } from './pages/personas/PersonasPage';
import { DeudasPage } from './pages/deudas/DeudasPage';
import { EventosPage } from './pages/eventos/EventosPage';
import { CombustiblePage } from './pages/combustible/CombustiblePage';
import { PresupuestosPage } from './pages/presupuestos/PresupuestosPage';
import { AjustesPage } from './pages/ajustes/AjustesPage';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
// Idle timeout: 15 minutos en milisegundos
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
function RequireAuth({ children }) {
    const user = useAuthStore(s => s.user);
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(_Fragment, { children: children });
}
function ComingSoon({ title }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center h-64 gap-3", children: [_jsx("div", { className: "text-xl font-semibold text-text-primary", children: title }), _jsx("div", { className: "text-text-muted text-sm", children: "M\u00F3dulo en desarrollo" })] }));
}
/** Envuelve el layout protegido con idle timer */
function AuthenticatedLayout() {
    const logout = useAuthStore(s => s.logout);
    const { isWarning, secondsRemaining, resetTimer } = useIdleTimer(IDLE_TIMEOUT_MS, logout);
    return (_jsxs(_Fragment, { children: [isWarning && (_jsx(IdleWarning, { secondsRemaining: secondsRemaining, onContinue: resetTimer, onLogout: logout })), _jsx(AppLayout, {})] }));
}
export default function App() {
    return (_jsx(GoogleOAuthProvider, { clientId: GOOGLE_CLIENT_ID, children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/verify-email", element: _jsx(VerifyEmailPage, {}) }), _jsx(Route, { path: "/2fa", element: _jsx(TwoFactorPage, {}) }), _jsxs(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(AuthenticatedLayout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "transacciones", element: _jsx(TransaccionesPage, {}) }), _jsx(Route, { path: "cuentas", element: _jsx(CuentasPage, {}) }), _jsx(Route, { path: "tarjetas", element: _jsx(TarjetasPage, {}) }), _jsx(Route, { path: "deudas", element: _jsx(DeudasPage, {}) }), _jsx(Route, { path: "personas", element: _jsx(PersonasPage, {}) }), _jsx(Route, { path: "categorias", element: _jsx(CategoriasPage, {}) }), _jsx(Route, { path: "eventos", element: _jsx(EventosPage, {}) }), _jsx(Route, { path: "combustible", element: _jsx(CombustiblePage, {}) }), _jsx(Route, { path: "presupuestos", element: _jsx(PresupuestosPage, {}) }), _jsx(Route, { path: "proyecciones", element: _jsx(ComingSoon, { title: "Proyecciones" }) }), _jsx(Route, { path: "reportes", element: _jsx(ComingSoon, { title: "Reportes" }) }), _jsx(Route, { path: "importacion", element: _jsx(ComingSoon, { title: "Importaci\u00F3n" }) }), _jsx(Route, { path: "ajustes", element: _jsx(AjustesPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
