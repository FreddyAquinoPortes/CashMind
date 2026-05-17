import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * IdleWarning — modal que aparece cuando el usuario está inactivo
 * y le quedan menos de 2 minutos para el logout automático.
 */
import { Clock } from 'lucide-react';
export function IdleWarning({ secondsRemaining, onContinue, onLogout }) {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return (_jsxs("div", { className: "fixed inset-0 z-[9999] flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200", children: [_jsx("div", { className: "flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 border border-warning/20 mx-auto mb-4", children: _jsx(Clock, { size: 24, className: "text-warning" }) }), _jsx("h2", { className: "text-lg font-semibold text-text-primary text-center mb-2", children: "\u00BFSigues ah\u00ED?" }), _jsx("p", { className: "text-sm text-text-muted text-center mb-4", children: "Tu sesi\u00F3n cerrar\u00E1 autom\u00E1ticamente por inactividad." }), _jsx("div", { className: "bg-background border border-border rounded-lg py-3 text-center mb-5", children: _jsxs("span", { className: "text-2xl font-bold tabular-nums text-text-primary", children: [String(minutes).padStart(2, '0'), ":", String(seconds).padStart(2, '0')] }) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onLogout, className: "flex-1 py-2 rounded-lg text-sm font-medium text-text-secondary border border-border hover:border-danger/50 hover:text-danger transition-colors", children: "Cerrar sesi\u00F3n" }), _jsx("button", { onClick: onContinue, className: "flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors", children: "Seguir usando" })] })] })] }));
}
