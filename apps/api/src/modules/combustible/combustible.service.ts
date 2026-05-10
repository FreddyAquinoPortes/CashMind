import { z } from 'zod'
import { prisma } from '../../shared/prisma'

const vehiculoSchema = z.object({
  marca: z.string().min(1),
  modelo: z.string().min(1),
  ano: z.number().int().min(1950).max(2035),
  mpgRealWorld: z.number().positive(),
  margenConsumo: z.number().min(0).max(100).default(15),
  fuenteMpg: z.string().optional(),
  activo: z.boolean().default(true),
})

const rutaSchema = z.object({
  vehiculoId: z.string().optional(),
  nombre: z.string().min(1),
  distanciaKm: z.number().positive(),
  vecesPorSemana: z.number().int().min(1).max(7),
  tipoCombustible: z.string().default('Regular'),
  porcentajePropio: z.number().min(0).max(100).default(100),
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

export class CombustibleService {
  // ── Vehículos ──────────────────────────────────────────────────────────────
  async listVehiculos(clienteId: string) {
    return prisma.vehiculo.findMany({ where: { clienteId }, orderBy: { marca: 'asc' } })
  }

  async createVehiculo(clienteId: string, body: unknown) {
    const d = vehiculoSchema.parse(body)
    return prisma.vehiculo.create({
      data: { clienteId, marca: d.marca, modelo: d.modelo, ano: d.ano, mpgRealWorld: d.mpgRealWorld, margenConsumo: d.margenConsumo, fuenteMpg: d.fuenteMpg ?? null, activo: d.activo },
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
      },
    })
  }

  async removeVehiculo(id: string) {
    return prisma.vehiculo.delete({ where: { id } })
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
      data: { clienteId, vehiculoId: d.vehiculoId ?? null, nombre: d.nombre, distanciaKm: d.distanciaKm, vecesPorSemana: d.vecesPorSemana, tipoCombustible: d.tipoCombustible, porcentajePropio: d.porcentajePropio, activa: d.activa },
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
        ...(d.vecesPorSemana !== undefined && { vecesPorSemana: d.vecesPorSemana }),
        ...(d.tipoCombustible !== undefined && { tipoCombustible: d.tipoCombustible }),
        ...(d.porcentajePropio !== undefined && { porcentajePropio: d.porcentajePropio }),
        ...(d.activa !== undefined && { activa: d.activa }),
      },
    })
  }

  async removeRuta(id: string) {
    return prisma.ruta.delete({ where: { id } })
  }

  // ── Precios Combustible ────────────────────────────────────────────────────
  async listPrecios() {
    return prisma.precioCombustible.findMany({ orderBy: { fecha: 'desc' }, take: 60 })
  }

  async latestPrecios() {
    const tipos = ['Regular', 'Premium', 'Gasoil', 'GLP', 'GNC']
    const results = await Promise.all(
      tipos.map(tipo => prisma.precioCombustible.findFirst({ where: { tipo }, orderBy: { fecha: 'desc' } }))
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

  // ── Cálculo Principal ──────────────────────────────────────────────────────
  async calcular(clienteId: string) {
    const rutas = await prisma.ruta.findMany({
      where: { clienteId, activa: true },
      include: {
        vehiculo: { include: { rendimientos: true } },
      },
    })

    // Cargar el último precio de cada tipo de combustible usado en las rutas
    const tiposUsados = [...new Set(rutas.map(r => r.tipoCombustible))]
    const preciosPorTipo: Record<string, number> = {}
    await Promise.all(
      tiposUsados.map(async tipo => {
        const p = await prisma.precioCombustible.findFirst({ where: { tipo }, orderBy: { fecha: 'desc' } })
        preciosPorTipo[tipo] = p ? Number(p.precio) : 294.5
      })
    )

    const detalleRutas = rutas.map(ruta => {
      const kmSemanal = Number(ruta.distanciaKm) * ruta.vecesPorSemana
      const kmMensual = kmSemanal * 4.33
      const porcentaje = Number(ruta.porcentajePropio) / 100
      const tipoComb = ruta.tipoCombustible
      const precioPorUnidad = preciosPorTipo[tipoComb] ?? 294.5

      let consumoMes = 0   // galones o m³ según unidad
      let costoTotal = 0
      let costoNeto = 0
      let rendimientoEfectivo: number | null = null
      let unidad = 'mpg'

      if (ruta.vehiculo) {
        // Busca rendimiento específico para el combustible de la ruta
        const rendEspecifico = ruta.vehiculo.rendimientos.find(r => r.tipoCombustible === tipoComb)

        if (rendEspecifico) {
          const rend = Number(rendEspecifico.rendimiento)
          const margen = Number(rendEspecifico.margenConsumo) / 100
          rendimientoEfectivo = +(rend / (1 + margen)).toFixed(2)
          unidad = rendEspecifico.unidad
        } else {
          // Fallback: usa mpgRealWorld del vehículo (asume combustible de gasolina)
          const mpg = Number(ruta.vehiculo.mpgRealWorld)
          const margen = Number(ruta.vehiculo.margenConsumo) / 100
          rendimientoEfectivo = +(mpg / (1 + margen)).toFixed(2)
          unidad = 'mpg'
        }

        if (unidad === 'mpg') {
          const millasMes = kmMensual / 1.60934
          consumoMes = millasMes / rendimientoEfectivo
        } else {
          // km_m3: rendimiento es km por m³
          consumoMes = kmMensual / rendimientoEfectivo
        }
        costoTotal = consumoMes * precioPorUnidad
        costoNeto = costoTotal * porcentaje
      }

      return {
        id: ruta.id,
        nombre: ruta.nombre,
        distanciaKm: Number(ruta.distanciaKm),
        vecesPorSemana: ruta.vecesPorSemana,
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
      }
    })

    const totales = detalleRutas.reduce(
      (acc, r) => ({
        kmSemanal: acc.kmSemanal + r.kmSemanal,
        kmMensual: acc.kmMensual + r.kmMensual,
        costoTotal: acc.costoTotal + r.costoTotal,
        costoNeto: acc.costoNeto + r.costoNeto,
      }),
      { kmSemanal: 0, kmMensual: 0, costoTotal: 0, costoNeto: 0 }
    )

    return {
      preciosPorTipo,
      rutas: detalleRutas,
      totales: {
        kmSemanal: +totales.kmSemanal.toFixed(1),
        kmMensual: +totales.kmMensual.toFixed(1),
        costoTotal: +totales.costoTotal.toFixed(2),
        costoNeto: +totales.costoNeto.toFixed(2),
      },
    }
  }
}
