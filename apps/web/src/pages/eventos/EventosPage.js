import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { useFmt } from '../../lib/useFmt';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, ChevronDownIcon, BookmarkIcon, } from '@heroicons/react/24/outline';
import { Icon } from '@iconify/react';
// ── Constants ──────────────────────────────────────────────────────────────
const TIPO_CONFIG = {
    PAGO_PROGRAMADO: { label: 'Pago programado', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: '#f59e0b', icon: '💳' },
    NOMINA: { label: 'Nómina', color: 'bg-green-500/15 text-green-400 border-green-500/30', dot: '#22c55e', icon: '💼' },
    CUMPLEANOS: { label: 'Cumpleaños', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30', dot: '#ec4899', icon: '🎂' },
    FERIADO: { label: 'Feriado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: '#3b82f6', icon: '🏖️' },
    OTRO: { label: 'Otro', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30', dot: '#6b7280', icon: '📌' },
};
const ESTADO_CONFIG = {
    PLANIFICADO: { label: 'Planificado', color: 'text-blue-400' },
    APARTADO: { label: 'Apartado', color: 'text-amber-400' },
    EJECUTADO: { label: 'Ejecutado', color: 'text-success' },
    CANCELADO: { label: 'Cancelado', color: 'text-text-muted line-through' },
};
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Parsea fechas ISO del API como fecha LOCAL (evita el desfase UTC-4 de RD)
const parseLocalDate = (iso) => {
    const part = iso.split('T')[0]; // "YYYY-MM-DD"
    const [y, m, d] = part.split('-').map(Number);
    return new Date(y, m - 1, d);
};
// fmt is provided per-component via useFmt() hook — see each component below
const fmtDate = (iso) => {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
};
const LS_KEY = 'cashmind_saved_periods';
const BUILT_IN_PERIODS = [
    { id: 'bimestral', nombre: 'Bimestral', durationDays: 60, anchorDay: 1 },
    { id: 'trimestral', nombre: 'Trimestral', durationDays: 90, anchorDay: 1 },
    { id: 'cuatrimestral', nombre: 'Cuatrimestral', durationDays: 120, anchorDay: 1 },
    { id: 'semestral', nombre: 'Semestral', durationDays: 180, anchorDay: 1 },
    { id: 'anual', nombre: 'Anual', durationDays: 365, anchorDay: 1 },
];
function loadSavedPeriods() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    }
    catch {
        return [];
    }
}
function persistSavedPeriods(periods) {
    localStorage.setItem(LS_KEY, JSON.stringify(periods));
}
function applyBuiltInPeriod(p) {
    const today = new Date();
    let start = new Date(today.getFullYear(), today.getMonth(), p.anchorDay);
    if (start > today)
        start = new Date(today.getFullYear(), today.getMonth() - 1, p.anchorDay);
    const end = new Date(start);
    end.setDate(end.getDate() + p.durationDays - 1);
    return { start, end };
}
function getWeekStart(d) {
    const s = new Date(d);
    s.setDate(s.getDate() - s.getDay());
    s.setHours(0, 0, 0, 0);
    return s;
}
// ── Recurring expansion ────────────────────────────────────────────────────
function occurrencesInMonth(ev, year, month) {
    const base = parseLocalDate(ev.fecha);
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const dates = [];
    if (!ev.recurrente || !ev.tipoRecurrencia) {
        if (base >= first && base <= last)
            dates.push(base);
        return dates;
    }
    let cur = new Date(base);
    const maxIter = 400;
    let i = 0;
    while (cur <= last && i++ < maxIter) {
        if (cur >= first)
            dates.push(new Date(cur));
        switch (ev.tipoRecurrencia) {
            case 'DIARIA':
                cur = new Date(cur);
                cur.setDate(cur.getDate() + 1);
                break;
            case 'SEMANAL':
                cur = new Date(cur);
                cur.setDate(cur.getDate() + 7);
                break;
            case 'MENSUAL':
                cur = new Date(cur);
                cur.setMonth(cur.getMonth() + 1);
                break;
            case 'ANUAL':
                cur = new Date(cur);
                cur.setFullYear(cur.getFullYear() + 1);
                break;
        }
        if (cur > last)
            break;
    }
    return dates;
}
function occursOnDate(ev, date) {
    const ds = toDateStr(date);
    const base = parseLocalDate(ev.fecha);
    if (!ev.recurrente || !ev.tipoRecurrencia) {
        return toDateStr(base) === ds;
    }
    let cur = new Date(base);
    let i = 0;
    while (cur <= date && i++ < 2000) {
        if (toDateStr(cur) === ds)
            return true;
        switch (ev.tipoRecurrencia) {
            case 'DIARIA':
                cur.setDate(cur.getDate() + 1);
                break;
            case 'SEMANAL':
                cur.setDate(cur.getDate() + 7);
                break;
            case 'MENSUAL':
                cur.setMonth(cur.getMonth() + 1);
                break;
            case 'ANUAL':
                cur.setFullYear(cur.getFullYear() + 1);
                break;
        }
    }
    return false;
}
// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: `bg-surface border border-border rounded-xl w-full shadow-2xl flex flex-col max-h-[90vh] ${wide ? 'max-w-xl' : 'max-w-md'}`, children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 px-6 pb-6", children: children })] }) }));
}
// ── CategoriaSelect ────────────────────────────────────────────────────────
function CategoriaSelect({ value, onChange, categorias, placeholder = '— Sin categoría —' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    const selected = categorias.find(c => c.id === value);
    return (_jsxs("div", { ref: ref, className: "relative", children: [_jsxs("button", { type: "button", onClick: () => setOpen(p => !p), className: "input w-full text-left flex items-center gap-2", children: [selected ? (_jsxs(_Fragment, { children: [selected.icono && (_jsx(Icon, { icon: selected.icono.includes(':') ? selected.icono : `tabler:${selected.icono}`, className: "w-4 h-4 flex-shrink-0", style: { color: selected.color ?? '#22c55e' } })), _jsx("span", { className: "text-text-primary flex-1 truncate", children: selected.nombre })] })) : (_jsx("span", { className: "text-text-muted flex-1", children: placeholder })), _jsx(ChevronDownIcon, { className: `w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}` })] }), open && (_jsxs("div", { className: "absolute z-[600] top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-2xl py-1 max-h-52 overflow-y-auto", children: [_jsx("button", { type: "button", onClick: () => { onChange(''); setOpen(false); }, className: `w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${!value ? 'text-primary font-medium' : 'text-text-muted'}`, children: placeholder }), categorias.map(c => (_jsxs("button", { type: "button", onClick: () => { onChange(c.id); setOpen(false); }, className: `w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-white/5 transition-colors
                ${value === c.id ? 'text-primary font-medium bg-primary/5' : 'text-text-secondary'}`, children: [c.icono ? (_jsx(Icon, { icon: c.icono.includes(':') ? c.icono : `tabler:${c.icono}`, className: "w-4 h-4 flex-shrink-0", style: { color: c.color ?? '#22c55e' } })) : (_jsx("span", { className: "w-4 h-4 rounded-full flex-shrink-0", style: { backgroundColor: c.color ?? '#22c55e' } })), _jsx("span", { className: "truncate", children: c.nombre })] }, c.id)))] }))] }));
}
function SubcategoriaSelect({ value, onChange, subcategorias, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    const selected = subcategorias.find(s => s.id === value);
    if (disabled)
        return (_jsx("div", { className: "input opacity-40 flex items-center gap-2 cursor-not-allowed select-none", children: _jsx("span", { className: "text-text-muted text-sm", children: "\u2014 Sin subcategor\u00EDa \u2014" }) }));
    return (_jsxs("div", { ref: ref, className: "relative", children: [_jsxs("button", { type: "button", onClick: () => setOpen(p => !p), className: "input w-full text-left flex items-center gap-2", children: [selected ? (_jsxs(_Fragment, { children: [selected.icono && (_jsx(Icon, { icon: selected.icono.includes(':') ? selected.icono : `tabler:${selected.icono}`, className: "w-4 h-4 flex-shrink-0", style: { color: selected.color ?? '#94a3b8' } })), _jsx("span", { className: "text-text-primary flex-1 truncate", children: selected.nombre })] })) : (_jsx("span", { className: "text-text-muted flex-1", children: "\u2014 Sin subcategor\u00EDa \u2014" })), _jsx(ChevronDownIcon, { className: `w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}` })] }), open && (_jsxs("div", { className: "absolute z-[600] top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-2xl py-1 max-h-44 overflow-y-auto", children: [_jsx("button", { type: "button", onClick: () => { onChange(''); setOpen(false); }, className: `w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${!value ? 'text-primary font-medium' : 'text-text-muted'}`, children: "\u2014 Sin subcategor\u00EDa \u2014" }), subcategorias.map(s => (_jsxs("button", { type: "button", onClick: () => { onChange(s.id); setOpen(false); }, className: `w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-white/5 transition-colors
                ${value === s.id ? 'text-primary font-medium bg-primary/5' : 'text-text-secondary'}`, children: [s.icono ? (_jsx(Icon, { icon: s.icono.includes(':') ? s.icono : `tabler:${s.icono}`, className: "w-4 h-4 flex-shrink-0", style: { color: s.color ?? '#94a3b8' } })) : (_jsx("span", { className: "w-2 h-2 rounded-full flex-shrink-0 ml-1", style: { backgroundColor: s.color ?? '#94a3b8' } })), _jsx("span", { className: "truncate", children: s.nombre })] }, s.id)))] }))] }));
}
// ── DatePicker ─────────────────────────────────────────────────────────────
function DatePicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const toLocal = (iso) => iso ? new Date(iso + 'T00:00:00') : new Date();
    const parsed = toLocal(value);
    const [viewYear, setViewYear] = useState(parsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed.getMonth());
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    useEffect(() => {
        if (value) {
            const d = toLocal(value);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [value]);
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [
        ...Array(firstDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0)
        cells.push(null);
    const select = (day) => {
        onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
        setOpen(false);
    };
    const prevM = () => { if (viewMonth === 0) {
        setViewYear(y => y - 1);
        setViewMonth(11);
    }
    else
        setViewMonth(m => m - 1); };
    const nextM = () => { if (viewMonth === 11) {
        setViewYear(y => y + 1);
        setViewMonth(0);
    }
    else
        setViewMonth(m => m + 1); };
    const displayValue = value
        ? toLocal(value).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';
    return (_jsxs("div", { ref: ref, className: "relative", children: [_jsxs("button", { type: "button", onClick: () => setOpen(p => !p), className: "input w-full text-left flex items-center gap-2 cursor-pointer", children: [_jsx(CalendarDaysIcon, { className: "w-4 h-4 text-text-muted flex-shrink-0" }), _jsx("span", { className: displayValue ? 'text-text-primary' : 'text-text-muted', children: displayValue || 'Seleccionar fecha…' })] }), open && (_jsxs("div", { className: "absolute z-[600] mt-1 left-0 bg-surface border border-border rounded-xl shadow-2xl p-4 w-72", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("button", { type: "button", onClick: prevM, className: "p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors", children: _jsx(ChevronLeftIcon, { className: "w-4 h-4" }) }), _jsxs("span", { className: "text-sm font-semibold text-text-primary select-none", children: [MESES[viewMonth], " ", viewYear] }), _jsx("button", { type: "button", onClick: nextM, className: "p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors", children: _jsx(ChevronRightIcon, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "grid grid-cols-7 mb-1", children: DIAS_SEMANA.map(d => (_jsx("div", { className: "text-center text-[10px] text-text-muted font-semibold uppercase py-1 select-none", children: d }, d))) }), _jsx("div", { className: "grid grid-cols-7 gap-0.5", children: cells.map((day, i) => {
                            if (!day)
                                return _jsx("div", {}, `e-${i}`);
                            const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                            const isSelected = dateStr === value;
                            const isToday = dateStr === todayStr;
                            return (_jsx("button", { type: "button", onClick: () => select(day), className: `h-8 w-full rounded-lg text-sm font-medium transition-colors select-none
                    ${isSelected
                                    ? 'bg-primary text-white shadow-sm'
                                    : isToday
                                        ? 'border border-primary text-primary'
                                        : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'}`, children: day }, day));
                        }) }), _jsxs("div", { className: "mt-3 pt-3 border-t border-border flex items-center justify-between", children: [_jsx("button", { type: "button", onClick: () => { onChange(todayStr); setOpen(false); }, className: "text-xs text-primary hover:underline font-medium", children: "Hoy" }), _jsx("button", { type: "button", onClick: () => setOpen(false), className: "text-xs text-text-muted hover:text-text-primary", children: "Cerrar" })] })] }))] }));
}
// ── PeriodDropdown ─────────────────────────────────────────────────────────
function PeriodDropdown({ periodType, customLabel, onSelect, onOpenCustom, savedPeriods, onApplySaved, onDeleteSaved }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    const pillLabel = periodType === 'dia' ? 'Hoy' : periodType === 'semana' ? 'Semana' : periodType === 'mes' ? 'Mes' : customLabel;
    return (_jsxs("div", { ref: ref, className: "relative", children: [_jsxs("button", { onClick: () => setOpen(p => !p), className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium", children: [pillLabel, _jsx(ChevronDownIcon, { className: `w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}` })] }), open && (_jsxs("div", { className: "absolute right-0 top-full mt-1 z-[300] bg-surface border border-border rounded-xl shadow-2xl w-56 py-1 overflow-hidden", children: [['dia', 'semana', 'mes'].map(t => (_jsx("button", { onClick: () => { onSelect(t); setOpen(false); }, className: `w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/5
                ${periodType === t ? 'text-primary font-medium' : 'text-text-secondary'}`, children: t === 'dia' ? 'Hoy' : t === 'semana' ? 'Esta semana' : 'Este mes' }, t))), _jsx("button", { onClick: () => { onOpenCustom(); setOpen(false); }, className: "w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-white/5 transition-colors", children: "Per\u00EDodo personalizado\u2026" }), _jsxs("div", { className: "border-t border-border mt-1 pt-1", children: [_jsx("p", { className: "px-4 py-1 text-[10px] text-text-muted uppercase tracking-wider", children: "Per\u00EDodos guardados" }), [...BUILT_IN_PERIODS, ...savedPeriods].map(p => (_jsxs("div", { className: "flex items-center group", children: [_jsx("button", { onClick: () => { onApplySaved(p); setOpen(false); }, className: "flex-1 text-left px-4 py-1.5 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors", children: p.nombre }), !BUILT_IN_PERIODS.find(b => b.id === p.id) && (_jsx("button", { onClick: () => onDeleteSaved(p.id), className: "opacity-0 group-hover:opacity-100 pr-3 text-xs text-text-muted hover:text-danger transition-all", children: "\u2715" }))] }, p.id)))] })] }))] }));
}
// ── CustomPeriodModal ──────────────────────────────────────────────────────
function CustomPeriodModal({ onClose, onApply, onSave }) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [startStr, setStartStr] = useState(todayStr);
    const [endStr, setEndStr] = useState(todayStr);
    const [saveName, setSaveName] = useState('');
    const [saving, setSaving] = useState(false);
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    const valid = startStr && endStr && start <= end;
    const days = valid ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1 : 0;
    const QUICK = [
        { label: 'Bimestral (2m)', days: 60 },
        { label: 'Trimestral (3m)', days: 90 },
        { label: 'Cuatrimestral (4m)', days: 120 },
        { label: 'Semestral (6m)', days: 180 },
        { label: 'Anual (12m)', days: 365 },
    ];
    const applyQuick = (d) => {
        const s = new Date();
        const e = new Date(s);
        e.setDate(e.getDate() + d - 1);
        setStartStr(toDateStr(s));
        setEndStr(toDateStr(e));
    };
    return (_jsx(Modal, { title: "Per\u00EDodo personalizado", onClose: onClose, wide: true, children: _jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-text-muted mb-2 font-medium", children: "Duraci\u00F3n r\u00E1pida" }), _jsx("div", { className: "flex flex-wrap gap-2", children: QUICK.map(q => (_jsx("button", { type: "button", onClick: () => applyQuick(q.days), className: "text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:border-primary/50 hover:text-primary transition-colors", children: q.label }, q.label))) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Desde", _jsx(DatePicker, { value: startStr, onChange: setStartStr })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Hasta", _jsx(DatePicker, { value: endStr, onChange: v => { if (v >= startStr)
                                        setEndStr(v); } })] })] }), valid && (_jsxs("p", { className: "text-xs text-text-muted text-center -mt-2", children: [days, " ", days === 1 ? 'día' : 'días', " (", startStr === endStr ? 'un solo día' : `${fmtDate(startStr)} — ${fmtDate(endStr)}`, ")"] })), saving ? (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { value: saveName, onChange: e => setSaveName(e.target.value), placeholder: "Nombre del per\u00EDodo\u2026", className: "input flex-1 text-sm", autoFocus: true }), _jsx("button", { type: "button", disabled: !saveName || !valid, onClick: () => { if (valid) {
                                onSave(saveName, start, end);
                                setSaving(false);
                            } }, className: "btn-primary text-xs px-3", children: "Guardar" }), _jsx("button", { type: "button", onClick: () => setSaving(false), className: "btn-ghost text-xs px-3", children: "\u00D7" })] })) : (_jsxs("button", { type: "button", onClick: () => setSaving(true), className: "text-xs text-text-muted hover:text-primary transition-colors self-start flex items-center gap-1", children: [_jsx(BookmarkIcon, { className: "w-3.5 h-3.5" }), " Guardar este per\u00EDodo"] })), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "button", disabled: !valid, onClick: () => { if (valid)
                                onApply(start, end); }, className: "btn-primary", children: "Aplicar" })] })] }) }));
}
// ── WeekStrip ──────────────────────────────────────────────────────────────
function WeekStrip({ ws, eventos, selectedStr, onSelectDay }) {
    const todayStr = toDateStr(new Date());
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ws);
        d.setDate(ws.getDate() + i);
        return d;
    });
    const evMap = useMemo(() => {
        const map = new Map();
        for (const d of days) {
            map.set(toDateStr(d), eventos.filter(ev => occursOnDate(ev, d)));
        }
        return map;
    }, [eventos, ws.toISOString()]);
    return (_jsx("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: _jsx("div", { className: "grid grid-cols-7", children: days.map(d => {
                const ds = toDateStr(d);
                const isToday = ds === todayStr;
                const isSel = ds === selectedStr;
                const dayEvs = evMap.get(ds) ?? [];
                return (_jsxs("button", { type: "button", onClick: () => onSelectDay(ds), className: `flex flex-col items-center py-4 px-1 min-h-[110px] transition-colors border-r border-border/40 last:border-r-0
                ${isSel ? 'bg-primary/10' : 'hover:bg-white/5'}`, children: [_jsx("span", { className: "text-[10px] text-text-muted uppercase mb-1", children: DIAS_SEMANA[d.getDay()] }), _jsx("span", { className: `w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mb-2
                ${isToday ? 'bg-primary text-white' : isSel ? 'text-primary' : 'text-text-secondary'}`, children: d.getDate() }), _jsxs("div", { className: "flex flex-col gap-0.5 w-full px-1", children: [dayEvs.slice(0, 3).map((ev, i) => (_jsx("div", { className: "w-full rounded text-[9px] px-1 py-0.5 truncate", style: { backgroundColor: (TIPO_CONFIG[ev.tipo]?.dot ?? '#6b7280') + '30', color: TIPO_CONFIG[ev.tipo]?.dot ?? '#6b7280' }, children: ev.nombre }, `${ev.id}-${i}`))), dayEvs.length > 3 && (_jsxs("span", { className: "text-[9px] text-text-muted text-center", children: ["+", dayEvs.length - 3] }))] })] }, ds));
            }) }) }));
}
// ── CalendarGrid ───────────────────────────────────────────────────────────
function CalendarGrid({ year, month, eventos, selectedDay, onSelectDay, rangeStart, rangeEnd }) {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const dayMap = useMemo(() => {
        const map = new Map();
        for (const ev of eventos) {
            const dates = occurrencesInMonth(ev, year, month);
            for (const d of dates) {
                const day = d.getDate();
                if (!map.has(day))
                    map.set(day, []);
                map.get(day).push(ev);
            }
        }
        return map;
    }, [eventos, year, month]);
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [
        ...Array(firstDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0)
        cells.push(null);
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsx("div", { className: "grid grid-cols-7 border-b border-border", children: DIAS_SEMANA.map(d => (_jsx("div", { className: "py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wide", children: d }, d))) }), _jsx("div", { className: "grid grid-cols-7", children: cells.map((day, i) => {
                    if (!day)
                        return (_jsx("div", { className: "min-h-[72px] border-b border-r border-border/40 bg-background/20" }, `empty-${i}`));
                    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const isToday = isCurrentMonth && day === today.getDate();
                    const isSelected = day === selectedDay;
                    const inRange = rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd;
                    const dayEvents = dayMap.get(day) ?? [];
                    const hasExec = dayEvents.some(e => e.estado === 'PLANIFICADO' && (e.tipo === 'PAGO_PROGRAMADO' || e.tipo === 'NOMINA'));
                    return (_jsxs("button", { type: "button", onClick: () => onSelectDay(isSelected ? null : day), className: `min-h-[72px] border-b border-r border-border/40 p-1.5 text-left flex flex-col transition-colors
                ${isSelected ? 'bg-primary/10' : inRange ? 'bg-primary/5' : 'hover:bg-white/5'}`, children: [_jsx("span", { className: `text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                ${isToday ? 'bg-primary text-white' : isSelected ? 'text-primary' : 'text-text-secondary'}`, children: day }), _jsxs("div", { className: "flex flex-wrap gap-0.5 flex-1", children: [dayEvents.slice(0, 4).map((ev, idx) => (_jsx("span", { className: "w-1.5 h-1.5 rounded-full flex-shrink-0", style: { backgroundColor: TIPO_CONFIG[ev.tipo]?.dot ?? '#6b7280' }, title: ev.nombre }, `${ev.id}-${idx}`))), dayEvents.length > 4 && (_jsxs("span", { className: "text-[9px] text-text-muted leading-none", children: ["+", dayEvents.length - 4] }))] }), hasExec && (_jsx("span", { className: "text-[9px] text-amber-400 font-semibold mt-auto", children: "\u25CF pendiente" }))] }, day));
                }) })] }));
}
const EMPTY_FORM = {
    nombre: '', tipo: 'PAGO_PROGRAMADO', fecha: new Date().toISOString().slice(0, 10),
    recurrente: false, tipoRecurrencia: '', presupuestoEstimado: '', moneda: 'DOP',
    estado: 'PLANIFICADO', personaId: '', prioridad: '3', categoriaId: '', subcategoriaId: '', notas: '',
};
function EventoFormPanel({ initial, personas, categorias, onSubmit, onClose, loading, error }) {
    const [form, setForm] = useState(initial ?? EMPTY_FORM);
    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
    const setCheck = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.checked }));
    const isPago = form.tipo === 'PAGO_PROGRAMADO' || form.tipo === 'NOMINA';
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [error && _jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre *", _jsx("input", { required: true, type: "text", maxLength: 150, value: form.nombre, onChange: set('nombre'), className: "input", placeholder: "Ej. Pago luz, Cumplea\u00F1os mam\u00E1..." })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo *", _jsx("select", { required: true, value: form.tipo, onChange: set('tipo'), className: "input", children: Object.keys(TIPO_CONFIG).map(t => (_jsxs("option", { value: t, children: [TIPO_CONFIG[t].icon, " ", TIPO_CONFIG[t].label] }, t))) })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha *", _jsx(DatePicker, { value: form.fecha, onChange: v => setForm(p => ({ ...p, fecha: v })) })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-text-secondary cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.recurrente, onChange: setCheck('recurrente'), className: "w-4 h-4 accent-primary" }), "Evento recurrente"] }), form.recurrente && (_jsxs("select", { value: form.tipoRecurrencia, onChange: set('tipoRecurrencia'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Frecuencia \u2014" }), _jsx("option", { value: "DIARIA", children: "Diaria" }), _jsx("option", { value: "SEMANAL", children: "Semanal" }), _jsx("option", { value: "MENSUAL", children: "Mensual" }), _jsx("option", { value: "ANUAL", children: "Anual" })] }))] }), isPago && (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Monto estimado", _jsx("input", { type: "number", step: "0.01", min: "0", value: form.presupuestoEstimado, onChange: set('presupuestoEstimado'), className: "input", placeholder: "0.00" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Moneda", _jsxs("select", { value: form.moneda, onChange: set('moneda'), className: "input", children: [_jsx("option", { value: "DOP", children: "DOP" }), _jsx("option", { value: "USD", children: "USD" }), _jsx("option", { value: "EUR", children: "EUR" })] })] })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Estado", _jsx("select", { value: form.estado, onChange: set('estado'), className: "input", children: Object.keys(ESTADO_CONFIG).map(e => (_jsx("option", { value: e, children: ESTADO_CONFIG[e].label }, e))) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Prioridad (1-5)", _jsx("input", { type: "number", min: "1", max: "5", value: form.prioridad, onChange: set('prioridad'), className: "input" })] })] }), (form.tipo === 'CUMPLEANOS' || form.tipo === 'OTRO') && (_jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Persona (opcional)", _jsxs("select", { value: form.personaId, onChange: set('personaId'), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Ninguna \u2014" }), personas.map(p => _jsx("option", { value: p.id, children: p.displayName }, p.id))] })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Categor\u00EDa", _jsx(CategoriaSelect, { value: form.categoriaId, onChange: id => setForm(p => ({ ...p, categoriaId: id, subcategoriaId: '' })), categorias: categorias })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Subcategor\u00EDa", _jsx(SubcategoriaSelect, { value: form.subcategoriaId, onChange: id => setForm(p => ({ ...p, subcategoriaId: id })), subcategorias: categorias.find(c => c.id === form.categoriaId)?.subcategorias ?? [], disabled: !form.categoriaId })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("textarea", { value: form.notas, onChange: set('notas'), className: "input resize-none", rows: 2, placeholder: "Informaci\u00F3n adicional..." })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
// ── Ejecutar Form ──────────────────────────────────────────────────────────
function EjecutarFormPanel({ evento, cuentas, categorias, onSubmit, onClose, loading, error }) {
    const fmt = useFmt();
    const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
    const [categoriaId, setCategoriaId] = useState(evento.categoriaId ?? '');
    const [subcategoriaId, setSubcategoriaId] = useState(evento.subcategoriaId ?? '');
    const [notas, setNotas] = useState('');
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(cuentaId, categoriaId, subcategoriaId, notas); }, className: "flex flex-col gap-4", children: [error && _jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "bg-background/60 rounded-xl p-4 border border-border/60", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "text-xl", children: TIPO_CONFIG[evento.tipo]?.icon }), _jsx("span", { className: "font-semibold text-text-primary", children: evento.nombre })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Monto estimado" }), _jsx("p", { className: "font-bold text-text-primary", children: fmt(evento.presupuestoEstimado) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Fecha" }), _jsx("p", { className: "font-medium text-text-primary", children: fmtDate(evento.fecha) })] })] })] }), _jsxs("p", { className: "text-xs text-text-muted -mt-1", children: ["Se crear\u00E1 una transacci\u00F3n de ", _jsx("strong", { children: evento.tipo === 'NOMINA' ? 'Ingreso' : 'Gasto' }), " por el monto estimado y el evento quedar\u00E1 marcado como Ejecutado."] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Cuenta *", _jsxs("select", { required: true, value: cuentaId, onChange: e => setCuentaId(e.target.value), className: "input", children: [_jsx("option", { value: "", children: "\u2014 Seleccionar cuenta \u2014" }), cuentas.map(c => (_jsxs("option", { value: c.id, children: [c.alias ?? c.banco, " (\u00B7\u00B7\u00B7", c.numero.slice(-4), ")"] }, c.id)))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Categor\u00EDa", _jsx(CategoriaSelect, { value: categoriaId, onChange: id => { setCategoriaId(id); setSubcategoriaId(''); }, categorias: categorias })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Subcategor\u00EDa", _jsx(SubcategoriaSelect, { value: subcategoriaId, onChange: setSubcategoriaId, subcategorias: categorias.find(c => c.id === categoriaId)?.subcategorias ?? [], disabled: !categoriaId })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas (opcional)", _jsx("input", { value: notas, onChange: e => setNotas(e.target.value), className: "input", placeholder: "Ej. Cuota mayo, mes de..." })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading || !cuentaId, className: "btn-primary", children: loading ? 'Ejecutando…' : '▶ Ejecutar' })] })] }));
}
const toPayload = (f) => ({
    nombre: f.nombre,
    tipo: f.tipo,
    fecha: f.fecha,
    recurrente: f.recurrente,
    tipoRecurrencia: f.recurrente && f.tipoRecurrencia ? f.tipoRecurrencia : null,
    presupuestoEstimado: f.presupuestoEstimado ? parseFloat(f.presupuestoEstimado) : 0,
    moneda: f.moneda,
    estado: f.estado,
    prioridad: parseInt(f.prioridad),
    personaId: f.personaId || null,
    categoriaId: f.categoriaId || null,
    subcategoriaId: f.subcategoriaId || null,
    notas: f.notas || null,
});
export function EventosPage() {
    const fmt = useFmt();
    const qc = useQueryClient();
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // ── Period state ─────────────────────────────────────────────────────────
    const [periodType, setPeriodType] = useState('mes');
    const [periodStart, setPeriodStart] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [periodEnd, setPeriodEnd] = useState(() => new Date(today.getFullYear(), today.getMonth() + 1, 0));
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    const [selectedDayStr, setSelectedDayStr] = useState(toDateStr(today));
    const [tipoFiltro, setTipoFiltro] = useState('');
    const [modal, setModal] = useState(null);
    const [customOpen, setCustomOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [savedPeriods, setSavedPeriods] = useState(loadSavedPeriods);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3200);
    };
    // ── Query params ──────────────────────────────────────────────────────────
    const queryParams = useMemo(() => {
        if (periodType === 'mes') {
            return `mes=${periodStart.getFullYear()}-${pad(periodStart.getMonth() + 1)}`;
        }
        return `inicio=${toDateStr(periodStart)}&fin=${toDateStr(periodEnd)}`;
    }, [periodType, periodStart, periodEnd]);
    const { data: eventos = [], isLoading } = useQuery({
        queryKey: ['eventos', queryParams, cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/eventos?${queryParams}`)).data.data,
        enabled: !!cid,
    });
    const { data: cuentas = [] } = useQuery({
        queryKey: ['cuentas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/cuentas`)).data.data,
        enabled: !!cid,
    });
    const { data: personas = [] } = useQuery({
        queryKey: ['personas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
        enabled: !!cid,
    });
    const { data: categorias = [] } = useQuery({
        queryKey: ['categorias'],
        queryFn: async () => (await api.get('/categorias')).data.data,
    });
    const invalidate = () => qc.invalidateQueries({ queryKey: ['eventos'] });
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/eventos`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Evento creado'); },
        onError: (e) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error'); },
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/eventos/${id}`, d),
        onSuccess: () => { invalidate(); setModal(null); showToast('Evento actualizado'); },
        onError: (e) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error'); },
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/eventos/${id}`),
        onSuccess: () => { invalidate(); setModal(null); showToast('Evento eliminado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e?.message, 'error'),
    });
    const ejecutar = useMutation({
        mutationFn: ({ id, cuentaId, categoriaId, subcategoriaId, notas }) => api.post(`/eventos/${id}/ejecutar`, { clienteId: cid, cuentaId, categoriaId: categoriaId || null, subcategoriaId: subcategoriaId || null, notas }),
        onSuccess: () => {
            invalidate();
            qc.invalidateQueries({ queryKey: ['cuentas'] });
            qc.invalidateQueries({ queryKey: ['transacciones'] });
            setModal(null);
            showToast('✅ Transacción registrada correctamente');
        },
        onError: (e) => { const m = e?.response?.data?.error ?? e?.message; setModal(p => p ? { ...p, error: m } : p); showToast(m, 'error'); },
    });
    // ── Period selection handlers ─────────────────────────────────────────────
    const selectPeriod = (t) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (t === 'dia') {
            setPeriodType('dia');
            setPeriodStart(now);
            setPeriodEnd(now);
            setSelectedDay(now.getDate());
            setSelectedDayStr(toDateStr(now));
        }
        else if (t === 'semana') {
            const ws = getWeekStart(now);
            const we = new Date(ws);
            we.setDate(we.getDate() + 6);
            setPeriodType('semana');
            setPeriodStart(ws);
            setPeriodEnd(we);
            setSelectedDayStr(toDateStr(now));
            setSelectedDay(now.getDate());
        }
        else {
            const ms = new Date(now.getFullYear(), now.getMonth(), 1);
            const me = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setPeriodType('mes');
            setPeriodStart(ms);
            setPeriodEnd(me);
            setSelectedDay(now.getDate());
            setSelectedDayStr(toDateStr(now));
        }
    };
    const applyCustom = (start, end) => {
        setPeriodType('custom');
        setPeriodStart(start);
        setPeriodEnd(end);
        setSelectedDay(null);
        setSelectedDayStr(null);
        setCustomOpen(false);
    };
    const applySaved = (p) => {
        const { start, end } = applyBuiltInPeriod(p);
        setPeriodType('custom');
        setPeriodStart(start);
        setPeriodEnd(end);
        setSelectedDay(null);
        setSelectedDayStr(null);
    };
    const saveCustomPeriod = (nombre, start, end) => {
        const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        const anchorDay = start.getDate();
        const np = { id: `custom_${Date.now()}`, nombre, durationDays: days, anchorDay };
        const updated = [...savedPeriods, np];
        setSavedPeriods(updated);
        persistSavedPeriods(updated);
    };
    const deleteSaved = (id) => {
        const updated = savedPeriods.filter(p => p.id !== id);
        setSavedPeriods(updated);
        persistSavedPeriods(updated);
    };
    // ── Navigation ────────────────────────────────────────────────────────────
    const navigate = (dir) => {
        if (periodType === 'dia') {
            const d = new Date(periodStart);
            d.setDate(d.getDate() + dir);
            setPeriodStart(d);
            setPeriodEnd(d);
            setSelectedDay(d.getDate());
            setSelectedDayStr(toDateStr(d));
        }
        else if (periodType === 'semana') {
            const ws = new Date(periodStart);
            ws.setDate(ws.getDate() + dir * 7);
            const we = new Date(ws);
            we.setDate(we.getDate() + 6);
            setPeriodStart(ws);
            setPeriodEnd(we);
        }
        else if (periodType === 'mes') {
            const d = new Date(periodStart);
            d.setMonth(d.getMonth() + dir);
            const ms = new Date(d.getFullYear(), d.getMonth(), 1);
            const me = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            setPeriodStart(ms);
            setPeriodEnd(me);
            setSelectedDay(null);
            setSelectedDayStr(null);
        }
        else {
            const dur = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
            const ns = new Date(periodStart);
            ns.setDate(ns.getDate() + dir * (dur + 1));
            const ne = new Date(ns);
            ne.setDate(ne.getDate() + dur);
            setPeriodStart(ns);
            setPeriodEnd(ne);
            setSelectedDay(null);
            setSelectedDayStr(null);
        }
    };
    const goToday = () => selectPeriod(periodType === 'dia' ? 'dia' : periodType === 'semana' ? 'semana' : 'mes');
    // ── Filtered events ───────────────────────────────────────────────────────
    const eventosFiltrados = useMemo(() => tipoFiltro ? eventos.filter(ev => ev.tipo === tipoFiltro) : eventos, [eventos, tipoFiltro]);
    // Events for selected day or full period
    const displayList = useMemo(() => {
        if (periodType === 'dia' || (selectedDayStr && periodType !== 'semana')) {
            const targetDate = selectedDayStr ? new Date(selectedDayStr + 'T00:00:00') : periodStart;
            return eventosFiltrados
                .filter(ev => occursOnDate(ev, targetDate))
                .map(ev => ({ ev, date: targetDate }));
        }
        if (periodType === 'semana' && selectedDayStr) {
            const targetDate = new Date(selectedDayStr + 'T00:00:00');
            return eventosFiltrados
                .filter(ev => occursOnDate(ev, targetDate))
                .map(ev => ({ ev, date: targetDate }));
        }
        // All events in period
        const expanded = [];
        const start = periodStart;
        const end = periodEnd;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const day = new Date(d);
            for (const ev of eventosFiltrados) {
                if (occursOnDate(ev, day))
                    expanded.push({ ev, date: new Date(day) });
            }
        }
        return expanded.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [eventosFiltrados, periodType, periodStart, periodEnd, selectedDayStr]);
    // Summary
    const totalPagos = displayList.filter(({ ev }) => ev.tipo === 'PAGO_PROGRAMADO').reduce((s, { ev }) => s + parseFloat(String(ev.presupuestoEstimado)), 0);
    const totalNomina = displayList.filter(({ ev }) => ev.tipo === 'NOMINA').reduce((s, { ev }) => s + parseFloat(String(ev.presupuestoEstimado)), 0);
    const pendientes = displayList.filter(({ ev }) => ev.estado === 'PLANIFICADO' && (ev.tipo === 'PAGO_PROGRAMADO' || ev.tipo === 'NOMINA')).length;
    // ── Period label ──────────────────────────────────────────────────────────
    const periodLabel = useMemo(() => {
        if (periodType === 'dia') {
            return periodStart.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
        }
        if (periodType === 'semana') {
            const ws = periodStart;
            const we = periodEnd;
            if (ws.getMonth() === we.getMonth()) {
                return `${ws.getDate()}–${we.getDate()} de ${MESES[ws.getMonth()]} ${ws.getFullYear()}`;
            }
            return `${ws.getDate()} ${(MESES[ws.getMonth()] ?? '').slice(0, 3)} – ${we.getDate()} ${(MESES[we.getMonth()] ?? '').slice(0, 3)} ${we.getFullYear()}`;
        }
        if (periodType === 'mes') {
            return `${MESES[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
        }
        return `${fmtDate(toDateStr(periodStart))} — ${fmtDate(toDateStr(periodEnd))}`;
    }, [periodType, periodStart, periodEnd]);
    // ── Calendar view ─────────────────────────────────────────────────────────
    const calendarMonths = useMemo(() => {
        if (periodType !== 'custom') {
            return [{ year: periodStart.getFullYear(), month: periodStart.getMonth() }];
        }
        const months = [];
        let cur = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
        const endMonth = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
        while (cur <= endMonth) {
            months.push({ year: cur.getFullYear(), month: cur.getMonth() });
            cur.setMonth(cur.getMonth() + 1);
        }
        return months;
    }, [periodType, periodStart, periodEnd]);
    const rangeStartStr = toDateStr(periodStart);
    const rangeEndStr = toDateStr(periodEnd);
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Eventos" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Calendario de pagos, fechas importantes y recordatorios" })] }), _jsxs("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), " Nuevo evento"] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "\uD83D\uDCB3 Pagos del per\u00EDodo" }), _jsx("p", { className: "text-xl font-bold text-amber-400", children: fmt(totalPagos) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "\uD83D\uDCBC N\u00F3mina del per\u00EDodo" }), _jsx("p", { className: "text-xl font-bold text-success", children: fmt(totalNomina) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "\u23F3 Pendientes de ejecutar" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: pendientes })] })] }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5", children: [_jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", children: _jsx(ChevronLeftIcon, { className: "w-5 h-5" }) }), _jsx("h2", { className: "text-lg font-bold text-text-primary flex-1 text-center capitalize", children: periodLabel }), _jsx("button", { onClick: () => navigate(1), className: "p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", children: _jsx(ChevronRightIcon, { className: "w-5 h-5" }) }), _jsx(PeriodDropdown, { periodType: periodType, customLabel: periodType === 'custom' ? 'Período' : 'Período', onSelect: selectPeriod, onOpenCustom: () => setCustomOpen(true), savedPeriods: savedPeriods, onApplySaved: applySaved, onDeleteSaved: deleteSaved }), periodType !== 'custom' && (_jsx("button", { onClick: goToday, className: "text-xs px-2.5 py-1 rounded-lg border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors", children: "Ahora" }))] }), _jsx("div", { className: "flex items-center gap-3 flex-wrap", children: Object.keys(TIPO_CONFIG).map(t => (_jsxs("button", { type: "button", onClick: () => setTipoFiltro(f => f === t ? '' : t), className: `flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors
                  ${tipoFiltro === t ? 'opacity-100' : 'opacity-60 hover:opacity-100'} ${TIPO_CONFIG[t].color}`, children: [_jsx("span", { className: "w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: TIPO_CONFIG[t].dot } }), TIPO_CONFIG[t].label] }, t))) }), isLoading ? (_jsx("div", { className: "h-64 flex items-center justify-center text-text-muted text-sm", children: "Cargando\u2026" })) : periodType === 'semana' ? (_jsx(WeekStrip, { ws: periodStart, eventos: eventosFiltrados, selectedStr: selectedDayStr, onSelectDay: ds => {
                                    setSelectedDayStr(prev => prev === ds ? null : ds);
                                    const d = new Date(ds + 'T00:00:00');
                                    setSelectedDay(prev => prev === d.getDate() ? null : d.getDate());
                                } })) : (_jsx("div", { className: "flex flex-col gap-4", children: calendarMonths.map(({ year, month }) => (_jsxs("div", { children: [calendarMonths.length > 1 && (_jsxs("p", { className: "text-sm font-semibold text-text-secondary mb-2", children: [MESES[month], " ", year] })), _jsx(CalendarGrid, { year: year, month: month, eventos: eventosFiltrados, selectedDay: periodType === 'dia' ? periodStart.getDate() : selectedDay, onSelectDay: d => {
                                                setSelectedDay(prev => prev === d ? null : d);
                                                if (d !== null) {
                                                    setSelectedDayStr(`${year}-${pad(month + 1)}-${pad(d)}`);
                                                }
                                                else {
                                                    setSelectedDayStr(null);
                                                }
                                            }, rangeStart: periodType === 'custom' ? rangeStartStr : undefined, rangeEnd: periodType === 'custom' ? rangeEndStr : undefined })] }, `${year}-${month}`))) }))] }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("h3", { className: "text-sm font-semibold text-text-secondary uppercase tracking-wider", children: selectedDayStr && periodType !== 'dia'
                                    ? (() => { const d = new Date(selectedDayStr + 'T00:00:00'); return `${d.getDate()} de ${MESES[d.getMonth()]}`; })()
                                    : periodType === 'dia'
                                        ? `${periodStart.getDate()} de ${MESES[periodStart.getMonth()]}`
                                        : `${periodLabel} — todos los eventos` }), displayList.length === 0 && (_jsx("div", { className: "text-center text-text-muted text-sm py-10 bg-surface border border-border rounded-xl", children: "Sin eventos en este per\u00EDodo" })), _jsx("div", { className: "flex flex-col gap-2", children: displayList.map(({ ev, date }, idx) => {
                                    const cfg = TIPO_CONFIG[ev.tipo];
                                    const canExecute = ev.estado === 'PLANIFICADO' && parseFloat(String(ev.presupuestoEstimado)) > 0;
                                    const isEjecutado = ev.estado === 'EJECUTADO';
                                    return (_jsxs("div", { className: `bg-surface border rounded-xl p-3 flex gap-3 items-start
                    ${isEjecutado ? 'opacity-50' : 'border-border'}`, children: [_jsx("div", { className: "w-1 self-stretch rounded-full flex-shrink-0", style: { backgroundColor: cfg.dot } }), _jsx("div", { className: "text-xl flex-shrink-0 leading-none mt-0.5", children: cfg.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: `text-sm font-semibold ${ESTADO_CONFIG[ev.estado].color}`, children: ev.nombre }), _jsx("p", { className: "text-xs text-text-muted", children: fmtDate(date.toISOString()) }), ev.recurrente && (_jsxs("p", { className: "text-xs text-text-muted", children: ["\uD83D\uDD01 ", ev.tipoRecurrencia?.toLowerCase()] }))] }), parseFloat(String(ev.presupuestoEstimado)) > 0 && (_jsxs("p", { className: `text-sm font-bold flex-shrink-0 ${ev.tipo === 'NOMINA' ? 'text-success' : 'text-danger'}`, children: [ev.tipo === 'NOMINA' ? '+' : '-', fmt(ev.presupuestoEstimado)] }))] }), ev.notas && _jsx("p", { className: "text-xs text-text-muted mt-1 truncate", children: ev.notas }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [canExecute && (_jsx("button", { onClick: () => setModal({ type: 'ejecutar', evento: ev }), className: "text-xs px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors font-semibold flex items-center gap-1", children: "\u25B6 Ejecutar" })), isEjecutado && (_jsx("span", { className: "text-xs text-success font-medium", children: "\u2713 Ejecutado" })), _jsx("button", { onClick: () => setModal({ type: 'edit', evento: ev }), className: "text-xs text-text-muted hover:text-primary transition-colors px-1", children: "\u270F" }), _jsx("button", { onClick: () => setModal({ type: 'delete', evento: ev }), className: "text-xs text-text-muted hover:text-danger transition-colors px-1", children: "\uD83D\uDDD1" })] })] })] }, `${ev.id}-${idx}`));
                                }) })] })] }), customOpen && (_jsx(CustomPeriodModal, { onClose: () => setCustomOpen(false), onApply: applyCustom, onSave: saveCustomPeriod })), modal?.type === 'new' && (_jsx(Modal, { title: "Nuevo evento", onClose: () => setModal(null), wide: true, children: _jsx(EventoFormPanel, { personas: personas, categorias: categorias, onClose: () => setModal(null), loading: create.isPending, error: modal.error, onSubmit: d => create.mutate(toPayload(d)) }) })), modal?.type === 'edit' && (_jsx(Modal, { title: "Editar evento", onClose: () => setModal(null), wide: true, children: _jsx(EventoFormPanel, { initial: {
                        nombre: modal.evento.nombre,
                        tipo: modal.evento.tipo,
                        fecha: modal.evento.fecha.slice(0, 10),
                        recurrente: modal.evento.recurrente,
                        tipoRecurrencia: (modal.evento.tipoRecurrencia ?? ''),
                        presupuestoEstimado: String(modal.evento.presupuestoEstimado),
                        moneda: modal.evento.moneda,
                        estado: modal.evento.estado,
                        prioridad: String(modal.evento.prioridad),
                        personaId: modal.evento.personaId ?? '',
                        categoriaId: modal.evento.categoriaId ?? '',
                        subcategoriaId: modal.evento.subcategoriaId ?? '',
                        notas: modal.evento.notas ?? '',
                    }, personas: personas, categorias: categorias, onClose: () => setModal(null), loading: update.isPending, error: modal.error, onSubmit: d => update.mutate({ id: modal.evento.id, d: toPayload(d) }) }) })), modal?.type === 'delete' && (_jsxs(Modal, { title: "Eliminar evento", onClose: () => setModal(null), children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFEliminar el evento ", _jsxs("strong", { className: "text-text-primary", children: ["\"", modal.evento.nombre, "\""] }), "? Esta acci\u00F3n no se puede deshacer."] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.evento.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] })), modal?.type === 'ejecutar' && (_jsx(Modal, { title: "Ejecutar evento", onClose: () => setModal(null), children: _jsx(EjecutarFormPanel, { evento: modal.evento, cuentas: cuentas, categorias: categorias, loading: ejecutar.isPending, error: modal.error, onClose: () => setModal(null), onSubmit: (cuentaId, categoriaId, subcategoriaId, notas) => ejecutar.mutate({ id: modal.evento.id, cuentaId, categoriaId, subcategoriaId, notas }) }) }))] }));
}
