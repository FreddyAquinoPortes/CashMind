import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * TwoFactorPage — Solicita el código TOTP (o backup code) después del login.
 * Usa el mfaToken temporal guardado en el store.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Loader2, ShieldCheck, Key } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
export function TwoFactorPage() {
    const navigate = useNavigate();
    const mfaToken = useAuthStore(s => s.mfaToken);
    const clearMfaToken = useAuthStore(s => s.clearMfaToken);
    const setAuth = useAuthStore(s => s.setAuth);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [useBackup, setUseBackup] = useState(false);
    const inputRef = useRef(null);
    // Redirigir si no hay token MFA (acceso directo a la ruta)
    useEffect(() => {
        if (!mfaToken)
            navigate('/login', { replace: true });
    }, [mfaToken, navigate]);
    useEffect(() => {
        inputRef.current?.focus();
    }, [useBackup]);
    async function handleSubmit(e) {
        e.preventDefault();
        if (!mfaToken)
            return;
        setError(null);
        setLoading(true);
        try {
            const { data } = await api.post('/auth/verify-mfa', { mfaToken, code });
            clearMfaToken();
            setAuth(data.data);
            navigate('/');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Código incorrecto');
            setCode('');
            inputRef.current?.focus();
        }
        finally {
            setLoading(false);
        }
    }
    // Auto-submit al completar 6 dígitos TOTP
    function handleCodeChange(val) {
        const clean = useBackup
            ? val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
            : val.replace(/\D/g, '').slice(0, 6);
        setCode(clean);
    }
    return (_jsxs("div", { className: "min-h-screen bg-background flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 opacity-[0.04] pointer-events-none", style: {
                    backgroundImage: `linear-gradient(hsl(var(--border)) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--border)) 1px,transparent 1px)`,
                    backgroundSize: '32px 32px',
                } }), _jsxs("div", { className: "relative w-full max-w-sm", children: [_jsxs("div", { className: "flex flex-col items-center mb-8", children: [_jsx("div", { className: "flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20", children: _jsx(DollarSign, { size: 28, strokeWidth: 2, className: "text-primary-foreground" }) }), _jsx("h1", { className: "text-2xl font-bold text-text-primary tracking-tight", children: "CashMind" })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-6 shadow-2xl", children: [_jsxs("div", { className: "flex items-center gap-3 mb-5", children: [_jsx("div", { className: "w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0", children: useBackup ? _jsx(Key, { size: 18, className: "text-primary" }) : _jsx(ShieldCheck, { size: 18, className: "text-primary" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: useBackup ? 'Código de respaldo' : 'Verificación en dos pasos' }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: useBackup
                                                    ? 'Ingresa uno de tus códigos de respaldo'
                                                    : 'Ingresa el código de tu app autenticadora' })] })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-medium text-text-secondary", children: useBackup ? 'Código de respaldo (8 caracteres)' : 'Código TOTP (6 dígitos)' }), _jsx("input", { ref: inputRef, type: "text", inputMode: useBackup ? 'text' : 'numeric', value: code, onChange: e => handleCodeChange(e.target.value), placeholder: useBackup ? 'XXXXXXXX' : '000000', required: true, disabled: loading, className: cn('w-full px-3 py-3 rounded-md text-center text-xl font-bold tracking-widest tabular-nums', 'bg-background border border-border text-text-primary', 'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors', 'disabled:opacity-50') })] }), error && (_jsx("div", { className: "text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2", children: error })), _jsxs("button", { type: "submit", disabled: loading || (useBackup ? code.length < 8 : code.length < 6), className: cn('w-full py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground', 'hover:bg-primary-hover transition-colors', 'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2'), children: [loading && _jsx(Loader2, { size: 14, className: "animate-spin" }), loading ? 'Verificando...' : 'Verificar'] })] }), _jsx("button", { type: "button", onClick: () => { setUseBackup(u => !u); setCode(''); setError(null); }, className: "w-full mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors", children: useBackup ? 'Usar código de autenticadora' : 'Usar código de respaldo' })] }), _jsx("button", { onClick: () => { clearMfaToken(); navigate('/login'); }, className: "block text-center text-xs text-text-muted hover:text-text-secondary transition-colors mt-4 mx-auto", children: "Volver al inicio de sesi\u00F3n" })] })] }));
}
