import { z } from 'zod'
import * as https from 'https'
import * as http from 'http'
import { prisma } from '../../shared/prisma'

// ── DR fuel type names (matches prestocombustibles.com nomenclature) ────────
export const DR_FUEL_TYPES = [
  'Gasolina Premium',
  'Gasolina Regular',
  'Gasoil Premium',
  'Gasoil Regular',
  'Kerosene / Jet Fuel',
  'Gas Licuado (GLP)',
  'Gas Natural (GNC)',
]

// ── Schemas ────────────────────────────────────────────────────────────────

const vehiculoSchema = z.object({
  marca: z.string().min(1),
  modelo: z.string().min(1),
  ano: z.number().int().min(1950).max(2035),
  mpgRealWorld: z.number().positive(),
  margenConsumo: z.number().min(0).max(100).default(15),
  fuenteMpg: z.string().optional(),
  activo: z.boolean().default(true),
  catalogoId: z.string().optional().nullable(),
})

const rutaSchema = z.object({
  vehiculoId: z.string().optional(),
  nombre: z.string().min(1),
  distanciaKm: z.number().positive(),
  frecuenciaValor: z.number().int().min(1).max(365).default(5),
  frecuenciaUnidad: z.enum(['dia', 'semana', 'mes']).default('semana'),
  diasSemana: z.string().optional().nullable(),
  tipoCombustible: z.string().default('Gasolina Regular'),
  porcentajePropio: z.number().min(0).max(100).default(100),
  rendimientoManual: z.number().positive().optional().nullable(),
  unidadRendimiento: z.enum(['mpg', 'km_l', 'km_m3']).default('mpg'),
  activa: z.boolean().default(true),
})

const rendimientoSchema = z.object({
  tipoCombustible: z.string().min(1),
  rendimiento: z.number().positive(),
  unidad: z.enum(['mpg', 'km_m3']).default('mpg'),
  margenConsumo: z.number().min(0).max(100).default(15),
  fuente: z.string().optional(),
})

const precioSchema = z.object({
  tipo: z.string().min(1),
  precio: z.number().positive(),
  moneda: z.string().default('DOP'),
  unidad: z.string().default('galon'),
  fecha: z.coerce.date(),
  fuente: z.string().optional(),
})

// ── HTTP helper (Node built-in, no axios needed) ───────────────────────────

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, { headers: { 'User-Agent': 'CashMind/1.0' } }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// ── Scrape prestocombustibles.com ──────────────────────────────────────────
// Parses the fuel price table from the site.
// Expected HTML pattern: fuel name in <td> followed by price in next <td>

const FUEL_NAME_MAP: Record<string, string> = {
  'gasolina premium':      'Gasolina Premium',
  'premium':               'Gasolina Premium',
  'gasolina regular':      'Gasolina Regular',
  'regular':               'Gasolina Regular',
  'gasoil premium':        'Gasoil Premium',
  'gasoil regular':        'Gasoil Regular',
  'óptimo':                'Gasoil Premium',
  'optimo':                'Gasoil Premium',
  'kerosene':              'Kerosene / Jet Fuel',
  'kerosene / jet fuel':   'Kerosene / Jet Fuel',
  'gas licuado':           'Gas Licuado (GLP)',
  'gas licuado (lp)':      'Gas Licuado (GLP)',
  'glp':                   'Gas Licuado (GLP)',
  'gas natural':           'Gas Natural (GNC)',
  'gas natural comprimido':'Gas Natural (GNC)',
  'gnc':                   'Gas Natural (GNC)',
}

