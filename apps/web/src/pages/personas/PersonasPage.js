import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { PlusIcon, UserIcon, BuildingOfficeIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
// ── Helpers ────────────────────────────────────────────────────────────────
const fmtMoney = (n) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n);
const COUNTRY_CODES = [
    { code: '+1', flag: '🇩🇴', name: 'Rep. Dominicana (809/829/849)', nanp: true },
    { code: '+1', flag: '🇺🇸', name: 'EE.UU. / Canadá', nanp: true },
    { code: '+54', flag: '🇦🇷', name: 'Argentina' },
    { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
    { code: '+55', flag: '🇧🇷', name: 'Brasil' },
    { code: '+56', flag: '🇨🇱', name: 'Chile' },
    { code: '+57', flag: '🇨🇴', name: 'Colombia' },
    { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
    { code: '+53', flag: '🇨🇺', name: 'Cuba' },
    { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
    { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
    { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
    { code: '+509', flag: '🇭🇹', name: 'Haití' },
    { code: '+504', flag: '🇭🇳', name: 'Honduras' },
    { code: '+52', flag: '🇲🇽', name: 'México' },
    { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
    { code: '+507', flag: '🇵🇦', name: 'Panamá' },
    { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
    { code: '+51', flag: '🇵🇪', name: 'Perú' },
    { code: '+1787', flag: '🇵🇷', name: 'Puerto Rico', nanp: true },
    { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
    { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
    { code: '+34', flag: '🇪🇸', name: 'España' },
    { code: '+39', flag: '🇮🇹', name: 'Italia' },
    { code: '+33', flag: '🇫🇷', name: 'Francia' },
    { code: '+49', flag: '🇩🇪', name: 'Alemania' },
    { code: '+44', flag: '🇬🇧', name: 'Reino Unido' },
    { code: '+351', flag: '🇵🇹', name: 'Portugal' },
    { code: '+1868', flag: '🇹🇹', name: 'Trinidad y Tobago', nanp: true },
    { code: '+1876', flag: '🇯🇲', name: 'Jamaica', nanp: true },
    { code: '+1246', flag: '🇧🇧', name: 'Barbados', nanp: true },
];
const DEFAULT_COUNTRY = COUNTRY_CODES[0];
// ── Phone formatting ───────────────────────────────────────────────────────
function fmtNANP(d) {
    const s = d.slice(0, 10);
    if (s.length <= 3)
        return `(${s}`;
    if (s.length <= 6)
        return `(${s.slice(0, 3)}) ${s.slice(3)}`;
    return `(${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6)}`;
}
function fmtIntl(d) {
    const s = d.slice(0, 12);
    return s.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim();
}
function buildPhone(c, digits) {
    if (!digits)
        return null;
    const display = c.nanp ? fmtNANP(digits) : fmtIntl(digits);
    return `${c.code} ${display}`;
}
function parsePhone(tel) {
    if (!tel)
        return { country: DEFAULT_COUNTRY, digits: '' };
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
        if (tel.startsWith(c.code)) {
            return { country: c, digits: tel.slice(c.code.length).replace(/\D/g, '') };
        }
    }
    return { country: DEFAULT_COUNTRY, digits: tel.replace(/\D/g, '') };
}
// ── PhoneInput ─────────────────────────────────────────────────────────────
function PhoneInput({ country, digits, onCountryChange, onDigitsChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const h = (e) => { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const list = COUNTRY_CODES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search));
    const rawDigits = digits.replace(/\D/g, '');
    const displayVal = country.nanp ? fmtNANP(rawDigits) : fmtIntl(rawDigits);
    const preview = rawDigits ? `${country.code} ${displayVal}` : '';
    return (_jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "relative flex-shrink-0", ref: ref, children: [_jsxs("button", { type: "button", onClick: () => setOpen(p => !p), className: "flex items-center gap-1.5 px-3 py-2 h-[42px] rounded-lg border border-border bg-background text-sm hover:border-primary transition-colors", children: [_jsx("span", { className: "text-base leading-none", children: country.flag }), _jsx("span", { className: "font-mono text-xs text-text-muted", children: country.code }), _jsx(ChevronDownIcon, { className: "w-3 h-3 text-text-muted" })] }), open && (_jsxs("div", { className: "absolute left-0 top-full mt-1 z-[200] w-72 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden", children: [_jsx("div", { className: "p-2 border-b border-border", children: _jsx("input", { autoFocus: true, value: search, onChange: e => setSearch(e.target.value), placeholder: "Buscar pa\u00EDs\u2026", className: "input text-sm" }) }), _jsx("div", { className: "max-h-52 overflow-y-auto", children: list.map((c, i) => (_jsxs("button", { type: "button", onClick: () => { onCountryChange(c); setOpen(false); setSearch(''); }, className: `w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors
                    ${c === country ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-elevated'}`, children: [_jsx("span", { className: "text-base", children: c.flag }), _jsx("span", { className: "flex-1 truncate", children: c.name }), _jsx("span", { className: "font-mono text-xs text-text-muted flex-shrink-0", children: c.code })] }, i))) })] }))] }), _jsxs("div", { className: "flex-1 flex flex-col gap-0.5", children: [_jsx("input", { type: "tel", inputMode: "numeric", value: displayVal, onChange: e => onDigitsChange(e.target.value.replace(/\D/g, '')), className: "input w-full", placeholder: country.nanp ? '(809) 000-0000' : '000 000 0000' }), preview && (_jsx("span", { className: "text-xs text-primary font-mono", children: preview }))] })] }));
}
// ── Validation ─────────────────────────────────────────────────────────────
const NAME_RE = /^[a-zA-ZÀ-ÿñÑ\s'-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY_FORM = {
    tipo: 'persona', nombre: '', apellido: '', relacion: '',
    country: DEFAULT_COUNTRY, digits: '', email: '', notas: '',
};
function validate(f) {
    const e = {};
    if (!f.nombre.trim())
        e['nombre'] = 'El nombre es requerido';
    else if (!NAME_RE.test(f.nombre))
        e['nombre'] = 'Solo letras, espacios y guiones';
    if (f.tipo === 'persona') {
        if (!f.apellido.trim())
            e['apellido'] = 'El apellido es requerido';
        else if (!NAME_RE.test(f.apellido))
            e['apellido'] = 'Solo letras, espacios y guiones';
    }
    if (f.email && !EMAIL_RE.test(f.email))
        e['email'] = 'Formato inválido — ej: usuario@dominio.com';
    const raw = f.digits.replace(/\D/g, '');
    if (raw && f.country.nanp && raw.length !== 10)
        e['tel'] = 'Ingresa exactamente 10 dígitos (ej. 8094659444)';
    else if (raw && !f.country.nanp && raw.length < 6)
        e['tel'] = 'Número muy corto';
    return e;
}
// ── Toast / Modal ──────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
function Modal({ title, onClose, children }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: "bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 px-6 pb-6", children: children })] }) }));
}
// ── PersonaForm component ──────────────────────────────────────────────────
function PersonaForm({ initial, onSubmit, onClose, loading, serverError }) {
    const [f, setF] = useState(initial ?? EMPTY_FORM);
    const [errs, setErrs] = useState({});
    const [dirty, setDirty] = useState(false);
    const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
    const txt = (k) => (e) => upd(k, e.target.value);
    useEffect(() => { if (dirty)
        setErrs(validate(f)); }, [f, dirty]);
    const submit = (e) => {
        e.preventDefault();
        setDirty(true);
        const v = validate(f);
        setErrs(v);
        if (Object.keys(v).length)
            return;
        onSubmit(f);
    };
    const blockNonLetters = (e) => {
        if (e.key.length === 1 && /[^a-zA-ZÀ-ÿñÑ\s'-]/.test(e.key))
            e.preventDefault();
    };
    const Err = ({ k }) => errs[k]
        ? _jsx("span", { className: "text-xs text-danger", children: errs[k] }) : null;
    return (_jsxs("form", { onSubmit: submit, className: "flex flex-col gap-4", children: [serverError && (_jsx("div", { className: "text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2", children: serverError })), _jsx("div", { className: "flex gap-2", children: ['persona', 'entidad'].map(t => (_jsxs("button", { type: "button", onClick: () => upd('tipo', t), className: `flex-1 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${f.tipo === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-primary/50'}`, children: [t === 'persona' ? _jsx(UserIcon, { className: "w-4 h-4" }) : _jsx(BuildingOfficeIcon, { className: "w-4 h-4" }), t === 'persona' ? 'Persona' : 'Entidad'] }, t))) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: [f.tipo === 'persona' ? 'Nombre(s) *' : 'Nombre *', _jsx("input", { autoFocus: true, required: true, value: f.nombre, onChange: txt('nombre'), onKeyDown: blockNonLetters, className: `input ${errs['nombre'] ? 'border-danger' : ''}`, placeholder: f.tipo === 'persona' ? 'Ej. Jhonniel' : 'Empresa XYZ' }), _jsx(Err, { k: "nombre" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Apellido(s)", f.tipo === 'persona' ? ' *' : '', _jsx("input", { required: f.tipo === 'persona', disabled: f.tipo !== 'persona', value: f.apellido, onChange: txt('apellido'), onKeyDown: blockNonLetters, className: `input ${errs['apellido'] ? 'border-danger' : ''}`, placeholder: f.tipo === 'persona' ? 'Ej. García' : '—', style: { opacity: f.tipo === 'persona' ? 1 : 0.4 } }), _jsx(Err, { k: "apellido" })] })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Relaci\u00F3n / Descripci\u00F3n", _jsx("input", { value: f.relacion, onChange: txt('relacion'), className: "input", placeholder: f.tipo === 'persona' ? 'Amigo, Familiar, Socio…' : 'Proveedor, Cliente…' })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tel\u00E9fono", _jsx(PhoneInput, { country: f.country, digits: f.digits, onCountryChange: c => upd('country', c), onDigitsChange: d => upd('digits', d) }), _jsx(Err, { k: "tel" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Correo electr\u00F3nico", _jsx("input", { type: "text", value: f.email, onChange: txt('email'), className: `input ${errs['email'] ? 'border-danger' : ''}`, placeholder: "usuario@dominio.com" }), _jsx(Err, { k: "email" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Notas", _jsx("textarea", { value: f.notas, onChange: txt('notas'), className: "input resize-none", rows: 2, placeholder: "Informaci\u00F3n adicional\u2026" })] }), _jsxs("div", { className: "flex gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
export function PersonasPage() {
    const qc = useQueryClient();
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const { data: personas = [], isLoading } = useQuery({
        queryKey: ['personas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/personas`)).data.data,
        enabled: !!cid,
    });
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null);
    const [search, setSearch] = useState('');
    const closeModal = () => setModal(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3200);
    };
    const invalidate = () => qc.invalidateQueries({ queryKey: ['personas', cid] });
    const toPayload = (f) => ({
        tipo: f.tipo,
        nombre: f.nombre.trim(),
        apellido: f.tipo === 'persona' ? (f.apellido.trim() || null) : null,
        relacion: f.relacion.trim() || null,
        telefono: buildPhone(f.country, f.digits.replace(/\D/g, '')),
        email: f.email.trim() || null,
        notas: f.notas.trim() || null,
    });
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/personas`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Persona creada'); },
        onError: (e) => setModal(p => p ? { ...p, err: e.message } : p),
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/personas/${id}`, d),
        onSuccess: () => { invalidate(); closeModal(); showToast('Actualizado'); },
        onError: (e) => setModal(p => p ? { ...p, err: e.message } : p),
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/personas/${id}`),
        onSuccess: () => { invalidate(); closeModal(); showToast('Eliminado'); },
        onError: (e) => showToast(e.message, 'error'),
    });
    const openEdit = (p) => {
        const { country, digits } = parsePhone(p.telefono);
        setModal({
            type: 'edit', persona: p,
            initial: {
                tipo: p.tipo, nombre: p.nombre, apellido: p.apellido ?? '',
                relacion: p.relacion ?? '', country, digits, email: p.email ?? '', notas: p.notas ?? '',
            },
        });
    };
    const filtered = personas.filter(p => p.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (p.relacion ?? '').toLowerCase().includes(search.toLowerCase()));
    const totalDeudas = personas.reduce((s, p) => s + p.balanceTotal, 0);
    return (_jsxs("div", { className: "flex flex-col gap-6 max-w-3xl mx-auto", children: [toast && _jsx(Toast, { ...toast }), _jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Personas y Entidades" }), _jsx("p", { className: "text-text-muted text-sm mt-0.5", children: "Contactos asociados a deudas y transacciones" })] }), _jsxs("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary flex items-center gap-2", children: [_jsx(PlusIcon, { className: "w-4 h-4" }), " Nueva persona"] })] }), personas.length > 0 && (_jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Total contactos" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: personas.length })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Personas" }), _jsx("p", { className: "text-xl font-bold text-text-primary", children: personas.filter(p => p.tipo === 'persona').length })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Deudas activas" }), _jsx("p", { className: "text-xl font-bold text-warning", children: fmtMoney(totalDeudas) })] })] })), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), className: "input", placeholder: "Buscar persona o entidad\u2026" }), isLoading && _jsx("div", { className: "flex items-center justify-center h-32 text-text-muted text-sm", children: "Cargando\u2026" }), _jsx("div", { className: "flex flex-col gap-3", children: filtered.map(p => {
                    const isPersona = p.tipo === 'persona';
                    const Ico = isPersona ? UserIcon : BuildingOfficeIcon;
                    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex items-center gap-4", children: [_jsx("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10", children: _jsx(Ico, { className: "w-5 h-5 text-primary" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-semibold text-text-primary", children: p.displayName }), _jsx("span", { className: `text-xs px-1.5 py-0.5 rounded font-medium
                    ${isPersona ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`, children: isPersona ? 'Persona' : 'Entidad' })] }), _jsxs("div", { className: "flex items-center gap-3 mt-0.5 flex-wrap", children: [p.relacion && _jsx("span", { className: "text-xs text-text-muted", children: p.relacion }), p.telefono && _jsx("span", { className: "text-xs text-text-muted font-mono", children: p.telefono }), p.email && _jsx("span", { className: "text-xs text-text-muted", children: p.email })] })] }), p.balanceTotal > 0 && (_jsxs("div", { className: "text-right flex-shrink-0", children: [_jsx("div", { className: "text-xs text-text-muted", children: "Deuda activa" }), _jsx("div", { className: "font-semibold text-danger text-sm", children: fmtMoney(p.balanceTotal) })] })), _jsxs("div", { className: "flex items-center gap-1 flex-shrink-0", children: [_jsx("button", { onClick: () => openEdit(p), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors", children: "\u270F" }), _jsx("button", { onClick: () => setModal({ type: 'delete', persona: p }), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors", children: "\uD83D\uDDD1" })] })] }, p.id));
                }) }), !isLoading && filtered.length === 0 && (_jsxs("div", { className: "text-center text-text-muted py-16 text-sm", children: [_jsx(UserIcon, { className: "w-10 h-10 mx-auto mb-3 opacity-30" }), _jsx("p", { children: search ? 'Sin resultados' : 'No hay personas ni entidades registradas' }), !search && (_jsx("button", { onClick: () => setModal({ type: 'new' }), className: "btn-primary mt-4", children: "+ A\u00F1adir primera persona" }))] })), modal?.type === 'new' && (_jsx(Modal, { title: "Nueva persona / entidad", onClose: closeModal, children: _jsx(PersonaForm, { onClose: closeModal, loading: create.isPending, serverError: modal.err, onSubmit: f => create.mutate(toPayload(f)) }) })), modal?.type === 'edit' && (_jsx(Modal, { title: "Editar persona / entidad", onClose: closeModal, children: _jsx(PersonaForm, { initial: modal.initial, onClose: closeModal, loading: update.isPending, serverError: modal.err, onSubmit: f => update.mutate({ id: modal.persona.id, d: toPayload(f) }) }) })), modal?.type === 'delete' && (_jsxs(Modal, { title: "Eliminar contacto", onClose: closeModal, children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFEliminar ", _jsx("strong", { className: "text-text-primary", children: modal.persona.displayName }), "? Esta acci\u00F3n no se puede deshacer."] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: closeModal, children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.persona.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] }))] }));
}
