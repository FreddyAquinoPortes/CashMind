import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { useFmt } from '../../lib/useFmt';
import { BANCOS_RD, TIPOS_CUENTA, MONEDAS } from '../../lib/constants';
import { PlusIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline';
const TIPO_LABELS = {
    CORRIENTE: 'Corriente',
    AHORRO: 'Ahorro',
    INVERSION: 'Inversión',
    OTRO: 'Otro',
};
const TIPO_COLORS = {
    CORRIENTE: '#3b82f6',
    AHORRO: '#22c55e',
    INVERSION: '#a78bfa',
    OTRO: '#94a3b8',
};
// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: "bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 px-6 pb-6", children: children })] }) }));
}
const EMPTY = { alias: '', banco: '', numero: '', tipo: 'AHORRO', moneda: 'DOP', saldo: '0', activa: true };
function CuentaFormPanel({ initial, onSubmit, onClose, loading, error, }) {
    const [form, setForm] = useState(initial ?? EMPTY);
    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [error && _jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre / Alias *", _jsx("input", { required: true, value: form.alias, onChange: set('alias'), className: "input", placeholder: "Ej. Cuenta n\u00F3mina, Ahorros...", autoFocus: true })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Banco *", _jsxs("select", { required: true, value: form.banco, onChange: set('banco'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Seleccionar banco \u2014" }), BANCOS_RD.map(b => _jsx("option", { value: b, children: b }, b))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["N\u00FAmero de cuenta *", _jsx("input", { required: true, value: form.numero, onChange: set('numero'), className: "input", placeholder: "Ej. 1234567890" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo", _jsx("select", { value: form.tipo, onChange: set('tipo'), className: "input", children: TIPOS_CUENTA.map(t => _jsx("option", { value: t.value, children: t.label }, t.value)) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Moneda", _jsx("select", { value: form.moneda, onChange: set('moneda'), className: "input", children: MONEDAS.map(m => _jsx("option", { value: m.value, children: m.value }, m.value)) })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Balance inicial", _jsx("input", { type: "number", step: "0.01", value: form.saldo, onChange: set('saldo'), className: "input", placeholder: "0.00" })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-text-secondary cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.activa, onChange: e => setForm(p => ({ ...p, activa: e.target.checked })), className: "accent-primary w-4 h-4" }), "Cuenta activa"] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
export function CuentasPage() {
    const fmt = useFmt();
    const qc = useQueryClient();
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const { data: cuentas = [], isLoading } = useQuery({
        queryKey: ['cuentas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/cuentas`)).data.data,
        enabled: !!cid,
    });
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null);
    const closeModal = () => setModal(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    const invalidate = () => qc.invalidateQueries({ queryKey: ['cuentas', cid] });
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/cuentas`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Cuenta creada'); },
        onError: (e) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error'); },
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/cuentas/${id}`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Cuenta actualizada'); },
        onError: (e) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error'); },
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/cuentas/${id}`),
        onSuccess: () => { invalidate(); closeModal(); showToast('Cuenta eliminada'); },
        onError: (e) => { showToast(e.message, 'error'); },
    });
    const totalSaldo = cuentas.filter(c => c.activa).reduce((s, c) => s + parseFloat(String(c.saldo)), 0);
    return (_jsxs("div", { className: "flex flex-col gap-6 max-w-3xl mx-auto", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Cuentas" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Tus cuentas bancarias y billeteras" })] }), _jsxs("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), " Nueva cuenta"] })] }), cuentas.length > 0 && (_jsxs("div", { className: "grid grid-cols-2 gap-4 sm:grid-cols-3", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Balance total" }), _jsx("p", { className: "text-xl font-bold text-success", children: fmt(totalSaldo) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Cuentas activas" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: cuentas.filter(c => c.activa).length })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Total cuentas" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: cuentas.length })] })] })), isLoading && _jsx("div", { className: "flex items-center justify-center h-32 text-text-muted text-sm", children: "Cargando\u2026" }), _jsx("div", { className: "flex flex-col gap-3", children: cuentas.map(c => {
                    const color = TIPO_COLORS[c.tipo] ?? '#94a3b8';
                    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex items-center gap-4", children: [_jsx("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", style: { backgroundColor: color + '22' }, children: _jsx(BuildingLibraryIcon, { className: "w-5 h-5", style: { color } }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-semibold text-text-primary", children: c.alias ?? c.banco }), _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-border text-text-muted", children: TIPO_LABELS[c.tipo] }), !c.activa && _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning", children: "Inactiva" })] }), _jsxs("div", { className: "text-xs text-text-muted mt-0.5", children: [c.banco, " \u00B7 \u00B7\u00B7\u00B7", c.numero.slice(-4)] })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsx("div", { className: "font-semibold text-success", children: fmt(c.saldo) }), _jsx("div", { className: "text-xs text-text-muted", children: c.moneda })] }), _jsxs("div", { className: "flex items-center gap-1 flex-shrink-0", children: [_jsx("button", { onClick: () => setModal({ type: 'edit', cuenta: c }), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", title: "Editar", children: "\u270F" }), _jsx("button", { onClick: () => setModal({ type: 'delete', cuenta: c }), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors", title: "Eliminar", children: "\uD83D\uDDD1" })] })] }, c.id));
                }) }), !isLoading && cuentas.length === 0 && (_jsxs("div", { className: "text-center text-text-muted py-16 text-sm", children: [_jsx(BuildingLibraryIcon, { className: "w-10 h-10 mx-auto mb-3 opacity-30" }), _jsx("p", { children: "No tienes cuentas registradas todav\u00EDa" }), _jsx("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary mt-4", children: "+ A\u00F1adir primera cuenta" })] })), modal?.type === 'new' && (_jsx(Modal, { title: "Nueva cuenta", onClose: closeModal, children: _jsx(CuentaFormPanel, { onClose: closeModal, loading: create.isPending, error: modal.error, onSubmit: d => create.mutate({ ...d, saldo: parseFloat(d.saldo) }) }) })), modal?.type === 'edit' && (_jsx(Modal, { title: "Editar cuenta", onClose: closeModal, children: _jsx(CuentaFormPanel, { initial: { alias: modal.cuenta.alias ?? '', banco: modal.cuenta.banco, numero: modal.cuenta.numero,
                        tipo: modal.cuenta.tipo, moneda: modal.cuenta.moneda, saldo: String(modal.cuenta.saldo), activa: modal.cuenta.activa }, onClose: closeModal, loading: update.isPending, error: modal.error, onSubmit: d => update.mutate({ id: modal.cuenta.id, d: { ...d, saldo: parseFloat(d.saldo) } }) }) })), modal?.type === 'delete' && (_jsxs(Modal, { title: "Eliminar cuenta", onClose: closeModal, children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFEliminar ", _jsx("strong", { className: "text-text-primary", children: modal.cuenta.alias ?? modal.cuenta.banco }), "? Esta acci\u00F3n no se puede deshacer."] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: closeModal, children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.cuenta.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] }))] }));
}
