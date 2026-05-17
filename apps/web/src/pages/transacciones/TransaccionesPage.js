import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { PlusIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, FunnelIcon, } from '@heroicons/react/24/outline';
// ── Constants ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
const TIPO_LABELS = {
    GASTO: 'Gasto',
    INGRESO: 'Ingreso',
    TRANSFERENCIA: 'Transferencia',
    PAGO_DEUDA: 'Pago deuda',
    AJUSTE: 'Ajuste',
};
const TIPO_COLORS = {
    GASTO: 'bg-red-500/15 text-red-400',
    INGRESO: 'bg-green-500/15 text-green-400',
    TRANSFERENCIA: 'bg-blue-500/15 text-blue-400',
    PAGO_DEUDA: 'bg-orange-500/15 text-orange-400',
    AJUSTE: 'bg-gray-500/15 text-gray-400',
};
const ESTADO_COLORS = {
    EJECUTADO: 'bg-green-500/10 text-green-400',
    PENDIENTE: 'bg-yellow-500/10 text-yellow-400',
    CANCELADO: 'bg-red-500/10 text-red-400',
    PROYECTADO: 'bg-blue-500/10 text-blue-400',
    PROGRAMADO: 'bg-purple-500/10 text-purple-400',
};
const TODAY = new Date().toISOString().slice(0, 10);
// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso) {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}
function formatMonto(monto, tipo) {
    const formatted = new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP',
        minimumFractionDigits: 2,
    }).format(Math.abs(parseFloat(String(monto))));
    const isNeg = tipo === 'GASTO' || tipo === 'PAGO_DEUDA';
    const isPos = tipo === 'INGRESO';
    return (_jsxs("span", { className: `tabular font-medium ${isNeg ? 'amount-negative' : isPos ? 'amount-positive' : 'text-text-secondary'}`, children: [isNeg ? '-' : isPos ? '+' : '', formatted] }));
}
// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: `bg-surface border border-border rounded-xl w-full shadow-2xl mx-4 flex flex-col max-h-[90vh] ${wide ? 'max-w-2xl' : 'max-w-md'}`, children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary transition-colors text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 px-6 pb-6", children: children })] }) }));
}
// ── Skeleton rows ──────────────────────────────────────────────────────────
function SkeletonRows() {
    return (_jsx(_Fragment, { children: Array.from({ length: 8 }).map((_, i) => (_jsx("tr", { className: "animate-pulse", children: Array.from({ length: 8 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 rounded bg-surface-elevated w-full" }) }, j))) }, i))) }));
}
const EMPTY_FORM = {
    fecha: TODAY,
    concepto: '',
    monto: '',
    tipo: 'GASTO',
    estado: 'EJECUTADO',
    cuentaId: '',
    categoriaId: '',
    subcategoriaId: '',
    notas: '',
    personaId: '',
    deudaId: '',
};
const fmtCOP = (n) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 })
    .format(parseFloat(String(n)));
function TransaccionForm({ initial, cuentas, categorias, personas, deudas, onSubmit, onClose, loading, }) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
    const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));
    // When persona changes, clear deuda selection
    const handlePersonaChange = (e) => setForm(p => ({ ...p, personaId: e.target.value, deudaId: '', monto: '' }));
    // When deuda is selected, auto-fill concepto and suggest saldo as monto
    const handleDeudaChange = (e) => {
        const deudaId = e.target.value;
        const deuda = deudas.find(d => d.id === deudaId);
        const persona = personas.find(p => p.id === form.personaId);
        setForm(prev => ({
            ...prev,
            deudaId,
            monto: deuda ? String(parseFloat(String(deuda.saldoActual)).toFixed(2)) : prev.monto,
            concepto: deuda && persona
                ? `Pago deuda — ${persona.displayName}`
                : prev.concepto,
        }));
    };
    const selectedCat = categorias.find(c => c.id === form.categoriaId);
    const subcats = selectedCat?.subcategorias ?? [];
    const handleCatChange = (e) => setForm(p => ({ ...p, categoriaId: e.target.value, subcategoriaId: '' }));
    const isPagoDeuda = form.tipo === 'PAGO_DEUDA';
    // Deudas filtradas por persona seleccionada (solo activas)
    const deudasPersona = deudas.filter(d => d.personaId === form.personaId && d.estado === 'ACTIVA');
    const selectedDeuda = deudas.find(d => d.id === form.deudaId);
    const saldoDeuda = selectedDeuda ? parseFloat(String(selectedDeuda.saldoActual)) : null;
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha *", _jsx("input", { type: "date", required: true, value: form.fecha, onChange: set('fecha'), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo *", _jsx("select", { value: form.tipo, onChange: set('tipo'), className: "input", children: Object.keys(TIPO_LABELS).map(t => (_jsx("option", { value: t, children: TIPO_LABELS[t] }, t))) })] })] }), isPagoDeuda && (_jsxs("div", { className: "flex flex-col gap-3 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-semibold text-orange-400 uppercase tracking-wider", children: [_jsx("span", { children: "\uD83D\uDCB3" }), " Vinculaci\u00F3n de deuda"] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Persona / Entidad acreedora *", _jsxs("select", { required: isPagoDeuda, value: form.personaId, onChange: handlePersonaChange, className: "input", children: [_jsx("option", { value: "", children: "\u2014 Seleccionar persona \u2014" }), personas.map(p => (_jsx("option", { value: p.id, children: p.displayName }, p.id)))] })] }), form.personaId && (_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Deuda a pagar *", _jsxs("select", { required: isPagoDeuda, value: form.deudaId, onChange: handleDeudaChange, className: "input", children: [_jsx("option", { value: "", children: "\u2014 Seleccionar deuda \u2014" }), deudasPersona.length === 0 && (_jsx("option", { disabled: true, children: "Sin deudas activas con esta persona" })), deudasPersona.map(d => (_jsxs("option", { value: d.id, children: [d.tipo, " \u2014 Saldo: ", fmtCOP(d.saldoActual), d.numeroCuotas ? ` (${d.numeroCuotas} cuotas)` : ''] }, d.id)))] }), selectedDeuda && (_jsxs("div", { className: "flex items-center justify-between text-xs mt-1 px-1", children: [_jsx("span", { className: "text-text-muted", children: "Saldo pendiente:" }), _jsx("span", { className: "font-semibold text-danger", children: fmtCOP(selectedDeuda.saldoActual) })] }))] }))] })), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Concepto *", _jsx("input", { required: true, value: form.concepto, onChange: set('concepto'), className: "input", placeholder: "Ej. Supermercado Nacional" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Monto *", _jsx("input", { type: "number", required: true, min: "0.01", step: "0.01", max: saldoDeuda ?? undefined, value: form.monto, onChange: set('monto'), className: "input", placeholder: "0.00" }), saldoDeuda !== null && (_jsxs("span", { className: "text-xs text-text-muted", children: ["M\u00E1ximo: ", fmtCOP(saldoDeuda)] }))] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Estado *", _jsxs("select", { value: form.estado, onChange: set('estado'), className: "input", children: [_jsx("option", { value: "EJECUTADO", children: "Ejecutado" }), _jsx("option", { value: "PENDIENTE", children: "Pendiente" }), _jsx("option", { value: "PROYECTADO", children: "Proyectado" })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Cuenta", _jsxs("select", { value: form.cuentaId, onChange: set('cuentaId'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Sin cuenta \u2014" }), cuentas.map(c => (_jsx("option", { value: c.id, children: c.alias ?? c.banco }, c.id)))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Categor\u00EDa", _jsxs("select", { value: form.categoriaId, onChange: handleCatChange, className: "input", children: [_jsx("option", { value: "", children: "\u2014 Sin categor\u00EDa \u2014" }), categorias.map(c => (_jsxs("option", { value: c.id, children: [c.icono ? `${c.icono} ` : '', c.nombre] }, c.id)))] })] })] }), form.categoriaId && subcats.length > 0 && (_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Subcategor\u00EDa", _jsxs("select", { value: form.subcategoriaId, onChange: set('subcategoriaId'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Sin subcategor\u00EDa \u2014" }), subcats.map(s => _jsx("option", { value: s.id, children: s.nombre }, s.id))] })] })), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("textarea", { value: form.notas, onChange: set('notas'), className: "input resize-none", rows: 2, placeholder: "Observaciones opcionales\u2026" })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
const EMPTY_FILTERS = {
    search: '',
    desde: '',
    hasta: '',
    tipo: '',
    cuentaId: '',
    categoriaId: '',
};
export function TransaccionesPage() {
    const qc = useQueryClient();
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const [page, setPage] = useState(0);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };
    // Queries
    const { data: txData, isLoading: txLoading } = useQuery({
        queryKey: ['transacciones', filters, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', String(page * PAGE_SIZE));
            if (filters.search)
                params.set('concepto', filters.search);
            if (filters.desde)
                params.set('desde', filters.desde);
            if (filters.hasta)
                params.set('hasta', filters.hasta);
            if (filters.tipo)
                params.set('tipo', filters.tipo);
            if (filters.cuentaId)
                params.set('cuentaId', filters.cuentaId);
            if (filters.categoriaId)
                params.set('categoriaId', filters.categoriaId);
            const { data } = await api.get(`/clientes/${cid}/transacciones?${params.toString()}`);
            return data.data;
        },
        enabled: !!cid,
    });
    const { data: cuentas = [] } = useQuery({
        queryKey: ['cuentas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/cuentas`)).data.data,
        enabled: !!cid,
    });
    const { data: categorias = [] } = useQuery({
        queryKey: ['categorias'],
        queryFn: async () => (await api.get('/categorias')).data.data,
    });
    const { data: personas = [] } = useQuery({
        queryKey: ['personas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
        enabled: !!cid,
    });
    const { data: deudas = [] } = useQuery({
        queryKey: ['deudas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/deudas`)).data.data,
        enabled: !!cid,
    });
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['transacciones'] });
        qc.invalidateQueries({ queryKey: ['deudas'] });
        qc.invalidateQueries({ queryKey: ['cuentas'] });
    };
    // Build API payload from form — extract deudaId separately
    const buildPayload = (f) => {
        const { personaId, deudaId, ...rest } = f;
        return {
            ...rest,
            monto: parseFloat(f.monto),
            fecha: f.fecha ? new Date(f.fecha + 'T00:00:00').toISOString() : new Date().toISOString(),
            cuentaId: f.cuentaId || null,
            categoriaId: f.categoriaId || null,
            subcategoriaId: f.subcategoriaId || null,
            frecuencia: 'UNICA',
            // Only send deudaId when tipo=PAGO_DEUDA and a deuda is selected
            ...(f.tipo === 'PAGO_DEUDA' && deudaId ? { deudaId } : {}),
        };
    };
    const createTx = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/transacciones`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Transacción creada'); },
        onError: (e) => {
            const msg = e?.response?.data?.error ?? e?.message ?? 'Error al crear la transacción';
            showToast(msg, 'error');
        },
    });
    const updateTx = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/transacciones/${id}`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Transacción actualizada'); },
        onError: (e) => {
            const msg = e?.response?.data?.error ?? e?.message ?? 'Error al actualizar la transacción';
            showToast(msg, 'error');
        },
    });
    const deleteTx = useMutation({
        mutationFn: (id) => api.delete(`/transacciones/${id}`),
        onSuccess: () => { invalidate(); setModal(null); showToast('Transacción eliminada'); },
        onError: (e) => {
            const msg = e?.response?.data?.error ?? e?.message ?? 'Error al eliminar la transacción';
            showToast(msg, 'error');
        },
    });
    const transactions = txData?.items ?? [];
    const total = txData?.total ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    // Summary cards computed from current page
    const summary = useMemo(() => {
        const ingresos = transactions
            .filter(t => t.tipo === 'INGRESO')
            .reduce((s, t) => s + parseFloat(String(t.monto)), 0);
        const gastos = transactions
            .filter(t => t.tipo === 'GASTO')
            .reduce((s, t) => s + parseFloat(String(t.monto)), 0);
        return { ingresos, gastos, balance: ingresos - gastos };
    }, [transactions]);
    const setFilter = (key) => (e) => {
        setPage(0);
        setFilters(p => ({ ...p, [key]: e.target.value }));
    };
    const clearFilters = () => {
        setPage(0);
        setFilters(EMPTY_FILTERS);
    };
    const hasFilters = Object.values(filters).some(v => v !== '');
    const formatCurrency = (n) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n);
    const fromItem = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const toItem = Math.min((page + 1) * PAGE_SIZE, total);
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Transacciones" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Registro completo de movimientos financieros" })] }), _jsxs("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), "Nueva transacci\u00F3n"] })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-text-muted text-sm", children: [_jsx(FunnelIcon, { className: "w-4 h-4" }), _jsx("span", { className: "font-medium", children: "Filtros" }), hasFilters && (_jsx("button", { onClick: clearFilters, className: "ml-auto text-xs text-text-muted hover:text-text-primary underline transition-colors", children: "Limpiar filtros" }))] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3", children: [_jsx("div", { className: "lg:col-span-2", children: _jsx("input", { value: filters.search, onChange: setFilter('search'), placeholder: "Buscar por concepto\u2026", className: "input" }) }), _jsx("div", { children: _jsx("input", { type: "date", value: filters.desde, onChange: setFilter('desde'), className: "input", title: "Desde" }) }), _jsx("div", { children: _jsx("input", { type: "date", value: filters.hasta, onChange: setFilter('hasta'), className: "input", title: "Hasta" }) }), _jsx("div", { children: _jsxs("select", { value: filters.tipo, onChange: setFilter('tipo'), className: "input", children: [_jsx("option", { value: "", children: "Todos los tipos" }), Object.keys(TIPO_LABELS).map(t => (_jsx("option", { value: t, children: TIPO_LABELS[t] }, t)))] }) }), _jsx("div", { children: _jsxs("select", { value: filters.cuentaId, onChange: setFilter('cuentaId'), className: "input", children: [_jsx("option", { value: "", children: "Todas las cuentas" }), cuentas.map(c => (_jsx("option", { value: c.id, children: c.alias ?? c.banco }, c.id)))] }) })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3", children: _jsx("div", { className: "lg:col-span-2", children: _jsxs("select", { value: filters.categoriaId, onChange: setFilter('categoriaId'), className: "input", children: [_jsx("option", { value: "", children: "Todas las categor\u00EDas" }), categorias.map(c => (_jsxs("option", { value: c.id, children: [c.icono ? `${c.icono} ` : '', c.nombre] }, c.id)))] }) }) })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Ingresos (p\u00E1gina)" }), _jsx("p", { className: "text-lg font-semibold amount-positive tabular", children: formatCurrency(summary.ingresos) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Gastos (p\u00E1gina)" }), _jsx("p", { className: "text-lg font-semibold amount-negative tabular", children: formatCurrency(summary.gastos) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Balance neto" }), _jsx("p", { className: `text-lg font-semibold tabular ${summary.balance >= 0 ? 'amount-positive' : 'amount-negative'}`, children: formatCurrency(summary.balance) })] })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm table-zebra", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border bg-background/60", children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Fecha" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Concepto" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Categor\u00EDa" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Cuenta" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Monto" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Tipo" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Estado" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Acciones" })] }) }), _jsxs("tbody", { children: [txLoading && _jsx(SkeletonRows, {}), !txLoading && transactions.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-16 text-center text-text-muted text-sm", children: "No hay transacciones para los filtros seleccionados" }) })), !txLoading && transactions.map(tx => (_jsxs("tr", { className: "border-b border-border/30 hover:bg-surface-elevated transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-text-secondary whitespace-nowrap", children: formatDate(tx.fecha) }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("span", { className: "text-text-primary font-medium", children: tx.concepto }), tx.notas && (_jsx("p", { className: "text-xs text-text-muted mt-0.5 truncate max-w-[200px]", children: tx.notas }))] }), _jsx("td", { className: "px-4 py-3", children: tx.categoria ? (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("div", { className: "w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: tx.categoria.color ?? '#94a3b8' } }), _jsxs("span", { className: "text-text-secondary text-xs", children: [tx.categoria.icono && _jsx("span", { className: "mr-0.5", children: tx.categoria.icono }), tx.categoria.nombre] })] })) : (_jsx("span", { className: "text-text-muted text-xs", children: "\u2014" })) }), _jsx("td", { className: "px-4 py-3", children: tx.cuentaBancaria ? (_jsx("span", { className: "text-text-secondary text-xs", children: tx.cuentaBancaria.alias ?? tx.cuentaBancaria.banco })) : (_jsx("span", { className: "text-text-muted text-xs", children: "\u2014" })) }), _jsx("td", { className: "px-4 py-3 text-right", children: formatMonto(tx.monto, tx.tipo) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[tx.tipo]}`, children: TIPO_LABELS[tx.tipo] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[tx.estado]}`, children: tx.estado.charAt(0) + tx.estado.slice(1).toLowerCase() }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center justify-center gap-1", children: [_jsx("button", { onClick: () => setModal({ type: 'edit', tx }), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", title: "Editar", children: _jsx(PencilIcon, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => setModal({ type: 'delete', tx }), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors", title: "Eliminar", children: _jsx(TrashIcon, { className: "w-4 h-4" }) })] }) })] }, tx.id)))] })] }) }), total > 0 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-border bg-background/30", children: [_jsxs("span", { className: "text-xs text-text-muted", children: ["Mostrando ", fromItem, "\u2013", toItem, " de ", total, " transacciones"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => setPage(p => p - 1), disabled: page === 0, className: "btn-ghost px-2 py-1.5 flex items-center gap-1 text-xs disabled:opacity-40", children: [_jsx(ChevronLeftIcon, { className: "w-4 h-4" }), "Anterior"] }), _jsxs("span", { className: "text-xs text-text-muted px-1", children: [page + 1, " / ", totalPages] }), _jsxs("button", { onClick: () => setPage(p => p + 1), disabled: page >= totalPages - 1, className: "btn-ghost px-2 py-1.5 flex items-center gap-1 text-xs disabled:opacity-40", children: ["Siguiente", _jsx(ChevronRightIcon, { className: "w-4 h-4" })] })] })] }))] }), modal?.type === 'new' && (_jsx(Modal, { title: "Nueva transacci\u00F3n", onClose: () => setModal(null), wide: true, children: _jsx(TransaccionForm, { cuentas: cuentas, categorias: categorias, personas: personas, deudas: deudas, onClose: () => setModal(null), loading: createTx.isPending, onSubmit: d => createTx.mutate(buildPayload(d)) }) })), modal?.type === 'edit' && (_jsx(Modal, { title: "Editar transacci\u00F3n", onClose: () => setModal(null), wide: true, children: _jsx(TransaccionForm, { initial: {
                        fecha: modal.tx.fecha.slice(0, 10),
                        concepto: modal.tx.concepto,
                        monto: String(modal.tx.monto),
                        tipo: modal.tx.tipo,
                        estado: modal.tx.estado,
                        cuentaId: modal.tx.cuentaId ?? '',
                        categoriaId: modal.tx.categoriaId ?? '',
                        subcategoriaId: modal.tx.subcategoriaId ?? '',
                        notas: modal.tx.notas ?? '',
                        personaId: '',
                        deudaId: '',
                    }, cuentas: cuentas, categorias: categorias, personas: personas, deudas: deudas, onClose: () => setModal(null), loading: updateTx.isPending, onSubmit: d => updateTx.mutate({ id: modal.tx.id, d: buildPayload(d) }) }) })), modal?.type === 'delete' && (_jsxs(Modal, { title: "Eliminar transacci\u00F3n", onClose: () => setModal(null), children: [_jsxs("p", { className: "text-text-secondary text-sm mb-2", children: ["\u00BFSeguro que quieres eliminar la transacci\u00F3n", ' ', _jsx("strong", { className: "text-text-primary", children: modal.tx.concepto }), "?"] }), _jsx("p", { className: "text-text-muted text-xs mb-6", children: "Esta acci\u00F3n no se puede deshacer." }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: deleteTx.isPending, onClick: () => deleteTx.mutate(modal.tx.id), children: deleteTx.isPending ? 'Eliminando…' : 'Eliminar' })] })] }))] }));
}
