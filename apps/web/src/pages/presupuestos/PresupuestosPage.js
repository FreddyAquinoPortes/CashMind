import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, } from 'recharts';
import { Icon } from '@iconify/react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { useFmt } from '../../lib/useFmt';
const FmtCtx = createContext(() => '');
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
// fmt is provided via FmtCtx — each component calls: const fmt = useContext(FmtCtx)
function periodoLabel(p) {
    const ini = new Date(p.fechaInicio);
    const fin = new Date(p.fechaFin);
    return `${ini.toLocaleDateString('es-DO', { month: 'short', day: 'numeric' })} – ${fin.toLocaleDateString('es-DO', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
const ESTADO_COLOR = {
    BORRADOR: 'bg-yellow-500/20 text-yellow-400',
    ACTIVO: 'bg-success/20 text-success',
    CERRADO: 'bg-text-muted/20 text-text-muted',
};
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#84cc16'];
const origenIcon = {
    evento_recurrente: 'tabler:calendar-repeat',
    deuda: 'tabler:credit-card',
    ruta_combustible: 'tabler:gas-station',
};
// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
function Modal({ title, onClose, wide, children }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: `bg-surface border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`, children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 p-6", children: children })] }) }));
}
// ── Mini pie chart showing expense distribution ───────────────────────────
function DistribucionChart({ lineas }) {
    const fmt = useContext(FmtCtx);
    const gastos = lineas.filter(l => l.tipo === 'GASTO' && l.montoPlaneado > 0);
    if (gastos.length === 0)
        return (_jsx("div", { className: "flex items-center justify-center h-48 text-text-muted text-sm", children: "A\u00F1ade l\u00EDneas de gastos para ver la distribuci\u00F3n" }));
    const data = gastos.map(l => ({ name: l.concepto, value: l.montoPlaneado }));
    return (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data, cx: "50%", cy: "50%", innerRadius: 50, outerRadius: 85, dataKey: "value", nameKey: "name", paddingAngle: 2, children: data.map((_, i) => _jsx(Cell, { fill: COLORS[i % COLORS.length] }, i)) }), _jsx(Tooltip, { formatter: (v) => fmt(v) }), _jsx(Legend, { iconType: "circle", iconSize: 8, formatter: (v) => _jsx("span", { className: "text-xs text-text-secondary", children: v.length > 18 ? v.slice(0, 17) + '…' : v }) })] }) }));
}
// ── Cumplimiento bar chart ────────────────────────────────────────────────
function CumplimientoChart({ lineas }) {
    const fmt = useContext(FmtCtx);
    const data = lineas.filter(l => l.montoPlaneado > 0).map(l => ({
        name: l.concepto.length > 14 ? l.concepto.slice(0, 13) + '…' : l.concepto,
        Planeado: l.montoPlaneado,
        Ejecutado: l.montoEjecutado,
        tipo: l.tipo,
    }));
    if (data.length === 0)
        return null;
    return (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: data, margin: { left: 0, right: 8, top: 4, bottom: 40 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#ffffff10" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 10, fill: '#9ca3af' }, angle: -30, textAnchor: "end", interval: 0 }), _jsx(YAxis, { tick: { fontSize: 10, fill: '#9ca3af' }, tickFormatter: (v) => `${(v / 1000).toFixed(0)}k` }), _jsx(Tooltip, { formatter: (v) => fmt(v) }), _jsx(Bar, { dataKey: "Planeado", fill: "#3b82f6", radius: [3, 3, 0, 0], opacity: 0.5 }), _jsx(Bar, { dataKey: "Ejecutado", fill: "#22c55e", radius: [3, 3, 0, 0] })] }) }));
}
// ── Line row in budget table ──────────────────────────────────────────────
function LineaRow({ linea, readOnly, onEdit, onDelete, onEjecutar, }) {
    const fmt = useContext(FmtCtx);
    const isIngreso = linea.tipo === 'INGRESO';
    const pct = linea.cumplimiento;
    return (_jsxs("tr", { className: "border-b border-border/50 hover:bg-surface-elevated/30 transition-colors", children: [_jsx("td", { className: "py-2.5 pl-4 pr-2", children: _jsxs("span", { className: `inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
          ${isIngreso ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`, children: [_jsx(Icon, { icon: isIngreso ? 'tabler:arrow-down-circle' : 'tabler:arrow-up-circle', className: "w-3 h-3" }), isIngreso ? 'Ingreso' : 'Gasto'] }) }), _jsx("td", { className: "py-2.5 px-2 text-sm text-text-primary font-medium", children: linea.concepto }), _jsx("td", { className: "py-2.5 px-2 text-sm text-right tabular-nums text-text-secondary", children: fmt(linea.montoPlaneado) }), _jsx("td", { className: "py-2.5 px-2 text-sm text-right tabular-nums", children: _jsx("span", { className: linea.montoEjecutado > 0 ? 'text-success font-medium' : 'text-text-muted', children: fmt(linea.montoEjecutado) }) }), _jsx("td", { className: "py-2.5 px-2 w-32", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 bg-border rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full transition-all", style: { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#3b82f6' } }) }), _jsxs("span", { className: "text-xs text-text-muted tabular-nums w-8 text-right", children: [pct.toFixed(0), "%"] })] }) }), _jsx("td", { className: "py-2.5 pr-3 pl-2", children: _jsx("div", { className: "flex items-center gap-1 justify-end", children: !readOnly && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => onEjecutar(linea), className: "p-1 rounded text-text-muted hover:text-success hover:bg-success/10 transition-colors", title: "Ejecutar", children: _jsx(Icon, { icon: "tabler:player-play", className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => onEdit(linea), className: "p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", title: "Editar", children: _jsx(Icon, { icon: "tabler:pencil", className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => onDelete(linea.id), className: "p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors", title: "Eliminar", children: _jsx(Icon, { icon: "tabler:trash", className: "w-3.5 h-3.5" }) })] })) }) })] }));
}
// ── Form to add/edit a line ───────────────────────────────────────────────
function LineaForm({ initial, onSubmit, onClose, loading, }) {
    const [tipo, setTipo] = useState(initial?.tipo ?? 'GASTO');
    const [concepto, setConcepto] = useState(initial?.concepto ?? '');
    const [monto, setMonto] = useState(initial?.montoPlaneado?.toString() ?? '');
    const [notas, setNotas] = useState(initial?.notas ?? '');
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit({ tipo, concepto, montoPlaneado: Number(monto), notas: notas || undefined }); }, className: "flex flex-col gap-4", children: [_jsx("div", { className: "flex rounded-lg overflow-hidden border border-border", children: ['INGRESO', 'GASTO'].map(t => (_jsx("button", { type: "button", onClick: () => setTipo(t), className: `flex-1 py-2 text-sm font-medium transition-colors
              ${tipo === t
                        ? t === 'INGRESO' ? 'bg-success text-white' : 'bg-danger text-white'
                        : 'text-text-muted hover:bg-surface-elevated'}`, children: t === 'INGRESO' ? '↓ Ingreso' : '↑ Gasto' }, t))) }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Concepto *", _jsx("input", { required: true, value: concepto, onChange: e => setConcepto(e.target.value), className: "input", placeholder: "Ej. N\u00F3mina mayo, Supermercado\u2026", autoFocus: true })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Monto planeado (DOP) *", _jsx("input", { required: true, type: "number", min: "0.01", step: "0.01", value: monto, onChange: e => setMonto(e.target.value), className: "input", placeholder: "0.00" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("input", { value: notas, onChange: e => setNotas(e.target.value), className: "input", placeholder: "Opcional\u2026" })] }), _jsxs("div", { className: "flex gap-2 justify-end pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
// ── Modal to create/activate a budget ────────────────────────────────────
function PresupuestoForm({ initial, onSubmit, onClose, loading, }) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const [tipo, setTipo] = useState(initial?.tipo ?? 'NORMAL');
    const [nombre, setNombre] = useState(initial?.nombre ??
        (tipo === 'ATOMICO'
            ? `Lista ${now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}`
            : `Presupuesto ${now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}`));
    const [ini, setIni] = useState(initial?.fechaInicio?.slice(0, 10) ?? `${y}-${m}-01`);
    const [fin, setFin] = useState(initial?.fechaFin?.slice(0, 10) ?? `${y}-${m}-${lastDay}`);
    const [notas, setNotas] = useState(initial?.notas ?? '');
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit({ nombre, tipo, fechaInicio: ini, fechaFin: fin, notas: notas || undefined }); }, className: "flex flex-col gap-4", children: [!initial?.id && (_jsxs("div", { className: "flex flex-col gap-1.5 text-sm text-text-secondary", children: [_jsx("span", { children: "Tipo de presupuesto" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                            { key: 'NORMAL', icon: 'tabler:layout-list', label: 'Normal', desc: 'Ingresos y gastos por período, ejecución línea por línea' },
                            { key: 'ATOMICO', icon: 'tabler:shopping-cart', label: 'Atómico', desc: 'Lista de ítems que se ejecuta como una sola transacción' },
                        ].map(t => (_jsxs("button", { type: "button", onClick: () => setTipo(t.key), className: `flex flex-col gap-1 p-3 rounded-xl border text-left transition-all
                  ${tipo === t.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`, children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Icon, { icon: t.icon, className: `w-4 h-4 ${tipo === t.key ? 'text-primary' : 'text-text-muted'}` }), _jsx("span", { className: `font-semibold text-sm ${tipo === t.key ? 'text-primary' : 'text-text-primary'}`, children: t.label })] }), _jsx("span", { className: "text-xs text-text-muted leading-snug", children: t.desc })] }, t.key))) })] })), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre *", _jsx("input", { required: true, value: nombre, onChange: e => setNombre(e.target.value), className: "input", autoFocus: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha inicio *", _jsx("input", { required: true, type: "date", value: ini, onChange: e => setIni(e.target.value), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha fin *", _jsx("input", { required: true, type: "date", value: fin, onChange: e => setFin(e.target.value), className: "input" })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("textarea", { value: notas, onChange: e => setNotas(e.target.value), className: "input resize-none", rows: 2 })] }), _jsxs("div", { className: "flex gap-2 justify-end pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Creando…' : 'Crear' })] })] }));
}
// ── Sugerencias panel ─────────────────────────────────────────────────────
function SugerenciasPanel({ sugerencias, onAgregar, onCerrar, }) {
    const fmt = useContext(FmtCtx);
    const [selected, setSelected] = useState(new Set(sugerencias.map((_, i) => i)));
    const toggle = (i) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(i))
            next.delete(i);
        else
            next.add(i);
        return next;
    });
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("p", { className: "text-sm text-text-secondary", children: "Selecciona las l\u00EDneas a importar a tu presupuesto. Las sugerencias provienen de eventos recurrentes, cuotas de deudas y rutas de combustible." }), _jsxs("div", { className: "flex flex-col gap-1 max-h-72 overflow-y-auto pr-1", children: [sugerencias.length === 0 && (_jsx("div", { className: "text-center text-text-muted text-sm py-6", children: "No se encontraron sugerencias para este per\u00EDodo." })), sugerencias.map((s, i) => (_jsxs("label", { className: "flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface-elevated cursor-pointer transition-colors", children: [_jsx("input", { type: "checkbox", checked: selected.has(i), onChange: () => toggle(i), className: "accent-primary" }), _jsx(Icon, { icon: origenIcon[s.origen] ?? 'tabler:circle-dot', className: "w-4 h-4 text-text-muted flex-shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm text-text-primary font-medium truncate", children: s.concepto }), _jsx("div", { className: "text-xs text-text-muted capitalize", children: s.origen.replace(/_/g, ' ') })] }), _jsxs("span", { className: `text-sm font-semibold tabular-nums ${s.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}`, children: [s.tipo === 'INGRESO' ? '+' : '-', fmt(s.montoPlaneado)] })] }, i)))] }), _jsxs("div", { className: "flex gap-2 justify-between pt-2 border-t border-border", children: [_jsx("button", { onClick: onCerrar, className: "btn-ghost", children: "Cancelar" }), _jsxs("button", { onClick: () => {
                            sugerencias.forEach((s, i) => { if (selected.has(i))
                                onAgregar(s); });
                            onCerrar();
                        }, className: "btn-primary", children: ["Importar ", selected.size, " l\u00EDnea", selected.size !== 1 ? 's' : ''] })] })] }));
}
// ── Ejecutar linea modal ──────────────────────────────────────────────────
function EjecutarLineaForm({ linea, onSubmit, onClose, loading, }) {
    const fmt = useContext(FmtCtx);
    const [monto, setMonto] = useState(linea.montoPlaneado.toString());
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [crearEvento, setCrearEvento] = useState(false);
    const [notas, setNotas] = useState('');
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit({ montoEjecutado: Number(monto), fecha, crearEvento, notas: notas || undefined }); }, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "rounded-lg bg-background p-3 text-sm", children: [_jsx("div", { className: "font-medium text-text-primary", children: linea.concepto }), _jsxs("div", { className: "text-text-muted mt-0.5", children: ["Planeado: ", _jsx("span", { className: "font-semibold tabular-nums", children: fmt(linea.montoPlaneado) })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Monto ejecutado (DOP) *", _jsx("input", { required: true, type: "number", min: "0.01", step: "0.01", value: monto, onChange: e => setMonto(e.target.value), className: "input", autoFocus: true })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha", _jsx("input", { type: "date", value: fecha, onChange: e => setFecha(e.target.value), className: "input" })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-text-secondary cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: crearEvento, onChange: e => setCrearEvento(e.target.checked), className: "accent-primary w-4 h-4" }), "Crear evento pendiente (en lugar de transacci\u00F3n directa)"] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("input", { value: notas, onChange: e => setNotas(e.target.value), className: "input", placeholder: "Opcional\u2026" })] }), _jsxs("div", { className: "flex gap-2 justify-end pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Ejecutando…' : crearEvento ? 'Crear evento' : 'Registrar transacción' })] })] }));
}
// ── Atomic budget checklist view ──────────────────────────────────────────
function AtomicoView({ presupuesto, onToggle, onDelete, onAddItem, onEjecutarTodo, ejecutando, }) {
    const fmt = useContext(FmtCtx);
    const lineas = presupuesto.lineas;
    const incluidas = lineas.filter(l => l.incluido);
    const total = incluidas.reduce((s, l) => s + l.montoPlaneado, 0);
    const totalTodo = lineas.reduce((s, l) => s + l.montoPlaneado, 0);
    const yaEjecutado = lineas.some(l => l.ejecuciones.length > 0);
    const cerrado = presupuesto.estado === 'CERRADO';
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-start gap-2", children: [_jsx(Icon, { icon: "tabler:info-circle", className: "w-4 h-4 flex-shrink-0 mt-0.5" }), _jsxs("span", { children: [_jsx("strong", { children: "Presupuesto at\u00F3mico" }), " \u2014 Desmarca los art\u00EDculos que no compraste, luego ejecuta todo de una vez. Se crear\u00E1 ", _jsx("strong", { children: "una sola transacci\u00F3n" }), " por el total de los \u00EDtems marcados."] })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-border/50", children: [_jsxs("span", { className: "text-sm font-semibold text-text-primary flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:shopping-cart", className: "w-4 h-4 text-primary" }), presupuesto.nombre] }), !cerrado && (_jsxs("button", { onClick: onAddItem, className: "flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors", children: [_jsx(Icon, { icon: "tabler:plus", className: "w-3.5 h-3.5" }), " A\u00F1adir \u00EDtem"] }))] }), lineas.length === 0 && (_jsx("div", { className: "py-10 text-center text-text-muted text-sm", children: "Lista vac\u00EDa. A\u00F1ade \u00EDtems para comenzar." })), _jsx("div", { className: "divide-y divide-border/40", children: lineas.map(l => {
                            const tachado = !l.incluido;
                            return (_jsxs("div", { className: `flex items-center gap-3 px-4 py-3 transition-colors
                  ${tachado ? 'opacity-50 bg-background/40' : 'hover:bg-surface-elevated/30'}`, children: [_jsx("input", { type: "checkbox", checked: l.incluido, disabled: cerrado || l.ejecuciones.length > 0, onChange: e => onToggle(l.id, e.target.checked), className: "accent-primary w-4 h-4 flex-shrink-0 cursor-pointer" }), _jsx("span", { className: `flex-1 text-sm ${tachado ? 'line-through text-text-muted' : 'text-text-primary'}`, children: l.concepto }), l.ejecuciones.length > 0 && (_jsx("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium flex-shrink-0", children: "\u2713 ejecutado" })), _jsx("span", { className: `text-sm font-semibold tabular-nums flex-shrink-0
                  ${tachado ? 'text-text-muted line-through' : 'text-text-primary'}`, children: fmt(l.montoPlaneado) }), !cerrado && l.ejecuciones.length === 0 && (_jsx("button", { onClick: () => onDelete(l.id), className: "p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0", children: _jsx(Icon, { icon: "tabler:x", className: "w-3.5 h-3.5" }) }))] }, l.id));
                        }) }), lineas.length > 0 && (_jsxs("div", { className: "border-t border-border px-4 py-3 flex items-center justify-between bg-background/50", children: [_jsxs("div", { className: "text-xs text-text-muted", children: [incluidas.length, " de ", lineas.length, " \u00EDtems \u00B7 descartado: ", fmt(totalTodo - total)] }), _jsxs("div", { className: "text-base font-bold text-text-primary tabular-nums", children: ["Total: ", _jsx("span", { className: "text-primary", children: fmt(total) })] })] }))] }), !cerrado && !yaEjecutado && (_jsx("div", { className: "flex justify-end", children: _jsxs("button", { onClick: onEjecutarTodo, disabled: ejecutando || incluidas.length === 0 || presupuesto.estado === 'BORRADOR', className: "btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx(Icon, { icon: "tabler:check", className: "w-4 h-4" }), ejecutando ? 'Ejecutando…' : `Ejecutar lista · ${fmt(total)}`] }) })), presupuesto.estado === 'BORRADOR' && !cerrado && (_jsx("p", { className: "text-xs text-text-muted text-right", children: "Activa el presupuesto para poder ejecutarlo." })), yaEjecutado && (_jsxs("div", { className: "rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:circle-check", className: "w-4 h-4" }), "Lista ejecutada. Transacci\u00F3n registrada en tus movimientos."] }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function PresupuestosPage() {
    const fmt = useFmt();
    const qc = useQueryClient();
    const clienteId = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const [tab, setTab] = useState('planificar');
    const [selectedId, setSelectedId] = useState(null);
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['presupuestos', clienteId] });
        qc.invalidateQueries({ queryKey: ['dashboard', clienteId] });
        qc.invalidateQueries({ queryKey: ['cuentas', clienteId] });
        qc.invalidateQueries({ queryKey: ['transacciones'] });
    };
    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: presupuestos = [], isLoading } = useQuery({
        queryKey: ['presupuestos', clienteId],
        queryFn: async () => {
            const { data } = await api.get(`/clientes/${clienteId}/presupuestos`);
            return data.data;
        },
        enabled: !!clienteId,
    });
    const presupuesto = useMemo(() => presupuestos.find(p => p.id === selectedId) ?? presupuestos[0] ?? null, [presupuestos, selectedId]);
    // Auto-select first
    const currentId = presupuesto?.id ?? null;
    // ── Mutations ─────────────────────────────────────────────────────────────
    const createPres = useMutation({
        mutationFn: (d) => api.post(`/clientes/${clienteId}/presupuestos`, d),
        onSuccess: (res) => { invalidate(); setModal(null); setSelectedId(res.data.data.id); showToast('Presupuesto creado'); },
        onError: () => showToast('Error al crear presupuesto', 'error'),
    });
    const updatePres = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/clientes/${clienteId}/presupuestos/${id}`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Presupuesto actualizado'); },
        onError: () => showToast('Error al actualizar', 'error'),
    });
    const deletePres = useMutation({
        mutationFn: (id) => api.delete(`/clientes/${clienteId}/presupuestos/${id}`),
        onSuccess: () => { invalidate(); setSelectedId(null); showToast('Presupuesto eliminado'); },
        onError: () => showToast('Error al eliminar', 'error'),
    });
    const addLinea = useMutation({
        mutationFn: ({ presupuestoId, d }) => api.post(`/clientes/${clienteId}/presupuestos/${presupuestoId}/lineas`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Línea añadida'); },
        onError: () => showToast('Error al añadir línea', 'error'),
    });
    const editLinea = useMutation({
        mutationFn: ({ lineaId, d }) => api.patch(`/presupuestos/lineas/${lineaId}`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Línea actualizada'); },
        onError: () => showToast('Error al actualizar línea', 'error'),
    });
    const deleteLinea = useMutation({
        mutationFn: (lineaId) => api.delete(`/presupuestos/lineas/${lineaId}`),
        onSuccess: () => { invalidate(); showToast('Línea eliminada'); },
        onError: () => showToast('Error al eliminar', 'error'),
    });
    const toggleIncluido = useMutation({
        mutationFn: ({ lineaId, incluido }) => api.patch(`/presupuestos/lineas/${lineaId}/incluido`, { incluido }),
        onSuccess: () => invalidate(),
        onError: () => showToast('Error al actualizar', 'error'),
    });
    const ejecutarAtomico = useMutation({
        mutationFn: ({ presupuestoId, d }) => api.post(`/clientes/${clienteId}/presupuestos/${presupuestoId}/ejecutar-atomico`, d),
        onSuccess: (res) => {
            invalidate();
            setModal(null);
            showToast(`✓ Ejecutado: ${res.data.data.itemsEjecutados} ítems · ${fmt(res.data.data.total)}`);
        },
        onError: (e) => showToast(e.message || 'Error al ejecutar', 'error'),
    });
    const ejecutarLinea = useMutation({
        mutationFn: ({ lineaId, d }) => api.post(`/clientes/${clienteId}/presupuestos/lineas/${lineaId}/ejecutar`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('¡Ejecutado! Transacción/evento creado'); },
        onError: () => showToast('Error al ejecutar', 'error'),
    });
    // ── Sugerencias ───────────────────────────────────────────────────────────
    const fetchSugerencias = async (p) => {
        try {
            const { data } = await api.get(`/clientes/${clienteId}/presupuestos/sugerencias`, {
                params: { fechaInicio: p.fechaInicio.slice(0, 10), fechaFin: p.fechaFin.slice(0, 10) },
            });
            setModal({ type: 'sugerencias', presupuestoId: p.id, sugerencias: data.data });
        }
        catch {
            showToast('Error al obtener sugerencias', 'error');
        }
    };
    // ── Render ────────────────────────────────────────────────────────────────
    const lineas = presupuesto?.lineas ?? [];
    const ingresos = lineas.filter(l => l.tipo === 'INGRESO');
    const gastos = lineas.filter(l => l.tipo === 'GASTO');
    const readOnly = presupuesto?.estado === 'CERRADO';
    return (_jsx(FmtCtx.Provider, { value: fmt, children: _jsxs("div", { className: "flex flex-col gap-6 max-w-7xl mx-auto", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between flex-wrap gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Presupuestos" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Planifica, ejecuta y eval\u00FAa tus finanzas por per\u00EDodo" })] }), _jsxs("button", { onClick: () => setModal({ type: 'newPresupuesto' }), className: "btn-primary flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:plus", className: "w-4 h-4" }), "Nuevo presupuesto"] })] }), isLoading && (_jsx("div", { className: "flex items-center justify-center h-48 text-text-muted", children: "Cargando\u2026" })), !isLoading && presupuestos.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center gap-4 py-20 text-center", children: [_jsx(Icon, { icon: "tabler:calculator", className: "w-14 h-14 text-text-muted opacity-40" }), _jsxs("div", { children: [_jsx("div", { className: "text-text-primary font-medium text-lg", children: "Sin presupuestos a\u00FAn" }), _jsx("div", { className: "text-text-muted text-sm mt-1", children: "Crea tu primer presupuesto para distribuir tus ingresos" })] }), _jsx("button", { onClick: () => setModal({ type: 'newPresupuesto' }), className: "btn-primary", children: "Crear mi primer presupuesto" })] })), presupuestos.length > 0 && (_jsxs("div", { className: "flex gap-6 flex-col xl:flex-row", children: [_jsxs("aside", { className: "xl:w-64 flex-shrink-0 flex flex-col gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-1", children: "Per\u00EDodos" }), presupuestos.map(p => (_jsxs("button", { onClick: () => setSelectedId(p.id), className: `w-full text-left px-4 py-3 rounded-xl border transition-all
                  ${currentId === p.id
                                        ? 'border-primary bg-primary/10 text-text-primary'
                                        : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-surface-elevated'}`, children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [p.tipo === 'ATOMICO' && _jsx(Icon, { icon: "tabler:shopping-cart", className: "w-3 h-3 text-text-muted flex-shrink-0" }), _jsx("span", { className: "font-medium text-sm truncate", children: p.nombre })] }), _jsx("div", { className: "text-xs text-text-muted mt-0.5", children: periodoLabel(p) }), _jsxs("div", { className: "flex items-center gap-1.5 mt-1.5", children: [_jsx("span", { className: `text-xs font-semibold inline-block px-1.5 py-0.5 rounded-full ${ESTADO_COLOR[p.estado]}`, children: p.estado }), p.tipo === 'ATOMICO' && (_jsx("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium", children: "At\u00F3mico" }))] })] }, p.id)))] }), presupuesto && (_jsxs("div", { className: "flex-1 min-w-0 flex flex-col gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl px-5 py-4", children: [_jsxs("div", { className: "flex items-start justify-between flex-wrap gap-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h2", { className: "text-lg font-bold text-text-primary", children: presupuesto.nombre }), _jsx("span", { className: `text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[presupuesto.estado]}`, children: presupuesto.estado })] }), _jsx("div", { className: "text-text-muted text-sm mt-0.5", children: periodoLabel(presupuesto) })] }), _jsxs("div", { className: "flex gap-2 flex-wrap", children: [presupuesto.estado === 'BORRADOR' && (_jsxs("button", { onClick: () => fetchSugerencias(presupuesto), className: "btn-ghost flex items-center gap-1.5 text-sm", children: [_jsx(Icon, { icon: "tabler:sparkles", className: "w-4 h-4 text-yellow-400" }), "Autocompletar"] })), presupuesto.estado === 'BORRADOR' && (_jsxs("button", { onClick: () => updatePres.mutate({ id: presupuesto.id, d: { estado: 'ACTIVO' } }), className: "btn-primary text-sm flex items-center gap-1.5", children: [_jsx(Icon, { icon: "tabler:player-play", className: "w-4 h-4" }), "Activar"] })), presupuesto.estado === 'ACTIVO' && (_jsxs("button", { onClick: () => updatePres.mutate({ id: presupuesto.id, d: { estado: 'CERRADO' } }), className: "btn-ghost text-sm flex items-center gap-1.5", children: [_jsx(Icon, { icon: "tabler:lock", className: "w-4 h-4" }), "Cerrar per\u00EDodo"] })), _jsx("button", { onClick: () => setModal({ type: 'editPresupuesto', presupuesto }), className: "btn-ghost text-sm flex items-center gap-1.5", children: _jsx(Icon, { icon: "tabler:pencil", className: "w-4 h-4" }) }), _jsx("button", { onClick: () => { if (confirm('¿Eliminar este presupuesto?'))
                                                                deletePres.mutate(presupuesto.id); }, className: "p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors", children: _jsx(Icon, { icon: "tabler:trash", className: "w-4 h-4" }) })] })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4", children: [
                                                { label: 'Ingresos planeados', value: presupuesto.resumen.ingresos, color: 'text-success' },
                                                { label: 'Gastos planeados', value: presupuesto.resumen.gastos, color: 'text-danger' },
                                                { label: 'Disponible', value: presupuesto.resumen.disponible, color: presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger' },
                                                { label: 'Cumplimiento', value: null, pct: presupuesto.resumen.cumplimientoGeneral, color: 'text-primary' },
                                            ].map((item, i) => (_jsxs("div", { className: "bg-background rounded-lg px-3 py-2.5", children: [_jsx("div", { className: "text-xs text-text-muted", children: item.label }), item.value !== null
                                                        ? _jsx("div", { className: `text-base font-bold tabular-nums mt-0.5 ${item.color}`, children: fmt(item.value) })
                                                        : _jsxs("div", { className: `text-base font-bold mt-0.5 ${item.color}`, children: [item.pct.toFixed(0), "%"] })] }, i))) })] }), presupuesto.tipo === 'ATOMICO' && (_jsx(AtomicoView, { presupuesto: presupuesto, onToggle: (lineaId, incluido) => toggleIncluido.mutate({ lineaId, incluido }), onDelete: id => deleteLinea.mutate(id), onAddItem: () => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'GASTO' }), onEjecutarTodo: () => setModal({ type: 'ejecutarAtomico', presupuesto }), ejecutando: ejecutarAtomico.isPending })), presupuesto.tipo === 'NORMAL' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex border-b border-border gap-1", children: [
                                                { key: 'planificar', label: 'Planificación', icon: 'tabler:layout-list' },
                                                { key: 'ejecutar', label: 'Ejecución', icon: 'tabler:player-play' },
                                                { key: 'historial', label: 'Gráficas', icon: 'tabler:chart-pie' },
                                            ].map(t => (_jsxs("button", { onClick: () => setTab(t.key), className: `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`, children: [_jsx(Icon, { icon: t.icon, className: "w-4 h-4" }), t.label] }, t.key))) }), tab === 'planificar' && (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-border/50 bg-success/5", children: [_jsxs("div", { className: "flex items-center gap-2 text-success font-semibold text-sm", children: [_jsx(Icon, { icon: "tabler:arrow-down-circle", className: "w-4 h-4" }), "Ingresos", _jsxs("span", { className: "text-xs font-normal text-text-muted", children: ["(", ingresos.length, " l\u00EDneas)"] })] }), !readOnly && (_jsxs("button", { onClick: () => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'INGRESO' }), className: "flex items-center gap-1 text-xs text-success hover:text-success/80 transition-colors", children: [_jsx(Icon, { icon: "tabler:plus", className: "w-3.5 h-3.5" }), " A\u00F1adir"] }))] }), ingresos.length > 0 ? (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-text-muted border-b border-border/50", children: [_jsx("th", { className: "py-2 pl-4 pr-2 text-left w-24", children: "Tipo" }), _jsx("th", { className: "py-2 px-2 text-left", children: "Concepto" }), _jsx("th", { className: "py-2 px-2 text-right", children: "Planeado" }), _jsx("th", { className: "py-2 px-2 text-right", children: "Ejecutado" }), _jsx("th", { className: "py-2 px-2 text-left w-36", children: "Progreso" }), _jsx("th", { className: "py-2 pr-3 pl-2 w-20" })] }) }), _jsx("tbody", { children: ingresos.map(l => (_jsx(LineaRow, { linea: l, readOnly: readOnly, onEdit: l => setModal({ type: 'editLinea', linea: l, presupuestoId: presupuesto.id }), onDelete: id => deleteLinea.mutate(id), onEjecutar: l => setModal({ type: 'ejecutarLinea', linea: l, presupuestoId: presupuesto.id }) }, l.id))) }), _jsx("tfoot", { children: _jsxs("tr", { className: "border-t border-border/50 bg-success/5", children: [_jsx("td", { colSpan: 2, className: "py-2 pl-4 text-xs font-semibold text-success", children: "Total ingresos" }), _jsx("td", { className: "py-2 px-2 text-right text-sm font-bold text-success tabular-nums", children: fmt(presupuesto.resumen.ingresos) }), _jsx("td", { className: "py-2 px-2 text-right text-sm font-bold text-success tabular-nums", children: fmt(presupuesto.resumen.ingresosEjecutados) }), _jsx("td", { colSpan: 2 })] }) })] })) : (_jsxs("div", { className: "py-6 text-center text-text-muted text-sm", children: ["Sin ingresos definidos.", ' ', !readOnly && _jsx("button", { onClick: () => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'INGRESO' }), className: "text-success underline", children: "A\u00F1adir ingreso" })] }))] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-border/50 bg-danger/5", children: [_jsxs("div", { className: "flex items-center gap-2 text-danger font-semibold text-sm", children: [_jsx(Icon, { icon: "tabler:arrow-up-circle", className: "w-4 h-4" }), "Gastos", _jsxs("span", { className: "text-xs font-normal text-text-muted", children: ["(", gastos.length, " l\u00EDneas)"] })] }), !readOnly && (_jsxs("button", { onClick: () => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'GASTO' }), className: "flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors", children: [_jsx(Icon, { icon: "tabler:plus", className: "w-3.5 h-3.5" }), " A\u00F1adir"] }))] }), gastos.length > 0 ? (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-text-muted border-b border-border/50", children: [_jsx("th", { className: "py-2 pl-4 pr-2 text-left w-24", children: "Tipo" }), _jsx("th", { className: "py-2 px-2 text-left", children: "Concepto" }), _jsx("th", { className: "py-2 px-2 text-right", children: "Planeado" }), _jsx("th", { className: "py-2 px-2 text-right", children: "Ejecutado" }), _jsx("th", { className: "py-2 px-2 text-left w-36", children: "Progreso" }), _jsx("th", { className: "py-2 pr-3 pl-2 w-20" })] }) }), _jsx("tbody", { children: gastos.map(l => (_jsx(LineaRow, { linea: l, readOnly: readOnly, onEdit: l => setModal({ type: 'editLinea', linea: l, presupuestoId: presupuesto.id }), onDelete: id => deleteLinea.mutate(id), onEjecutar: l => setModal({ type: 'ejecutarLinea', linea: l, presupuestoId: presupuesto.id }) }, l.id))) }), _jsxs("tfoot", { children: [_jsxs("tr", { className: "border-t border-border/50 bg-danger/5", children: [_jsx("td", { colSpan: 2, className: "py-2 pl-4 text-xs font-semibold text-danger", children: "Total gastos" }), _jsx("td", { className: "py-2 px-2 text-right text-sm font-bold text-danger tabular-nums", children: fmt(presupuesto.resumen.gastos) }), _jsx("td", { className: "py-2 px-2 text-right text-sm font-bold text-danger tabular-nums", children: fmt(presupuesto.resumen.gastosEjecutados) }), _jsx("td", { colSpan: 2 })] }), _jsxs("tr", { className: "border-t-2 border-border bg-background", children: [_jsx("td", { colSpan: 2, className: `py-2.5 pl-4 text-sm font-bold ${presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger'}`, children: presupuesto.resumen.disponible >= 0 ? '✓ Disponible' : '⚠ Déficit' }), _jsx("td", { className: `py-2.5 px-2 text-right text-sm font-bold tabular-nums ${presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger'}`, children: fmt(Math.abs(presupuesto.resumen.disponible)) }), _jsx("td", { colSpan: 3 })] })] })] })) : (_jsxs("div", { className: "py-6 text-center text-text-muted text-sm", children: ["Sin gastos definidos.", ' ', !readOnly && _jsx("button", { onClick: () => setModal({ type: 'newLinea', presupuestoId: presupuesto.id, tipoDefecto: 'GASTO' }), className: "text-danger underline", children: "A\u00F1adir gasto" })] }))] })] })), tab === 'ejecutar' && (_jsxs("div", { className: "flex flex-col gap-4", children: [presupuesto.estado === 'BORRADOR' && (_jsxs("div", { className: "rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400 flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:info-circle", className: "w-4 h-4 flex-shrink-0" }), "Activa el presupuesto primero para comenzar a ejecutar l\u00EDneas."] })), _jsxs("div", { className: "bg-surface border border-border rounded-xl px-5 py-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-sm font-medium text-text-secondary", children: "Cumplimiento general" }), _jsxs("span", { className: "text-lg font-bold text-primary tabular-nums", children: [presupuesto.resumen.cumplimientoGeneral.toFixed(0), "%"] })] }), _jsx("div", { className: "h-3 bg-border rounded-full overflow-hidden", children: _jsx("div", { className: "h-3 rounded-full transition-all duration-500", style: {
                                                                    width: `${Math.min(100, presupuesto.resumen.cumplimientoGeneral)}%`,
                                                                    backgroundColor: presupuesto.resumen.cumplimientoGeneral >= 90 ? '#22c55e'
                                                                        : presupuesto.resumen.cumplimientoGeneral >= 60 ? '#f59e0b' : '#3b82f6',
                                                                } }) }), _jsxs("div", { className: "flex justify-between text-xs text-text-muted mt-1.5", children: [_jsxs("span", { children: ["Ejecutado: ", fmt(presupuesto.resumen.gastosEjecutados)] }), _jsxs("span", { children: ["Planeado: ", fmt(presupuesto.resumen.gastos)] })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [lineas.filter(l => l.tipo === 'GASTO').map(l => (_jsxs("div", { className: "bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: l.concepto }), l.ejecuciones.length > 0 && (_jsxs("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium", children: [l.ejecuciones.length, "\u2713"] }))] }), _jsxs("div", { className: "flex items-center gap-3 mt-1.5", children: [_jsx("div", { className: "flex-1 h-1.5 bg-border rounded-full", children: _jsx("div", { className: "h-1.5 rounded-full transition-all", style: {
                                                                                            width: `${Math.min(100, l.cumplimiento)}%`,
                                                                                            backgroundColor: l.cumplimiento >= 100 ? '#22c55e' : l.cumplimiento >= 60 ? '#f59e0b' : '#3b82f6',
                                                                                        } }) }), _jsxs("span", { className: "text-xs text-text-muted tabular-nums whitespace-nowrap", children: [fmt(l.montoEjecutado), " / ", fmt(l.montoPlaneado)] })] })] }), presupuesto.estado === 'ACTIVO' && (_jsxs("button", { onClick: () => setModal({ type: 'ejecutarLinea', linea: l, presupuestoId: presupuesto.id }), className: "flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors", children: [_jsx(Icon, { icon: "tabler:player-play", className: "w-3.5 h-3.5" }), "Ejecutar"] }))] }, l.id))), gastos.length === 0 && (_jsx("div", { className: "text-center text-text-muted text-sm py-8", children: "No hay l\u00EDneas de gastos definidas." }))] })] })), tab === 'historial' && (_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsxs("div", { className: "text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:chart-pie", className: "w-4 h-4 text-primary" }), "Distribuci\u00F3n de gastos"] }), _jsx(DistribucionChart, { lineas: lineas })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsxs("div", { className: "text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:chart-bar", className: "w-4 h-4 text-primary" }), "Planeado vs Ejecutado"] }), _jsx(CumplimientoChart, { lineas: lineas })] }), _jsxs("div", { className: "md:col-span-2 bg-surface border border-border rounded-xl p-4", children: [_jsxs("div", { className: "text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2", children: [_jsx(Icon, { icon: "tabler:bulb", className: "w-4 h-4 text-yellow-400" }), "An\u00E1lisis del per\u00EDodo"] }), _jsxs("div", { className: "grid sm:grid-cols-3 gap-3 text-sm", children: [_jsxs("div", { className: "bg-background rounded-lg p-3", children: [_jsx("div", { className: "text-text-muted text-xs", children: "Ratio ahorro" }), _jsx("div", { className: `text-lg font-bold mt-0.5 ${presupuesto.resumen.disponible >= 0 ? 'text-success' : 'text-danger'}`, children: presupuesto.resumen.ingresos > 0
                                                                                ? `${((presupuesto.resumen.disponible / presupuesto.resumen.ingresos) * 100).toFixed(1)}%`
                                                                                : '—' }), _jsx("div", { className: "text-text-muted text-xs mt-0.5", children: "del ingreso disponible" })] }), _jsxs("div", { className: "bg-background rounded-lg p-3", children: [_jsx("div", { className: "text-text-muted text-xs", children: "L\u00EDneas ejecutadas" }), _jsxs("div", { className: "text-lg font-bold mt-0.5 text-primary", children: [lineas.filter(l => l.ejecuciones.length > 0).length, " / ", lineas.length] }), _jsx("div", { className: "text-text-muted text-xs mt-0.5", children: "l\u00EDneas con al menos 1 ejecuci\u00F3n" })] }), _jsxs("div", { className: "bg-background rounded-lg p-3", children: [_jsx("div", { className: "text-text-muted text-xs", children: "Mayor gasto" }), _jsx("div", { className: "text-base font-bold mt-0.5 text-danger truncate", children: gastos.sort((a, b) => b.montoPlaneado - a.montoPlaneado)[0]?.concepto ?? '—' }), _jsx("div", { className: "text-text-muted text-xs mt-0.5 tabular-nums", children: gastos[0] ? fmt(gastos.sort((a, b) => b.montoPlaneado - a.montoPlaneado)[0].montoPlaneado) : '' })] })] })] })] }))] }))] }))] })), modal?.type === 'newPresupuesto' && (_jsx(Modal, { title: "Nuevo presupuesto", onClose: () => setModal(null), children: _jsx(PresupuestoForm, { loading: createPres.isPending, onClose: () => setModal(null), onSubmit: d => createPres.mutate(d) }) })), modal?.type === 'editPresupuesto' && (_jsx(Modal, { title: "Editar presupuesto", onClose: () => setModal(null), children: _jsx(PresupuestoForm, { initial: modal.presupuesto, loading: updatePres.isPending, onClose: () => setModal(null), onSubmit: d => updatePres.mutate({ id: modal.presupuesto.id, d }) }) })), modal?.type === 'newLinea' && (_jsx(Modal, { title: "Nueva l\u00EDnea", onClose: () => setModal(null), children: _jsx(LineaForm, { initial: { tipo: modal.tipoDefecto ?? 'GASTO' }, loading: addLinea.isPending, onClose: () => setModal(null), onSubmit: d => addLinea.mutate({ presupuestoId: modal.presupuestoId, d }) }) })), modal?.type === 'editLinea' && (_jsx(Modal, { title: "Editar l\u00EDnea", onClose: () => setModal(null), children: _jsx(LineaForm, { initial: modal.linea, loading: editLinea.isPending, onClose: () => setModal(null), onSubmit: d => editLinea.mutate({ lineaId: modal.linea.id, d }) }) })), modal?.type === 'sugerencias' && (_jsx(Modal, { title: "\u2728 Autocompletar desde tu historial", onClose: () => setModal(null), wide: true, children: _jsx(SugerenciasPanel, { sugerencias: modal.sugerencias, onCerrar: () => setModal(null), onAgregar: s => addLinea.mutate({ presupuestoId: modal.presupuestoId, d: s }) }) })), modal?.type === 'ejecutarLinea' && (_jsx(Modal, { title: `Ejecutar: ${modal.linea.concepto}`, onClose: () => setModal(null), children: _jsx(EjecutarLineaForm, { linea: modal.linea, loading: ejecutarLinea.isPending, onClose: () => setModal(null), onSubmit: d => ejecutarLinea.mutate({ lineaId: modal.linea.id, d }) }) })), modal?.type === 'ejecutarAtomico' && (() => {
                    const p = modal.presupuesto;
                    const incluidas = p.lineas.filter(l => l.incluido);
                    const total = incluidas.reduce((s, l) => s + l.montoPlaneado, 0);
                    return (_jsx(Modal, { title: "Ejecutar lista completa", onClose: () => setModal(null), children: _jsx(EjecutarAtomicoConfirm, { presupuesto: p, total: total, itemCount: incluidas.length, loading: ejecutarAtomico.isPending, onClose: () => setModal(null), onSubmit: d => ejecutarAtomico.mutate({ presupuestoId: p.id, d }) }) }));
                })()] }) }));
}
// ── Confirm modal for atomic execution ───────────────────────────────────────
function EjecutarAtomicoConfirm({ presupuesto, total, itemCount, loading, onClose, onSubmit, }) {
    const fmt = useFmt();
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [notas, setNotas] = useState('');
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit({ fecha, notas: notas || undefined }); }, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex flex-col gap-1", children: [_jsxs("div", { className: "text-sm text-text-secondary", children: [itemCount, " \u00EDtems marcados se registrar\u00E1n como una sola transacci\u00F3n:"] }), _jsx("div", { className: "text-2xl font-bold text-primary tabular-nums", children: fmt(total) }), _jsx("div", { className: "text-xs text-text-muted", children: presupuesto.nombre })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha de transacci\u00F3n", _jsx("input", { type: "date", value: fecha, onChange: e => setFecha(e.target.value), className: "input" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas adicionales", _jsx("input", { value: notas, onChange: e => setNotas(e.target.value), className: "input", placeholder: "Opcional\u2026" })] }), _jsxs("p", { className: "text-xs text-text-muted", children: ["El presupuesto se cerrar\u00E1 autom\u00E1ticamente tras la ejecuci\u00F3n. Los \u00EDtems desmarcados ", _jsx("strong", { children: "no" }), " se incluir\u00E1n en la transacci\u00F3n."] }), _jsxs("div", { className: "flex gap-2 justify-end pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading || itemCount === 0, className: "btn-primary", children: loading ? 'Ejecutando…' : `Confirmar · ${fmt(total)}` })] })] }));
}
