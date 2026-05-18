import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useFmt } from '../../lib/useFmt'

// Fix Leaflet marker icons en Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})
const ICON_A = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
})
const ICON_B = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
})

// ── Types ──────────────────────────────────────────────────────────────────
interface Rendimiento { id: string; tipoCombustible: string; rendimiento: number; unidad: string; margenConsumo: number; fuente: string | null }
interface Vehiculo { id: string; marca: string; modelo: string; ano: number; mpgRealWorld: number; margenConsumo: number; fuenteMpg: string | null; activo: boolean; rendimientos?: Rendimiento[] }
interface Ruta { id: string; nombre: string; distanciaKm: number; frecuenciaValor: number; frecuenciaUnidad: string; diasSemana: string | null; tipoCombustible: string; porcentajePropio: number; activa: boolean; vehiculoId: string | null; vehiculo: { id: string; marca: string; modelo: string; ano: number } | null; rendimientoManual: number | null; unidadRendimiento: string }
interface Precio { id: string; tipo: string; precio: number; moneda: string; fecha: string; fuente: string | null }
interface CalcRuta { id: string; nombre: string; distanciaKm: number; frecuenciaValor: number; frecuenciaUnidad: string; diasSemana: string | null; tipoCombustible: string; porcentajePropio: number; vehiculo: { marca: string; modelo: string; rendimientoEfectivo: number | null; unidad: string } | null; kmSemanal: number; kmMensual: number; consumoMes: number; unidadConsumo: string; costoTotal: number; costoNeto: number; precioCombustibleUsado: number; kmPeriodo: number | null; consumoPeriodo: number | null; costoPeriodo: number | null; costoNetoPeriodo: number | null }
interface Calculo { preciosPorTipo: Record<string, number>; rutas: CalcRuta[]; totales: { kmSemanal: number; kmMensual: number; costoTotal: number; costoNeto: number; kmPeriodo: number; costoPeriodo: number; costoNetoPeriodo: number }; periodDays: number | null; periodoInicio: string | null; periodoFin: string | null }

// ── Helpers ────────────────────────────────────────────────────────────────
const FmtCtx = createContext<(n: number, isTotal?: boolean) => string>(() => '')
const fmtDec = (n: number, d = 2) => n.toLocaleString('es-DO', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── Geolocalización + contexto de país ────────────────────────────────────
type LatLng = [number, number]

interface GeoContext {
  coords: LatLng          // [lat, lon] del usuario
  countryCode: string     // ISO-2 ej. "do", "us", "es"
  countryName: string     // Nombre legible
  viewbox: string         // lon_min,lat_min,lon_max,lat_max para Nominatim
}

async function resolveGeoContext(lat: number, lon: number): Promise<GeoContext> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=3`,
      { headers: { 'User-Agent': 'CashMind/1.0', 'Accept-Language': 'es' } }
    )
    const data = await r.json()
    const cc: string = (data.address?.country_code ?? 'do').toLowerCase()
    const name: string = data.address?.country ?? 'República Dominicana'
    // Viewbox amplio (~500 km) centrado en el usuario para dar prioridad regional
    const delta = 4.5
    const viewbox = `${(lon - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lon + delta).toFixed(4)},${(lat + delta).toFixed(4)}`
    return { coords: [lat, lon], countryCode: cc, countryName: name, viewbox }
  } catch {
    // Fallback: República Dominicana
    return { coords: [18.7357, -70.1627], countryCode: 'do', countryName: 'República Dominicana', viewbox: '-72.0,17.4,-68.2,20.0' }
  }
}

function useGeoContext() {
  const [ctx, setCtx] = useState<GeoContext | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      // Sin soporte → fallback RD
      resolveGeoContext(18.7357, -70.1627).then(setCtx)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolveGeoContext(pos.coords.latitude, pos.coords.longitude).then(setCtx),
      ()  => resolveGeoContext(18.7357, -70.1627).then(setCtx),   // permiso denegado → RD
      { timeout: 6000, maximumAge: 300_000 }
    )
  }, [])

  return ctx
}

// ── Nominatim geocoding con prioridad de país ──────────────────────────────
interface GeoResult { display_name: string; lat: string; lon: string }

async function geocode(q: string, ctx: GeoContext | null): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    q, format: 'json', limit: '6', addressdetails: '0',
  })
  if (ctx) {
    params.set('countrycodes', ctx.countryCode)   // Prioriza resultados del país detectado
    params.set('viewbox', ctx.viewbox)             // Prioriza área cercana al usuario
    params.set('bounded', '0')                     // No restringe, solo da prioridad
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'CashMind/1.0', 'Accept-Language': 'es' } }
  )
  return r.json()
}

// ── OSRM: Distancia de conducción real ────────────────────────────────────
async function getRoute(from: LatLng, to: LatLng): Promise<{ distanceKm: number; coords: LatLng[] } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    const r = await fetch(url)
    const data = await r.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null
    const route = data.routes[0]
    const distanceKm = route.distance / 1000
    const coords: LatLng[] = route.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon])
    return { distanceKm, coords }
  } catch { return null }
}

// ── MapClickHandler ────────────────────────────────────────────────────────
function MapClickHandler({ placing, onPlace }: { placing: 'A' | 'B' | null; onPlace(pos: LatLng, which: 'A' | 'B'): void }) {
  useMapEvents({
    click(e) { if (placing) onPlace([e.latlng.lat, e.latlng.lng], placing) },
  })
  return null
}

// Fuerza a Leaflet a recalcular tamaño (necesario dentro de modales)
function MapResizer() {
  const map = useMap()
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 150); return () => clearTimeout(t) }, [map])
  return null
}

// ── RouteMapPicker ─────────────────────────────────────────────────────────
function RouteMapPicker({ geoCtx, onConfirm }: {
  geoCtx: GeoContext | null
  onConfirm(km: number, nombre: string): void
}) {
  const [posA, setPosA] = useState<LatLng | null>(null)
  const [posB, setPosB] = useState<LatLng | null>(null)
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([])
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [placing, setPlacing] = useState<'A' | 'B' | null>(null)
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [suggestA, setSuggestA] = useState<GeoResult[]>([])
  const [suggestB, setSuggestB] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [routeName, setRouteName] = useState('')
  const timerA = useRef<ReturnType<typeof setTimeout>>()
  const timerB = useRef<ReturnType<typeof setTimeout>>()

  const calcRoute = useCallback(async (a: LatLng, b: LatLng) => {
    setLoading(true)
    const result = await getRoute(a, b)
    setLoading(false)
    if (result) { setRouteCoords(result.coords); setDistanceKm(result.distanceKm) }
  }, [])

  const handlePlace = useCallback((pos: LatLng, which: 'A' | 'B') => {
    if (which === 'A') { setPosA(pos); setSuggestA([]) }
    else { setPosB(pos); setSuggestB([]) }
    setPlacing(null)
    setRouteCoords([]); setDistanceKm(null)
  }, [])

  useEffect(() => { if (posA && posB) calcRoute(posA, posB) }, [posA, posB, calcRoute])

  const searchGeo = (q: string, which: 'A' | 'B') => {
    if (which === 'A') { setSearchA(q); clearTimeout(timerA.current) }
    else { setSearchB(q); clearTimeout(timerB.current) }
    if (q.length < 3) { which === 'A' ? setSuggestA([]) : setSuggestB([]); return }
    const t = setTimeout(async () => {
      const res = await geocode(q, geoCtx)
      which === 'A' ? setSuggestA(res) : setSuggestB(res)
    }, 450)
    if (which === 'A') timerA.current = t; else timerB.current = t
  }

  const selectGeo = (r: GeoResult, which: 'A' | 'B') => {
    const pos: LatLng = [parseFloat(r.lat), parseFloat(r.lon)]
    if (which === 'A') { setPosA(pos); setSearchA(r.display_name.split(',')[0]!); setSuggestA([]) }
    else { setPosB(pos); setSearchB(r.display_name.split(',')[0]!); setSuggestB([]) }
    setRouteCoords([]); setDistanceKm(null)
  }

  const mapCenter: LatLng = posA ?? posB ?? geoCtx?.coords ?? [18.7357, -70.1627]

  return (
    <div className="flex flex-col gap-4">
      {/* Indicador de país detectado */}
      {geoCtx && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <span>📍</span>
          <span>Búsqueda priorizada para <strong className="text-text-secondary">{geoCtx.countryName}</strong></span>
        </p>
      )}

      {/* Inputs de búsqueda */}
      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as const).map(w => {
          const search = w === 'A' ? searchA : searchB
          const suggest = w === 'A' ? suggestA : suggestB
          const pos = w === 'A' ? posA : posB
          const icon = w === 'A' ? '🟢' : '🔴'
          const label = w === 'A' ? 'Origen' : 'Destino'
          return (
            <div key={w} className="relative flex flex-col gap-1.5">
              <label className="text-xs text-text-muted font-medium">{icon} {label}</label>
              <input
                value={search}
                onChange={e => searchGeo(e.target.value, w)}
                placeholder={`Buscar ${label.toLowerCase()}…`}
                className="input text-sm"
                autoComplete="off"
              />
              {/* Dropdown de sugerencias */}
              {suggest.length > 0 && (
                <div className="absolute top-full mt-1 z-[9999] w-full bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                  {suggest.map((r, i) => (
                    <button key={i} type="button" onClick={() => selectGeo(r, w)}
                      className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:bg-surface-elevated truncate block border-b border-border/40 last:border-0">
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
              {pos && <span className="text-xs text-success">✓ punto marcado</span>}
              <button
                type="button"
                onClick={() => setPlacing(p => p === w ? null : w)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  placing === w
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted hover:border-primary/50'
                }`}>
                {placing === w ? '⊕ Haz clic en el mapa' : '📍 Marcar en mapa'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Mapa */}
      <div
        style={{ height: 320, cursor: placing ? 'crosshair' : 'default' }}
        className="rounded-xl overflow-hidden border border-border">
        <MapContainer
          center={mapCenter}
          zoom={geoCtx ? 10 : 8}
          style={{ height: '100%', width: '100%' }}
          zoomControl>
          <MapResizer />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapClickHandler placing={placing} onPlace={handlePlace} />
          {posA && <Marker position={posA} icon={ICON_A} />}
          {posB && <Marker position={posB} icon={ICON_B} />}
          {routeCoords.length > 1 && (
            <Polyline positions={routeCoords} color="#22c55e" weight={5} opacity={0.85} />
          )}
        </MapContainer>
      </div>

      {/* Resultado */}
      {loading && <p className="text-center text-sm text-text-muted animate-pulse">Calculando ruta…</p>}
      {distanceKm !== null && !loading && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-success">{distanceKm.toFixed(1)} km</p>
          <p className="text-xs text-text-muted mt-1">Distancia de conducción · OpenStreetMap / OSRM</p>
        </div>
      )}

      {/* Nombre + confirmar */}
      <input
        value={routeName}
        onChange={e => setRouteName(e.target.value)}
        placeholder="Nombre de la ruta (ej. Baní → Capital)"
        className="input"
      />
      <button
        type="button"
        disabled={distanceKm === null || !routeName.trim()}
        onClick={() => distanceKm !== null && routeName.trim() && onConfirm(distanceKm, routeName.trim())}
        className="btn-primary w-full disabled:opacity-40">
        Usar esta distancia → {distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '—'}
      </button>
    </div>
  )
}

