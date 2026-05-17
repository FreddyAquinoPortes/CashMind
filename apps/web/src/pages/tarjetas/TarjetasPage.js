import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { useFmt } from '../../lib/useFmt';
import { BANCOS_RD, FRANQUICIAS, TIPOS_TARJETA, CATEGORIAS_TARJETA } from '../../lib/constants';
import { PlusIcon, CreditCardIcon } from '@heroicons/react/24/outline';
const FRANQ_COLORS = {
    VISA: '#1a1f71', MASTERCARD: '#eb001b', AMEX: '#007bc1', DISCOVER: '#ff6600',
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
const EMPTY = {
    alias: '', banco: '', ultimosCuatro: '', franquicia: '', tipoTarjeta: 'CREDITO', categoriaTarjeta: '',
    limite: '0', saldoActual: '0', tasaInteres: '0', diaCorte: '1', diaPago: '15', moneda: 'DOP', activa: true,
};
function TarjetaFormPanel({ initial, onSubmit, onClose, loading, error, }) {
    const [form, setForm] = useState(initial ?? EMPTY);
    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [error && _jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre / Alias *", _jsx("input", { required: true, value: form.alias, onChange: set('alias'), className: "input", placeholder: "Ej. Visa Oro Popular", autoFocus: true })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Banco *", _jsxs("select", { required: true, value: form.banco, onChange: set('banco'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Seleccionar banco \u2014" }), BANCOS_RD.map(b => _jsx("option", { value: b, children: b }, b))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["\u00DAltimos 4 d\u00EDgitos *", _jsx("input", { required: true, maxLength: 4, pattern: "\\d{4}", value: form.ultimosCuatro, onChange: set('ultimosCuatro'), className: "input", placeholder: "1234" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Franquicia", _jsxs("select", { value: form.franquicia, onChange: set('franquicia'), className: "input", children: [_jsx("option", { value: "", children: "\u2014" }), FRANQUICIAS.map(f => _jsx("option", { value: f.value, children: f.label }, f.value))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo", _jsxs("select", { value: form.tipoTarjeta, onChange: set('tipoTarjeta'), className: "input", children: [_jsx("option", { value: "", children: "\u2014" }), TIPOS_TARJETA.map(t => _jsx("option", { value: t.value, children: t.label }, t.value))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Categor\u00EDa", _jsxs("select", { value: form.categoriaTarjeta, onChange: set('categoriaTarjeta'), className: "input", children: [_jsx("option", { value: "", children: "\u2014" }), CATEGORIAS_TARJETA.map(c => _jsx("option", { value: c.value, children: c.label }, c.value))] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["L\u00EDmite de cr\u00E9dito", _jsx("input", { type: "number", step: "0.01", min: "0", value: form.limite, onChange: set('limite'), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Saldo actual", _jsx("input", { type: "number", step: "0.01", min: "0", value: form.saldoActual, onChange: set('saldoActual'), className: "input" })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tasa inter\u00E9s %", _jsx("input", { type: "number", step: "0.01", min: "0", max: "100", value: form.tasaInteres, onChange: set('tasaInteres'), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["D\u00EDa de corte", _jsx("input", { type: "number", min: "1", max: "31", value: form.diaCorte, onChange: set('diaCorte'), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["D\u00EDa de pago", _jsx("input", { type: "number", min: "1", max: "31", value: form.diaPago, onChange: set('diaPago'), className: "input" })] })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
// ── Progress bar ───────────────────────────────────────────────────────────
function UtilBar({ pct }) {
    const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
    return (_jsx("div", { className: "w-full bg-border rounded-full h-1.5 mt-2", children: _jsx("div", { className: "h-1.5 rounded-full transition-all", style: { width: `${Math.min(pct, 100)}%`, backgroundColor: color } }) }));
}
export function TarjetasPage() {
    const fmt = useFmt();
    const qc = useQueryClient();
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const { data: tarjetas = [], isLoading } = useQuery({
        queryKey: ['tarjetas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/tarjetas`)).data.data,
        enabled: !!cid,
    });
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null);
    const closeModal = () => setModal(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    const invalidate = () => qc.invalidateQueries({ queryKey: ['tarjetas', cid] });
    const toPayload = (d) => ({
        ...d,
        franquicia: d.franquicia || null,
        tipoTarjeta: d.tipoTarjeta || null,
        categoriaTarjeta: d.categoriaTarjeta || null,
        limite: parseFloat(d.limite),
        saldoActual: parseFloat(d.saldoActual),
        tasaInteres: parseFloat(d.tasaInteres),
        diaCorte: parseInt(d.diaCorte),
        diaPago: parseInt(d.diaPago),
    });
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/tarjetas`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta creada'); },
        onError: (e) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error'); },
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/tarjetas/${id}`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta actualizada'); },
        onError: (e) => { setModal(p => p ? { ...p, error: e.message } : p); showToast(e.message, 'error'); },
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/tarjetas/${id}`),
        onSuccess: () => { invalidate(); closeModal(); showToast('Tarjeta eliminada'); },
        onError: (e) => { showToast(e.message, 'error'); },
    });
    const totalDeuda = tarjetas.reduce((s, t) => s + parseFloat(String(t.saldoActual)), 0);
    const totalLimite = tarjetas.reduce((s, t) => s + parseFloat(String(t.limite)), 0);
    return (_jsxs("div", { className: "flex flex-col gap-6 max-w-3xl mx-auto", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Tarjetas" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Tus tarjetas de cr\u00E9dito y d\u00E9bito" })] }), _jsxs("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), " Nueva tarjeta"] })] }), tarjetas.length > 0 && (_jsxs("div", { className: "grid grid-cols-2 gap-4 sm:grid-cols-3", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Deuda total" }), _jsx("p", { className: "text-xl font-bold text-danger", children: fmt(totalDeuda) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "L\u00EDmite total" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: fmt(totalLimite) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Disponible" }), _jsx("p", { className: "text-xl font-bold text-success", children: fmt(Math.max(0, totalLimite - totalDeuda)) })] })] })), isLoading && _jsx("div", { className: "flex items-center justify-center h-32 text-text-muted text-sm", children: "Cargando\u2026" }), _jsx("div", { className: "flex flex-col gap-3", children: tarjetas.map(t => {
                    const color = FRANQ_COLORS[t.franquicia ?? ''] ?? '#6366f1';
                    const util = typeof t.utilizacion === 'number' ? t.utilizacion : 0;
                    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex items-start gap-4", children: [_jsx("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", style: { backgroundColor: color + '22' }, children: _jsx(CreditCardIcon, { className: "w-5 h-5", style: { color } }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-semibold text-text-primary", children: t.alias ?? `····${t.ultimosCuatro}` }), t.franquicia && _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-border text-text-muted", children: t.franquicia }), t.categoriaTarjeta && _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-border text-text-muted", children: t.categoriaTarjeta }), !t.activa && _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning", children: "Inactiva" })] }), _jsxs("div", { className: "text-xs text-text-muted mt-0.5", children: [t.banco, " \u00B7 \u00B7\u00B7\u00B7\u00B7", t.ultimosCuatro] }), _jsx(UtilBar, { pct: util }), _jsxs("div", { className: "flex items-center justify-between text-xs text-text-muted mt-1", children: [_jsxs("span", { children: ["Usado: ", fmt(t.saldoActual)] }), _jsxs("span", { children: [util, "% de ", fmt(t.limite)] })] })] }), _jsxs("div", { className: "flex items-center gap-1 flex-shrink-0", children: [_jsx("button", { onClick: () => setModal({ type: 'edit', tarjeta: t }), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", children: "\u270F" }), _jsx("button", { onClick: () => setModal({ type: 'delete', tarjeta: t }), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors", children: "\uD83D\uDDD1" })] })] }, t.id));
                }) }), !isLoading && tarjetas.length === 0 && (_jsxs("div", { className: "text-center text-text-muted py-16 text-sm", children: [_jsx(CreditCardIcon, { className: "w-10 h-10 mx-auto mb-3 opacity-30" }), _jsx("p", { children: "No tienes tarjetas registradas" }), _jsx("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary mt-4", children: "+ A\u00F1adir primera tarjeta" })] })), modal?.type === 'new' && (_jsx(Modal, { title: "Nueva tarjeta", onClose: closeModal, children: _jsx(TarjetaFormPanel, { onClose: closeModal, loading: create.isPending, error: modal.error, onSubmit: d => create.mutate(toPayload(d)) }) })), modal?.type === 'edit' && (_jsx(Modal, { title: "Editar tarjeta", onClose: closeModal, children: _jsx(TarjetaFormPanel, { initial: {
                        alias: modal.tarjeta.alias ?? '', banco: modal.tarjeta.banco,
                        ultimosCuatro: modal.tarjeta.ultimosCuatro,
                        franquicia: (modal.tarjeta.franquicia ?? ''),
                        tipoTarjeta: (modal.tarjeta.tipoTarjeta ?? ''),
                        categoriaTarjeta: (modal.tarjeta.categoriaTarjeta ?? ''),
                        limite: String(modal.tarjeta.limite), saldoActual: String(modal.tarjeta.saldoActual),
                        tasaInteres: String(modal.tarjeta.tasaInteres), diaCorte: String(modal.tarjeta.diaCorte),
                        diaPago: String(modal.tarjeta.diaPago), moneda: modal.tarjeta.moneda, activa: modal.tarjeta.activa,
                    }, onClose: closeModal, loading: update.isPending, error: modal.error, onSubmit: d => update.mutate({ id: modal.tarjeta.id, d: toPayload(d) }) }) })), modal?.type === 'delete' && (_jsxs(Modal, { title: "Eliminar tarjeta", onClose: closeModal, children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFEliminar ", _jsx("strong", { className: "text-text-primary", children: modal.tarjeta.alias ?? `····${modal.tarjeta.ultimosCuatro}` }), "? Esta acci\u00F3n no se puede deshacer."] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: closeModal, children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.tarjeta.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] }))] }));
}
