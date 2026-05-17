import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { useFmt } from '../../lib/useFmt';
import { TIPOS_DEUDA, MONEDAS } from '../../lib/constants';
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
const ESTADO_COLORS = {
    ACTIVA: '#22c55e', SALDADA: '#6366f1', EN_MORA: '#ef4444',
    RENEGOCIADA: '#f59e0b', CANCELADA: '#94a3b8',
};
const ESTADO_LABELS = {
    ACTIVA: 'Activa', SALDADA: 'Saldada', EN_MORA: 'En mora',
    RENEGOCIADA: 'Renegociada', CANCELADA: 'Cancelada',
};
function personaDisplayName(p) {
    return p.tipo === 'persona' && p.apellido ? `${p.nombre} ${p.apellido}` : p.nombre;
}
// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: "bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 px-6 pb-6", children: children })] }) }));
}
// ── Progress Bar ───────────────────────────────────────────────────────────
function DeudaProgress({ saldo, original, compact }) {
    const fmt = useFmt();
    const s = parseFloat(String(saldo));
    const o = parseFloat(String(original));
    const pct = o > 0 ? (s / o) * 100 : 0;
    const color = pct <= 25 ? '#22c55e' : pct <= 60 ? '#f59e0b' : '#ef4444';
    if (compact) {
        return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 bg-border rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full", style: { width: `${pct}%`, backgroundColor: color } }) }), _jsxs("span", { className: "text-xs text-text-muted tabular-nums w-8 text-right", children: [pct.toFixed(0), "%"] })] }));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs text-text-muted mb-1", children: [_jsxs("span", { children: ["Saldo: ", fmt(saldo)] }), _jsxs("span", { children: ["Pagado: ", fmt(Math.max(0, o - s))] })] }), _jsx("div", { className: "w-full bg-border rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full transition-all", style: { width: `${pct}%`, backgroundColor: color } }) }), _jsxs("div", { className: "text-xs text-text-muted mt-1 text-right", children: [pct.toFixed(0), "% pendiente"] })] }));
}
const EMPTY = {
    personaId: '', concepto: '', tipo: 'PERSONAL', montoOriginal: '', saldoActual: '',
    moneda: 'DOP', fechaInicio: new Date().toISOString().slice(0, 10), fechaFin: '',
    tasaInteres: '', tipoPlazo: 'FLEXIBLE', numeroCuotas: '', diaCobro: '', estado: 'ACTIVA', notas: '',
};
function DeudaFormPanel({ initial, personas, onSubmit, onClose, loading, error, }) {
    const [form, setForm] = useState(initial ?? EMPTY);
    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
    const isFijo = form.tipoPlazo === 'FIJO';
    // Auto-calculate cuotas from date range when plazo=FIJO
    useEffect(() => {
        if (form.tipoPlazo !== 'FIJO' || !form.fechaInicio || !form.fechaFin)
            return;
        const inicio = new Date(form.fechaInicio);
        const fin = new Date(form.fechaFin);
        if (fin <= inicio)
            return;
        const meses = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth());
        if (meses > 0)
            setForm(p => ({ ...p, numeroCuotas: String(meses) }));
    }, [form.fechaInicio, form.fechaFin, form.tipoPlazo]);
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [error && _jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Persona / Entidad *", _jsxs("select", { required: true, value: form.personaId, onChange: set('personaId'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Seleccionar \u2014" }), personas.map(p => _jsx("option", { value: p.id, children: p.displayName }, p.id))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Concepto *", _jsx("input", { required: true, type: "text", maxLength: 150, value: form.concepto, onChange: set('concepto'), className: "input", placeholder: "Ej. Pr\u00E9stamo para comida abril 2026" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo de deuda", _jsx("select", { value: form.tipo, onChange: set('tipo'), className: "input", children: TIPOS_DEUDA.map(t => _jsx("option", { value: t.value, children: t.label }, t.value)) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Moneda", _jsx("select", { value: form.moneda, onChange: set('moneda'), className: "input", children: MONEDAS.map(m => _jsx("option", { value: m.value, children: m.value }, m.value)) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Monto original *", _jsx("input", { required: true, type: "number", step: "0.01", min: "0.01", value: form.montoOriginal, onChange: set('montoOriginal'), className: "input", placeholder: "0.00" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Saldo actual", _jsx("input", { type: "number", step: "0.01", min: "0", value: form.saldoActual, onChange: set('saldoActual'), className: "input", placeholder: "Igual al original" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha inicio *", _jsx("input", { required: true, type: "date", value: form.fechaInicio, onChange: set('fechaInicio'), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha fin", _jsx("input", { type: "date", value: form.fechaFin, onChange: set('fechaFin'), className: "input" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo de plazo", _jsxs("select", { value: form.tipoPlazo, onChange: set('tipoPlazo'), className: "input", children: [_jsx("option", { value: "FLEXIBLE", children: "Flexible" }), _jsx("option", { value: "FIJO", children: "Fijo (cuotas)" })] })] }), isFijo ? (_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["N\u00B0 cuotas *", _jsx("input", { required: isFijo, type: "number", min: "1", value: form.numeroCuotas, onChange: set('numeroCuotas'), className: "input", placeholder: "12" })] })) : (_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tasa de inter\u00E9s %", _jsx("input", { type: "number", step: "0.01", min: "0", max: "100", value: form.tasaInteres, onChange: set('tasaInteres'), className: "input", placeholder: "0.00" })] }))] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Estado", _jsx("select", { value: form.estado, onChange: set('estado'), className: "input", children: Object.keys(ESTADO_LABELS).map(e => (_jsx("option", { value: e, children: ESTADO_LABELS[e] }, e))) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("textarea", { value: form.notas, onChange: set('notas'), className: "input resize-none", rows: 2, placeholder: "Informaci\u00F3n adicional..." })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
// ── Pago Form ──────────────────────────────────────────────────────────────
function PagoFormPanel({ deuda, onSubmit, onClose, loading, error }) {
    const fmt = useFmt();
    const [monto, setMonto] = useState('');
    const [notas, setNotas] = useState('');
    const saldo = parseFloat(String(deuda.saldoActual));
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(parseFloat(monto), notas); }, className: "flex flex-col gap-4", children: [error && _jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "bg-background/50 rounded-xl p-3 text-sm", children: [_jsx("p", { className: "text-text-muted text-xs mb-1", children: deuda.concepto ?? '—' }), _jsxs("div", { className: "flex justify-between text-text-muted", children: [_jsx("span", { children: "Saldo actual" }), _jsx("span", { className: "font-semibold text-danger", children: fmt(saldo) })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Monto del pago *", _jsx("input", { required: true, type: "number", step: "0.01", min: "0.01", max: saldo, value: monto, onChange: e => setMonto(e.target.value), className: "input", placeholder: "0.00", autoFocus: true }), _jsxs("span", { className: "text-xs text-text-muted", children: ["M\u00E1ximo: ", fmt(saldo)] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("input", { value: notas, onChange: e => setNotas(e.target.value), className: "input", placeholder: "Ej. Cuota de mayo..." })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Aplicando…' : 'Aplicar pago' })] })] }));
}
// ── Deuda Row (expandable) ─────────────────────────────────────────────────
function DeudaRow({ d, onEdit, onDelete, onPago }) {
    const fmt = useFmt();
    const [open, setOpen] = useState(false);
    const color = ESTADO_COLORS[d.estado];
    const tipoLabel = TIPOS_DEUDA.find(t => t.value === d.tipo)?.label ?? d.tipo;
    const { data: pagos, isLoading: pagosLoading } = useQuery({
        queryKey: ['deuda-pagos', d.id],
        queryFn: async () => (await api.get(`/deudas/${d.id}/pagos`)).data.data,
        enabled: open, // only fetch when expanded
        staleTime: 30_000,
    });
    const fmtDate = (iso) => {
        if (!iso)
            return '—';
        const [y, m, day] = iso.slice(0, 10).split('-');
        return `${day}/${m}/${y}`;
    };
    return (_jsxs("div", { className: "border-b border-border/50 last:border-0", children: [_jsxs("div", { className: "px-4 py-3 flex items-start gap-3", children: [_jsx("button", { type: "button", onClick: () => setOpen(o => !o), className: "mt-1 flex-shrink-0 text-text-muted hover:text-text-primary transition-colors", title: open ? 'Colapsar' : 'Ver detalles', children: open
                            ? _jsx(ChevronDownIcon, { className: "w-3.5 h-3.5" })
                            : _jsx(ChevronRightIcon, { className: "w-3.5 h-3.5" }) }), _jsx("div", { className: "w-2 h-2 rounded-full mt-2 flex-shrink-0", style: { backgroundColor: color } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-2", children: [_jsx("span", { className: "text-sm font-medium text-text-primary cursor-pointer hover:text-primary transition-colors", onClick: () => setOpen(o => !o), children: d.concepto ?? '(sin concepto)' }), _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-border/80 text-text-muted", children: tipoLabel }), _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded font-medium", style: { backgroundColor: color + '22', color }, children: ESTADO_LABELS[d.estado] }), d.tipoPlazo === 'FIJO' && d.numeroCuotas && (_jsxs("span", { className: "text-xs text-text-muted", children: [d.numeroCuotas, " cuotas"] }))] }), _jsx(DeudaProgress, { saldo: d.saldoActual, original: d.montoOriginal })] }), _jsxs("div", { className: "flex items-center gap-1 flex-shrink-0 ml-2 mt-0.5", children: [d.estado === 'ACTIVA' && (_jsx("button", { onClick: () => onPago(d), className: "px-2 py-1 rounded text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors", children: "\uD83D\uDCB3 Pago" })), _jsx("button", { onClick: () => onEdit(d), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors text-sm", children: "\u270F" }), _jsx("button", { onClick: () => onDelete(d), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors text-sm", children: "\uD83D\uDDD1" })] })] }), open && (_jsxs("div", { className: "mx-4 mb-4 rounded-xl bg-background/60 border border-border/60 overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-3 divide-x divide-border/60 border-b border-border/60", children: [_jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Fecha inicio" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: fmtDate(d.fechaInicio) })] }), _jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Fecha fin" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: fmtDate(d.fechaFin) })] }), _jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Tasa de inter\u00E9s" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: d.tasaInteres ? `${parseFloat(String(d.tasaInteres)).toFixed(2)}%` : '—' })] })] }), _jsxs("div", { className: "grid grid-cols-3 divide-x divide-border/60 border-b border-border/60", children: [_jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Tipo plazo" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: d.tipoPlazo === 'FIJO' ? 'Fijo' : 'Flexible' })] }), _jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Cuotas" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: d.numeroCuotas ?? '—' })] }), _jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Moneda" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: d.moneda })] })] }), d.notas && (_jsxs("div", { className: "px-3 py-2.5 border-b border-border/60", children: [_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: "Notas" }), _jsx("p", { className: "text-sm text-text-secondary", children: d.notas })] })), _jsxs("div", { className: "px-3 py-2.5", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-2", children: "Historial de pagos" }), pagosLoading && (_jsx("p", { className: "text-xs text-text-muted", children: "Cargando\u2026" })), !pagosLoading && (!pagos || pagos.length === 0) && (_jsx("p", { className: "text-xs text-text-muted italic", children: "Sin pagos registrados" })), !pagosLoading && pagos && pagos.length > 0 && (_jsxs("div", { className: "flex flex-col gap-1.5", children: [pagos.map(p => (_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" }), _jsx("span", { className: "text-text-secondary", children: fmtDate(p.fecha) }), p.notas && _jsx("span", { className: "text-xs text-text-muted truncate max-w-[120px]", children: p.notas })] }), _jsxs("span", { className: "font-medium text-success tabular-nums", children: ["+", fmt(p.monto)] })] }, p.id))), _jsxs("div", { className: "flex items-center justify-between text-xs text-text-muted pt-1.5 border-t border-border/60 mt-0.5", children: [_jsxs("span", { children: [pagos.length, " ", pagos.length === 1 ? 'pago' : 'pagos'] }), _jsxs("span", { className: "font-semibold text-success", children: ["Total: ", fmt(pagos.reduce((s, p) => s + parseFloat(String(p.monto)), 0))] })] })] }))] })] }))] }));
}
// ── Persona Group Card ──────────────────────────────────────────────────────
function PersonaGroupCard({ personaName, deudas, filtroEstado, onNew, onEdit, onDelete, onPago, }) {
    const fmt = useFmt();
    const [open, setOpen] = useState(true);
    const filtered = deudas.filter(d => !filtroEstado || d.estado === filtroEstado);
    if (filtered.length === 0)
        return null;
    const totalSaldo = filtered.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0);
    const totalOriginal = filtered.reduce((s, d) => s + parseFloat(String(d.montoOriginal)), 0);
    const activas = filtered.filter(d => d.estado === 'ACTIVA').length;
    const hasActive = activas > 0;
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setOpen(o => !o), className: "w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left", children: [open
                        ? _jsx(ChevronDownIcon, { className: "w-4 h-4 text-text-muted flex-shrink-0" })
                        : _jsx(ChevronRightIcon, { className: "w-4 h-4 text-text-muted flex-shrink-0" }), _jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "text-primary font-bold text-sm", children: personaName.charAt(0).toUpperCase() }) }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-semibold text-text-primary truncate", children: personaName }), _jsxs("span", { className: "text-xs text-text-muted", children: [filtered.length, " ", filtered.length === 1 ? 'deuda' : 'deudas'] }), activas > 0 && (_jsxs("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium", children: [activas, " activa", activas > 1 ? 's' : ''] }))] }) }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsx("p", { className: `font-bold tabular-nums ${hasActive ? 'text-danger' : 'text-text-muted'}`, children: fmt(totalSaldo) }), totalOriginal !== totalSaldo && (_jsxs("p", { className: "text-xs text-text-muted", children: ["de ", fmt(totalOriginal)] }))] })] }), !open && hasActive && (_jsx("div", { className: "px-4 pb-3", children: _jsx(DeudaProgress, { saldo: String(totalSaldo), original: String(totalOriginal), compact: true }) })), open && (_jsxs("div", { className: "border-t border-border", children: [filtered.map(d => (_jsx(DeudaRow, { d: d, onEdit: onEdit, onDelete: onDelete, onPago: onPago }, d.id))), _jsx("div", { className: "px-4 py-2", children: _jsxs("button", { onClick: onNew, className: "text-xs text-text-muted hover:text-primary transition-colors flex items-center gap-1", children: [_jsx(PlusIcon, { className: "w-3 h-3" }), " Agregar otra deuda a ", personaName.split(' ')[0]] }) })] }))] }));
}
const toPayload = (d) => ({
    personaId: d.personaId,
    concepto: d.concepto || null,
    tipo: d.tipo,
    montoOriginal: parseFloat(d.montoOriginal),
    saldoActual: d.saldoActual ? parseFloat(d.saldoActual) : undefined,
    moneda: d.moneda,
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin || null,
    tasaInteres: d.tasaInteres ? parseFloat(d.tasaInteres) : null,
    tipoPlazo: d.tipoPlazo,
    numeroCuotas: d.numeroCuotas ? parseInt(d.numeroCuotas) : null,
    diaCobro: d.diaCobro ? parseInt(d.diaCobro) : null,
    estado: d.estado,
    notas: d.notas || null,
});
export function DeudasPage() {
    const fmt = useFmt();
    const qc = useQueryClient();
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const { data: deudas = [], isLoading } = useQuery({
        queryKey: ['deudas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/deudas`)).data.data,
        enabled: !!cid,
    });
    const { data: personas = [] } = useQuery({
        queryKey: ['personas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
        enabled: !!cid,
    });
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null);
    const [filtroEstado, setFiltroEstado] = useState('');
    const closeModal = () => setModal(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    const invalidate = () => qc.invalidateQueries({ queryKey: ['deudas', cid] });
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/deudas`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Deuda registrada'); },
        onError: (e) => {
            const msg = e?.response?.data?.error ?? e?.message ?? 'Error al registrar deuda';
            setModal(p => p ? { ...p, error: msg } : p);
            showToast(msg, 'error');
        },
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/deudas/${id}`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Deuda actualizada'); },
        onError: (e) => {
            const msg = e?.response?.data?.error ?? e?.message ?? 'Error al actualizar deuda';
            setModal(p => p ? { ...p, error: msg } : p);
            showToast(msg, 'error');
        },
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/deudas/${id}`),
        onSuccess: () => { invalidate(); closeModal(); showToast('Deuda eliminada'); },
        onError: (e) => { showToast(e?.response?.data?.error ?? e?.message, 'error'); },
    });
    const pagar = useMutation({
        mutationFn: ({ id, monto, notas }) => api.post(`/deudas/${id}/pagos`, { monto, notas }),
        onSuccess: () => { invalidate(); closeModal(); showToast('Pago aplicado correctamente'); },
        onError: (e) => {
            const msg = e?.response?.data?.error ?? e?.message ?? 'Error al aplicar pago';
            setModal(p => p ? { ...p, error: msg } : p);
            showToast(msg, 'error');
        },
    });
    // ── Summary ────────────────────────────────────────────────────────────
    const totalPorPagar = deudas.filter(d => d.estado === 'ACTIVA').reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0);
    const totalOriginal = deudas.filter(d => d.estado === 'ACTIVA').reduce((s, d) => s + parseFloat(String(d.montoOriginal)), 0);
    const saldadas = deudas.filter(d => d.estado === 'SALDADA').length;
    // ── Group by persona ───────────────────────────────────────────────────
    // Build a map: personaId → { name, deudas[] }
    const groups = useMemo(() => {
        const map = new Map();
        for (const d of deudas) {
            const key = d.personaId ?? `__txt__${d.acreedorTexto ?? 'sin_persona'}`;
            if (!map.has(key)) {
                const name = d.persona
                    ? personaDisplayName(d.persona)
                    : (d.acreedorTexto ?? 'Sin acreedor');
                map.set(key, { name, deudas: [] });
            }
            map.get(key).deudas.push(d);
        }
        // Sort groups: most total saldo first
        return Array.from(map.entries()).sort(([, a], [, b]) => {
            const sA = a.deudas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0);
            const sB = b.deudas.reduce((s, d) => s + parseFloat(String(d.saldoActual)), 0);
            return sB - sA;
        });
    }, [deudas]);
    // Modal initial form when pre-filling persona
    const newFormInitial = (prePersonaId) => prePersonaId ? { ...EMPTY, personaId: prePersonaId } : EMPTY;
    return (_jsxs("div", { className: "flex flex-col gap-6 max-w-3xl mx-auto", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Deudas" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Control de pr\u00E9stamos, cuotas y obligaciones financieras" })] }), _jsxs("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), " Nueva deuda"] })] }), deudas.length > 0 && (_jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Por pagar (activas)" }), _jsx("p", { className: "text-xl font-bold text-danger", children: fmt(totalPorPagar) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Monto original" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: fmt(totalOriginal) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Saldadas" }), _jsx("p", { className: "text-xl font-bold text-success", children: saldadas })] })] })), _jsx("div", { className: "flex gap-2 flex-wrap", children: ['', 'ACTIVA', 'SALDADA', 'EN_MORA', 'RENEGOCIADA', 'CANCELADA'].map(e => (_jsx("button", { type: "button", onClick: () => setFiltroEstado(e), className: `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
              ${filtroEstado === e ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-primary/40'}`, children: e === '' ? 'Todas' : ESTADO_LABELS[e] }, e))) }), isLoading && _jsx("div", { className: "flex items-center justify-center h-32 text-text-muted text-sm", children: "Cargando\u2026" }), _jsx("div", { className: "flex flex-col gap-3", children: groups.map(([key, { name, deudas: groupDeudas }]) => (_jsx(PersonaGroupCard, { personaName: name, deudas: groupDeudas, filtroEstado: filtroEstado, onNew: () => setModal({ type: 'new', prePersonaId: groupDeudas[0]?.personaId ?? undefined }), onEdit: d => setModal({ type: 'edit', deuda: d }), onDelete: d => setModal({ type: 'delete', deuda: d }), onPago: d => setModal({ type: 'pago', deuda: d }) }, key))) }), !isLoading && groups.length === 0 && (_jsxs("div", { className: "text-center text-text-muted py-16 text-sm", children: [_jsx("p", { className: "text-4xl mb-4", children: "\uD83D\uDCB8" }), _jsx("p", { className: "font-medium text-text-secondary mb-1", children: "No hay deudas registradas" }), _jsx("p", { className: "text-xs mb-4", children: "Registra pr\u00E9stamos, cuotas o cualquier obligaci\u00F3n financiera" }), _jsx("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary", children: "+ Registrar primera deuda" })] })), modal?.type === 'new' && (_jsx(Modal, { title: "Nueva deuda", onClose: closeModal, children: _jsx(DeudaFormPanel, { initial: newFormInitial(modal.prePersonaId), personas: personas, onClose: closeModal, loading: create.isPending, error: modal.error, onSubmit: d => create.mutate(toPayload(d)) }) })), modal?.type === 'edit' && (_jsx(Modal, { title: "Editar deuda", onClose: closeModal, children: _jsx(DeudaFormPanel, { initial: {
                        personaId: modal.deuda.personaId ?? '',
                        concepto: modal.deuda.concepto ?? '',
                        tipo: modal.deuda.tipo,
                        montoOriginal: String(modal.deuda.montoOriginal),
                        saldoActual: String(modal.deuda.saldoActual),
                        moneda: modal.deuda.moneda,
                        fechaInicio: modal.deuda.fechaInicio.slice(0, 10),
                        fechaFin: modal.deuda.fechaFin?.slice(0, 10) ?? '',
                        tasaInteres: String(modal.deuda.tasaInteres ?? ''),
                        tipoPlazo: modal.deuda.tipoPlazo,
                        numeroCuotas: String(modal.deuda.numeroCuotas ?? ''),
                        diaCobro: String(modal.deuda.diaCobro ?? ''),
                        estado: modal.deuda.estado,
                        notas: modal.deuda.notas ?? '',
                    }, personas: personas, onClose: closeModal, loading: update.isPending, error: modal.error, onSubmit: d => update.mutate({ id: modal.deuda.id, d: toPayload(d) }) }) })), modal?.type === 'delete' && (_jsxs(Modal, { title: "Eliminar deuda", onClose: closeModal, children: [_jsxs("p", { className: "text-text-secondary text-sm mb-2", children: ["\u00BFEliminar la deuda ", _jsxs("strong", { className: "text-text-primary", children: ["\"", modal.deuda.concepto ?? modal.deuda.persona?.nombre ?? modal.deuda.acreedorTexto ?? '—', "\""] }), "?"] }), _jsx("p", { className: "text-xs text-text-muted mb-6", children: "Esta acci\u00F3n no se puede deshacer." }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: closeModal, children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.deuda.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] })), modal?.type === 'pago' && (_jsx(Modal, { title: `Aplicar pago — ${modal.deuda.persona ? personaDisplayName(modal.deuda.persona) : modal.deuda.acreedorTexto ?? '—'}`, onClose: closeModal, children: _jsx(PagoFormPanel, { deuda: modal.deuda, onClose: closeModal, loading: pagar.isPending, error: modal.error, onSubmit: (monto, notas) => pagar.mutate({ id: modal.deuda.id, monto, notas }) }) }))] }));
}