async function scrapeDRFuelPrices(): Promise<{ tipo: string; precio: number; unidad: string }[]> {
  const html = await fetchText('https://www.prestocombustibles.com/precios-combustibles/')

  const results: { tipo: string; precio: number; unidad: string }[] = []

  // Strip HTML tags from a string
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim()

  // Match all <tr> rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch
  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1]
    // Extract all <td> cells
    const cells: string[] = []
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      cells.push(stripHtml(tdMatch[1]))
    }
    if (cells.length < 2) continue

    const rawName = cells[0].toLowerCase().trim()
    const mappedName = FUEL_NAME_MAP[rawName]
    if (!mappedName) continue

    // Find numeric price in any cell
    for (let i = 1; i < cells.length; i++) {
      const priceMatch = cells[i].match(/[\d,]+\.?\d*/)
      if (priceMatch) {
        const precio = parseFloat(priceMatch[0].replace(',', ''))
        if (precio > 0) {
          const unidad = mappedName === 'Gas Natural (GNC)' ? 'm3' : 'galon'
          results.push({ tipo: mappedName, precio, unidad })
          break
        }
      }
    }
  }

  return results
}

// Count occurrences of specific weekdays in a date range
function countDaysInPeriod(diasSemana: number[], start: Date, end: Date): number {
  let count = 0
  const d = new Date(start)
  d.setHours(0, 0, 0, 0)
  const endD = new Date(end)
  endD.setHours(23, 59, 59, 999)
  while (d <= endD) {
    if (diasSemana.includes(d.getDay())) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export class CombustibleService {
  // ── Vehículos ──────────────────────────────────────────────────────────────
  async listVehiculos(clienteId: string) {
    return prisma.vehiculo.findMany({
      where: { clienteId },
      orderBy: { marca: 'asc' },
      include: { catalogo: true },
    })
  }

  async createVehiculo(clienteId: string, body: unknown) {
    const d = vehiculoSchema.parse(body)
    return prisma.vehiculo.create({
      data: {
        clienteId, marca: d.marca, modelo: d.modelo, ano: d.ano,
        mpgRealWorld: d.mpgRealWorld, margenConsumo: d.margenConsumo,
        fuenteMpg: d.fuenteMpg ?? null, activo: d.activo,
        catalogoId: d.catalogoId ?? null,
      } as any,
    })
  }

  // ── Rendimientos por combustible ───────────────────────────────────────────
  async listRendimientos(vehiculoId: string) {
    return prisma.vehiculoRendimiento.findMany({
      where: { vehiculoId },
      orderBy: { tipoCombustible: 'asc' },
    })
  }

  async upsertRendimiento(vehiculoId: string, body: unknown) {
    const d = rendimientoSchema.parse(body)
    return prisma.vehiculoRendimiento.upsert({
      where: { vehiculoId_tipoCombustible: { vehiculoId, tipoCombustible: d.tipoCombustible } },
      update: { rendimiento: d.rendimiento, unidad: d.unidad, margenConsumo: d.margenConsumo, fuente: d.fuente ?? null },
      create: { vehiculoId, tipoCombustible: d.tipoCombustible, rendimiento: d.rendimiento, unidad: d.unidad, margenConsumo: d.margenConsumo, fuente: d.fuente ?? null },
    })
  }

  async removeRendimiento(id: string) {
    return prisma.vehiculoRendimiento.delete({ where: { id } })
  }

  async updateVehiculo(id: string, body: unknown) {
    const d = vehiculoSchema.partial().parse(body)
    return prisma.vehiculo.update({
      where: { id },
      data: {
        ...(d.marca !== undefined && { marca: d.marca }),
        ...(d.modelo !== undefined && { modelo: d.modelo }),
        ...(d.ano !== undefined && { ano: d.ano }),
        ...(d.mpgRealWorld !== undefined && { mpgRealWorld: d.mpgRealWorld }),
        ...(d.margenConsumo !== undefined && { margenConsumo: d.margenConsumo }),
        ...(d.fuenteMpg !== undefined && { fuenteMpg: d.fuenteMpg ?? null }),
        ...(d.activo !== undefined && { activo: d.activo }),
        ...('catalogoId' in d && { catalogoId: (d as any).catalogoId ?? null }),
      } as any,
    })
  }

  async removeVehiculo(id: string) {
    return prisma.vehiculo.delete({ where: { id } })
  }

  // ── Catálogo de vehículos ──────────────────────────────────────────────────
  async searchCatalogo(q?: string, marca?: string) {
    const where: Record<string, any> = {}
    if (marca) where['marca'] = { equals: marca, mode: 'insensitive' }
    if (q) {
      where['OR'] = [
        { marca: { contains: q, mode: 'insensitive' } },
        { modelo: { contains: q, mode: 'insensitive' } },
        { motor: { contains: q, mode: 'insensitive' } },
      ]
    }
    return (prisma as any).vehiculoCatalogo.findMany({
      where,
      orderBy: [{ marca: 'asc' }, { modelo: 'asc' }, { anoDesde: 'desc' }],
      take: 50,
    })
  }

  // ── Rutas ──────────────────────────────────────────────────────────────────
  async listRutas(clienteId: string) {
    return prisma.ruta.findMany({
      where: { clienteId },
      include: { vehiculo: { select: { id: true, marca: true, modelo: true, ano: true, mpgRealWorld: true, margenConsumo: true } } },
      orderBy: { nombre: 'asc' },
    })
  }

  async createRuta(clienteId: string, body: unknown) {
    const d = rutaSchema.parse(body)
    return prisma.ruta.create({
      data: {
        clienteId,
        vehiculoId: d.vehiculoId ?? null,
        nombre: d.nombre,
        distanciaKm: d.distanciaKm,
        frecuenciaValor: d.frecuenciaValor,
        frecuenciaUnidad: d.frecuenciaUnidad,
        diasSemana: d.diasSemana ?? null,
        tipoCombustible: d.tipoCombustible,
        porcentajePropio: d.porcentajePropio,
        rendimientoManual: d.rendimientoManual ?? null,
        unidadRendimiento: d.unidadRendimiento,
        activa: d.activa,
      } as any,
    })
  }

  async updateRuta(id: string, body: unknown) {
    const d = rutaSchema.partial().parse(body)
    return prisma.ruta.update({
      where: { id },
      data: {
        ...(d.vehiculoId !== undefined && { vehiculoId: d.vehiculoId ?? null }),
        ...(d.nombre !== undefined && { nombre: d.nombre }),
        ...(d.distanciaKm !== undefined && { distanciaKm: d.distanciaKm }),
        ...(d.frecuenciaValor !== undefined && { frecuenciaValor: d.frecuenciaValor }),
        ...(d.frecuenciaUnidad !== undefined && { frecuenciaUnidad: d.frecuenciaUnidad }),
        ...('diasSemana' in d && { diasSemana: d.diasSemana ?? null }),
        ...('rendimientoManual' in d && { rendimientoManual: d.rendimientoManual ?? null }),
        ...(d.unidadRendimiento !== undefined && { unidadRendimiento: d.unidadRendimiento }),
        ...(d.tipoCombustible !== undefined && { tipoCombustible: d.tipoCombustible }),
        ...(d.porcentajePropio !== undefined && { porcentajePropio: d.porcentajePropio }),
        ...(d.activa !== undefined && { activa: d.activa }),
      },
    })
  }

  async removeRuta(id: string) {
    // Delete all non-executed events linked to this route before removing it
    await prisma.evento.deleteMany({
      where: {
        rutaId: id,
        estado: { notIn: ['EJECUTADO'] },
      },
    })
    return prisma.ruta.delete({ where: { id } })
  }

  // ── Precios Combustible ────────────────────────────────────────────────────
  async listPrecios() {
    return prisma.precioCombustible.findMany({ orderBy: { fecha: 'desc' }, take: 60 })
  }

  async latestPrecios() {
    // Get latest price for every fuel type that has ever been recorded
    const allTypes = await prisma.precioCombustible.findMany({
      select: { tipo: true },
      distinct: ['tipo'],
    })
    const tipos = allTypes.map(t => t.tipo)

    // Fall back to DR defaults if DB is empty
    const effectiveTipos = tipos.length > 0 ? tipos : DR_FUEL_TYPES

    const results = await Promise.all(
      effectiveTipos.map(tipo =>
        prisma.precioCombustible.findFirst({ where: { tipo }, orderBy: { fecha: 'desc' } })
      )
    )
    return results.filter(Boolean)
  }

  async listPreciosByTipo(tipo: string) {
    return prisma.precioCombustible.findMany({
      where: { tipo },
      orderBy: { fecha: 'desc' },
      take: 50,
    })
  }

  async createPrecio(body: unknown) {
    const d = precioSchema.parse(body)
    return prisma.precioCombustible.create({
      data: { tipo: d.tipo, precio: d.precio, moneda: d.moneda, unidad: d.unidad, fecha: d.fecha, fuente: d.fuente ?? null },
    })
  }

  async updatePrecio(id: string, body: unknown) {
    const d = precioSchema.partial().parse(body)
    return prisma.precioCombustible.update({
      where: { id },
      data: {
        ...(d.tipo !== undefined && { tipo: d.tipo }),
        ...(d.precio !== undefined && { precio: d.precio }),
        ...(d.moneda !== undefined && { moneda: d.moneda }),
        ...(d.unidad !== undefined && { unidad: d.unidad }),
        ...(d.fecha !== undefined && { fecha: d.fecha }),
        ...(d.fuente !== undefined && { fuente: d.fuente ?? null }),
      },
    })
  }

  async removePrecio(id: string) {
    return prisma.precioCombustible.delete({ where: { id } })
  }

  // ── Sync DR fuel prices from prestocombustibles.com ───────────────────────
  async syncPrecios(): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = []
    let updated = 0
    const fecha = new Date()

    try {
      const scraped = await scrapeDRFuelPrices()

      if (scraped.length === 0) {
        errors.push('No se encontraron precios en el sitio. Puede que la estructura del HTML haya cambiado.')
        return { updated, errors }
      }

      for (const { tipo, precio, unidad } of scraped) {
        try {
          await prisma.precioCombustible.create({
            data: { tipo, precio, moneda: 'DOP', unidad, fecha, fuente: 'prestocombustibles.com' },
          })
          updated++
        } catch (e: any) {
          errors.push(`${tipo}: ${e.message}`)
        }
      }
    } catch (e: any) {
      errors.push(`Error al obtener página: ${e.message}`)
    }

    return { updated, errors }
  }

  // ── Cálculo Principal ──────────────────────────────────────────────────────
  async calcular(clienteId: string, opts?: { inicio?: string; fin?: string }) {
    const rutas = await prisma.ruta.findMany({
      where: { clienteId, activa: true },
      include: {
        vehiculo: { include: { rendimientos: true } },
      },
    })

    // Load latest price for each fuel type used in routes
    const tiposUsados = [...new Set(rutas.map(r => r.tipoCombustible))]
    const preciosPorTipo: Record<string, number> = {}
    await Promise.all(
      tiposUsados.map(async tipo => {
        const p = await prisma.precioCombustible.findFirst({ where: { tipo }, orderBy: { fecha: 'desc' } })
        preciosPorTipo[tipo as string] = p ? Number(p.precio) : 293.5
      })
    )

    let periodDays: number | null = null
    let periodoInicio: Date | null = null
    let periodoFin: Date | null = null
    if (opts?.inicio && opts?.fin) {
      periodoInicio = new Date(opts.inicio + 'T00:00:00')
      periodoFin = new Date(opts.fin + 'T23:59:59')
      periodDays = Math.round((periodoFin.getTime() - periodoInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }

    const detalleRutas = rutas.map(ruta => {
      const dist = Number(ruta.distanciaKm)
      const fVal = (ruta as any).frecuenciaValor ?? 5
      const fUnidad = (ruta as any).frecuenciaUnidad ?? 'semana'
      const kmSemanal = fUnidad === 'dia' ? dist * fVal * 7
        : fUnidad === 'mes' ? (dist * fVal) / 4.33
        : dist * fVal
      const kmMensual = kmSemanal * 4.33
      const porcentaje = Number(ruta.porcentajePropio) / 100
      const tipoComb = ruta.tipoCombustible
      const precioPorUnidad = preciosPorTipo[tipoComb] ?? 293.5

      let consumoMes = 0
      let costoTotal = 0
      let costoNeto = 0
      let rendimientoEfectivo: number | null = null
      let unidad = 'mpg'

      if (ruta.vehiculo) {
        const rendEspecifico = ruta.vehiculo.rendimientos.find(r => r.tipoCombustible === tipoComb)

        if (rendEspecifico) {
          const rend = Number(rendEspecifico.rendimiento)
          const margen = Number(rendEspecifico.margenConsumo) / 100
          rendimientoEfectivo = +(rend / (1 + margen)).toFixed(2)
          unidad = rendEspecifico.unidad
        } else {
          const mpg = Number(ruta.vehiculo.mpgRealWorld)
          const margen = Number(ruta.vehiculo.margenConsumo) / 100
          rendimientoEfectivo = +(mpg / (1 + margen)).toFixed(2)
          unidad = 'mpg'
        }

        if (unidad === 'mpg') {
          const millasMes = kmMensual / 1.60934
          consumoMes = millasMes / rendimientoEfectivo
        } else {
          consumoMes = kmMensual / rendimientoEfectivo
        }
        costoTotal = consumoMes * precioPorUnidad
        costoNeto = costoTotal * porcentaje
      } else if ((ruta as any).rendimientoManual) {
        const rend = Number((ruta as any).rendimientoManual)
        const unidadR = (ruta as any).unidadRendimiento ?? 'mpg'
        rendimientoEfectivo = rend
        unidad = unidadR
        if (unidadR === 'mpg') {
          const millasMes = kmMensual / 1.60934
          consumoMes = millasMes / rend
        } else {
          consumoMes = kmMensual / rend
        }
        costoTotal = consumoMes * precioPorUnidad
        costoNeto = costoTotal * porcentaje
      }

      // Period km calculation
      let kmPeriodo: number | null = null
      if (periodDays !== null && periodoInicio && periodoFin) {
        const diasSemana = (ruta as any).diasSemana
        if (fUnidad === 'semana' && diasSemana) {
          // Exact weekday count
          const dias = String(diasSemana).split(',').map(Number).filter((n: number) => n >= 0 && n <= 6)
          const viajes = countDaysInPeriod(dias, periodoInicio, periodoFin)
          kmPeriodo = dist * viajes
        } else if (fUnidad === 'dia') {
          kmPeriodo = dist * fVal * periodDays
        } else if (fUnidad === 'mes') {
          kmPeriodo = dist * fVal * (periodDays / 30.44)
        } else { // semana sin diasSemana
          kmPeriodo = dist * fVal * (periodDays / 7)
        }
      }

      let consumoPeriodo: number | null = null
      let costoPeriodo: number | null = null
      let costoNetoPeriodo: number | null = null
      if (kmPeriodo !== null && rendimientoEfectivo) {
        const consumo = unidad === 'mpg'
          ? (kmPeriodo / 1.60934) / rendimientoEfectivo
          : kmPeriodo / rendimientoEfectivo
        consumoPeriodo = +consumo.toFixed(2)
        costoPeriodo = +(consumo * precioPorUnidad).toFixed(2)
        costoNetoPeriodo = +(costoPeriodo * porcentaje).toFixed(2)
      }

      return {
        id: ruta.id,
        nombre: ruta.nombre,
        distanciaKm: Number(ruta.distanciaKm),
        frecuenciaValor: (ruta as any).frecuenciaValor ?? 5,
        frecuenciaUnidad: (ruta as any).frecuenciaUnidad ?? 'semana',
        tipoCombustible: tipoComb,
        porcentajePropio: Number(ruta.porcentajePropio),
        vehiculo: ruta.vehiculo
          ? { id: ruta.vehiculo.id, marca: ruta.vehiculo.marca, modelo: ruta.vehiculo.modelo, ano: ruta.vehiculo.ano, rendimientoEfectivo, unidad }
          : null,
        kmSemanal: +kmSemanal.toFixed(1),
        kmMensual: +kmMensual.toFixed(1),
        consumoMes: +consumoMes.toFixed(2),
        unidadConsumo: unidad === 'mpg' ? 'gal' : 'm³',
        costoTotal: +costoTotal.toFixed(2),
        costoNeto: +costoNeto.toFixed(2),
        precioCombustibleUsado: precioPorUnidad,
        kmPeriodo: kmPeriodo !== null ? +kmPeriodo.toFixed(1) : null,
        consumoPeriodo,
        costoPeriodo,
        costoNetoPeriodo,
        diasSemana: (ruta as any).diasSemana ?? null,
      }
    })

    const totales = detalleRutas.reduce(
      (acc, r) => ({
        kmSemanal: acc.kmSemanal + r.kmSemanal,
        kmMensual: acc.kmMensual + r.kmMensual,
        costoTotal: acc.costoTotal + r.costoTotal,
        costoNeto: acc.costoNeto + r.costoNeto,
        kmPeriodo: acc.kmPeriodo + (r.kmPeriodo ?? 0),
        costoPeriodo: acc.costoPeriodo + (r.costoPeriodo ?? 0),
        costoNetoPeriodo: acc.costoNetoPeriodo + (r.costoNetoPeriodo ?? 0),
      }),
      { kmSemanal: 0, kmMensual: 0, costoTotal: 0, costoNeto: 0, kmPeriodo: 0, costoPeriodo: 0, costoNetoPeriodo: 0 }
    )

    return {
      preciosPorTipo,
      rutas: detalleRutas,
      totales: {
        kmSemanal: +totales.kmSemanal.toFixed(1),
        kmMensual: +totales.kmMensual.toFixed(1),
        costoTotal: +totales.costoTotal.toFixed(2),
        costoNeto: +totales.costoNeto.toFixed(2),
        kmPeriodo: +totales.kmPeriodo.toFixed(1),
        costoPeriodo: +totales.costoPeriodo.toFixed(2),
        costoNetoPeriodo: +totales.costoNetoPeriodo.toFixed(2),
      },
      periodDays,
      periodoInicio: periodoInicio ? periodoInicio.toISOString().split('T')[0] : null,
      periodoFin: periodoFin ? periodoFin.toISOString().split('T')[0] : null,
    }
  }
}

// ── Weekly auto-sync (starts when module loads in production) ─────────────
let syncScheduled = false

export function startWeeklySyncIfNeeded() {
  if (syncScheduled || process.env.NODE_ENV !== 'production') return
  syncScheduled = true

  const svc = new CombustibleService()

  // Run once on startup after 5s delay, then weekly
  setTimeout(() => {
    svc.syncPrecios().then(r => {
      console.log(`[combustible] Startup sync: ${r.updated} precios actualizados`)
      if (r.errors.length) console.warn('[combustible] Errores:', r.errors)
    }).catch(e => console.warn('[combustible] Sync error:', e.message))
  }, 5000)

  // Weekly: 7 days in ms
  setInterval(() => {
    svc.syncPrecios().then(r => {
      console.log(`[combustible] Weekly sync: ${r.updated} precios actualizados`)
      if (r.errors.length) console.warn('[combustible] Errores:', r.errors)
    }).catch(e => console.warn('[combustible] Weekly sync error:', e.message))
  }, 7 * 24 * 60 * 60 * 1000)
}