// ── VehiculoForm ───────────────────────────────────────────────────────────
interface VForm { marca: string; modelo: string; ano: string; mpgRealWorld: string; margenConsumo: string; fuenteMpg: string; catalogoId?: string }
const EMPTY_V: VForm = { marca: '', modelo: '', ano: String(new Date().getFullYear()), mpgRealWorld: '', margenConsumo: '15', fuenteMpg: '', catalogoId: undefined }

interface CatalogoEntry { id: string; marca: string; modelo: string; anoDesde: number; anoHasta: number | null; motor: string | null; transmision: string | null; mpgCombinado: number; mpgCiudad: number; mpgCarretera: number }

function VehiculoForm({ initial, onSubmit, loading, onClose }: { initial?: VForm; onSubmit(d: VForm): void; loading: boolean; onClose(): void }) {
  const [f, setF] = useState<VForm>(initial ?? EMPTY_V)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState<CatalogoEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [fromCatalog, setFromCatalog] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const upd = (k: keyof VForm) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  // Debounced catalog search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (catalogSearch.length < 2) { setCatalogResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setCatalogLoading(true)
      try {
        const { data } = await api.get(`/combustible/catalogo-vehiculos?q=${encodeURIComponent(catalogSearch)}`)
        setCatalogResults(data.data ?? [])
      } catch { setCatalogResults([]) }
      finally { setCatalogLoading(false) }
    }, 350)
  }, [catalogSearch])

  const selectCatalog = (c: CatalogoEntry) => {
    setF({
      marca: c.marca,
      modelo: c.modelo,
      ano: String(c.anoDesde),
      mpgRealWorld: String(c.mpgCombinado),
      margenConsumo: '15',
      fuenteMpg: 'Catálogo CashMind',
      catalogoId: c.id,
    })
    setFromCatalog(true)
    setCatalogSearch('')
    setCatalogResults([])
  }

  const clearCatalog = () => {
    setFromCatalog(false)
    setF(p => ({ ...p, catalogoId: undefined }))
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f) }} className="flex flex-col gap-4">
      {/* ── Catalog search (only for new vehicles, not editing) ── */}
      {!initial && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">Buscar en catálogo</span>
            {fromCatalog && (
              <button type="button" onClick={clearCatalog}
                className="text-xs text-text-muted hover:text-primary transition-colors">
                Ingresar manualmente
              </button>
            )}
          </div>
          {fromCatalog ? (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <span className="text-sm text-primary">📋 {f.marca} {f.modelo} ({f.ano})</span>
              <span className="text-xs text-text-muted">· {f.mpgRealWorld} mpg (combinado)</span>
            </div>
          ) : (
            <div className="relative">
              <input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="input"
                placeholder="Ej. Nissan Note, Corolla, Picanto…"
              />
              {catalogLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted animate-pulse">Buscando…</span>
              )}
              {catalogResults.length > 0 && (
                <div className="absolute top-full mt-1 z-50 w-full bg-surface border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {catalogResults.map(c => (
                    <button key={c.id} type="button" onClick={() => selectCatalog(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-elevated transition-colors border-b border-border/40 last:border-0 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{c.marca} {c.modelo}</p>
                        <p className="text-xs text-text-muted">
                          {c.anoDesde}{c.anoHasta ? `–${c.anoHasta}` : '+'} · {c.motor ?? '—'} · {c.transmision ?? '—'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-primary">{c.mpgCombinado} mpg</p>
                        <p className="text-xs text-text-muted">{c.mpgCiudad}/{c.mpgCarretera} ciudad/carr.</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-text-muted mt-1">O completa los campos manualmente abajo ↓</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Marca *
          <input required value={f.marca} onChange={upd('marca')} className="input" placeholder="Nissan" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Modelo *
          <input required value={f.modelo} onChange={upd('modelo')} className="input" placeholder="Note" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Año *
          <input required type="number" min={1950} max={2035} value={f.ano} onChange={upd('ano')} className="input" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          MPG real *
          <input required type="number" step="0.1" min={1} value={f.mpgRealWorld} onChange={upd('mpgRealWorld')} className="input" placeholder="34.3" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Margen %
          <input required type="number" step="0.5" min={0} max={100} value={f.margenConsumo} onChange={upd('margenConsumo')} className="input" placeholder="15" />
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Fuente MPG
        <input value={f.fuenteMpg} onChange={upd('fuenteMpg')} className="input" placeholder="fuelly.com, EPA, medición propia…" />
      </div>
      <p className="text-xs text-text-muted bg-surface-elevated rounded-lg px-3 py-2">
        💡 MPG efectivo = {f.mpgRealWorld && f.margenConsumo ? fmtDec(Number(f.mpgRealWorld) / (1 + Number(f.margenConsumo) / 100), 1) : '—'} mpg (con margen de {f.margenConsumo}%)
      </p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// ── RutaForm ───────────────────────────────────────────────────────────────
interface RForm {
  vehiculoId: string; nombre: string; distanciaKm: string
  frecuenciaValor: string; frecuenciaUnidad: 'dia' | 'semana' | 'mes'
  diasSemana: string  // comma-separated day numbers 0-6 when frecuenciaUnidad=semana
  tipoCombustible: string; porcentajePropio: string
  rendimientoManual: string; unidadRendimiento: 'mpg' | 'km_l' | 'km_m3'
  crearEvento: boolean; eventoFechaInicio: string; eventoPerpetuo: boolean; eventoFechaFin: string
}
const EMPTY_R: RForm = {
  vehiculoId: '', nombre: '', distanciaKm: '',
  frecuenciaValor: '5', frecuenciaUnidad: 'semana', diasSemana: '',
  tipoCombustible: 'Gasolina Regular', porcentajePropio: '100',
  rendimientoManual: '', unidadRendimiento: 'mpg',
  crearEvento: false, eventoFechaInicio: '', eventoPerpetuo: true, eventoFechaFin: '',
}

function RutaForm({ initial, vehiculos, geoCtx, onSubmit, loading, onClose, preciosPorTipo }: {
  initial?: RForm; vehiculos: Vehiculo[]; geoCtx: GeoContext | null
  preciosPorTipo: Record<string, number>
  onSubmit(d: RForm): void; loading: boolean; onClose(): void
}) {
  const [f, setF] = useState<RForm>(initial ?? EMPTY_R)
  const [showMap, setShowMap] = useState(false)
  const mapSectionRef = useRef<HTMLDivElement>(null)
  const eventoSectionRef = useRef<HTMLDivElement>(null)
  const upd = (k: keyof RForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    if (showMap && mapSectionRef.current) {
      setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    }
  }, [showMap])

  const frecVal = Number(f.frecuenciaValor) || 0
  const dist = Number(f.distanciaKm) || 0
  const kmMensual = dist === 0 || frecVal === 0 ? 0
    : f.frecuenciaUnidad === 'dia' ? dist * frecVal * 30.44
    : f.frecuenciaUnidad === 'mes' ? dist * frecVal
    : dist * frecVal * 4.33

  // Fuel cost estimate
  const vehiculo = vehiculos.find(v => v.id === f.vehiculoId)
  const rendEspecifico = vehiculo?.rendimientos?.find(r => r.tipoCombustible === f.tipoCombustible)
  const mpgEfectivo = rendEspecifico
    ? Number(rendEspecifico.rendimiento) / (1 + Number(rendEspecifico.margenConsumo) / 100)
    : vehiculo
      ? Number(vehiculo.mpgRealWorld) / (1 + Number(vehiculo.margenConsumo) / 100)
      : f.rendimientoManual ? Number(f.rendimientoManual) : null
  const unidadRend = rendEspecifico?.unidad ?? (vehiculo ? 'mpg' : f.unidadRendimiento)
  const precioFuel = preciosPorTipo[f.tipoCombustible] ?? 0
  const costoMensual = mpgEfectivo && kmMensual > 0 && precioFuel > 0 ? (() => {
    if (unidadRend === 'mpg') return (kmMensual / 1.60934 / mpgEfectivo) * precioFuel
    return (kmMensual / mpgEfectivo) * precioFuel
  })() : null

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f) }} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        Nombre de la ruta *
        <input required value={f.nombre} onChange={upd('nombre')} className="input"
          placeholder="Ej. Baní → Capital (ida y vuelta)" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Vehículo
          <select value={f.vehiculoId} onChange={upd('vehiculoId')} className="input">
            <option value="">Sin vehículo</option>
            {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} {v.ano}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Combustible
          <select value={f.tipoCombustible} onChange={upd('tipoCombustible')} className="input">
            {Object.entries(TIPOS_CONFIG).map(([tipo, cfg]) => (
              <option key={tipo} value={tipo}>{cfg.emoji} {tipo}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Aviso de rendimiento del vehículo */}
      {f.vehiculoId && (() => {
        const v = vehiculos.find(v => v.id === f.vehiculoId)
        const tieneRend = v?.rendimientos?.some(r => r.tipoCombustible === f.tipoCombustible)
        const mpgBase = v ? Number(v.mpgRealWorld) : 0
        if (!tieneRend && mpgBase <= 0) {
          // Sin rendimiento específico NI mpg base — cálculo imposible
          return (
            <p className="text-xs bg-warning/10 border border-warning/30 text-warning rounded-lg px-3 py-2">
              ⚠ Este vehículo no tiene MPG registrado. Agrégalo en la pestaña <strong>Vehículos</strong> para ver el costo estimado.
            </p>
          )
        }
        if (!tieneRend && mpgBase > 0) {
          // Usando mpgRealWorld como fallback — solo info, no advertencia
          const margen = v ? Number(v.margenConsumo) : 0
          const mpgEf = +(mpgBase / (1 + margen / 100)).toFixed(1)
          return (
            <p className="text-xs bg-primary/5 border border-primary/20 text-text-muted rounded-lg px-3 py-2">
              ℹ Usando MPG base del vehículo: <strong className="text-text-secondary">{mpgEf} mpg efectivo</strong> · Para mayor precisión, agrega el rendimiento por combustible en <strong>Vehículos</strong>.
            </p>
          )
        }
        return null
      })()}

      {/* Distancia + toggle mapa */}
      <div className="flex flex-col gap-2 text-sm text-text-secondary">
        <div className="flex items-center justify-between">
          <span>Distancia (km) *</span>
          <button
            type="button"
            onClick={() => setShowMap(p => !p)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${showMap
                ? 'border-primary bg-primary text-white'
                : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary'}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {showMap ? 'Cerrar mapa' : 'Calcular con mapa'}
          </button>
        </div>
        <input
          required type="number" step="0.1" min={0.1}
          value={f.distanciaKm} onChange={upd('distanciaKm')}
          className="input" placeholder="125"
        />
      </div>

      {/* Mapa inline */}
      {showMap && (
        <div ref={mapSectionRef} className="border border-border rounded-xl overflow-hidden bg-background">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
            <span className="text-xs font-medium text-text-secondary">🗺️ Selecciona origen y destino</span>
            <button type="button" onClick={() => setShowMap(false)}
              className="text-text-muted hover:text-text-primary text-sm leading-none">&times;</button>
          </div>
          <div className="p-4">
            <RouteMapPicker
              geoCtx={geoCtx}
              onConfirm={(km, nombre) => {
                setF(p => ({ ...p, distanciaKm: km.toFixed(1), nombre: p.nombre || nombre }))
                setShowMap(false)
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Frecuencia *
          <input type="number" min={1} max={365} required
            value={f.frecuenciaValor} onChange={upd('frecuenciaValor')} className="input" placeholder="5" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Unidad
          <select value={f.frecuenciaUnidad}
            onChange={e => setF(p => ({ ...p, frecuenciaUnidad: e.target.value as RForm['frecuenciaUnidad'], diasSemana: '' }))}
            className="input">
            <option value="dia">× por día</option>
            <option value="semana">× por semana</option>
            <option value="mes">× por mes</option>
          </select>
        </div>
      </div>

      {/* ── Días de la semana (solo cuando frecuencia = por semana) ── */}
      {f.frecuenciaUnidad === 'semana' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-text-secondary">Días de la semana <span className="text-text-muted font-normal">(opcional — para cálculo exacto de períodos)</span></span>
          <div className="flex gap-1.5">
            {([{d:1,l:'L'},{d:2,l:'M'},{d:3,l:'X'},{d:4,l:'J'},{d:5,l:'V'},{d:6,l:'S'},{d:0,l:'D'}] as const).map(({ d, l }) => {
              const sel = f.diasSemana.split(',').filter(Boolean).includes(String(d))
              return (
                <button key={d} type="button"
                  onClick={() => {
                    const dias = f.diasSemana.split(',').filter(Boolean)
                    const next = sel ? dias.filter(x => x !== String(d)) : [...dias, String(d)]
                    next.sort()
                    setF(p => ({ ...p, diasSemana: next.join(','), frecuenciaValor: String(next.length || p.frecuenciaValor) }))
                  }}
                  className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors select-none
                    ${sel ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:border-primary/60 hover:text-primary'}`}>
                  {l}
                </button>
              )
            })}
          </div>
          {f.diasSemana
            ? <p className="text-xs text-primary">{f.diasSemana.split(',').filter(Boolean).length} días/semana · El cálculo de período usará ocurrencias exactas</p>
            : <p className="text-xs text-text-muted">Sin selección → usa el número de frecuencia como promedio semanal</p>
          }
        </div>
      )}

      {!f.vehiculoId && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            Rendimiento estimado (opcional)
            <input type="number" step="0.1" min={0.1}
              value={f.rendimientoManual} onChange={upd('rendimientoManual')}
              className="input" placeholder="Sin vehículo: ingresa MPG o km/L" />
          </div>
          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            Unidad
            <select value={f.unidadRendimiento}
              onChange={e => setF(p => ({ ...p, unidadRendimiento: e.target.value as RForm['unidadRendimiento'] }))}
              className="input">
              <option value="mpg">MPG (millas/galón)</option>
              <option value="km_l">km/L</option>
              <option value="km_m3">km/m³</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary col-span-2 sm:col-span-1">
          % propio
          <input type="number" min={0} max={100} value={f.porcentajePropio}
            onChange={upd('porcentajePropio')} className="input" />
        </div>
      </div>

      {kmMensual > 0 && (
        <div className="bg-surface-elevated rounded-lg px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
          <span>📊 <strong className="text-text-primary">{fmtDec(kmMensual, 0)} km/mes</strong></span>
          <span>· {fmtDec(kmMensual * Number(f.porcentajePropio) / 100, 0)} km neto tuyo</span>
          {costoMensual != null && (
            <span>· 💰 <strong className="text-success">DOP {fmtDec(costoMensual, 0)}/mes</strong></span>
          )}
          {!costoMensual && !f.vehiculoId && !f.rendimientoManual && (
            <span className="text-warning">· ⚠ Ingresa un rendimiento o asigna un vehículo para ver el costo</span>
          )}
        </div>
      )}

      {/* ── Evento de gasto programado ── */}
      <div ref={eventoSectionRef} className="border-t border-border/60 pt-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={f.crearEvento}
            onChange={e => {
              const checked = e.target.checked
              setF(p => ({ ...p, crearEvento: checked }))
              if (checked) setTimeout(() => eventoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
            }}
            className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm font-medium text-text-primary">📅 Crear evento de gasto programado</span>
        </label>
        {f.crearEvento && (
          <div className="mt-3 flex flex-col gap-3 pl-6 border-l-2 border-primary/30">
            {costoMensual != null && (
              <p className="text-xs bg-success/10 border border-success/30 text-success rounded-lg px-3 py-2">
                💰 Se creará con presupuesto estimado de <strong>DOP {fmtDec(costoMensual, 0)}/mes</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 text-sm text-text-secondary">
                Fecha de inicio *
                <input type="date" required={f.crearEvento}
                  value={f.eventoFechaInicio}
                  onChange={upd('eventoFechaInicio')} className="input" />
              </div>
              <div className="flex flex-col gap-1 text-sm text-text-secondary">
                Periodicidad
                <input readOnly value={
                  f.frecuenciaUnidad === 'dia' ? 'Diaria' :
                  f.frecuenciaUnidad === 'mes' ? 'Mensual' : 'Semanal'
                } className="input bg-surface-elevated cursor-not-allowed" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
              <input type="checkbox" checked={f.eventoPerpetuo}
                onChange={e => setF(p => ({ ...p, eventoPerpetuo: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary" />
              Repetir indefinidamente
            </label>
            {!f.eventoPerpetuo && (
              <div className="flex flex-col gap-1 text-sm text-text-secondary">
                Fecha de fin
                <input type="date" value={f.eventoFechaFin}
                  onChange={upd('eventoFechaFin')} className="input" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── Tab: Resumen ───────────────────────────────────────────────────────────
function TabResumen({ cid }: { cid: string }) {
  const fmt = useFmt()
  const today = new Date()

  // ── period helpers ──
  const getWeekRange = () => {
    const d = new Date(today)
    const dow = d.getDay() === 0 ? 7 : d.getDay() // Mon=1..Sun=7
    const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
    const sun = new Date(d); sun.setDate(d.getDate() - dow + 7)
    return { inicio: mon.toISOString().split('T')[0]!, fin: sun.toISOString().split('T')[0]! }
  }
  const getMonthRange = () => {
    const y = today.getFullYear(); const m = today.getMonth()
    return {
      inicio: new Date(y, m, 1).toISOString().split('T')[0]!,
      fin:    new Date(y, m + 1, 0).toISOString().split('T')[0]!,
    }
  }

  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'custom'>('mes')
  const [custom, setCustom] = useState(() => getMonthRange())

  const range = periodo === 'semana' ? getWeekRange()
    : periodo === 'mes' ? getMonthRange()
    : custom

  const { data: calculo, isLoading } = useQuery<Calculo>({
    queryKey: ['combustible-calculo', cid, range.inicio, range.fin],
    queryFn: async () => (await api.get(`/clientes/${cid}/combustible/calculo`, {
      params: { inicio: range.inicio, fin: range.fin },
    })).data.data,
    enabled: !!cid,
  })

  if (isLoading) return <div className="flex items-center justify-center h-48 text-text-muted text-sm">Calculando…</div>
  if (!calculo) return null

  const { totales, rutas, preciosPorTipo } = calculo
  const hasPeriod = (calculo as any).periodDays != null
  const periodDays: number = (calculo as any).periodDays ?? 0

  const periodLabel = periodo === 'semana' ? 'Esta semana'
    : periodo === 'mes'
      ? new Date(range.inicio + 'T12:00').toLocaleString('es-DO', { month: 'long', year: 'numeric' })
      : `${range.inicio} → ${range.fin}`

  // KPI cards: show period values if available, otherwise monthly
  const kpis = hasPeriod ? [
    { label: `km · ${periodLabel}`,    value: fmtDec((totales as any).kmPeriodo ?? 0, 0),          unit: 'km', color: 'text-primary' },
    { label: 'km / mes (prom.)',        value: fmtDec(totales.kmMensual, 0),                         unit: 'km', color: 'text-primary' },
    { label: `Costo · ${periodDays}d`, value: fmt((totales as any).costoPeriodo ?? 0),               unit: '',   color: 'text-danger'  },
    { label: 'Costo neto tuyo',         value: fmt((totales as any).costoNetoPeriodo ?? 0),          unit: '',   color: 'text-success' },
  ] : [
    { label: 'km / semana',    value: fmtDec(totales.kmSemanal, 0), unit: 'km', color: 'text-primary' },
    { label: 'km / mes',       value: fmtDec(totales.kmMensual, 0), unit: 'km', color: 'text-primary' },
    { label: 'Costo total',    value: fmt(totales.costoTotal),       unit: '',   color: 'text-danger'  },
    { label: 'Costo neto tuyo',value: fmt(totales.costoNeto),        unit: '',   color: 'text-success' },
  ]

  return (
    <div className="flex flex-col gap-5">

      {/* ── Selector de período ── */}
      <div className="flex flex-wrap items-center gap-2">
        {(['semana', 'mes', 'custom'] as const).map(p => (
          <button key={p} type="button" onClick={() => setPeriodo(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
              ${periodo === p ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-primary/50'}`}>
            {p === 'semana' ? '📅 Semana' : p === 'mes' ? '📆 Mes' : '🗓️ Personalizado'}
          </button>
        ))}
        {periodo === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={custom.inicio}
              onChange={e => setCustom(p => ({ ...p, inicio: e.target.value }))}
              className="input text-sm py-1 px-2" style={{ height: 'auto' }} />
            <span className="text-text-muted text-sm">→</span>
            <input type="date" value={custom.fin}
              onChange={e => setCustom(p => ({ ...p, fin: e.target.value }))}
              className="input text-sm py-1 px-2" style={{ height: 'auto' }} />
          </div>
        )}
      </div>
      {hasPeriod && (
        <p className="text-xs text-text-muted -mt-3">
          📊 <strong className="text-text-secondary">{periodLabel}</strong> · {periodDays} días
          {rutas.some(r => (r as any).diasSemana) && <span className="text-primary"> · Rutas con días exactos activas</span>}
        </p>
      )}

      {/* Precios de combustible usados */}
      {Object.keys(preciosPorTipo).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(preciosPorTipo).map(([tipo, precio]) => {
            const cfg = TIPOS_CONFIG[tipo] ?? { emoji: '⛽', color: 'text-text-primary' }
            return (
              <span key={tipo} className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1 text-xs">
                <span>{cfg.emoji}</span>
                <span className="text-text-muted">{tipo}:</span>
                <span className={`font-semibold ${cfg.color}`}>DOP {fmtDec(precio, 2)}</span>
              </span>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wider leading-tight">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            {k.unit && <p className="text-xs text-text-muted">{k.unit}</p>}
          </div>
        ))}
      </div>

      {rutas.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Desglose por ruta</h3>
            {hasPeriod && <span className="text-xs text-text-muted">{periodLabel}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Ruta</th>
                  <th className="px-4 py-2 text-left">Combustible</th>
                  <th className="px-4 py-2 text-right">{hasPeriod ? 'km período' : 'km/mes'}</th>
                  <th className="px-4 py-2 text-right">Consumo</th>
                  <th className="px-4 py-2 text-right">{hasPeriod ? 'Costo período' : 'Costo total'}</th>
                  <th className="px-4 py-2 text-right">Costo neto</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((r, i) => {
                  const cfg = TIPOS_CONFIG[r.tipoCombustible] ?? { emoji: '⛽', color: 'text-text-primary' }
                  const kmShow     = hasPeriod ? ((r as any).kmPeriodo      ?? r.kmMensual) : r.kmMensual
                  const costoShow  = hasPeriod ? ((r as any).costoPeriodo   ?? r.costoTotal): r.costoTotal
                  const netoShow   = hasPeriod ? ((r as any).costoNetoPeriodo ?? r.costoNeto): r.costoNeto
                  const consumoShow= hasPeriod ? ((r as any).consumoPeriodo ?? r.consumoMes): r.consumoMes
                  const hasExact   = hasPeriod && (r as any).diasSemana
                  return (
                    <tr key={r.id} className={i % 2 === 0 ? '' : 'bg-surface-elevated/40'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-text-primary">{r.nombre}</p>
                          {hasExact && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">exacto</span>}
                        </div>
                        {r.vehiculo && (
                          <p className="text-xs text-text-muted">
                            {r.vehiculo.marca} {r.vehiculo.modelo}
                            {r.vehiculo.rendimientoEfectivo !== null && (
                              <> · <strong>{fmtDec(r.vehiculo.rendimientoEfectivo, 1)}</strong> {r.vehiculo.unidad === 'km_m3' ? 'km/m³' : 'mpg'} ef.</>
                            )}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                          {cfg.emoji} {r.tipoCombustible}
                        </span>
                        <p className="text-xs text-text-muted mt-0.5">DOP {fmtDec(r.precioCombustibleUsado, 2)}/{r.unidadConsumo}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">{fmtDec(kmShow, 0)}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{fmtDec(consumoShow, 2)} {r.unidadConsumo}</td>
                      <td className="px-4 py-3 text-right text-danger font-medium">{fmt(costoShow)}</td>
                      <td className="px-4 py-3 text-right text-success font-medium">{fmt(netoShow)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rutas.length === 0 && (
        <div className="text-center py-16 text-text-muted text-sm">
          <p className="text-4xl mb-3">⛽</p>
          <p>Agrega rutas y un vehículo para ver el cálculo</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Rutas ─────────────────────────────────────────────────────────────
function TabRutas({ cid, geoCtx }: { cid: string; geoCtx: GeoContext | null }) {
  const qc = useQueryClient()
  const { data: rutas = [], isLoading } = useQuery<Ruta[]>({
    queryKey: ['rutas', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/rutas`)).data.data,
    enabled: !!cid,
  })
  const { data: vehiculos = [] } = useQuery<Vehiculo[]>({
    queryKey: ['vehiculos', cid],
    queryFn: async () => {
      const vs: Vehiculo[] = (await api.get(`/clientes/${cid}/vehiculos`)).data.data
      const withRend = await Promise.all(vs.map(async v => {
        const r = await api.get(`/vehiculos/${v.id}/rendimientos`)
        return { ...v, rendimientos: r.data.data }
      }))
      return withRend
    },
    enabled: !!cid,
  })
  const [modal, setModal] = useState<'new' | { type: 'edit'; ruta: Ruta } | { type: 'del'; ruta: Ruta } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const inv = () => { qc.invalidateQueries({ queryKey: ['rutas', cid] }); qc.invalidateQueries({ queryKey: ['combustible-calculo', cid] }) }

  const create = useMutation({
    mutationFn: (payload: { d: object; f: RForm }) => api.post(`/clientes/${cid}/rutas`, payload.d),
    onSuccess: (_, payload) => {
      inv(); setModal(null); showToast('Ruta creada')
      if (payload.f.crearEvento && payload.f.eventoFechaInicio) {
        createEvento.mutate(buildEventoPayload(payload.f, payload.f.nombre))
      }
    },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const update = useMutation({
    mutationFn: (payload: { id: string; d: object; f: RForm }) => api.patch(`/rutas/${payload.id}`, payload.d),
    onSuccess: (_, payload) => {
      inv(); setModal(null); showToast('Ruta actualizada')
      if (payload.f.crearEvento && payload.f.eventoFechaInicio) {
        createEvento.mutate(buildEventoPayload(payload.f, payload.f.nombre))
      }
    },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/rutas/${id}`),
    onSuccess: () => { inv(); setModal(null); showToast('Ruta eliminada') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })

  const { data: preciosData } = useQuery<{ lista: any[]; latest: any[] }>({
    queryKey: ['combustible-precios'],
    queryFn: async () => (await api.get('/combustible/precios')).data.data,
  })
  const preciosPorTipo: Record<string, number> = {}
  if (preciosData?.latest) {
    for (const p of preciosData.latest) {
      preciosPorTipo[p.tipo] = Number(p.precio)
    }
  }

  const createEvento = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/eventos`, d),
    onSuccess: () => showToast('📅 Evento de gasto programado creado'),
    onError: (e: any) => showToast(`Error creando evento: ${e?.response?.data?.error ?? e.message}`, 'error'),
  })

  const toPayload = (f: RForm) => ({
    nombre: f.nombre,
    distanciaKm: Number(f.distanciaKm),
    frecuenciaValor: Number(f.frecuenciaValor),
    frecuenciaUnidad: f.frecuenciaUnidad,
    diasSemana: (f.frecuenciaUnidad === 'semana' && f.diasSemana) ? f.diasSemana : null,
    tipoCombustible: f.tipoCombustible,
    porcentajePropio: Number(f.porcentajePropio),
    vehiculoId: f.vehiculoId || undefined,
    rendimientoManual: f.rendimientoManual ? Number(f.rendimientoManual) : undefined,
    unidadRendimiento: f.unidadRendimiento,
  })

  const buildEventoPayload = (f: RForm, rutaNombre: string) => {
    const frecUnidad = f.frecuenciaUnidad
    const tipoRec = frecUnidad === 'dia' ? 'DIARIA' : frecUnidad === 'mes' ? 'MENSUAL' : 'SEMANAL'
    const distN = Number(f.distanciaKm) || 0
    const frecVal = Number(f.frecuenciaValor) || 0
    const kmMes = frecUnidad === 'dia' ? distN * frecVal * 30.44 : frecUnidad === 'mes' ? distN * frecVal : distN * frecVal * 4.33
    const veh = vehiculos.find(v => v.id === f.vehiculoId)
    const rendEspec = veh?.rendimientos?.find(r => r.tipoCombustible === f.tipoCombustible)
    const mpg = rendEspec
      ? Number(rendEspec.rendimiento) / (1 + Number(rendEspec.margenConsumo) / 100)
      : veh ? Number(veh.mpgRealWorld) / (1 + Number(veh.margenConsumo) / 100)
      : f.rendimientoManual ? Number(f.rendimientoManual) : null
    const unidR = rendEspec?.unidad ?? (veh ? 'mpg' : f.unidadRendimiento)
    const precio = preciosPorTipo[f.tipoCombustible] ?? 0
    const costo = mpg && kmMes > 0 && precio > 0
      ? (unidR === 'mpg' ? (kmMes / 1.60934 / mpg) * precio : (kmMes / mpg) * precio)
      : 0
    return {
      nombre: `⛽ ${rutaNombre}`,
      tipo: 'PAGO_PROGRAMADO',
      fecha: f.eventoFechaInicio || new Date().toISOString().split('T')[0],
      recurrente: true,
      tipoRecurrencia: tipoRec,
      presupuestoEstimado: Math.round(costo * 100) / 100,
      fechaFin: (!f.eventoPerpetuo && f.eventoFechaFin) ? f.eventoFechaFin : null,
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast {...toast} />}
      <div className="flex justify-end">
        <button onClick={() => setModal('new')} className="btn-primary text-sm flex items-center gap-2">+ Nueva ruta</button>
      </div>
      {isLoading && <div className="h-24 flex items-center justify-center text-text-muted text-sm">Cargando…</div>}
      <div className="flex flex-col gap-3">
        {rutas.map(r => {
          const fVal = (r as any).frecuenciaValor ?? (r as any).vecesPorSemana ?? 5
          const fUnidad = (r as any).frecuenciaUnidad ?? 'semana'
          const kmMes = fUnidad === 'dia' ? Number(r.distanciaKm) * fVal * 30.44
            : fUnidad === 'mes' ? Number(r.distanciaKm) * fVal
            : Number(r.distanciaKm) * fVal * 4.33
          return (
            <div key={r.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="text-2xl">🗺️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{r.nombre}</span>
                  {!r.activa && <span className="text-xs bg-text-muted/20 text-text-muted px-1.5 py-0.5 rounded">Inactiva</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted">
                  <span>📍 {fmtDec(Number(r.distanciaKm), 1)} km</span>
                  <span>🔁 {fVal}× /{fUnidad} → {fmtDec(kmMes, 0)} km/mes</span>
                  <span>👤 {r.porcentajePropio}% propio</span>
                  {r.vehiculo && <span>🚗 {r.vehiculo.marca} {r.vehiculo.modelo}</span>}
                  {(() => { const cfg = TIPOS_CONFIG[r.tipoCombustible]; return cfg ? <span>{cfg.emoji} {r.tipoCombustible}</span> : null })()}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModal({ type: 'edit', ruta: r })} className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10">✏</button>
                <button onClick={() => setModal({ type: 'del', ruta: r })} className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10">🗑</button>
              </div>
            </div>
          )
        })}
        {!isLoading && rutas.length === 0 && (
          <div className="text-center py-16 text-text-muted text-sm">
            <p className="text-4xl mb-3">🗺️</p>
            <p>No hay rutas registradas</p>
          </div>
        )}
      </div>

      {modal === 'new' && (
        <Modal title="Nueva ruta" onClose={() => setModal(null)} wide>
          <RutaForm vehiculos={vehiculos} geoCtx={geoCtx} loading={create.isPending} preciosPorTipo={preciosPorTipo} onClose={() => setModal(null)}
            onSubmit={f => create.mutate({ d: toPayload(f), f })} />
        </Modal>
      )}
      {modal !== null && typeof modal === 'object' && modal.type === 'edit' && (
        <Modal title="Editar ruta" onClose={() => setModal(null)} wide>
          <RutaForm vehiculos={vehiculos} geoCtx={geoCtx} loading={update.isPending} preciosPorTipo={preciosPorTipo} onClose={() => setModal(null)}
            initial={{
              vehiculoId: modal.ruta.vehiculoId ?? '',
              nombre: modal.ruta.nombre,
              distanciaKm: String(modal.ruta.distanciaKm),
              frecuenciaValor: String((modal.ruta as any).frecuenciaValor ?? 5),
              frecuenciaUnidad: ((modal.ruta as any).frecuenciaUnidad ?? 'semana') as 'dia' | 'semana' | 'mes',
              tipoCombustible: modal.ruta.tipoCombustible,
              porcentajePropio: String(modal.ruta.porcentajePropio),
              rendimientoManual: (modal.ruta as any).rendimientoManual ? String((modal.ruta as any).rendimientoManual) : '',
              unidadRendimiento: ((modal.ruta as any).unidadRendimiento ?? 'mpg') as 'mpg' | 'km_l' | 'km_m3',
              diasSemana: modal.ruta.diasSemana ?? '',
              crearEvento: false, eventoFechaInicio: '', eventoPerpetuo: true, eventoFechaFin: '',
            }}
            onSubmit={f => update.mutate({ id: modal.ruta.id, d: toPayload(f), f })} />
        </Modal>
      )}
      {modal !== null && typeof modal === 'object' && modal.type === 'del' && (
        <Modal title="Eliminar ruta" onClose={() => setModal(null)}>
          <p className="text-text-secondary text-sm mb-6">¿Eliminar la ruta <strong className="text-text-primary">{modal.ruta.nombre}</strong>?</p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.ruta.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── RendimientoPanel ────────────────────────────────────────────────────────
function RendimientoPanel({ vehiculo, onClose }: { vehiculo: Vehiculo; onClose(): void }) {
  const qc = useQueryClient()
  const { data: rendimientos = [], isLoading } = useQuery<Rendimiento[]>({
    queryKey: ['rendimientos', vehiculo.id],
    queryFn: async () => (await api.get(`/vehiculos/${vehiculo.id}/rendimientos`)).data.data,
  })
  const [form, setForm] = useState({ tipoCombustible: 'Regular', rendimiento: '', unidad: 'mpg', margenConsumo: '15', fuente: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const inv = () => { qc.invalidateQueries({ queryKey: ['rendimientos', vehiculo.id] }); qc.invalidateQueries({ queryKey: ['combustible-calculo'] }); qc.invalidateQueries({ queryKey: ['vehiculos'] }) }

  // Cuando el tipo cambia a GNC forzar unidad km_m3
  const handleTipoCambio = (tipo: string) => {
    setForm(p => ({ ...p, tipoCombustible: tipo, unidad: tipo === 'GNC' ? 'km_m3' : 'mpg' }))
  }

  const upsert = useMutation({
    mutationFn: (d: object) => api.post(`/vehiculos/${vehiculo.id}/rendimientos`, d),
    onSuccess: () => { inv(); setForm({ tipoCombustible: 'Regular', rendimiento: '', unidad: 'mpg', margenConsumo: '15', fuente: '' }); setEditingId(null); showToast('Rendimiento guardado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/vehiculos/rendimientos/${id}`),
    onSuccess: () => { inv(); showToast('Eliminado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })

  const startEdit = (r: Rendimiento) => {
    setEditingId(r.id)
    setForm({ tipoCombustible: r.tipoCombustible, rendimiento: String(r.rendimiento), unidad: r.unidad, margenConsumo: String(r.margenConsumo), fuente: r.fuente ?? '' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm({ tipoCombustible: 'Regular', rendimiento: '', unidad: 'mpg', margenConsumo: '15', fuente: '' })
  }

  const submitForm = () => {
    if (!form.rendimiento) return
    upsert.mutate({ tipoCombustible: form.tipoCombustible, rendimiento: Number(form.rendimiento), unidad: form.unidad, margenConsumo: Number(form.margenConsumo), fuente: form.fuente || undefined })
  }

  const unidadLabel = form.unidad === 'km_m3' ? 'km/m³' : 'mpg'
  const rendEfectivo = form.rendimiento && form.margenConsumo
    ? Number(form.rendimiento) / (1 + Number(form.margenConsumo) / 100)
    : null

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast {...toast} />}
      <p className="text-sm text-text-muted">
        Registra el rendimiento real de <strong className="text-text-primary">{vehiculo.marca} {vehiculo.modelo}</strong> para cada tipo de combustible.
        El cálculo de cada ruta usará el rendimiento del combustible que le asignes.
      </p>

      {/* Formulario nuevo/editar */}
      <div className="bg-surface-elevated border border-border rounded-xl p-4 flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-text-primary">{editingId ? 'Editar rendimiento' : 'Agregar rendimiento'}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1 text-xs text-text-secondary">
            Combustible
            <select value={form.tipoCombustible} onChange={e => handleTipoCambio(e.target.value)} className="input text-sm" disabled={!!editingId}>
              {Object.entries(TIPOS_CONFIG).map(([t, c]) => <option key={t} value={t}>{c.emoji} {t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs text-text-secondary">
            Rendimiento ({unidadLabel})
            <input type="number" step="0.1" min={0.1} value={form.rendimiento}
              onChange={e => setForm(p => ({ ...p, rendimiento: e.target.value }))}
              className="input text-sm" placeholder={form.unidad === 'km_m3' ? '12.5' : '34.3'} />
          </div>
          <div className="flex flex-col gap-1 text-xs text-text-secondary">
            Margen consumo %
            <input type="number" step="0.5" min={0} max={100} value={form.margenConsumo}
              onChange={e => setForm(p => ({ ...p, margenConsumo: e.target.value }))}
              className="input text-sm" placeholder="15" />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-text-secondary">
          Fuente (opcional)
          <input value={form.fuente} onChange={e => setForm(p => ({ ...p, fuente: e.target.value }))}
            className="input text-sm" placeholder="Medición propia, fuelly.com…" />
        </div>
        {rendEfectivo !== null && (
          <p className="text-xs text-text-muted bg-background rounded-lg px-3 py-2">
            💡 Rendimiento efectivo: <strong className="text-text-primary">{fmtDec(rendEfectivo, 1)} {unidadLabel}</strong> (con margen de {form.margenConsumo}%)
          </p>
        )}
        <div className="flex gap-2 justify-end">
          {editingId && <button type="button" className="btn-ghost text-sm" onClick={cancelEdit}>Cancelar</button>}
          <button type="button" className="btn-primary text-sm" disabled={upsert.isPending || !form.rendimiento} onClick={submitForm}>
            {upsert.isPending ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Lista de rendimientos */}
      {isLoading ? <div className="h-12 flex items-center justify-center text-text-muted text-sm">Cargando…</div> : (
        <div className="flex flex-col gap-2">
          {rendimientos.length === 0 && (
            <p className="text-center text-text-muted text-sm py-4">Sin rendimientos registrados. Agrega uno arriba.</p>
          )}
          {rendimientos.map(r => {
            const cfg = TIPOS_CONFIG[r.tipoCombustible] ?? { emoji: '⛽', color: 'text-text-primary' }
            const ef = Number(r.rendimiento) / (1 + Number(r.margenConsumo) / 100)
            const unidLabel = r.unidad === 'km_m3' ? 'km/m³' : 'mpg'
            return (
              <div key={r.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${cfg.color}`}>{r.tipoCombustible}</span>
                    <span className="text-xs text-text-muted">
                      {fmtDec(Number(r.rendimiento), 1)} {unidLabel} real · margen {r.margenConsumo}%
                    </span>
                    <span className="text-xs font-medium text-text-primary">→ {fmtDec(ef, 1)} {unidLabel} ef.</span>
                    {r.fuente && <span className="text-xs text-text-muted">· {r.fuente}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 text-xs">✏</button>
                  <button onClick={() => del.mutate(r.id)} className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 text-xs">🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border">
        <button className="btn-ghost text-sm" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

// ── Tab: Vehículos ─────────────────────────────────────────────────────────
function TabVehiculos({ cid }: { cid: string }) {
  const qc = useQueryClient()
  const { data: vehiculos = [], isLoading } = useQuery<Vehiculo[]>({
    queryKey: ['vehiculos', cid],
    queryFn: async () => (await api.get(`/clientes/${cid}/vehiculos`)).data.data,
    enabled: !!cid,
  })
  const [modal, setModal] = useState<'new' | { type: 'edit'; v: Vehiculo } | { type: 'del'; v: Vehiculo } | { type: 'rend'; v: Vehiculo } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const inv = () => { qc.invalidateQueries({ queryKey: ['vehiculos', cid] }); qc.invalidateQueries({ queryKey: ['combustible-calculo', cid] }) }

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/clientes/${cid}/vehiculos`, d),
    onSuccess: () => { inv(); setModal(null); showToast('Vehículo agregado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/vehiculos/${id}`, d),
    onSuccess: () => { inv(); setModal(null); showToast('Vehículo actualizado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/vehiculos/${id}`),
    onSuccess: () => { inv(); setModal(null); showToast('Vehículo eliminado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })

  const toPayload = (f: VForm) => ({
    marca: f.marca, modelo: f.modelo, ano: Number(f.ano),
    mpgRealWorld: Number(f.mpgRealWorld), margenConsumo: Number(f.margenConsumo),
    fuenteMpg: f.fuenteMpg || undefined,
    catalogoId: f.catalogoId || undefined,
  })

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast {...toast} />}
      <div className="flex justify-end">
        <button onClick={() => setModal('new')} className="btn-primary text-sm">+ Nuevo vehículo</button>
      </div>
      {isLoading && <div className="h-24 flex items-center justify-center text-text-muted text-sm">Cargando…</div>}
      <div className="flex flex-col gap-3">
        {vehiculos.map(v => {
          const mpgEf = Number(v.mpgRealWorld) / (1 + Number(v.margenConsumo) / 100)
          return (
            <div key={v.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🚗</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{v.marca} {v.modelo} {v.ano}</span>
                    {!v.activo && <span className="text-xs bg-text-muted/20 text-text-muted px-1.5 py-0.5 rounded">Inactivo</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted">
                    <span>⚡ {fmtDec(Number(v.mpgRealWorld), 1)} MPG base (gasolina)</span>
                    <span>📉 Margen: {fmtDec(Number(v.margenConsumo), 1)}%</span>
                    <span>✅ <strong>{fmtDec(mpgEf, 1)} MPG ef.</strong></span>
                    {v.fuenteMpg && <span>📄 {v.fuenteMpg}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ type: 'rend', v })} className="p-1.5 rounded text-text-muted hover:text-warning hover:bg-warning/10 text-sm" title="Rendimientos por combustible">⛽</button>
                  <button onClick={() => setModal({ type: 'edit', v })} className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10">✏</button>
                  <button onClick={() => setModal({ type: 'del', v })} className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10">🗑</button>
                </div>
              </div>
            </div>
          )
        })}
        {!isLoading && vehiculos.length === 0 && (
          <div className="text-center py-16 text-text-muted text-sm">
            <p className="text-4xl mb-3">🚗</p>
            <p>No hay vehículos configurados</p>
          </div>
        )}
      </div>

      {modal === 'new' && (
        <Modal title="Nuevo vehículo" onClose={() => setModal(null)}>
          <VehiculoForm loading={create.isPending} onClose={() => setModal(null)} onSubmit={f => create.mutate(toPayload(f))} />
        </Modal>
      )}
      {modal !== null && typeof modal === 'object' && modal.type === 'edit' && (
        <Modal title="Editar vehículo" onClose={() => setModal(null)}>
          <VehiculoForm loading={update.isPending} onClose={() => setModal(null)}
            initial={{ marca: modal.v.marca, modelo: modal.v.modelo, ano: String(modal.v.ano), mpgRealWorld: String(modal.v.mpgRealWorld), margenConsumo: String(modal.v.margenConsumo), fuenteMpg: modal.v.fuenteMpg ?? '' }}
            onSubmit={f => update.mutate({ id: modal.v.id, d: toPayload(f) })} />
        </Modal>
      )}
      {modal !== null && typeof modal === 'object' && modal.type === 'del' && (
        <Modal title="Eliminar vehículo" onClose={() => setModal(null)}>
          <p className="text-text-secondary text-sm mb-6">¿Eliminar <strong className="text-text-primary">{modal.v.marca} {modal.v.modelo}</strong>?</p>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(modal.v.id)}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
      {modal !== null && typeof modal === 'object' && modal.type === 'rend' && (
        <Modal title={`⛽ Rendimientos · ${modal.v.marca} ${modal.v.modelo}`} onClose={() => setModal(null)} wide>
          <RendimientoPanel vehiculo={modal.v} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}

// ── Tab: Precios ───────────────────────────────────────────────────────────
const TIPOS_CONFIG: Record<string, { color: string; emoji: string; unidad: string }> = {
  'Gasolina Regular':    { color: 'text-success',    emoji: '🟢', unidad: 'gal' },
  'Gasolina Premium':    { color: 'text-warning',    emoji: '🟡', unidad: 'gal' },
  'Gasoil Regular':      { color: 'text-primary',    emoji: '🔵', unidad: 'gal' },
  'Gasoil Premium':      { color: 'text-cyan-400',   emoji: '🔷', unidad: 'gal' },
  'Kerosene / Jet Fuel': { color: 'text-orange-400', emoji: '🟠', unidad: 'gal' },
  'Gas Licuado (GLP)':   { color: 'text-purple-400', emoji: '🟣', unidad: 'gal' },
  'Gas Natural (GNC)':   { color: 'text-slate-400',  emoji: '⚪', unidad: 'm³'  },
}
const TIPOS_LISTA = Object.keys(TIPOS_CONFIG)

interface PrecioForm { tipo: string; precio: string; fecha: string; fuente: string }
const emptyForm = (): PrecioForm => ({ tipo: 'Gasolina Regular', precio: '', fecha: new Date().toISOString().slice(0, 10), fuente: '' })

function PrecioFormPanel({ initial, onSave, onCancel, loading }: {
  initial?: PrecioForm; onSave(f: PrecioForm): void; onCancel(): void; loading: boolean
}) {
  const [f, setF] = useState<PrecioForm>(initial ?? emptyForm())
  const upd = (k: keyof PrecioForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }))
  const cfg = TIPOS_CONFIG[f.tipo]
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Tipo
          <select value={f.tipo} onChange={upd('tipo')} className="input">
            {TIPOS_LISTA.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Precio (DOP/{cfg?.unidad ?? 'gal'})
          <input type="number" step="0.01" value={f.precio} onChange={upd('precio')} className="input" placeholder="294.50" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Fecha
          <input type="date" value={f.fecha} onChange={upd('fecha')} className="input" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          Fuente
          <input value={f.fuente} onChange={upd('fuente')} className="input" placeholder="DGII, bomba..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-sm" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary text-sm" disabled={loading || !f.precio} onClick={() => onSave(f)}>
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function TabPrecios() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ lista: Precio[]; latest: Precio[] }>({
    queryKey: ['combustible-precios'],
    queryFn: async () => (await api.get('/combustible/precios')).data.data,
  })
  const [modal, setModal] = useState<'new' | { type: 'edit'; p: Precio } | { type: 'history'; tipo: string } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const inv = () => { qc.invalidateQueries({ queryKey: ['combustible-precios'] }); qc.invalidateQueries({ queryKey: ['combustible-calculo'] }) }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const { data: res } = await api.post('/combustible/sync-precios')
      const r = res.data
      if (r.updated > 0) {
        showToast(`✅ ${r.updated} precio${r.updated !== 1 ? 's' : ''} actualizados desde prestocombustibles.com`)
        inv()
      } else if (r.errors?.length > 0) {
        showToast(`⚠ No se pudieron obtener precios: ${r.errors[0]}`, 'error')
      } else {
        showToast('Sin cambios — precios ya están al día')
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? e.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const create = useMutation({
    mutationFn: (d: object) => api.post('/combustible/precios', d),
    onSuccess: () => { inv(); setModal(null); showToast('Precio registrado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/combustible/precios/${id}`, d),
    onSuccess: () => { inv(); setModal(null); showToast('Precio actualizado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/combustible/precios/${id}`),
    onSuccess: () => { inv(); showToast('Eliminado') },
    onError: (e: any) => showToast(e?.response?.data?.error ?? e.message, 'error'),
  })

  const toPayload = (f: PrecioForm) => ({
    tipo: f.tipo, precio: Number(f.precio),
    fecha: new Date(f.fecha).toISOString(),
    fuente: f.fuente || undefined,
  })

  // Historial filtrado por tipo (client-side)
  const historialPorTipo = (tipo: string) => (data?.lista ?? []).filter(p => p.tipo === tipo)

  return (
    <div className="flex flex-col gap-5">
      {toast && <Toast {...toast} />}

      {/* Tarjetas de últimos precios */}
      {data?.latest && data.latest.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.latest.map(p => {
            const cfg = TIPOS_CONFIG[p.tipo] ?? { color: 'text-text-primary', emoji: '⛽', unidad: 'gal' }
            return (
              <div
                key={p.id}
                onClick={() => setModal({ type: 'history', tipo: p.tipo })}
                className="bg-surface border border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-surface-elevated transition-colors group relative"
                title={`Ver historial de ${p.tipo}`}
              >
                {/* botón editar */}
                <button
                  onClick={e => { e.stopPropagation(); setModal({ type: 'edit', p }) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 text-xs"
                  title="Editar precio"
                >✏</button>
                <p className="text-2xl mb-1">{cfg.emoji}</p>
                <p className="text-xs text-text-muted uppercase tracking-wider">{p.tipo}</p>
                <p className={`text-xl font-bold ${cfg.color}`}>DOP {fmtDec(Number(p.precio), 2)}</p>
                <p className="text-xs text-text-muted mt-1">{new Date(p.fecha).toLocaleDateString('es-DO')}</p>
                <p className="text-xs text-primary/60 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Ver historial →</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-50"
          title="Obtener precios actuales de prestocombustibles.com (RD)"
        >
          {syncing ? '⏳ Sincronizando…' : '🔄 Sincronizar RD'}
        </button>
        <button onClick={() => setModal('new')} className="btn-primary text-sm">+ Registrar precio</button>
      </div>

      {modal === 'new' && (
        <PrecioFormPanel
          loading={create.isPending}
          onCancel={() => setModal(null)}
          onSave={f => create.mutate(toPayload(f))}
        />
      )}

      {/* Historial general */}
      {isLoading ? <div className="h-24 flex items-center justify-center text-text-muted text-sm">Cargando…</div> : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Historial de precios</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-text-muted uppercase">
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-right">Precio</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Fuente</th>
                <th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {(data?.lista ?? []).map((p, i) => {
                  const cfg = TIPOS_CONFIG[p.tipo] ?? { color: 'text-text-primary', emoji: '⛽', unidad: 'gal' }
                  return (
                    <tr key={p.id} className={i % 2 === 0 ? '' : 'bg-surface-elevated/30'}>
                      <td className="px-4 py-2">{cfg.emoji} {p.tipo}</td>
                      <td className={`px-4 py-2 text-right font-mono font-medium ${cfg.color}`}>DOP {fmtDec(Number(p.precio), 2)}</td>
                      <td className="px-4 py-2 text-text-muted">{new Date(p.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-2 text-text-muted">{p.fuente ?? '—'}</td>
                      <td className="px-4 py-2 text-right flex items-center justify-end gap-2">
                        <button onClick={() => setModal({ type: 'edit', p })} className="text-xs text-text-muted hover:text-primary" title="Editar">✏</button>
                        <button onClick={() => del.mutate(p.id)} className="text-xs text-text-muted hover:text-danger" title="Eliminar">🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(data?.lista ?? []).length === 0 && (
              <p className="text-center text-text-muted text-sm py-8">Sin precios registrados</p>
            )}
          </div>
        </div>
      )}

      {/* Modal: editar precio */}
      {modal !== null && typeof modal === 'object' && modal.type === 'edit' && (
        <Modal title={`Editar precio · ${modal.p.tipo}`} onClose={() => setModal(null)}>
          <PrecioFormPanel
            loading={update.isPending}
            initial={{
              tipo: modal.p.tipo,
              precio: String(modal.p.precio),
              fecha: new Date(modal.p.fecha).toISOString().slice(0, 10),
              fuente: modal.p.fuente ?? '',
            }}
            onCancel={() => setModal(null)}
            onSave={f => update.mutate({ id: modal.p.id, d: toPayload(f) })}
          />
        </Modal>
      )}

      {/* Modal: historial por tipo */}
      {modal !== null && typeof modal === 'object' && modal.type === 'history' && (() => {
        const tipo = modal.tipo
        const cfg = TIPOS_CONFIG[tipo] ?? { color: 'text-text-primary', emoji: '⛽', unidad: 'gal' }
        const historial = historialPorTipo(tipo)

        // "Fijar" = create a new price record with that value strictly after the current latest
        const fijarPrecio = (p: Precio) => {
          // Guarantee the new record sorts AFTER the current latest (in case latest has a future date)
          const latestMs = historial[0] ? new Date(historial[0].fecha).getTime() : 0
          const fechaFijar = new Date(Math.max(Date.now(), latestMs + 1000)).toISOString()
          create.mutate(
            { tipo: p.tipo, precio: Number(p.precio), fecha: fechaFijar, fuente: p.fuente ?? undefined },
            {
              onSuccess: () => {
                inv()
                setModal(null)
                showToast(`📌 ${p.tipo} fijado en DOP ${fmtDec(Number(p.precio), 2)}`)
              },
            }
          )
        }

        // Which record is currently the latest (first in sorted list)
        const latestId = historial[0]?.id

        return (
          <Modal title={`${cfg.emoji} Historial · ${tipo}`} onClose={() => setModal(null)}>
            {historial.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">Sin registros para {tipo}</p>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-text-muted mb-2">
                  Haz clic en <strong className="text-text-secondary">📌 Fijar</strong> para usar ese precio como el activo (se registra con fecha de hoy).
                </p>
                <div className="flex flex-col divide-y divide-border/50 rounded-xl border border-border overflow-hidden">
                  {historial.map(p => {
                    const isLatest = p.id === latestId
                    return (
                      <div key={p.id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors
                          ${isLatest ? 'bg-primary/5' : 'hover:bg-surface-elevated/60'}`}
                      >
                        {/* Active indicator */}
                        <div className="flex-shrink-0 w-2">
                          {isLatest && <div className="w-2 h-2 rounded-full bg-primary" title="Precio activo" />}
                        </div>

                        {/* Date */}
                        <span className="text-sm text-text-muted w-20 flex-shrink-0 tabular-nums">
                          {new Date(p.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>

                        {/* Price */}
                        <span className={`font-mono font-bold text-base flex-1 ${cfg.color}`}>
                          DOP {fmtDec(Number(p.precio), 2)}
                        </span>

                        {/* Source */}
                        <span className="text-xs text-text-muted truncate max-w-[120px]">
                          {p.fuente ?? '—'}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isLatest && (
                            <button
                              onClick={() => fijarPrecio(p)}
                              disabled={create.isPending}
                              className="text-xs px-2.5 py-1 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium disabled:opacity-40"
                              title="Usar este precio como el activo (fecha hoy)"
                            >
                              📌 Fijar
                            </button>
                          )}
                          {isLatest && (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                              ✓ Activo
                            </span>
                          )}
                          <button
                            onClick={() => { setModal({ type: 'edit', p }); }}
                            className="text-xs text-text-muted hover:text-primary transition-colors p-1"
                            title="Editar"
                          >✏</button>
                          <button
                            onClick={() => del.mutate(p.id)}
                            className="text-xs text-text-muted hover:text-danger transition-colors p-1"
                            title="Eliminar"
                          >🗑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Stats */}
                {historial.length > 1 && (() => {
                  const max = Math.max(...historial.map(p => Number(p.precio)))
                  const min = Math.min(...historial.map(p => Number(p.precio)))
                  const avg = historial.reduce((s, p) => s + Number(p.precio), 0) / historial.length
                  return (
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
                      {[
                        { label: 'Mínimo',   val: min, color: 'text-success' },
                        { label: 'Promedio', val: avg, color: 'text-warning' },
                        { label: 'Máximo',   val: max, color: 'text-danger'  },
                      ].map(s => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => fijarPrecio({ ...historial[0]!, precio: s.val, fuente: 'manual' })}
                          disabled={create.isPending}
                          className="text-center bg-surface-elevated hover:bg-surface-elevated/80 border border-border/50 hover:border-primary/30 rounded-lg p-2.5 transition-colors group disabled:opacity-40"
                          title={`Fijar precio en DOP ${fmtDec(s.val, 2)}`}
                        >
                          <p className="text-xs text-text-muted">{s.label}</p>
                          <p className={`font-bold text-sm ${s.color}`}>DOP {fmtDec(s.val, 2)}</p>
                          <p className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">📌 Fijar</p>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </Modal>
        )
      })()}
    </div>
  )
}

// ── Tab: Transporte Público ────────────────────────────────────────────────
interface TPViaje { id: string; nombre: string; costoPorViaje: number; vecesPorSemana: number }

function TabTransportePublico() {
  const fmt = useFmt()
  const LS_KEY = 'cm_transp_publico'
  const load = (): TPViaje[] => { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] } }
  const [viajes, setViajes] = useState<TPViaje[]>(load)
  const [form, setForm] = useState({ nombre: '', costoPorViaje: '', vecesPorSemana: '10' })
  const [showForm, setShowForm] = useState(false)
  const save = (list: TPViaje[]) => { setViajes(list); localStorage.setItem(LS_KEY, JSON.stringify(list)) }
  const add = () => {
    if (!form.nombre.trim() || !form.costoPorViaje) return
    save([...viajes, { id: Date.now().toString(), nombre: form.nombre.trim(), costoPorViaje: Number(form.costoPorViaje), vecesPorSemana: Number(form.vecesPorSemana) }])
    setForm({ nombre: '', costoPorViaje: '', vecesPorSemana: '10' }); setShowForm(false)
  }
  const remove = (id: string) => save(viajes.filter(v => v.id !== id))
  const totalMensual = viajes.reduce((s, v) => s + v.costoPorViaje * v.vecesPorSemana * 4.33, 0)
  const totalSemanal = viajes.reduce((s, v) => s + v.costoPorViaje * v.vecesPorSemana, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-text-secondary">
        🚌 Registra tus gastos habituales en transporte público (autobús, metro, taxi, guagua, motoconcho…) para comparar contra el costo de usar tu vehículo.
      </div>
      {viajes.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Gasto semanal</p>
            <p className="text-xl font-bold text-warning">{fmt(totalSemanal)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Gasto mensual</p>
            <p className="text-xl font-bold text-danger">{fmt(totalMensual)}</p>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(p => !p)} className="btn-primary text-sm">+ Agregar viaje</button>
      </div>
      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Nuevo viaje en transporte público</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 text-sm text-text-secondary">
              Nombre / ruta
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input" placeholder="Casa → Trabajo (guagua)" />
            </div>
            <div className="flex flex-col gap-1 text-sm text-text-secondary">
              Costo por viaje (DOP)
              <input type="number" step="5" min={1} value={form.costoPorViaje} onChange={e => setForm(p => ({ ...p, costoPorViaje: e.target.value }))} className="input" placeholder="80" />
            </div>
            <div className="flex flex-col gap-1 text-sm text-text-secondary">
              Viajes / semana
              <input type="number" min={1} max={50} value={form.vecesPorSemana} onChange={e => setForm(p => ({ ...p, vecesPorSemana: e.target.value }))} className="input" placeholder="10" />
            </div>
          </div>
          {form.costoPorViaje && form.vecesPorSemana && (
            <p className="text-xs text-text-muted bg-surface-elevated rounded-lg px-3 py-2">
              📊 Estimado: <strong>{fmt(Number(form.costoPorViaje) * Number(form.vecesPorSemana))}/semana</strong> · <strong>{fmt(Number(form.costoPorViaje) * Number(form.vecesPorSemana) * 4.33)}/mes</strong>
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn-primary text-sm" onClick={add} disabled={!form.nombre || !form.costoPorViaje}>Agregar</button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {viajes.map(v => {
          const semana = v.costoPorViaje * v.vecesPorSemana
          const mes = semana * 4.33
          return (
            <div key={v.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="text-2xl">🚌</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary">{v.nombre}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted">
                  <span>💰 DOP {fmtDec(v.costoPorViaje, 0)}/viaje</span>
                  <span>🔁 {v.vecesPorSemana} viajes/sem</span>
                  <span>📅 {fmt(semana)}/sem · <strong className="text-text-primary">{fmt(mes)}/mes</strong></span>
                </div>
              </div>
              <button onClick={() => remove(v.id)} className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10">🗑</button>
            </div>
          )
        })}
        {viajes.length === 0 && !showForm && (
          <div className="text-center py-16 text-text-muted text-sm">
            <p className="text-4xl mb-3">🚌</p>
            <p>Agrega rutas en transporte público para calcular tu gasto mensual</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers UI ─────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>{msg}</div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className={`bg-surface border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh] ${wide ? 'w-full max-w-3xl' : 'w-full max-w-md'}`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'resumen',   label: '📊 Resumen' },
  { id: 'rutas',     label: '🗺️ Rutas' },
  { id: 'vehiculos', label: '🚗 Vehículos' },
  { id: 'precios',   label: '⛽ Precios' },
  { id: 'publico',   label: '🚌 Transporte público' },
] as const
type TabId = typeof TABS[number]['id']

export function CombustiblePage() {
  const cid    = useAuthStore(s => s.clienteActivo?.id) ?? ''
  const [tab, setTab] = useState<TabId>('resumen')
  const geoCtx = useGeoContext()   // detecta ubicación + país una sola vez al cargar

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Combustible y Transporte</h1>
        <p className="text-text-muted text-sm mt-0.5">
          Calcula tu gasto mensual en movilidad
          {geoCtx && <span className="ml-2 text-xs">· 📍 {geoCtx.countryName}</span>}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto pb-0 -mb-px">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'resumen'   && <TabResumen cid={cid} />}
        {tab === 'rutas'     && <TabRutas cid={cid} geoCtx={geoCtx} />}
        {tab === 'vehiculos' && <TabVehiculos cid={cid} />}
        {tab === 'precios'   && <TabPrecios />}
        {tab === 'publico'   && <TabTransportePublico />}
      </div>
    </div>
  )
}
