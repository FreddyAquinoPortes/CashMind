import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PlusIcon, ChevronRightIcon, ChevronDownIcon, } from '@heroicons/react/24/outline';
import { Icon } from '@iconify/react';
import { IconPicker, suggestIcon } from '../../components/ui/IconPicker';
import { useAuthStore } from '../../store/auth.store';
// ── API helpers ────────────────────────────────────────────────────────────
const fetchCategorias = async (clienteId) => {
    const { data } = await api.get('/categorias', { params: clienteId ? { clienteId } : {} });
    return data.data;
};
function Toast({ toast }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all
        ${toast.type === 'success'
            ? 'bg-success text-white'
            : 'bg-danger text-white'}`, children: toast.msg }));
}
function Modal({ title, onClose, children }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: "bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl mx-4 flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary transition-colors text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 px-6 pb-6", children: children })] }) }));
}
// ── Color picker ──────────────────────────────────────────────────────────
const PALETTE = [
    '#22c55e', '#16a34a', '#15803d', '#4ade80',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa',
    '#f59e0b', '#f97316', '#ef4444', '#ec4899',
    '#06b6d4', '#14b8a6', '#84cc16', '#94a3b8',
];
function ColorPicker({ value, onChange }) {
    return (_jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: PALETTE.map(c => (_jsx("button", { type: "button", onClick: () => onChange(c), className: "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110", style: { backgroundColor: c, borderColor: value === c ? '#fff' : 'transparent' } }, c))) }));
}
function CategoriaForm({ initial, onSubmit, onClose, loading, error, }) {
    const [form, setForm] = useState({
        nombre: initial?.nombre ?? '',
        color: initial?.color ?? '#22c55e',
        icono: initial?.icono ?? '',
        esEsencial: initial?.esEsencial ?? false,
    });
    // true = icon was auto-suggested (not manually chosen by user)
    const [autoSuggested, setAutoSuggested] = useState(!initial?.icono);
    // Auto-suggest icon as user types the name
    useEffect(() => {
        if (!autoSuggested)
            return; // user manually chose — don't override
        const suggested = suggestIcon(form.nombre);
        if (suggested)
            setForm(p => ({ ...p, icono: suggested }));
    }, [form.nombre, autoSuggested]);
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [error && (_jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error })), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre *", _jsx("input", { required: true, value: form.nombre, onChange: e => setForm(p => ({ ...p, nombre: e.target.value })), className: "input", placeholder: "Ej. Supermercado, Combustible, Salud\u2026", autoFocus: true })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: "\u00CDcono" }), autoSuggested && form.icono && (_jsx("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium", children: "\u2728 Sugerido" }))] }), _jsx(IconPicker, { value: form.icono, onChange: icono => {
                            setForm(p => ({ ...p, icono }));
                            setAutoSuggested(false); // user manually picked
                        } })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Color", _jsx(ColorPicker, { value: form.color, onChange: c => setForm(p => ({ ...p, color: c })) })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-text-secondary cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.esEsencial, onChange: e => setForm(p => ({ ...p, esEsencial: e.target.checked })), className: "accent-primary w-4 h-4" }), "Categor\u00EDa esencial (incluida en health score)"] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
function SubcategoriaForm({ initial, onSubmit, onClose, loading, error, }) {
    const [form, setForm] = useState({
        nombre: initial?.nombre ?? '',
        color: initial?.color ?? '#4ade80',
        icono: initial?.icono ?? '',
    });
    const [autoSuggested, setAutoSuggested] = useState(!initial?.icono);
    useEffect(() => {
        if (!autoSuggested)
            return;
        const suggested = suggestIcon(form.nombre);
        if (suggested)
            setForm(p => ({ ...p, icono: suggested }));
    }, [form.nombre, autoSuggested]);
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(form); }, className: "flex flex-col gap-4", children: [error && (_jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: error })), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre *", _jsx("input", { required: true, value: form.nombre, onChange: e => setForm(p => ({ ...p, nombre: e.target.value })), className: "input", placeholder: "Ej. Restaurantes, Gasolina, Gym\u2026", autoFocus: true })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: "\u00CDcono" }), autoSuggested && form.icono && (_jsx("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium", children: "\u2728 Sugerido" }))] }), _jsx(IconPicker, { value: form.icono, onChange: icono => {
                            setForm(p => ({ ...p, icono }));
                            setAutoSuggested(false);
                        } })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Color", _jsx(ColorPicker, { value: form.color, onChange: c => setForm(p => ({ ...p, color: c })) })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
function DropdownMenu({ menuId, openMenu, setOpenMenu, actions }) {
    const ref = useRef(null);
    const isOpen = openMenu === menuId;
    useEffect(() => {
        if (!isOpen)
            return;
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpenMenu(null);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, setOpenMenu]);
    return (_jsxs("div", { className: "relative", ref: ref, children: [_jsx("button", { type: "button", onClick: e => { e.stopPropagation(); setOpenMenu(isOpen ? null : menuId); }, className: "p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors text-base leading-none font-bold tracking-widest", title: "M\u00E1s opciones", children: "\u00B7\u00B7\u00B7" }), isOpen && (_jsx("div", { className: "absolute right-0 top-full mt-1 z-30 min-w-[200px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden", children: actions.map((action, i) => (_jsx("button", { type: "button", onClick: e => { e.stopPropagation(); action.onClick(); setOpenMenu(null); }, className: `w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5
                ${action.danger
                        ? 'text-danger hover:bg-danger/10'
                        : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'}`, children: action.label }, i))) }))] }));
}
// ── SubcategoriaRow ───────────────────────────────────────────────────────
function SubcategoriaRow({ sub, isSystem, menuId, openMenu, setOpenMenu, onEdit, onDelete, }) {
    const actions = [
        { label: '✏ Editar subcategoría', onClick: () => onEdit(sub) },
        { label: '🗑 Eliminar subcategoría', onClick: () => onDelete(sub), danger: true },
    ];
    return (_jsxs("div", { className: "flex items-center gap-3 py-2 pl-10 pr-3 rounded-lg hover:bg-background/50 transition-colors", children: [_jsx("span", { className: "text-sm text-text-muted select-none", children: "\u2022" }), _jsx("div", { className: "w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: sub.color ?? '#94a3b8' } }), _jsxs("span", { className: "text-sm text-text-secondary flex-1 flex items-center gap-1.5", children: [sub.icono
                        ? _jsx(Icon, { icon: sub.icono.includes(':') ? sub.icono : `tabler:${sub.icono}`, className: "w-4 h-4", style: { color: sub.color ?? '#94a3b8' } })
                        : _jsx("span", { className: "text-text-muted", children: "\u2022" }), sub.nombre] }), _jsx(DropdownMenu, { menuId: menuId, openMenu: openMenu, setOpenMenu: setOpenMenu, actions: actions })] }));
}
// ── CategoriaRow ──────────────────────────────────────────────────────────
function CategoriaRow({ cat, expandedIds, toggleExpand, openMenu, setOpenMenu, onEdit, onDelete, onAddSub, onEditSub, onDeleteSub, }) {
    const isSystem = cat.clienteId === null;
    const expanded = expandedIds.has(cat.id);
    const catMenuActions = [
        { label: '+ Añadir subcategoría', onClick: () => onAddSub(cat) },
        { label: '✏ Editar categoría', onClick: () => onEdit(cat) },
        { label: '🗑 Eliminar categoría', onClick: () => onDelete(cat), danger: true },
    ];
    return (_jsxs("div", { className: "rounded-xl border border-border bg-surface overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-background/30 transition-colors select-none", onClick: () => toggleExpand(cat.id), children: [_jsx("span", { className: "flex-shrink-0 text-text-muted", children: expanded
                            ? _jsx(ChevronDownIcon, { className: "w-4 h-4" })
                            : _jsx(ChevronRightIcon, { className: "w-4 h-4" }) }), _jsx("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base", style: { backgroundColor: (cat.color ?? '#1e8e5a') + '33' }, children: cat.icono
                            ? _jsx(Icon, { icon: cat.icono.includes(':') ? cat.icono : `tabler:${cat.icono}`, className: "w-5 h-5", style: { color: cat.color ?? '#22c55e' } })
                            : _jsx(Icon, { icon: "tabler:tag", className: "w-5 h-5", style: { color: cat.color ?? '#22c55e' } }) }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-medium text-text-primary", children: cat.nombre }), isSystem && (_jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium", children: "Sistema" })), cat.esEsencial && (_jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium", children: "Esencial" })), _jsxs("span", { className: "text-xs px-1.5 py-0.5 rounded bg-border text-text-muted font-medium", children: [cat.subcategorias.length, " sub", cat.subcategorias.length !== 1 ? 's' : ''] })] }) }), _jsxs("button", { type: "button", onClick: e => { e.stopPropagation(); onAddSub(cat); }, className: "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-success hover:bg-success/10 transition-colors", title: "A\u00F1adir subcategor\u00EDa", children: [_jsx(PlusIcon, { className: "w-3.5 h-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "Sub" })] }), _jsx("div", { onClick: e => e.stopPropagation(), children: _jsx(DropdownMenu, { menuId: `cat-${cat.id}`, openMenu: openMenu, setOpenMenu: setOpenMenu, actions: catMenuActions }) })] }), expanded && cat.subcategorias.length > 0 && (_jsx("div", { className: "border-t border-border/50 py-1 px-2", children: cat.subcategorias.map(sub => (_jsx(SubcategoriaRow, { sub: sub, isSystem: isSystem, menuId: `sub-${sub.id}`, openMenu: openMenu, setOpenMenu: setOpenMenu, onEdit: s => onEditSub(cat, s), onDelete: s => onDeleteSub(cat, s) }, sub.id))) })), expanded && cat.subcategorias.length === 0 && (_jsx("div", { className: "border-t border-border/50 py-3 px-10 text-xs text-text-muted", children: "Sin subcategor\u00EDas. Usa el bot\u00F3n \"+ Sub\" para a\u00F1adir una." }))] }));
}
// ── Main page ─────────────────────────────────────────────────────────────
export function CategoriasPage() {
    const qc = useQueryClient();
    const clienteId = useAuthStore(s => s.clienteActivo?.id);
    const { data: categorias = [], isLoading } = useQuery({
        queryKey: ['categorias', clienteId],
        queryFn: () => fetchCategorias(clienteId),
    });
    // Toast
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    // Expanded rows
    const [expandedIds, setExpandedIds] = useState(new Set());
    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    // Open dropdown menu
    const [openMenu, setOpenMenu] = useState(null);
    // Modal state (also stores mutation error per modal)
    const [modal, setModal] = useState(null);
    const closeModal = () => setModal(null);
    const invalidate = () => qc.invalidateQueries({ queryKey: ['categorias'] });
    // Mutations
    const createCat = useMutation({
        mutationFn: (d) => api.post('/categorias', { ...d, clienteId }),
        onSuccess: () => { invalidate(); closeModal(); showToast('Categoría creada'); },
        onError: (err) => {
            setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev);
            showToast(err.message || 'Error al guardar', 'error');
        },
    });
    const updateCat = useMutation({
        mutationFn: ({ id, d }) => api.put(`/categorias/${id}`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Categoría actualizada'); },
        onError: (err) => {
            setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev);
            showToast(err.message || 'Error al guardar', 'error');
        },
    });
    const deleteCat = useMutation({
        mutationFn: (id) => api.delete(`/categorias/${id}`),
        onSuccess: () => { invalidate(); closeModal(); showToast('Categoría eliminada'); },
        onError: (err) => { showToast(err.message || 'Error al eliminar', 'error'); },
    });
    const createSub = useMutation({
        mutationFn: ({ catId, d }) => api.post(`/categorias/${catId}/subcategorias`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Subcategoría creada'); },
        onError: (err) => {
            setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev);
            showToast(err.message || 'Error al guardar', 'error');
        },
    });
    const updateSub = useMutation({
        mutationFn: ({ catId, subId, d }) => api.put(`/categorias/${catId}/subcategorias/${subId}`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Subcategoría actualizada'); },
        onError: (err) => {
            setModal(prev => prev ? { ...prev, error: err.message || 'Error al guardar' } : prev);
            showToast(err.message || 'Error al guardar', 'error');
        },
    });
    const deleteSub = useMutation({
        mutationFn: ({ catId, subId }) => api.delete(`/categorias/${catId}/subcategorias/${subId}`),
        onSuccess: () => { invalidate(); closeModal(); showToast('Subcategoría eliminada'); },
        onError: (err) => { showToast(err.message || 'Error al eliminar', 'error'); },
    });
    const [search, setSearch] = useState('');
    const filtered = categorias.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()));
    const system = filtered.filter(c => c.clienteId === null);
    const custom = filtered.filter(c => c.clienteId !== null);
    return (_jsxs("div", { className: "flex flex-col gap-6 max-w-3xl mx-auto", children: [toast && _jsx(Toast, { toast: toast }), _jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Categor\u00EDas" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Organiza tus transacciones con categor\u00EDas y subcategor\u00EDas personalizadas" })] }), _jsxs("button", { onClick: () => setModal({ type: 'newCat' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), "Nueva categor\u00EDa"] })] }), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "Buscar categor\u00EDa\u2026", className: "input" }), isLoading && (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted text-sm", children: "Cargando\u2026" })), custom.length > 0 && (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h2", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Mis categor\u00EDas" }), custom.map(cat => (_jsx(CategoriaRow, { cat: cat, expandedIds: expandedIds, toggleExpand: toggleExpand, openMenu: openMenu, setOpenMenu: setOpenMenu, onEdit: c => setModal({ type: 'editCat', cat: c }), onDelete: c => setModal({ type: 'deleteCat', cat: c }), onAddSub: c => setModal({ type: 'newSub', cat: c }), onEditSub: (c, s) => setModal({ type: 'editSub', cat: c, sub: s }), onDeleteSub: (c, s) => setModal({ type: 'deleteSub', cat: c, sub: s }) }, cat.id)))] })), system.length > 0 && (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h2", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Categor\u00EDas del sistema" }), system.map(cat => (_jsx(CategoriaRow, { cat: cat, expandedIds: expandedIds, toggleExpand: toggleExpand, openMenu: openMenu, setOpenMenu: setOpenMenu, onEdit: c => setModal({ type: 'editCat', cat: c }), onDelete: c => setModal({ type: 'deleteCat', cat: c }), onAddSub: c => setModal({ type: 'newSub', cat: c }), onEditSub: (c, s) => setModal({ type: 'editSub', cat: c, sub: s }), onDeleteSub: (c, s) => setModal({ type: 'deleteSub', cat: c, sub: s }) }, cat.id)))] })), !isLoading && filtered.length === 0 && (_jsx("div", { className: "text-center text-text-muted py-12 text-sm", children: search ? 'Sin resultados para tu búsqueda' : 'No hay categorías todavía' })), modal?.type === 'newCat' && (_jsx(Modal, { title: "Nueva categor\u00EDa", onClose: closeModal, children: _jsx(CategoriaForm, { onClose: closeModal, loading: createCat.isPending, error: modal.error, onSubmit: d => createCat.mutate(d) }) })), modal?.type === 'editCat' && (_jsx(Modal, { title: "Editar categor\u00EDa", onClose: closeModal, children: _jsx(CategoriaForm, { initial: { ...modal.cat, color: modal.cat.color ?? undefined, icono: modal.cat.icono ?? undefined }, onClose: closeModal, loading: updateCat.isPending, error: modal.error, onSubmit: d => updateCat.mutate({ id: modal.cat.id, d }) }) })), modal?.type === 'deleteCat' && (_jsxs(Modal, { title: "Eliminar categor\u00EDa", onClose: closeModal, children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFSeguro que quieres eliminar ", _jsx("strong", { className: "text-text-primary", children: modal.cat.nombre }), "? Esta acci\u00F3n no se puede deshacer."] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: closeModal, children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: deleteCat.isPending, onClick: () => deleteCat.mutate(modal.cat.id), children: deleteCat.isPending ? 'Eliminando…' : 'Eliminar' })] })] })), modal?.type === 'newSub' && (_jsx(Modal, { title: `Añadir subcategoría a "${modal.cat.nombre}"`, onClose: closeModal, children: _jsx(SubcategoriaForm, { onClose: closeModal, loading: createSub.isPending, error: modal.error, onSubmit: d => createSub.mutate({ catId: modal.cat.id, d }) }) })), modal?.type === 'editSub' && (_jsx(Modal, { title: "Editar subcategor\u00EDa", onClose: closeModal, children: _jsx(SubcategoriaForm, { initial: { ...modal.sub, color: modal.sub.color ?? undefined, icono: modal.sub.icono ?? undefined }, onClose: closeModal, loading: updateSub.isPending, error: modal.error, onSubmit: d => updateSub.mutate({ catId: modal.cat.id, subId: modal.sub.id, d }) }) })), modal?.type === 'deleteSub' && (_jsxs(Modal, { title: "Eliminar subcategor\u00EDa", onClose: closeModal, children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFSeguro que quieres eliminar ", _jsx("strong", { className: "text-text-primary", children: modal.sub.nombre }), "?"] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: closeModal, children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: deleteSub.isPending, onClick: () => deleteSub.mutate({ catId: modal.cat.id, subId: modal.sub.id }), children: deleteSub.isPending ? 'Eliminando…' : 'Eliminar' })] })] }))] }));
}
