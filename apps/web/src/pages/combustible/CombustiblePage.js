import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback, createContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { useFmt } from '../../lib/useFmt';
// Fix Leaflet marker icons en Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const ICON_A = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41],
});
const ICON_B = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41],
});
// ── Helpers ────────────────────────────────────────────────────────────────
const FmtCtx = createContext(() => '');
const fmtDec = (n, d = 2) => n.toLocaleString('es-DO', { minimumFractionDigits: d, maximumFractionDigits: d });
async function resolveGeoContext(lat, lon) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=3`, { headers: { 'User-Agent': 'CashMind/1.0', 'Accept-Language': 'es' } });
        const data = await r.json();
        const cc = (data.address?.country_code ?? 'do').toLowerCase();
        const name = data.address?.country ?? 'República Dominicana';
        // Viewbox amplio (~500 km) centrado en el usuario para dar prioridad regional
        const delta = 4.5;
        const viewbox = `${(lon - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lon + delta).toFixed(4)},${(lat + delta).toFixed(4)}`;
        return { coords: [lat, lon], countryCode: cc, countryName: name, viewbox };
    }
    catch {
        // Fallback: República Dominicana
        return { coords: [18.7357, -70.1627], countryCode: 'do', countryName: 'República Dominicana', viewbox: '-72.0,17.4,-68.2,20.0' };
    }
}
function useGeoContext() {
    const [ctx, setCtx] = useState(null);
    useEffect(() => {
        if (!navigator.geolocation) {
            // Sin soporte → fallback RD
            resolveGeoContext(18.7357, -70.1627).then(setCtx);
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => resolveGeoContext(pos.coords.latitude, pos.coords.longitude).then(setCtx), () => resolveGeoContext(18.7357, -70.1627).then(setCtx), // permiso denegado → RD
        { timeout: 6000, maximumAge: 300_000 });
    }, []);
    return ctx;
}
async function geocode(q, ctx) {
    const params = new URLSearchParams({
        q, format: 'json', limit: '6', addressdetails: '0',
    });
    if (ctx) {
        params.set('countrycodes', ctx.countryCode); // Prioriza resultados del país detectado
        params.set('viewbox', ctx.viewbox); // Prioriza área cercana al usuario
        params.set('bounded', '0'); // No restringe, solo da prioridad
    }
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': 'CashMind/1.0', 'Accept-Language': 'es' } });
    return r.json();
}
// ── OSRM: Distancia de conducción real ────────────────────────────────────
async function getRoute(from, to) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
        const r = await fetch(url);
        const data = await r.json();
        if (data.code !== 'Ok' || !data.routes?.[0])
            return null;
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        return { distanceKm, coords };
    }
    catch {
        return null;
    }
}
// ── MapClickHandler ────────────────────────────────────────────────────────
function MapClickHandler({ placing, onPlace }) {
    useMapEvents({
        click(e) { if (placing)
            onPlace([e.latlng.lat, e.latlng.lng], placing); },
    });
    return null;
}
// Fuerza a Leaflet a recalcular tamaño (necesario dentro de modales)
function MapResizer() {
    const map = useMap();
    useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 150); return () => clearTimeout(t); }, [map]);
    return null;
}
// ── RouteMapPicker ─────────────────────────────────────────────────────────
function RouteMapPicker({ geoCtx, onConfirm }) {
    const [posA, setPosA] = useState(null);
    const [posB, setPosB] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [distanceKm, setDistanceKm] = useState(null);
    const [placing, setPlacing] = useState(null);
    const [searchA, setSearchA] = useState('');
    const [searchB, setSearchB] = useState('');
    const [suggestA, setSuggestA] = useState([]);
    const [suggestB, setSuggestB] = useState([]);
    const [loading, setLoading] = useState(false);
    const [routeName, setRouteName] = useState('');
    const timerA = useRef();
    const timerB = useRef();
    const calcRoute = useCallback(async (a, b) => {
        setLoading(true);
        const result = await getRoute(a, b);
        setLoading(false);
        if (result) {
            setRouteCoords(result.coords);
            setDistanceKm(result.distanceKm);
        }
    }, []);
    const handlePlace = useCallback((pos, which) => {
        if (which === 'A') {
            setPosA(pos);
            setSuggestA([]);
        }
        else {
            setPosB(pos);
            setSuggestB([]);
        }
        setPlacing(null);
        setRouteCoords([]);
        setDistanceKm(null);
    }, []);
    useEffect(() => { if (posA && posB)
        calcRoute(posA, posB); }, [posA, posB, calcRoute]);
    const searchGeo = (q, which) => {
        if (which === 'A') {
            setSearchA(q);
            clearTimeout(timerA.current);
        }
        else {
            setSearchB(q);
            clearTimeout(timerB.current);
        }
        if (q.length < 3) {
            which === 'A' ? setSuggestA([]) : setSuggestB([]);
            return;
        }
        const t = setTimeout(async () => {
            const res = await geocode(q, geoCtx);
            which === 'A' ? setSuggestA(res) : setSuggestB(res);
        }, 450);
        if (which === 'A')
            timerA.current = t;
        else
            timerB.current = t;
    };
    const selectGeo = (r, which) => {
        const pos = [parseFloat(r.lat), parseFloat(r.lon)];
        if (which === 'A') {
            setPosA(pos);
            setSearchA(r.display_name.split(',')[0]);
            setSuggestA([]);
        }
        else {
            setPosB(pos);
            setSearchB(r.display_name.split(',')[0]);
            setSuggestB([]);
        }
        setRouteCoords([]);
        setDistanceKm(null);
    };
    const mapCenter = posA ?? posB ?? geoCtx?.coords ?? [18.7357, -70.1627];
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [geoCtx && (_jsxs("p", { className: "text-xs text-text-muted flex items-center gap-1.5", children: [_jsx("span", { children: "\uD83D\uDCCD" }), _jsxs("span", { children: ["B\u00FAsqueda priorizada para ", _jsx("strong", { className: "text-text-secondary", children: geoCtx.countryName })] })] })), _jsx("div", { className: "grid grid-cols-2 gap-3", children: ['A', 'B'].map(w => {
                    const search = w === 'A' ? searchA : searchB;
                    const suggest = w === 'A' ? suggestA : suggestB;
                    const pos = w === 'A' ? posA : posB;
                    const icon = w === 'A' ? '🟢' : '🔴';
                    const label = w === 'A' ? 'Origen' : 'Destino';
                    return (_jsxs("div", { className: "relative flex flex-col gap-1.5", children: [_jsxs("label", { className: "text-xs text-text-muted font-medium", children: [icon, " ", label] }), _jsx("input", { value: search, onChange: e => searchGeo(e.target.value, w), placeholder: `Buscar ${label.toLowerCase()}…`, className: "input text-sm", autoComplete: "off" }), suggest.length > 0 && (_jsx("div", { className: "absolute top-full mt-1 z-[9999] w-full bg-surface border border-border rounded-lg shadow-xl overflow-hidden", children: suggest.map((r, i) => (_jsx("button", { type: "button", onClick: () => selectGeo(r, w), className: "w-full text-left px-3 py-2 text-xs text-text-secondary hover:bg-surface-elevated truncate block border-b border-border/40 last:border-0", children: r.display_name }, i))) })), pos && _jsx("span", { className: "text-xs text-success", children: "\u2713 punto marcado" }), _jsx("button", { type: "button", onClick: () => setPlacing(p => p === w ? null : w), className: `text-xs px-2 py-1 rounded border transition-colors ${placing === w
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-muted hover:border-primary/50'}`, children: placing === w ? '⊕ Haz clic en el mapa' : '📍 Marcar en mapa' })] }, w));
                }) }), _jsx("div", { style: { height: 320, cursor: placing ? 'crosshair' : 'default' }, className: "rounded-xl overflow-hidden border border-border", children: _jsxs(MapContainer, { center: mapCenter, zoom: geoCtx ? 10 : 8, style: { height: '100%', width: '100%' }, zoomControl: true, children: [_jsx(MapResizer, {}), _jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '\u00A9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }), _jsx(MapClickHandler, { placing: placing, onPlace: handlePlace }), posA && _jsx(Marker, { position: posA, icon: ICON_A }), posB && _jsx(Marker, { position: posB, icon: ICON_B }), routeCoords.length > 1 && (_jsx(Polyline, { positions: routeCoords, color: "#22c55e", weight: 5, opacity: 0.85 }))] }) }), loading && _jsx("p", { className: "text-center text-sm text-text-muted animate-pulse", children: "Calculando ruta\u2026" }), distanceKm !== null && !loading && (_jsxs("div", { className: "bg-success/10 border border-success/30 rounded-xl p-4 text-center", children: [_jsxs("p", { className: "text-2xl font-bold text-success", children: [distanceKm.toFixed(1), " km"] }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: "Distancia de conducci\u00F3n \u00B7 OpenStreetMap / OSRM" })] })), _jsx("input", { value: routeName, onChange: e => setRouteName(e.target.value), placeholder: "Nombre de la ruta (ej. Ban\u00ED \u2192 Capital)", className: "input" }), _jsxs("button", { type: "button", disabled: distanceKm === null || !routeName.trim(), onClick: () => distanceKm !== null && routeName.trim() && onConfirm(distanceKm, routeName.trim()), className: "btn-primary w-full disabled:opacity-40", children: ["Usar esta distancia \u2192 ", distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '—'] })] }));
}
const EMPTY_V = { marca: '', modelo: '', ano: String(new Date().getFullYear()), mpgRealWorld: '', margenConsumo: '15', fuenteMpg: '' };
function VehiculoForm({ initial, onSubmit, loading, onClose }) {
    const [f, setF] = useState(initial ?? EMPTY_V);
    const upd = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(f); }, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Marca *", _jsx("input", { required: true, value: f.marca, onChange: upd('marca'), className: "input", placeholder: "Nissan" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Modelo *", _jsx("input", { required: true, value: f.modelo, onChange: upd('modelo'), className: "input", placeholder: "Note" })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["A\u00F1o *", _jsx("input", { required: true, type: "number", min: 1950, max: 2035, value: f.ano, onChange: upd('ano'), className: "input" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["MPG real *", _jsx("input", { required: true, type: "number", step: "0.1", min: 1, value: f.mpgRealWorld, onChange: upd('mpgRealWorld'), className: "input", placeholder: "34.3" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Margen %", _jsx("input", { required: true, type: "number", step: "0.5", min: 0, max: 100, value: f.margenConsumo, onChange: upd('margenConsumo'), className: "input", placeholder: "15" })] })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fuente MPG", _jsx("input", { value: f.fuenteMpg, onChange: upd('fuenteMpg'), className: "input", placeholder: "fuelly.com, EPA, medici\u00F3n propia\u2026" })] }), _jsxs("p", { className: "text-xs text-text-muted bg-surface-elevated rounded-lg px-3 py-2", children: ["\uD83D\uDCA1 MPG efectivo = ", f.mpgRealWorld && f.margenConsumo ? fmtDec(Number(f.mpgRealWorld) / (1 + Number(f.margenConsumo) / 100), 1) : '—', " mpg (con margen de ", f.margenConsumo, "%)"] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
const EMPTY_R = { vehiculoId: '', nombre: '', distanciaKm: '', vecesPorSemana: '5', tipoCombustible: 'Regular', porcentajePropio: '100' };
function RutaForm({ initial, vehiculos, geoCtx, onSubmit, loading, onClose }) {
    const [f, setF] = useState(initial ?? EMPTY_R);
    const [showMap, setShowMap] = useState(false);
    const mapSectionRef = useRef(null);
    const upd = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
    useEffect(() => {
        if (showMap && mapSectionRef.current) {
            setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
        }
    }, [showMap]);
    const kmMensual = f.distanciaKm && f.vecesPorSemana
        ? Number(f.distanciaKm) * Number(f.vecesPorSemana) * 4.33
        : 0;
    return (_jsxs("form", { onSubmit: e => { e.preventDefault(); onSubmit(f); }, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre de la ruta *", _jsx("input", { required: true, value: f.nombre, onChange: upd('nombre'), className: "input", placeholder: "Ej. Ban\u00ED \u2192 Capital (ida y vuelta)" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Veh\u00EDculo", _jsxs("select", { value: f.vehiculoId, onChange: upd('vehiculoId'), className: "input", children: [_jsx("option", { value: "", children: "Sin veh\u00EDculo" }), vehiculos.map(v => _jsxs("option", { value: v.id, children: [v.marca, " ", v.modelo, " ", v.ano] }, v.id))] })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Combustible", _jsx("select", { value: f.tipoCombustible, onChange: upd('tipoCombustible'), className: "input", children: Object.entries(TIPOS_CONFIG).map(([tipo, cfg]) => (_jsxs("option", { value: tipo, children: [cfg.emoji, " ", tipo] }, tipo))) })] })] }), f.vehiculoId && (() => {
                const v = vehiculos.find(v => v.id === f.vehiculoId);
                const tieneRend = v?.rendimientos?.some(r => r.tipoCombustible === f.tipoCombustible);
                if (!tieneRend && f.tipoCombustible !== 'Regular') {
                    return (_jsxs("p", { className: "text-xs bg-warning/10 border border-warning/30 text-warning rounded-lg px-3 py-2", children: ["\u26A0 Este veh\u00EDculo no tiene rendimiento registrado para ", _jsx("strong", { children: f.tipoCombustible }), ". Se usar\u00E1 el MPG base como fallback. Agr\u00E9galo en la pesta\u00F1a ", _jsx("strong", { children: "Veh\u00EDculos" }), "."] }));
                }
                return null;
            })(), _jsxs("div", { className: "flex flex-col gap-2 text-sm text-text-secondary", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Distancia (km) *" }), _jsxs("button", { type: "button", onClick: () => setShowMap(p => !p), className: `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${showMap
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary'}`, children: [_jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" }) }), showMap ? 'Cerrar mapa' : 'Calcular con mapa'] })] }), _jsx("input", { required: true, type: "number", step: "0.1", min: 0.1, value: f.distanciaKm, onChange: upd('distanciaKm'), className: "input", placeholder: "125" })] }), showMap && (_jsxs("div", { ref: mapSectionRef, className: "border border-border rounded-xl overflow-hidden bg-background", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface", children: [_jsx("span", { className: "text-xs font-medium text-text-secondary", children: "\uD83D\uDDFA\uFE0F Selecciona origen y destino" }), _jsx("button", { type: "button", onClick: () => setShowMap(false), className: "text-text-muted hover:text-text-primary text-sm leading-none", children: "\u00D7" })] }), _jsx("div", { className: "p-4", children: _jsx(RouteMapPicker, { geoCtx: geoCtx, onConfirm: (km, nombre) => {
                                setF(p => ({ ...p, distanciaKm: km.toFixed(1), nombre: p.nombre || nombre }));
                                setShowMap(false);
                            } }) })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Veces/semana *", _jsx("select", { value: f.vecesPorSemana, onChange: upd('vecesPorSemana'), className: "input", children: [1, 2, 3, 4, 5, 6, 7].map(n => _jsxs("option", { value: n, children: [n, " \u00D7 /semana"] }, n)) })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["% propio", _jsx("input", { type: "number", min: 0, max: 100, value: f.porcentajePropio, onChange: upd('porcentajePropio'), className: "input" })] })] }), kmMensual > 0 && (_jsxs("p", { className: "text-xs text-text-muted bg-surface-elevated rounded-lg px-3 py-2", children: ["\uD83D\uDCCA Estimado: ", _jsxs("strong", { children: [fmtDec(kmMensual, 0), " km/mes"] }), ' · ', fmtDec(kmMensual * Number(f.porcentajePropio) / 100, 0), " km neto tuyo"] })), _jsxs("div", { className: "flex gap-2 justify-end pt-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn-ghost", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
// ── Tab: Resumen ───────────────────────────────────────────────────────────
function TabResumen({ cid }) {
    const fmt = useFmt();
    const { data: calculo, isLoading } = useQuery({
        queryKey: ['combustible-calculo', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/combustible/calculo`)).data.data,
        enabled: !!cid,
    });
    if (isLoading)
        return _jsx("div", { className: "flex items-center justify-center h-48 text-text-muted text-sm", children: "Calculando\u2026" });
    if (!calculo)
        return null;
    const { totales, rutas, preciosPorTipo } = calculo;
    const kpis = [
        { label: 'km / semana', value: fmtDec(totales.kmSemanal, 0), unit: 'km', color: 'text-primary' },
        { label: 'km / mes', value: fmtDec(totales.kmMensual, 0), unit: 'km', color: 'text-primary' },
        { label: 'Costo total', value: fmt(totales.costoTotal), unit: '', color: 'text-danger' },
        { label: 'Costo neto tuyo', value: fmt(totales.costoNeto), unit: '', color: 'text-success' },
    ];
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [Object.keys(preciosPorTipo).length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: Object.entries(preciosPorTipo).map(([tipo, precio]) => {
                    const cfg = TIPOS_CONFIG[tipo] ?? { emoji: '⛽', color: 'text-text-primary' };
                    return (_jsxs("span", { className: "inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1 text-xs", children: [_jsx("span", { children: cfg.emoji }), _jsxs("span", { className: "text-text-muted", children: [tipo, ":"] }), _jsxs("span", { className: `font-semibold ${cfg.color}`, children: ["DOP ", fmtDec(precio, 2)] })] }, tipo));
                }) })), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: kpis.map(k => (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-text-muted mb-1 uppercase tracking-wider leading-tight", children: k.label }), _jsx("p", { className: `text-xl font-bold ${k.color}`, children: k.value }), k.unit && _jsx("p", { className: "text-xs text-text-muted", children: k.unit })] }, k.label))) }), rutas.length > 0 && (_jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-border", children: _jsx("h3", { className: "text-sm font-semibold text-text-primary", children: "Desglose por ruta" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs text-text-muted uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-2 text-left", children: "Ruta" }), _jsx("th", { className: "px-4 py-2 text-left", children: "Combustible" }), _jsx("th", { className: "px-4 py-2 text-right", children: "km/mes" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Consumo" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Costo total" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Costo neto" })] }) }), _jsx("tbody", { children: rutas.map((r, i) => {
                                        const cfg = TIPOS_CONFIG[r.tipoCombustible] ?? { emoji: '⛽', color: 'text-text-primary' };
                                        return (_jsxs("tr", { className: i % 2 === 0 ? '' : 'bg-surface-elevated/40', children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium text-text-primary", children: r.nombre }), r.vehiculo && (_jsxs("p", { className: "text-xs text-text-muted", children: [r.vehiculo.marca, " ", r.vehiculo.modelo, r.vehiculo.rendimientoEfectivo !== null && (_jsxs(_Fragment, { children: [" \u00B7 ", _jsx("strong", { children: fmtDec(r.vehiculo.rendimientoEfectivo, 1) }), " ", r.vehiculo.unidad === 'km_m3' ? 'km/m³' : 'mpg', " ef."] }))] }))] }), _jsxs("td", { className: "px-4 py-3", children: [_jsxs("span", { className: `inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`, children: [cfg.emoji, " ", r.tipoCombustible] }), _jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: ["DOP ", fmtDec(r.precioCombustibleUsado, 2), "/", r.unidadConsumo] })] }), _jsx("td", { className: "px-4 py-3 text-right text-text-secondary", children: fmtDec(r.kmMensual, 0) }), _jsxs("td", { className: "px-4 py-3 text-right text-text-secondary", children: [fmtDec(r.consumoMes, 2), " ", r.unidadConsumo] }), _jsx("td", { className: "px-4 py-3 text-right text-danger font-medium", children: fmt(r.costoTotal) }), _jsx("td", { className: "px-4 py-3 text-right text-success font-medium", children: fmt(r.costoNeto) })] }, r.id));
                                    }) })] }) })] })), rutas.length === 0 && (_jsxs("div", { className: "text-center py-16 text-text-muted text-sm", children: [_jsx("p", { className: "text-4xl mb-3", children: "\u26FD" }), _jsx("p", { children: "Agrega rutas y un veh\u00EDculo para ver el c\u00E1lculo" })] }))] }));
}
// ── Tab: Rutas ─────────────────────────────────────────────────────────────
function TabRutas({ cid, geoCtx }) {
    const qc = useQueryClient();
    const { data: rutas = [], isLoading } = useQuery({
        queryKey: ['rutas', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/rutas`)).data.data,
        enabled: !!cid,
    });
    const { data: vehiculos = [] } = useQuery({
        queryKey: ['vehiculos', cid],
        queryFn: async () => {
            const vs = (await api.get(`/clientes/${cid}/vehiculos`)).data.data;
            const withRend = await Promise.all(vs.map(async (v) => {
                const r = await api.get(`/vehiculos/${v.id}/rendimientos`);
                return { ...v, rendimientos: r.data.data };
            }));
            return withRend;
        },
        enabled: !!cid,
    });
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
    const inv = () => { qc.invalidateQueries({ queryKey: ['rutas', cid] }); qc.invalidateQueries({ queryKey: ['combustible-calculo', cid] }); };
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/rutas`, d),
        onSuccess: () => { inv(); setModal(null); showToast('Ruta creada'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/rutas/${id}`, d),
        onSuccess: () => { inv(); setModal(null); showToast('Ruta actualizada'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/rutas/${id}`),
        onSuccess: () => { inv(); setModal(null); showToast('Ruta eliminada'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const toPayload = (f) => ({
        nombre: f.nombre, distanciaKm: Number(f.distanciaKm), vecesPorSemana: Number(f.vecesPorSemana),
        tipoCombustible: f.tipoCombustible, porcentajePropio: Number(f.porcentajePropio), vehiculoId: f.vehiculoId || undefined,
    });
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [toast && _jsx(Toast, { ...toast }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: () => setModal('new'), className: "btn-primary text-sm flex items-center gap-2", children: "+ Nueva ruta" }) }), isLoading && _jsx("div", { className: "h-24 flex items-center justify-center text-text-muted text-sm", children: "Cargando\u2026" }), _jsxs("div", { className: "flex flex-col gap-3", children: [rutas.map(r => {
                        const kmMes = Number(r.distanciaKm) * r.vecesPorSemana * 4.33;
                        return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex items-center gap-4", children: [_jsx("div", { className: "text-2xl", children: "\uD83D\uDDFA\uFE0F" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-semibold text-text-primary", children: r.nombre }), !r.activa && _jsx("span", { className: "text-xs bg-text-muted/20 text-text-muted px-1.5 py-0.5 rounded", children: "Inactiva" })] }), _jsxs("div", { className: "flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted", children: [_jsxs("span", { children: ["\uD83D\uDCCD ", fmtDec(Number(r.distanciaKm), 1), " km"] }), _jsxs("span", { children: ["\uD83D\uDD01 ", r.vecesPorSemana, "\u00D7/sem \u2192 ", fmtDec(kmMes, 0), " km/mes"] }), _jsxs("span", { children: ["\uD83D\uDC64 ", r.porcentajePropio, "% propio"] }), r.vehiculo && _jsxs("span", { children: ["\uD83D\uDE97 ", r.vehiculo.marca, " ", r.vehiculo.modelo] }), (() => { const cfg = TIPOS_CONFIG[r.tipoCombustible]; return cfg ? _jsxs("span", { children: [cfg.emoji, " ", r.tipoCombustible] }) : null; })()] })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => setModal({ type: 'edit', ruta: r }), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10", children: "\u270F" }), _jsx("button", { onClick: () => setModal({ type: 'del', ruta: r }), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10", children: "\uD83D\uDDD1" })] })] }, r.id));
                    }), !isLoading && rutas.length === 0 && (_jsxs("div", { className: "text-center py-16 text-text-muted text-sm", children: [_jsx("p", { className: "text-4xl mb-3", children: "\uD83D\uDDFA\uFE0F" }), _jsx("p", { children: "No hay rutas registradas" })] }))] }), modal === 'new' && (_jsx(Modal, { title: "Nueva ruta", onClose: () => setModal(null), wide: true, children: _jsx(RutaForm, { vehiculos: vehiculos, geoCtx: geoCtx, loading: create.isPending, onClose: () => setModal(null), onSubmit: f => create.mutate(toPayload(f)) }) })), modal !== null && typeof modal === 'object' && modal.type === 'edit' && (_jsx(Modal, { title: "Editar ruta", onClose: () => setModal(null), wide: true, children: _jsx(RutaForm, { vehiculos: vehiculos, geoCtx: geoCtx, loading: update.isPending, onClose: () => setModal(null), initial: { vehiculoId: modal.ruta.vehiculoId ?? '', nombre: modal.ruta.nombre, distanciaKm: String(modal.ruta.distanciaKm), vecesPorSemana: String(modal.ruta.vecesPorSemana), tipoCombustible: modal.ruta.tipoCombustible, porcentajePropio: String(modal.ruta.porcentajePropio) }, onSubmit: f => update.mutate({ id: modal.ruta.id, d: toPayload(f) }) }) })), modal !== null && typeof modal === 'object' && modal.type === 'del' && (_jsxs(Modal, { title: "Eliminar ruta", onClose: () => setModal(null), children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFEliminar la ruta ", _jsx("strong", { className: "text-text-primary", children: modal.ruta.nombre }), "?"] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.ruta.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] }))] }));
}
// ── RendimientoPanel ────────────────────────────────────────────────────────
function RendimientoPanel({ vehiculo, onClose }) {
    const qc = useQueryClient();
    const { data: rendimientos = [], isLoading } = useQuery({
        queryKey: ['rendimientos', vehiculo.id],
        queryFn: async () => (await api.get(`/vehiculos/${vehiculo.id}/rendimientos`)).data.data,
    });
    const [form, setForm] = useState({ tipoCombustible: 'Regular', rendimiento: '', unidad: 'mpg', margenConsumo: '15', fuente: '' });
    const [editingId, setEditingId] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
    const inv = () => { qc.invalidateQueries({ queryKey: ['rendimientos', vehiculo.id] }); qc.invalidateQueries({ queryKey: ['combustible-calculo'] }); qc.invalidateQueries({ queryKey: ['vehiculos'] }); };
    // Cuando el tipo cambia a GNC forzar unidad km_m3
    const handleTipoCambio = (tipo) => {
        setForm(p => ({ ...p, tipoCombustible: tipo, unidad: tipo === 'GNC' ? 'km_m3' : 'mpg' }));
    };
    const upsert = useMutation({
        mutationFn: (d) => api.post(`/vehiculos/${vehiculo.id}/rendimientos`, d),
        onSuccess: () => { inv(); setForm({ tipoCombustible: 'Regular', rendimiento: '', unidad: 'mpg', margenConsumo: '15', fuente: '' }); setEditingId(null); showToast('Rendimiento guardado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/vehiculos/rendimientos/${id}`),
        onSuccess: () => { inv(); showToast('Eliminado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const startEdit = (r) => {
        setEditingId(r.id);
        setForm({ tipoCombustible: r.tipoCombustible, rendimiento: String(r.rendimiento), unidad: r.unidad, margenConsumo: String(r.margenConsumo), fuente: r.fuente ?? '' });
    };
    const cancelEdit = () => {
        setEditingId(null);
        setForm({ tipoCombustible: 'Regular', rendimiento: '', unidad: 'mpg', margenConsumo: '15', fuente: '' });
    };
    const submitForm = () => {
        if (!form.rendimiento)
            return;
        upsert.mutate({ tipoCombustible: form.tipoCombustible, rendimiento: Number(form.rendimiento), unidad: form.unidad, margenConsumo: Number(form.margenConsumo), fuente: form.fuente || undefined });
    };
    const unidadLabel = form.unidad === 'km_m3' ? 'km/m³' : 'mpg';
    const rendEfectivo = form.rendimiento && form.margenConsumo
        ? Number(form.rendimiento) / (1 + Number(form.margenConsumo) / 100)
        : null;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [toast && _jsx(Toast, { ...toast }), _jsxs("p", { className: "text-sm text-text-muted", children: ["Registra el rendimiento real de ", _jsxs("strong", { className: "text-text-primary", children: [vehiculo.marca, " ", vehiculo.modelo] }), " para cada tipo de combustible. El c\u00E1lculo de cada ruta usar\u00E1 el rendimiento del combustible que le asignes."] }), _jsxs("div", { className: "bg-surface-elevated border border-border rounded-xl p-4 flex flex-col gap-3", children: [_jsx("h4", { className: "text-sm font-semibold text-text-primary", children: editingId ? 'Editar rendimiento' : 'Agregar rendimiento' }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-xs text-text-secondary", children: ["Combustible", _jsx("select", { value: form.tipoCombustible, onChange: e => handleTipoCambio(e.target.value), className: "input text-sm", disabled: !!editingId, children: Object.entries(TIPOS_CONFIG).map(([t, c]) => _jsxs("option", { value: t, children: [c.emoji, " ", t] }, t)) })] }), _jsxs("div", { className: "flex flex-col gap-1 text-xs text-text-secondary", children: ["Rendimiento (", unidadLabel, ")", _jsx("input", { type: "number", step: "0.1", min: 0.1, value: form.rendimiento, onChange: e => setForm(p => ({ ...p, rendimiento: e.target.value })), className: "input text-sm", placeholder: form.unidad === 'km_m3' ? '12.5' : '34.3' })] }), _jsxs("div", { className: "flex flex-col gap-1 text-xs text-text-secondary", children: ["Margen consumo %", _jsx("input", { type: "number", step: "0.5", min: 0, max: 100, value: form.margenConsumo, onChange: e => setForm(p => ({ ...p, margenConsumo: e.target.value })), className: "input text-sm", placeholder: "15" })] })] }), _jsxs("div", { className: "flex flex-col gap-1 text-xs text-text-secondary", children: ["Fuente (opcional)", _jsx("input", { value: form.fuente, onChange: e => setForm(p => ({ ...p, fuente: e.target.value })), className: "input text-sm", placeholder: "Medici\u00F3n propia, fuelly.com\u2026" })] }), rendEfectivo !== null && (_jsxs("p", { className: "text-xs text-text-muted bg-background rounded-lg px-3 py-2", children: ["\uD83D\uDCA1 Rendimiento efectivo: ", _jsxs("strong", { className: "text-text-primary", children: [fmtDec(rendEfectivo, 1), " ", unidadLabel] }), " (con margen de ", form.margenConsumo, "%)"] })), _jsxs("div", { className: "flex gap-2 justify-end", children: [editingId && _jsx("button", { type: "button", className: "btn-ghost text-sm", onClick: cancelEdit, children: "Cancelar" }), _jsx("button", { type: "button", className: "btn-primary text-sm", disabled: upsert.isPending || !form.rendimiento, onClick: submitForm, children: upsert.isPending ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar' })] })] }), isLoading ? _jsx("div", { className: "h-12 flex items-center justify-center text-text-muted text-sm", children: "Cargando\u2026" }) : (_jsxs("div", { className: "flex flex-col gap-2", children: [rendimientos.length === 0 && (_jsx("p", { className: "text-center text-text-muted text-sm py-4", children: "Sin rendimientos registrados. Agrega uno arriba." })), rendimientos.map(r => {
                        const cfg = TIPOS_CONFIG[r.tipoCombustible] ?? { emoji: '⛽', color: 'text-text-primary' };
                        const ef = Number(r.rendimiento) / (1 + Number(r.margenConsumo) / 100);
                        const unidLabel = r.unidad === 'km_m3' ? 'km/m³' : 'mpg';
                        return (_jsxs("div", { className: "bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3", children: [_jsx("span", { className: "text-lg", children: cfg.emoji }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: `font-semibold text-sm ${cfg.color}`, children: r.tipoCombustible }), _jsxs("span", { className: "text-xs text-text-muted", children: [fmtDec(Number(r.rendimiento), 1), " ", unidLabel, " real \u00B7 margen ", r.margenConsumo, "%"] }), _jsxs("span", { className: "text-xs font-medium text-text-primary", children: ["\u2192 ", fmtDec(ef, 1), " ", unidLabel, " ef."] }), r.fuente && _jsxs("span", { className: "text-xs text-text-muted", children: ["\u00B7 ", r.fuente] })] }) }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => startEdit(r), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 text-xs", children: "\u270F" }), _jsx("button", { onClick: () => del.mutate(r.id), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 text-xs", children: "\uD83D\uDDD1" })] })] }, r.id));
                    })] })), _jsx("div", { className: "flex justify-end pt-2 border-t border-border", children: _jsx("button", { className: "btn-ghost text-sm", onClick: onClose, children: "Cerrar" }) })] }));
}
// ── Tab: Vehículos ─────────────────────────────────────────────────────────
function TabVehiculos({ cid }) {
    const qc = useQueryClient();
    const { data: vehiculos = [], isLoading } = useQuery({
        queryKey: ['vehiculos', cid],
        queryFn: async () => (await api.get(`/clientes/${cid}/vehiculos`)).data.data,
        enabled: !!cid,
    });
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
    const inv = () => { qc.invalidateQueries({ queryKey: ['vehiculos', cid] }); qc.invalidateQueries({ queryKey: ['combustible-calculo', cid] }); };
    const create = useMutation({
        mutationFn: (d) => api.post(`/clientes/${cid}/vehiculos`, d),
        onSuccess: () => { inv(); setModal(null); showToast('Vehículo agregado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/vehiculos/${id}`, d),
        onSuccess: () => { inv(); setModal(null); showToast('Vehículo actualizado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/vehiculos/${id}`),
        onSuccess: () => { inv(); setModal(null); showToast('Vehículo eliminado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const toPayload = (f) => ({
        marca: f.marca, modelo: f.modelo, ano: Number(f.ano),
        mpgRealWorld: Number(f.mpgRealWorld), margenConsumo: Number(f.margenConsumo),
        fuenteMpg: f.fuenteMpg || undefined,
    });
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [toast && _jsx(Toast, { ...toast }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: () => setModal('new'), className: "btn-primary text-sm", children: "+ Nuevo veh\u00EDculo" }) }), isLoading && _jsx("div", { className: "h-24 flex items-center justify-center text-text-muted text-sm", children: "Cargando\u2026" }), _jsxs("div", { className: "flex flex-col gap-3", children: [vehiculos.map(v => {
                        const mpgEf = Number(v.mpgRealWorld) / (1 + Number(v.margenConsumo) / 100);
                        return (_jsx("div", { className: "bg-surface border border-border rounded-xl p-4 flex flex-col gap-3", children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "text-3xl", children: "\uD83D\uDE97" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "font-semibold text-text-primary", children: [v.marca, " ", v.modelo, " ", v.ano] }), !v.activo && _jsx("span", { className: "text-xs bg-text-muted/20 text-text-muted px-1.5 py-0.5 rounded", children: "Inactivo" })] }), _jsxs("div", { className: "flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted", children: [_jsxs("span", { children: ["\u26A1 ", fmtDec(Number(v.mpgRealWorld), 1), " MPG base (gasolina)"] }), _jsxs("span", { children: ["\uD83D\uDCC9 Margen: ", fmtDec(Number(v.margenConsumo), 1), "%"] }), _jsxs("span", { children: ["\u2705 ", _jsxs("strong", { children: [fmtDec(mpgEf, 1), " MPG ef."] })] }), v.fuenteMpg && _jsxs("span", { children: ["\uD83D\uDCC4 ", v.fuenteMpg] })] })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => setModal({ type: 'rend', v }), className: "p-1.5 rounded text-text-muted hover:text-warning hover:bg-warning/10 text-sm", title: "Rendimientos por combustible", children: "\u26FD" }), _jsx("button", { onClick: () => setModal({ type: 'edit', v }), className: "p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10", children: "\u270F" }), _jsx("button", { onClick: () => setModal({ type: 'del', v }), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10", children: "\uD83D\uDDD1" })] })] }) }, v.id));
                    }), !isLoading && vehiculos.length === 0 && (_jsxs("div", { className: "text-center py-16 text-text-muted text-sm", children: [_jsx("p", { className: "text-4xl mb-3", children: "\uD83D\uDE97" }), _jsx("p", { children: "No hay veh\u00EDculos configurados" })] }))] }), modal === 'new' && (_jsx(Modal, { title: "Nuevo veh\u00EDculo", onClose: () => setModal(null), children: _jsx(VehiculoForm, { loading: create.isPending, onClose: () => setModal(null), onSubmit: f => create.mutate(toPayload(f)) }) })), modal !== null && typeof modal === 'object' && modal.type === 'edit' && (_jsx(Modal, { title: "Editar veh\u00EDculo", onClose: () => setModal(null), children: _jsx(VehiculoForm, { loading: update.isPending, onClose: () => setModal(null), initial: { marca: modal.v.marca, modelo: modal.v.modelo, ano: String(modal.v.ano), mpgRealWorld: String(modal.v.mpgRealWorld), margenConsumo: String(modal.v.margenConsumo), fuenteMpg: modal.v.fuenteMpg ?? '' }, onSubmit: f => update.mutate({ id: modal.v.id, d: toPayload(f) }) }) })), modal !== null && typeof modal === 'object' && modal.type === 'del' && (_jsxs(Modal, { title: "Eliminar veh\u00EDculo", onClose: () => setModal(null), children: [_jsxs("p", { className: "text-text-secondary text-sm mb-6", children: ["\u00BFEliminar ", _jsxs("strong", { className: "text-text-primary", children: [modal.v.marca, " ", modal.v.modelo] }), "?"] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost", onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { className: "btn-danger", disabled: del.isPending, onClick: () => del.mutate(modal.v.id), children: del.isPending ? 'Eliminando…' : 'Eliminar' })] })] })), modal !== null && typeof modal === 'object' && modal.type === 'rend' && (_jsx(Modal, { title: `⛽ Rendimientos · ${modal.v.marca} ${modal.v.modelo}`, onClose: () => setModal(null), wide: true, children: _jsx(RendimientoPanel, { vehiculo: modal.v, onClose: () => setModal(null) }) }))] }));
}
// ── Tab: Precios ───────────────────────────────────────────────────────────
const TIPOS_CONFIG = {
    Regular: { color: 'text-success', emoji: '🟢', unidad: 'gal' },
    Premium: { color: 'text-warning', emoji: '🟡', unidad: 'gal' },
    Gasoil: { color: 'text-primary', emoji: '🔵', unidad: 'gal' },
    GLP: { color: 'text-purple-400', emoji: '🟣', unidad: 'gal' },
    GNC: { color: 'text-slate-400', emoji: '⚪', unidad: 'm³' },
};
const TIPOS_LISTA = Object.keys(TIPOS_CONFIG);
const emptyForm = () => ({ tipo: 'Regular', precio: '', fecha: new Date().toISOString().slice(0, 10), fuente: '' });
function PrecioFormPanel({ initial, onSave, onCancel, loading }) {
    const [f, setF] = useState(initial ?? emptyForm());
    const upd = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
    const cfg = TIPOS_CONFIG[f.tipo];
    return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Tipo", _jsx("select", { value: f.tipo, onChange: upd('tipo'), className: "input", children: TIPOS_LISTA.map(t => _jsx("option", { children: t }, t)) })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Precio (DOP/", cfg?.unidad ?? 'gal', ")", _jsx("input", { type: "number", step: "0.01", value: f.precio, onChange: upd('precio'), className: "input", placeholder: "294.50" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fecha", _jsx("input", { type: "date", value: f.fecha, onChange: upd('fecha'), className: "input" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Fuente", _jsx("input", { value: f.fuente, onChange: upd('fuente'), className: "input", placeholder: "DGII, bomba..." })] })] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost text-sm", onClick: onCancel, children: "Cancelar" }), _jsx("button", { className: "btn-primary text-sm", disabled: loading || !f.precio, onClick: () => onSave(f), children: loading ? 'Guardando…' : 'Guardar' })] })] }));
}
function TabPrecios() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['combustible-precios'],
        queryFn: async () => (await api.get('/combustible/precios')).data.data,
    });
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
    const inv = () => { qc.invalidateQueries({ queryKey: ['combustible-precios'] }); qc.invalidateQueries({ queryKey: ['combustible-calculo'] }); };
    const create = useMutation({
        mutationFn: (d) => api.post('/combustible/precios', d),
        onSuccess: () => { inv(); setModal(null); showToast('Precio registrado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const update = useMutation({
        mutationFn: ({ id, d }) => api.patch(`/combustible/precios/${id}`, d),
        onSuccess: () => { inv(); setModal(null); showToast('Precio actualizado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const del = useMutation({
        mutationFn: (id) => api.delete(`/combustible/precios/${id}`),
        onSuccess: () => { inv(); showToast('Eliminado'); },
        onError: (e) => showToast(e?.response?.data?.error ?? e.message, 'error'),
    });
    const toPayload = (f) => ({
        tipo: f.tipo, precio: Number(f.precio),
        fecha: new Date(f.fecha).toISOString(),
        fuente: f.fuente || undefined,
    });
    // Historial filtrado por tipo (client-side)
    const historialPorTipo = (tipo) => (data?.lista ?? []).filter(p => p.tipo === tipo);
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [toast && _jsx(Toast, { ...toast }), data?.latest && data.latest.length > 0 && (_jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3", children: data.latest.map(p => {
                    const cfg = TIPOS_CONFIG[p.tipo] ?? { color: 'text-text-primary', emoji: '⛽', unidad: 'gal' };
                    return (_jsxs("div", { onClick: () => setModal({ type: 'history', tipo: p.tipo }), className: "bg-surface border border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-surface-elevated transition-colors group relative", title: `Ver historial de ${p.tipo}`, children: [_jsx("button", { onClick: e => { e.stopPropagation(); setModal({ type: 'edit', p }); }, className: "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 text-xs", title: "Editar precio", children: "\u270F" }), _jsx("p", { className: "text-2xl mb-1", children: cfg.emoji }), _jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider", children: p.tipo }), _jsxs("p", { className: `text-xl font-bold ${cfg.color}`, children: ["DOP ", fmtDec(Number(p.precio), 2)] }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: new Date(p.fecha).toLocaleDateString('es-DO') }), _jsx("p", { className: "text-xs text-primary/60 mt-1 opacity-0 group-hover:opacity-100 transition-opacity", children: "Ver historial \u2192" })] }, p.id));
                }) })), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: () => setModal('new'), className: "btn-primary text-sm", children: "+ Registrar precio" }) }), modal === 'new' && (_jsx(PrecioFormPanel, { loading: create.isPending, onCancel: () => setModal(null), onSave: f => create.mutate(toPayload(f)) })), isLoading ? _jsx("div", { className: "h-24 flex items-center justify-center text-text-muted text-sm", children: "Cargando\u2026" }) : (_jsxs("div", { className: "bg-surface border border-border rounded-xl overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-border", children: _jsx("h3", { className: "text-sm font-semibold text-text-primary", children: "Historial de precios" }) }), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs text-text-muted uppercase", children: [_jsx("th", { className: "px-4 py-2 text-left", children: "Tipo" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Precio" }), _jsx("th", { className: "px-4 py-2 text-left", children: "Fecha" }), _jsx("th", { className: "px-4 py-2 text-left", children: "Fuente" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: (data?.lista ?? []).map((p, i) => {
                                            const cfg = TIPOS_CONFIG[p.tipo] ?? { color: 'text-text-primary', emoji: '⛽', unidad: 'gal' };
                                            return (_jsxs("tr", { className: i % 2 === 0 ? '' : 'bg-surface-elevated/30', children: [_jsxs("td", { className: "px-4 py-2", children: [cfg.emoji, " ", p.tipo] }), _jsxs("td", { className: `px-4 py-2 text-right font-mono font-medium ${cfg.color}`, children: ["DOP ", fmtDec(Number(p.precio), 2)] }), _jsx("td", { className: "px-4 py-2 text-text-muted", children: new Date(p.fecha).toLocaleDateString('es-DO') }), _jsx("td", { className: "px-4 py-2 text-text-muted", children: p.fuente ?? '—' }), _jsxs("td", { className: "px-4 py-2 text-right flex items-center justify-end gap-2", children: [_jsx("button", { onClick: () => setModal({ type: 'edit', p }), className: "text-xs text-text-muted hover:text-primary", title: "Editar", children: "\u270F" }), _jsx("button", { onClick: () => del.mutate(p.id), className: "text-xs text-text-muted hover:text-danger", title: "Eliminar", children: "\uD83D\uDDD1" })] })] }, p.id));
                                        }) })] }), (data?.lista ?? []).length === 0 && (_jsx("p", { className: "text-center text-text-muted text-sm py-8", children: "Sin precios registrados" }))] })] })), modal !== null && typeof modal === 'object' && modal.type === 'edit' && (_jsx(Modal, { title: `Editar precio · ${modal.p.tipo}`, onClose: () => setModal(null), children: _jsx(PrecioFormPanel, { loading: update.isPending, initial: {
                        tipo: modal.p.tipo,
                        precio: String(modal.p.precio),
                        fecha: new Date(modal.p.fecha).toISOString().slice(0, 10),
                        fuente: modal.p.fuente ?? '',
                    }, onCancel: () => setModal(null), onSave: f => update.mutate({ id: modal.p.id, d: toPayload(f) }) }) })), modal !== null && typeof modal === 'object' && modal.type === 'history' && (() => {
                const tipo = modal.tipo;
                const cfg = TIPOS_CONFIG[tipo] ?? { color: 'text-text-primary', emoji: '⛽', unidad: 'gal' };
                const historial = historialPorTipo(tipo);
                return (_jsx(Modal, { title: `${cfg.emoji} Historial · ${tipo}`, onClose: () => setModal(null), children: historial.length === 0 ? (_jsxs("p", { className: "text-center text-text-muted text-sm py-8", children: ["Sin registros para ", tipo] })) : (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs text-text-muted uppercase", children: [_jsx("th", { className: "py-2 text-left", children: "Fecha" }), _jsx("th", { className: "py-2 text-right", children: "Precio" }), _jsx("th", { className: "py-2 text-left pl-4", children: "Fuente" })] }) }), _jsx("tbody", { children: historial.map((p, i) => (_jsxs("tr", { className: i % 2 === 0 ? '' : 'bg-surface-elevated/30', children: [_jsx("td", { className: "py-2 text-text-muted", children: new Date(p.fecha).toLocaleDateString('es-DO') }), _jsxs("td", { className: `py-2 text-right font-mono font-bold ${cfg.color}`, children: ["DOP ", fmtDec(Number(p.precio), 2)] }), _jsx("td", { className: "py-2 text-text-muted pl-4", children: p.fuente ?? '—' })] }, p.id))) })] }), historial.length > 1 && (() => {
                                const max = Math.max(...historial.map(p => Number(p.precio)));
                                const min = Math.min(...historial.map(p => Number(p.precio)));
                                const avg = historial.reduce((s, p) => s + Number(p.precio), 0) / historial.length;
                                return (_jsx("div", { className: "mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4", children: [{ label: 'Mínimo', val: min, color: 'text-success' }, { label: 'Promedio', val: avg, color: 'text-warning' }, { label: 'Máximo', val: max, color: 'text-danger' }].map(s => (_jsxs("div", { className: "text-center bg-surface-elevated rounded-lg p-2", children: [_jsx("p", { className: "text-xs text-text-muted", children: s.label }), _jsxs("p", { className: `font-bold text-sm ${s.color}`, children: ["DOP ", fmtDec(s.val, 2)] })] }, s.label))) }));
                            })()] })) }));
            })()] }));
}
function TabTransportePublico() {
    const fmt = useFmt();
    const LS_KEY = 'cm_transp_publico';
    const load = () => { try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    }
    catch {
        return [];
    } };
    const [viajes, setViajes] = useState(load);
    const [form, setForm] = useState({ nombre: '', costoPorViaje: '', vecesPorSemana: '10' });
    const [showForm, setShowForm] = useState(false);
    const save = (list) => { setViajes(list); localStorage.setItem(LS_KEY, JSON.stringify(list)); };
    const add = () => {
        if (!form.nombre.trim() || !form.costoPorViaje)
            return;
        save([...viajes, { id: Date.now().toString(), nombre: form.nombre.trim(), costoPorViaje: Number(form.costoPorViaje), vecesPorSemana: Number(form.vecesPorSemana) }]);
        setForm({ nombre: '', costoPorViaje: '', vecesPorSemana: '10' });
        setShowForm(false);
    };
    const remove = (id) => save(viajes.filter(v => v.id !== id));
    const totalMensual = viajes.reduce((s, v) => s + v.costoPorViaje * v.vecesPorSemana * 4.33, 0);
    const totalSemanal = viajes.reduce((s, v) => s + v.costoPorViaje * v.vecesPorSemana, 0);
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx("div", { className: "bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-text-secondary", children: "\uD83D\uDE8C Registra tus gastos habituales en transporte p\u00FAblico (autob\u00FAs, metro, taxi, guagua, motoconcho\u2026) para comparar contra el costo de usar tu veh\u00EDculo." }), viajes.length > 0 && (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 text-center", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Gasto semanal" }), _jsx("p", { className: "text-xl font-bold text-warning", children: fmt(totalSemanal) })] }), _jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 text-center", children: [_jsx("p", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Gasto mensual" }), _jsx("p", { className: "text-xl font-bold text-danger", children: fmt(totalMensual) })] })] })), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: () => setShowForm(p => !p), className: "btn-primary text-sm", children: "+ Agregar viaje" }) }), showForm && (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex flex-col gap-3", children: [_jsx("h3", { className: "text-sm font-semibold text-text-primary", children: "Nuevo viaje en transporte p\u00FAblico" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Nombre / ruta", _jsx("input", { value: form.nombre, onChange: e => setForm(p => ({ ...p, nombre: e.target.value })), className: "input", placeholder: "Casa \u2192 Trabajo (guagua)" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Costo por viaje (DOP)", _jsx("input", { type: "number", step: "5", min: 1, value: form.costoPorViaje, onChange: e => setForm(p => ({ ...p, costoPorViaje: e.target.value })), className: "input", placeholder: "80" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm text-text-secondary", children: ["Viajes / semana", _jsx("input", { type: "number", min: 1, max: 50, value: form.vecesPorSemana, onChange: e => setForm(p => ({ ...p, vecesPorSemana: e.target.value })), className: "input", placeholder: "10" })] })] }), form.costoPorViaje && form.vecesPorSemana && (_jsxs("p", { className: "text-xs text-text-muted bg-surface-elevated rounded-lg px-3 py-2", children: ["\uD83D\uDCCA Estimado: ", _jsxs("strong", { children: [fmt(Number(form.costoPorViaje) * Number(form.vecesPorSemana)), "/semana"] }), " \u00B7 ", _jsxs("strong", { children: [fmt(Number(form.costoPorViaje) * Number(form.vecesPorSemana) * 4.33), "/mes"] })] })), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-ghost text-sm", onClick: () => setShowForm(false), children: "Cancelar" }), _jsx("button", { className: "btn-primary text-sm", onClick: add, disabled: !form.nombre || !form.costoPorViaje, children: "Agregar" })] })] })), _jsxs("div", { className: "flex flex-col gap-3", children: [viajes.map(v => {
                        const semana = v.costoPorViaje * v.vecesPorSemana;
                        const mes = semana * 4.33;
                        return (_jsxs("div", { className: "bg-surface border border-border rounded-xl p-4 flex items-center gap-4", children: [_jsx("div", { className: "text-2xl", children: "\uD83D\uDE8C" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "font-semibold text-text-primary", children: v.nombre }), _jsxs("div", { className: "flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted", children: [_jsxs("span", { children: ["\uD83D\uDCB0 DOP ", fmtDec(v.costoPorViaje, 0), "/viaje"] }), _jsxs("span", { children: ["\uD83D\uDD01 ", v.vecesPorSemana, " viajes/sem"] }), _jsxs("span", { children: ["\uD83D\uDCC5 ", fmt(semana), "/sem \u00B7 ", _jsxs("strong", { className: "text-text-primary", children: [fmt(mes), "/mes"] })] })] })] }), _jsx("button", { onClick: () => remove(v.id), className: "p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10", children: "\uD83D\uDDD1" })] }, v.id));
                    }), viajes.length === 0 && !showForm && (_jsxs("div", { className: "text-center py-16 text-text-muted text-sm", children: [_jsx("p", { className: "text-4xl mb-3", children: "\uD83D\uDE8C" }), _jsx("p", { children: "Agrega rutas en transporte p\u00FAblico para calcular tu gasto mensual" })] }))] })] }));
}
// ── Helpers UI ─────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    return (_jsx("div", { className: `fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`, children: msg }));
}
function Modal({ title, onClose, children, wide }) {
    return (_jsx("div", { className: "fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4", children: _jsxs("div", { className: `bg-surface border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh] ${wide ? 'w-full max-w-3xl' : 'w-full max-w-md'}`, children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-border", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "text-text-muted hover:text-text-primary text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto flex-1 p-6", children: children })] }) }));
}
// ── Main Page ──────────────────────────────────────────────────────────────
const TABS = [
    { id: 'resumen', label: '📊 Resumen' },
    { id: 'rutas', label: '🗺️ Rutas' },
    { id: 'vehiculos', label: '🚗 Vehículos' },
    { id: 'precios', label: '⛽ Precios' },
    { id: 'publico', label: '🚌 Transporte público' },
];
export function CombustiblePage() {
    const cid = useAuthStore(s => s.clienteActivo?.id) ?? '';
    const [tab, setTab] = useState('resumen');
    const geoCtx = useGeoContext(); // detecta ubicación + país una sola vez al cargar
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary", children: "Combustible y Transporte" }), _jsxs("p", { className: "text-text-muted text-sm mt-0.5", children: ["Calcula tu gasto mensual en movilidad", geoCtx && _jsxs("span", { className: "ml-2 text-xs", children: ["\u00B7 \uD83D\uDCCD ", geoCtx.countryName] })] })] }), _jsx("div", { className: "flex gap-1 border-b border-border overflow-x-auto pb-0 -mb-px", children: TABS.map(t => (_jsx("button", { onClick: () => setTab(t.id), className: `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`, children: t.label }, t.id))) }), _jsxs("div", { children: [tab === 'resumen' && _jsx(TabResumen, { cid: cid }), tab === 'rutas' && _jsx(TabRutas, { cid: cid, geoCtx: geoCtx }), tab === 'vehiculos' && _jsx(TabVehiculos, { cid: cid }), tab === 'precios' && _jsx(TabPrecios, {}), tab === 'publico' && _jsx(TabTransportePublico, {})] })] }));
}
