import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Eye, EyeOff, Loader2, Mail, AlertTriangle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
export function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore(s => s.setAuth);
    const setMfaToken = useAuthStore(s => s.setMfaToken);
    const [tab, setTab] = useState('login');
    const [flow, setFlow] = useState('form');
    const [linkState, setLinkState] = useState(null);
    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [linkPwd, setLinkPwd] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeSessions, setActiveSessions] = useState(0);
    function clearError() { setError(null); }
    async function handleLogin(e) {
        e.preventDefault();
        clearError();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { email, password });
            const result = data.data;
            if (result.mfaRequired) {
                setMfaToken(result.mfaToken);
                navigate('/2fa');
                return;
            }
            if (result.activeSessions > 1) {
                setActiveSessions(result.activeSessions - 1);
            }
            setAuth(result);
            navigate('/');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Error al iniciar sesión');
        }
        finally {
            setLoading(false);
        }
    }
    async function handleRegister(e) {
        e.preventDefault();
        clearError();
        setLoading(true);
        try {
            await api.post('/auth/register', { email, password, nombre });
            setFlow('emailSent');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Error al registrarse');
        }
        finally {
            setLoading(false);
        }
    }
    async function handleGoogleSuccess(credentialResponse) {
        if (!credentialResponse.credential)
            return;
        clearError();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/google', { idToken: credentialResponse.credential });
            const result = data.data;
            if (result.needsLink) {
                setLinkState({ googleEmail: result.googleEmail, googleName: result.googleName, googleId: result.googleId });
                setFlow('needsLink');
                return;
            }
            if (result.mfaRequired) {
                setMfaToken(result.mfaToken);
                navigate('/2fa');
                return;
            }
            setAuth(result);
            navigate('/');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Error con Google');
        }
        finally {
            setLoading(false);
        }
    }
    async function handleLinkGoogle(e) {
        e.preventDefault();
        if (!linkState)
            return;
        clearError();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/google/link', {
                googleId: linkState.googleId,
                googleEmail: linkState.googleEmail,
                googleName: linkState.googleName,
                password: linkPwd,
            });
            setAuth(data.data);
            navigate('/');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Error al vincular cuenta');
        }
        finally {
            setLoading(false);
        }
    }
    // ── Render: Email enviado ─────────────────────────────────────────────────
    if (flow === 'emailSent') {
        return (_jsx(AuthLayout, { children: _jsxs("div", { className: "text-center space-y-4", children: [_jsx("div", { className: "w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto", children: _jsx(Mail, { size: 24, className: "text-primary" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: "Revisa tu correo" }), _jsxs("p", { className: "text-sm text-text-muted mt-1", children: ["Enviamos un c\u00F3digo de verificaci\u00F3n a ", _jsx("strong", { className: "text-text-secondary", children: email }), "."] }), _jsx("p", { className: "text-xs text-text-muted mt-2", children: "El c\u00F3digo expira en 10 minutos." })] }), _jsx("button", { onClick: () => navigate('/verify-email'), className: "w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors", children: "Ingresar c\u00F3digo" }), _jsx("button", { onClick: () => { setFlow('form'); setTab('register'); }, className: "text-xs text-text-muted hover:text-text-secondary transition-colors", children: "Volver" })] }) }));
    }
    // ── Render: Vincular Google ───────────────────────────────────────────────
    if (flow === 'needsLink' && linkState) {
        return (_jsx(AuthLayout, { children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg", children: [_jsx(AlertTriangle, { size: 16, className: "text-warning flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: "Cuenta existente" }), _jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: ["Ya existe una cuenta con el correo ", _jsx("strong", { children: linkState.googleEmail }), ". Ingresa tu contrase\u00F1a para vincular Google."] })] })] }), _jsxs("form", { onSubmit: handleLinkGoogle, className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-medium text-text-secondary", children: "Contrase\u00F1a de tu cuenta" }), _jsx("input", { type: "password", value: linkPwd, onChange: e => setLinkPwd(e.target.value), required: true, placeholder: "Tu contrase\u00F1a actual", className: inputCls })] }), error && _jsx(ErrorBox, { message: error }), _jsxs("button", { type: "submit", disabled: loading, className: submitCls, children: [loading && _jsx(Loader2, { size: 14, className: "animate-spin" }), loading ? 'Vinculando...' : 'Vincular con Google'] })] }), _jsx("button", { onClick: () => { setFlow('form'); setLinkState(null); clearError(); }, className: "w-full text-xs text-text-muted hover:text-text-secondary transition-colors", children: "Cancelar" })] }) }));
    }
    // ── Render: Form principal ────────────────────────────────────────────────
    return (_jsxs(AuthLayout, { children: [activeSessions > 0 && (_jsxs("div", { className: "flex items-start gap-3 p-3 mb-4 bg-warning/10 border border-warning/20 rounded-lg", children: [_jsx(AlertTriangle, { size: 16, className: "text-warning flex-shrink-0 mt-0.5" }), _jsxs("p", { className: "text-xs text-text-muted", children: ["Tienes ", activeSessions, " ", activeSessions === 1 ? 'sesión activa' : 'sesiones activas', " en otros dispositivos."] })] })), _jsx("div", { className: "flex rounded-lg bg-background border border-border p-1 mb-5", children: ['login', 'register'].map(t => (_jsx("button", { type: "button", onClick: () => { setTab(t); clearError(); setActiveSessions(0); }, className: cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors', tab === t
                        ? 'bg-surface text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-secondary'), children: t === 'login' ? 'Iniciar sesión' : 'Registrarse' }, t))) }), _jsx("div", { className: "flex justify-center mb-4", children: _jsx(GoogleLogin, { onSuccess: handleGoogleSuccess, onError: () => setError('Error al iniciar con Google'), useOneTap: false, theme: "filled_black", shape: "rectangular", size: "large", text: tab === 'login' ? 'signin_with' : 'signup_with' }) }), _jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("div", { className: "flex-1 h-px bg-border" }), _jsx("span", { className: "text-xs text-text-muted", children: "o" }), _jsx("div", { className: "flex-1 h-px bg-border" })] }), tab === 'login' ? (_jsxs("form", { onSubmit: handleLogin, className: "space-y-4", children: [_jsx(Field, { label: "Correo electr\u00F3nico", htmlFor: "email", children: _jsx("input", { id: "email", type: "email", value: email, onChange: e => setEmail(e.target.value), required: true, autoComplete: "email", className: inputCls }) }), _jsx(Field, { label: "Contrase\u00F1a", htmlFor: "password", children: _jsx(PasswordInput, { value: password, onChange: setPassword, showPwd: showPwd, onToggle: () => setShowPwd(p => !p) }) }), error && _jsx(ErrorBox, { message: error }), _jsxs("button", { type: "submit", disabled: loading, className: submitCls, children: [loading && _jsx(Loader2, { size: 14, className: "animate-spin" }), loading ? 'Ingresando...' : 'Ingresar'] })] })) : (_jsxs("form", { onSubmit: handleRegister, className: "space-y-4", children: [_jsx(Field, { label: "Nombre", htmlFor: "nombre", children: _jsx("input", { id: "nombre", type: "text", value: nombre, onChange: e => setNombre(e.target.value), required: true, autoComplete: "name", className: inputCls }) }), _jsx(Field, { label: "Correo electr\u00F3nico", htmlFor: "email", children: _jsx("input", { id: "email", type: "email", value: email, onChange: e => setEmail(e.target.value), required: true, autoComplete: "email", className: inputCls }) }), _jsx(Field, { label: "Contrase\u00F1a", htmlFor: "password", children: _jsx(PasswordInput, { value: password, onChange: setPassword, showPwd: showPwd, onToggle: () => setShowPwd(p => !p) }) }), error && _jsx(ErrorBox, { message: error }), _jsxs("button", { type: "submit", disabled: loading, className: submitCls, children: [loading && _jsx(Loader2, { size: 14, className: "animate-spin" }), loading ? 'Registrando...' : 'Crear cuenta'] })] }))] }));
}
// ── Sub-componentes ──────────────────────────────────────────────────────────
function AuthLayout({ children }) {
    return (_jsxs("div", { className: "min-h-screen bg-background flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 opacity-[0.04] pointer-events-none", style: {
                    backgroundImage: `linear-gradient(hsl(var(--border)) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--border)) 1px,transparent 1px)`,
                    backgroundSize: '32px 32px',
                } }), _jsxs("div", { className: "relative w-full max-w-sm", children: [_jsxs("div", { className: "flex flex-col items-center mb-8", children: [_jsx("div", { className: "flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20", children: _jsx(DollarSign, { size: 28, strokeWidth: 2, className: "text-primary-foreground" }) }), _jsx("h1", { className: "text-2xl font-bold text-text-primary tracking-tight", children: "CashMind" }), _jsx("p", { className: "text-sm text-text-muted mt-1", children: "Tu sistema de finanzas personales" })] }), _jsx("div", { className: "bg-surface border border-border rounded-xl p-6 shadow-2xl", children: children }), _jsx("p", { className: "text-center text-xs text-text-muted mt-6", children: "v0.1.0 \u00B7 Datos 100% locales" })] })] }));
}
function Field({ label, htmlFor, children }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-medium text-text-secondary", htmlFor: htmlFor, children: label }), children] }));
}
function PasswordInput({ value, onChange, showPwd, onToggle }) {
    return (_jsxs("div", { className: "relative", children: [_jsx("input", { id: "password", type: showPwd ? 'text' : 'password', value: value, onChange: e => onChange(e.target.value), required: true, autoComplete: "current-password", className: cn(inputCls, 'pr-9') }), _jsx("button", { type: "button", onClick: onToggle, className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary", children: showPwd ? _jsx(EyeOff, { size: 14 }) : _jsx(Eye, { size: 14 }) })] }));
}
function ErrorBox({ message }) {
    return (_jsx("div", { className: "text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2", children: message }));
}
const inputCls = cn('w-full px-3 py-2 rounded-md text-sm bg-background border border-border', 'text-text-primary placeholder:text-text-muted', 'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors');
const submitCls = cn('w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground', 'hover:bg-primary-hover active:bg-primary-active transition-colors', 'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2');
