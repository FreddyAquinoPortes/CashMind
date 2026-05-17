import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, Tooltip, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, } from 'recharts';
import { Icon } from '@iconify/react';
import { ArrowUpRight, TrendingDown, CreditCard, AlertCircle, TrendingUp, Wallet, Calendar, } from 'lucide-react';
// ── Helpers ────────────────────────────────────────────────────────────────
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function mesLabel(ym) {
    const [, m] = ym.split('-');
    return MESES_CORTOS[parseInt(m ?? '0') - 1] ?? ym;
}
const fmtK = (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));
const PALETTE = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ec4899',
    '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];
// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className }) {
    return _jsx("div", { className: `animate-pulse bg-white/5 rounded-lg ${className}` });
}
// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon, variant = 'default' }) {
    const colors = { default: 'text-text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-border-strong transition-colors", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-medium text-text-muted uppercase tracking-wide", children: title }), _jsx("span", { className: "text-text-muted", children: icon })] }), _jsxs("div", { children: [_jsx("div", { className: `text-2xl font-bold tabular ${colors[variant]}`, children: value }), subtitle && _jsx("div", { className: "text-xs text-text-muted mt-0.5", children: subtitle })] })] }));
}
// ── Custom tooltip for area chart ──────────────────────────────────────────
function TendenciaTooltip({ active, payload, label }) {
    if (!active || !payload?.length)
        return null;
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-sm", children: [_jsx("p", { className: "text-text-muted text-xs mb-2 font-medium", children: mesLabel(label) }), payload.map((p) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full", style: { backgroundColor: p.color } }), _jsxs("span", { className: "text-text-secondary", children: [p.dataKey === 'ingresos' ? 'Ingresos' : 'Gastos', ":"] }), _jsx("span", { className: "font-semibold text-text-primary", children: formatCurrency(p.value) })] }, p.dataKey)))] }));
}
// ── Custom tooltip for pie chart ───────────────────────────────────────────
function CatTooltip({ active, payload }) {
    if (!active || !payload?.length)
        return null;
    const d = payload[0];
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-sm", children: [_jsx("p", { className: "font-semibold text-text-primary", children: d.name }), _jsx("p", { className: "text-text-muted", children: formatCurrency(d.value) }), _jsxs("p", { className: "text-xs text-text-muted", children: [d.payload.pct, "% del total"] })] }));
}
// ── Health score ───────────────────────────────────────────────────────────
function healthScore(data) {
    let score = 100;
    // Debt/income ratio
    const debtRatio = data.ingresosMes > 0 ? data.totalDeudas / (data.ingresosMes * 12) : 1;
    if (debtRatio > 0.5)
        score -= 30;
    else if (debtRatio > 0.3)
        score -= 15;
    // Spending ratio
    const spendRatio = data.ingresosMes > 0 ? data.gastosMes / data.ingresosMes : 1;
    if (spendRatio > 0.9)
        score -= 25;
    else if (spendRatio > 0.7)
        score -= 10;
    // Positive balance
    if (data.balanceTotal < 0)
        score -= 20;
    else if (data.balanceTotal < 5000)
        score -= 5;
    // Upcoming payments
    if (data.proximosPagos.length > 5)
        score -= 5;
    score = Math.max(0, Math.min(100, score));
    const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
    const label = score >= 70 ? 'Finanzas saludables'
        : score >= 40 ? 'Ratio deuda/ingreso elevado. Revisa Proyecciones.'
            : 'Situación crítica. Reduce gastos y deudas.';
    return { score, color, label };
}
// ── Main page ─────────────────────────────────────────────────────────────
export function DashboardPage() {
    const cliente = useAuthStore(s => s.clienteActivo);
    const cid = cliente?.id ?? '';
    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/dashboard`)).data.data,
        enabled: !!cid,
        staleTime: 60_000,
    });
    // Pie chart data
    const pieData = useMemo(() => {
        if (!data?.gastosPorCategoria?.length)
            return [];
        const total = data.gastosPorCategoria.reduce((s, c) => s + c.total, 0);
        return data.gastosPorCategoria.map((c, i) => ({
            name: c.nombre,
            value: c.total,
            icono: c.icono,
            pct: total > 0 ? Math.round((c.total / total) * 100) : 0,
            fill: PALETTE[i % PALETTE.length],
        }));
    }, [data]);
    const health = useMemo(() => data ? healthScore(data) : null, [data]);
    const ahorro = data ? data.ingresosMes - data.gastosMes : 0;
    const tasaAhorro = data?.ingresosMes ? Math.round((ahorro / data.ingresosMes) * 100) : 0;
    return (_jsxs("div", { className: "space-y-5 animate-fade-in", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-text-primary", children: "Dashboard" }), _jsxs("p", { className: "text-sm text-text-muted mt-0.5", children: [cliente?.nombre, " \u00B7 ", new Date().toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })] })] }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3", children: isLoading ? (Array.from({ length: 4 }).map((_, i) => _jsx(Skeleton, { className: "h-24" }, i))) : (_jsxs(_Fragment, { children: [_jsx(KpiCard, { title: "Balance total", value: formatCurrency(data?.balanceTotal ?? 0), subtitle: "Cuentas activas", icon: _jsx(Wallet, { size: 16 }), variant: (data?.balanceTotal ?? 0) >= 0 ? 'success' : 'danger' }), _jsx(KpiCard, { title: "Deuda activa", value: formatCurrency(data?.totalDeudas ?? 0), subtitle: `${data?.deudasActivas ?? 0} deuda${(data?.deudasActivas ?? 0) !== 1 ? 's' : ''} activa${(data?.deudasActivas ?? 0) !== 1 ? 's' : ''}`, icon: _jsx(TrendingDown, { size: 16 }), variant: "danger" }), _jsx(KpiCard, { title: "Gastos del mes", value: formatCurrency(data?.gastosMes ?? 0), subtitle: `Ingresos: ${formatCurrency(data?.ingresosMes ?? 0)}`, icon: _jsx(CreditCard, { size: 16 }), variant: (data?.gastosMes ?? 0) > (data?.ingresosMes ?? 0) ? 'danger' : 'warning' }), _jsx(KpiCard, { title: "Pr\u00F3x. pagos", value: String(data?.proximosPagos?.length ?? 0), subtitle: "Pr\u00F3ximos 7 d\u00EDas", icon: _jsx(AlertCircle, { size: 16 }), variant: (data?.proximosPagos?.length ?? 0) > 0 ? 'warning' : 'default' })] })) }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Tendencia mensual" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Ingresos vs. gastos \u2014 \u00FAltimos 6 meses" })] }), _jsx(TrendingUp, { size: 16, className: "text-text-muted" })] }), isLoading ? (_jsx(Skeleton, { className: "h-48" })) : (data?.tendenciaMensual?.length ?? 0) === 0 ? (_jsx("div", { className: "h-48 flex items-center justify-center text-text-muted text-sm", children: "Sin transacciones registradas" })) : (_jsx(ResponsiveContainer, { width: "100%", height: 200, children: _jsxs(AreaChart, { data: data.tendenciaMensual, margin: { top: 4, right: 4, left: -20, bottom: 0 }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "gradIngresos", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#22c55e", stopOpacity: 0.25 }), _jsx("stop", { offset: "95%", stopColor: "#22c55e", stopOpacity: 0 })] }), _jsxs("linearGradient", { id: "gradGastos", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#ef4444", stopOpacity: 0.25 }), _jsx("stop", { offset: "95%", stopColor: "#ef4444", stopOpacity: 0 })] })] }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#ffffff08" }), _jsx(XAxis, { dataKey: "mes", tickFormatter: mesLabel, tick: { fontSize: 11, fill: '#6b7280' }, axisLine: false, tickLine: false }), _jsx(YAxis, { tickFormatter: fmtK, tick: { fontSize: 11, fill: '#6b7280' }, axisLine: false, tickLine: false }), _jsx(Tooltip, { content: _jsx(TendenciaTooltip, {}) }), _jsx(Area, { type: "monotone", dataKey: "ingresos", stroke: "#22c55e", strokeWidth: 2, fill: "url(#gradIngresos)", dot: false }), _jsx(Area, { type: "monotone", dataKey: "gastos", stroke: "#ef4444", strokeWidth: 2, fill: "url(#gradGastos)", dot: false }), _jsx(Legend, { formatter: (v) => v === 'ingresos' ? 'Ingresos' : 'Gastos', wrapperStyle: { fontSize: 11, color: '#9ca3af' } })] }) }))] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Gastos por categor\u00EDa" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Distribuci\u00F3n del mes actual" })] }), _jsx(ArrowUpRight, { size: 16, className: "text-text-muted" })] }), isLoading ? (_jsx(Skeleton, { className: "h-48" })) : pieData.length === 0 ? (_jsxs("div", { className: "h-48 flex flex-col items-center justify-center gap-2 text-text-muted text-sm", children: [_jsx(Icon, { icon: "tabler:chart-pie", className: "w-10 h-10 opacity-20" }), "Sin gastos categorizados este mes"] })) : (_jsxs("div", { className: "flex gap-4 items-center", children: [_jsx(ResponsiveContainer, { width: 160, height: 160, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: pieData, cx: "50%", cy: "50%", innerRadius: 42, outerRadius: 72, paddingAngle: 2, dataKey: "value", stroke: "none", children: pieData.map((d, i) => _jsx(Cell, { fill: d.fill }, i)) }), _jsx(Tooltip, { content: _jsx(CatTooltip, {}) })] }) }), _jsx("div", { className: "flex-1 flex flex-col gap-1.5 min-w-0", children: pieData.map((d, i) => (_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: d.fill } }), d.icono && (_jsx(Icon, { icon: d.icono.includes(':') ? d.icono : `tabler:${d.icono}`, className: "w-3.5 h-3.5 flex-shrink-0 text-text-muted" })), _jsx("span", { className: "text-xs text-text-secondary truncate flex-1", children: d.name }), _jsxs("span", { className: "text-xs font-semibold text-text-primary tabular flex-shrink-0", children: [d.pct, "%"] })] }, i))) })] }))] })] }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-5", children: [_jsx("div", { className: "flex items-center justify-between mb-4", children: _jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Este mes" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Ingresos \u00B7 Gastos \u00B7 Ahorro" })] }) }), isLoading ? _jsx(Skeleton, { className: "h-36" }) : (_jsxs(_Fragment, { children: [_jsx(ResponsiveContainer, { width: "100%", height: 120, children: _jsxs(BarChart, { data: [{ name: 'Mes', ingresos: data?.ingresosMes ?? 0, gastos: data?.gastosMes ?? 0 }], margin: { top: 0, right: 0, left: -30, bottom: 0 }, barGap: 6, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#ffffff08", vertical: false }), _jsx(XAxis, { dataKey: "name", hide: true }), _jsx(YAxis, { tickFormatter: fmtK, tick: { fontSize: 10, fill: '#6b7280' }, axisLine: false, tickLine: false }), _jsx(Tooltip, { formatter: (v, name) => [formatCurrency(v), name === 'ingresos' ? 'Ingresos' : 'Gastos'], contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 } }), _jsx(Bar, { dataKey: "ingresos", fill: "#22c55e", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "gastos", fill: "#ef4444", radius: [4, 4, 0, 0] })] }) }), _jsxs("div", { className: "mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-center", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-text-muted", children: "Tasa de ahorro" }), _jsxs("p", { className: `text-base font-bold ${tasaAhorro >= 0 ? 'text-success' : 'text-danger'}`, children: [tasaAhorro, "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-text-muted", children: "Neto" }), _jsx("p", { className: `text-base font-bold ${ahorro >= 0 ? 'text-success' : 'text-danger'}`, children: formatCurrency(ahorro) })] })] })] }))] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Pr\u00F3ximos pagos" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Eventos pendientes \u2014 7 d\u00EDas" })] }), _jsx(Calendar, { size: 15, className: "text-text-muted" })] }), isLoading ? (_jsx("div", { className: "flex flex-col gap-2", children: Array.from({ length: 3 }).map((_, i) => _jsx(Skeleton, { className: "h-10" }, i)) })) : (data?.proximosPagos?.length ?? 0) === 0 ? (_jsx("div", { className: "h-32 flex items-center justify-center text-text-muted text-sm", children: "Sin pagos pr\u00F3ximos" })) : (_jsx("div", { className: "flex flex-col gap-2", children: data.proximosPagos.slice(0, 5).map((p, i) => {
                                    const fecha = new Date(p.fecha);
                                    const hoy = new Date();
                                    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
                                    return (_jsxs("div", { className: "flex items-center gap-3 py-1.5", children: [_jsxs("div", { className: "w-9 h-9 rounded-lg bg-warning/10 flex flex-col items-center justify-center flex-shrink-0", children: [_jsx("span", { className: "text-[10px] font-bold text-warning leading-none", children: MESES_CORTOS[fecha.getMonth()] }), _jsx("span", { className: "text-sm font-bold text-warning leading-none", children: fecha.getDate() })] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-text-primary font-medium truncate", children: p.nombre }), _jsxs("p", { className: "text-xs text-text-muted", children: ["en ", diff, " d\u00EDa", diff !== 1 ? 's' : ''] })] }), Number(p.presupuestoEstimado) > 0 && (_jsxs("span", { className: "text-sm font-bold text-danger flex-shrink-0", children: ["-", formatCurrency(Number(p.presupuestoEstimado))] }))] }, i));
                                }) }))] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-5", children: [_jsx("div", { className: "flex items-center justify-between mb-4", children: _jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Salud financiera" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Indicadores del per\u00EDodo" })] }) }), isLoading || !health ? _jsx(Skeleton, { className: "h-36" }) : (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "relative w-16 h-16 flex-shrink-0", children: [_jsxs("svg", { className: "w-16 h-16 -rotate-90", viewBox: "0 0 64 64", children: [_jsx("circle", { cx: "32", cy: "32", r: "26", fill: "none", stroke: "#ffffff0a", strokeWidth: "8" }), _jsx("circle", { cx: "32", cy: "32", r: "26", fill: "none", stroke: health.color, strokeWidth: "8", strokeLinecap: "round", strokeDasharray: `${(health.score / 100) * 163.4} 163.4`, style: { transition: 'stroke-dasharray 1s ease' } })] }), _jsx("span", { className: "absolute inset-0 flex items-center justify-center text-lg font-bold", style: { color: health.color }, children: health.score })] }), _jsx("div", { className: "flex-1", children: _jsx("p", { className: "text-xs text-text-muted leading-relaxed", children: health.label }) })] }), _jsx("div", { className: "flex flex-col gap-2.5", children: [
                                            {
                                                label: 'Ratio deuda/ingreso anual',
                                                value: data.ingresosMes > 0
                                                    ? `${Math.round((data.totalDeudas / (data.ingresosMes * 12)) * 100)}%`
                                                    : '—',
                                                ok: data.ingresosMes > 0 && (data.totalDeudas / (data.ingresosMes * 12)) < 0.3,
                                            },
                                            {
                                                label: 'Tasa de gasto mensual',
                                                value: data.ingresosMes > 0
                                                    ? `${Math.round((data.gastosMes / data.ingresosMes) * 100)}%`
                                                    : '—',
                                                ok: data.ingresosMes > 0 && data.gastosMes < data.ingresosMes * 0.7,
                                            },
                                            {
                                                label: 'Balance positivo',
                                                value: data.balanceTotal >= 0 ? 'Sí' : 'No',
                                                ok: data.balanceTotal >= 0,
                                            },
                                        ].map((ind, i) => (_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-xs text-text-muted truncate flex-1", children: ind.label }), _jsxs("div", { className: "flex items-center gap-1.5 flex-shrink-0", children: [_jsx("span", { className: "text-xs font-semibold text-text-secondary", children: ind.value }), _jsx("span", { className: `w-1.5 h-1.5 rounded-full ${ind.ok ? 'bg-success' : 'bg-danger'}` })] })] }, i))) })] }))] })] })] }));
}
