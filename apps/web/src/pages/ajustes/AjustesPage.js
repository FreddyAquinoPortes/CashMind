import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { usePreferenciasStore } from '../../store/preferencias.store';
import { useFmt } from '../../lib/useFmt';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';
import { Hash, EyeOff, Calendar, AlignJustify, BarChart2, RotateCcw, Check, Shield, Loader2, Copy, CheckCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
// ── Helpers UI ─────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2.5 px-5 py-4 border-b border-border", children: [_jsx(Icon, { size: 15, className: "text-primary" }), _jsx("h2", { className: "text-sm font-semibold text-text-primary", children: title })] }), _jsx("div", { className: "divide-y divide-border/60", children: children })] }));
}
function Row({ label, description, children }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-4 px-5 py-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: label }), description && _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: description })] }), _jsx("div", { className: "flex-shrink-0", children: children })] }));
}
function Toggle({ value, onChange }) {
    return (_jsx("button", { type: "button", onClick: () => onChange(!value), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${value ? 'bg-primary' : 'bg-border'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
        ${value ? 'translate-x-6' : 'translate-x-1'}` }) }));
}
function Chips({ options, value, onChange, }) {
    return (_jsx("div", { className: "flex gap-1.5 flex-wrap justify-end", children: options.map(o => (_jsxs("button", { type: "button", onClick: () => onChange(o.value), className: `flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition-colors
            ${value === o.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted hover:border-primary/40'}`, children: [value === o.value && _jsx(Check, { size: 11 }), o.label] }, o.value))) }));
}
// ── Preview ────────────────────────────────────────────────────────────────
function Preview() {
    const fmt = useFmt();
    const SAMPLE_VALS = [
        { label: 'Transacción', v: 1234.56, isTotal: false },
        { label: 'Total ingresos', v: 45678.90, isTotal: true },
        { label: 'Saldo cuenta', v: 999.00, isTotal: false },
        { label: 'Disponible', v: 7500, isTotal: true },
    ];
    return (_jsxs("div", { className: "bg-background/60 rounded-xl border border-border/60 overflow-hidden", children: [_jsx("p", { className: "text-xs text-text-muted px-4 py-2.5 border-b border-border/60 font-medium uppercase tracking-wider", children: "Vista previa" }), _jsx("div", { className: "divide-y divide-border/40", children: SAMPLE_VALS.map(s => (_jsxs("div", { className: "flex items-center justify-between px-4 py-2.5", children: [_jsx("span", { className: "text-xs text-text-muted", children: s.label }), _jsx("span", { className: `text-sm font-semibold tabular-nums ${s.isTotal ? 'text-primary' : 'text-text-primary'}`, children: fmt(s.v, s.isTotal) })] }, s.label))) })] }));
}
function SecuritySection() {
    const user = useAuthStore(s => s.user);
    const [mfaEnabled, setMfaEnabled] = useState(false); // Se cargaría del perfil real
    const [step, setStep] = useState('idle');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [confirmCode, setConfirmCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    if (!user)
        return null;
    async function handleEnableMfa() {
        setError(null);
        setLoading(true);
        try {
            const { data } = await api.get('/auth/mfa/setup');
            setQrDataUrl(data.data.qrDataUrl);
            setSecret(data.data.secret);
            setStep('setup');
        }
        catch {
            setError('Error al iniciar configuración de 2FA');
        }
        finally {
            setLoading(false);
        }
    }
    async function handleConfirmMfa(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { data } = await api.post('/auth/mfa/confirm', { code: confirmCode, secret });
            setBackupCodes(data.data.backupCodes);
            setMfaEnabled(true);
            setStep('backupCodes');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Código incorrecto');
        }
        finally {
            setLoading(false);
        }
    }
    async function handleDisableMfa(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await api.delete('/auth/mfa', { data: { code: disableCode } });
            setMfaEnabled(false);
            setStep('idle');
            setDisableCode('');
        }
        catch (err) {
            const msg = err?.response?.data?.error;
            setError(msg ?? 'Código incorrecto');
        }
        finally {
            setLoading(false);
        }
    }
    function copyBackupCodes() {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    const inputCls = cn('w-full px-3 py-2 rounded-md text-sm bg-background border border-border', 'text-text-primary placeholder:text-text-muted', 'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors');
    return (_jsxs(Section, { title: "Seguridad", icon: Shield, children: [_jsx(Row, { label: "Verificaci\u00F3n en dos pasos (2FA)", description: mfaEnabled ? 'Activo — se requiere código TOTP al iniciar sesión' : 'Agrega una capa extra de seguridad a tu cuenta', children: _jsx(Toggle, { value: mfaEnabled, onChange: v => {
                        if (v) {
                            handleEnableMfa();
                        }
                        else {
                            setStep('disabling');
                            setError(null);
                        }
                    } }) }), step === 'setup' && (_jsxs("div", { className: "px-5 pb-5 space-y-4", children: [_jsx("p", { className: "text-xs text-text-muted", children: "Escanea este c\u00F3digo QR con tu app autenticadora (Google Authenticator, Authy, etc.)" }), qrDataUrl && (_jsx("div", { className: "flex justify-center", children: _jsx("img", { src: qrDataUrl, alt: "QR 2FA", className: "w-48 h-48 rounded-lg border border-border" }) })), _jsxs("p", { className: "text-xs text-text-muted text-center", children: ["O ingresa manualmente: ", _jsx("code", { className: "bg-background px-1 py-0.5 rounded text-primary text-xs font-mono", children: secret })] }), _jsxs("form", { onSubmit: handleConfirmMfa, className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-text-secondary", children: "C\u00F3digo de confirmaci\u00F3n" }), _jsx("input", { type: "text", inputMode: "numeric", maxLength: 6, value: confirmCode, onChange: e => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "000000", required: true, className: cn(inputCls, 'text-center text-lg font-bold tracking-widest mt-1') })] }), error && _jsx("p", { className: "text-xs text-danger", children: error }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => { setStep('idle'); setError(null); }, className: "flex-1 py-2 rounded-lg text-xs text-text-muted border border-border hover:border-border/70 transition-colors", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: loading || confirmCode.length < 6, className: "flex-1 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors", children: [loading && _jsx(Loader2, { size: 12, className: "animate-spin" }), "Activar 2FA"] })] })] })] })), step === 'backupCodes' && (_jsxs("div", { className: "px-5 pb-5 space-y-3", children: [_jsxs("div", { className: "p-3 bg-warning/10 border border-warning/20 rounded-lg", children: [_jsx("p", { className: "text-xs font-medium text-warning mb-1", children: "Guarda estos c\u00F3digos ahora" }), _jsx("p", { className: "text-xs text-text-muted", children: "Son de un solo uso y no se mostrar\u00E1n de nuevo. \u00DAsalos si pierdes acceso a tu autenticadora." })] }), _jsx("div", { className: "bg-background border border-border rounded-lg p-3 font-mono text-sm grid grid-cols-2 gap-1", children: backupCodes.map(c => (_jsx("span", { className: "text-text-primary text-xs", children: c }, c))) }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: copyBackupCodes, className: "flex-1 py-2 rounded-lg text-xs text-text-muted border border-border hover:border-primary/40 flex items-center justify-center gap-1.5 transition-colors", children: [copied ? _jsx(CheckCheck, { size: 12, className: "text-success" }) : _jsx(Copy, { size: 12 }), copied ? 'Copiado' : 'Copiar'] }), _jsx("button", { onClick: () => setStep('idle'), className: "flex-1 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors", children: "Listo" })] })] })), step === 'disabling' && (_jsxs("div", { className: "px-5 pb-5 space-y-3", children: [_jsx("p", { className: "text-xs text-text-muted", children: "Ingresa tu c\u00F3digo TOTP para confirmar que deseas deshabilitar el 2FA." }), _jsxs("form", { onSubmit: handleDisableMfa, className: "space-y-3", children: [_jsx("input", { type: "text", inputMode: "numeric", maxLength: 6, value: disableCode, onChange: e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "000000", required: true, className: cn(inputCls, 'text-center text-lg font-bold tracking-widest') }), error && _jsx("p", { className: "text-xs text-danger", children: error }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => { setStep('idle'); setError(null); }, className: "flex-1 py-2 rounded-lg text-xs text-text-muted border border-border hover:border-border/70 transition-colors", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: loading || disableCode.length < 6, className: "flex-1 py-2 rounded-lg text-xs font-medium bg-danger text-white hover:bg-danger/80 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors", children: [loading && _jsx(Loader2, { size: 12, className: "animate-spin" }), "Deshabilitar"] })] })] })] })), loading && step === 'idle' && (_jsxs("div", { className: "px-5 pb-4 flex items-center gap-2 text-xs text-text-muted", children: [_jsx(Loader2, { size: 12, className: "animate-spin" }), " Cargando..."] })), error && step === 'idle' && (_jsx("div", { className: "px-5 pb-4 text-xs text-danger", children: error }))] }));
}
// ── Main ───────────────────────────────────────────────────────────────────
export function AjustesPage() {
    const prefs = usePreferenciasStore();
    const set = prefs.set;
    return (_jsxs("div", { className: "flex flex-col gap-6 max-w-2xl mx-auto", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Ajustes" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Personaliza la visualizaci\u00F3n de la app" })] }), _jsxs("button", { onClick: () => { if (confirm('¿Restaurar todos los ajustes a sus valores por defecto?'))
                            prefs.reset(); }, className: "flex items-center gap-2 text-sm text-text-muted hover:text-danger transition-colors border border-border rounded-lg px-3 py-2", children: [_jsx(RotateCcw, { size: 13 }), " Restaurar"] })] }), _jsxs(Section, { title: "Formato de montos", icon: Hash, children: [_jsx(Row, { label: "Precisi\u00F3n decimal", description: "Cu\u00E1ndo mostrar los centavos (.00) en los montos", children: _jsx(Chips, { value: prefs.precisionDecimal, onChange: v => set('precisionDecimal', v), options: [
                                { value: 'siempre', label: 'Siempre' },
                                { value: 'solo_totales', label: 'Solo totales' },
                                { value: 'nunca', label: 'Nunca' },
                            ] }) }), _jsx(Row, { label: "Mostrar s\u00EDmbolo de moneda", description: "Mostrar RD$, USD, EUR antes de los valores", children: _jsx(Toggle, { value: prefs.mostrarSimbolo, onChange: v => set('mostrarSimbolo', v) }) }), _jsx(Row, { label: "Moneda de visualizaci\u00F3n", description: "Solo afecta el s\u00EDmbolo mostrado, no convierte valores", children: _jsx(Chips, { value: prefs.monedaVista, onChange: v => set('monedaVista', v), options: [
                                { value: 'DOP', label: 'DOP' },
                                { value: 'USD', label: 'USD' },
                                { value: 'EUR', label: 'EUR' },
                            ] }) }), _jsx(Row, { label: "", children: _jsx("div", { className: "w-72", children: _jsx(Preview, {}) }) })] }), _jsx(Section, { title: "Privacidad visual", icon: EyeOff, children: _jsx(Row, { label: "Ocultar montos sensibles", description: "Reemplaza todos los valores con \u2022\u2022\u2022\u2022 (\u00FAtil al compartir pantalla)", children: _jsx(Toggle, { value: prefs.mostrarSaldoOculto, onChange: v => set('mostrarSaldoOculto', v) }) }) }), _jsx(Section, { title: "Formato de fechas", icon: Calendar, children: _jsx(Row, { label: "Formato", description: "C\u00F3mo se muestran las fechas en toda la app", children: _jsx(Chips, { value: prefs.formatoFecha, onChange: v => set('formatoFecha', v), options: [
                            { value: 'dd/mm/yyyy', label: 'DD/MM/AAAA' },
                            { value: 'mm/dd/yyyy', label: 'MM/DD/AAAA' },
                            { value: 'relativo', label: 'Relativo' },
                        ] }) }) }), _jsx(Section, { title: "Listas y tablas", icon: AlignJustify, children: _jsx(Row, { label: "Filas por p\u00E1gina", description: "Cantidad de registros visibles por defecto en tablas", children: _jsx(Chips, { value: prefs.filasPorPagina, onChange: v => set('filasPorPagina', v), options: [
                            { value: 10, label: '10' },
                            { value: 25, label: '25' },
                            { value: 50, label: '50' },
                        ] }) }) }), _jsx(Section, { title: "Dashboard y gr\u00E1ficos", icon: BarChart2, children: _jsx(Row, { label: "Animaciones en gr\u00E1ficos", description: "Desactiva si notas lentitud al cargar el dashboard", children: _jsx(Toggle, { value: prefs.animacionesGraficos, onChange: v => set('animacionesGraficos', v) }) }) }), _jsx(SecuritySection, {}), _jsx("p", { className: "text-xs text-text-muted text-center pb-4", children: "Todos los ajustes se guardan localmente en tu dispositivo \u00B7 No afectan la base de datos" })] }));
}
