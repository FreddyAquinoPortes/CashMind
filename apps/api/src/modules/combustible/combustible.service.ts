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
  porcentajePropio: z.number().min(0).max(100).default(100),
  activa: z.boolean().default(true),
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
      data: { clienteId, vehiculoId: d.vehiculoId ?? null, nombre: d.nombre, distanciaKm: d.distanciaKm, vecesPorSemana: d.vecesPorSemana, porcentajePropio: d.porcentajePropio, activa: d.activa },
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
    const tipos = ['Regular', 'Premium', 'Gasoil']
    const results = await Promise.all(
      tipos.map(tipo => prisma.precioCombustible.findFirst({ where: { tipo }, orderBy: { fecha: 'desc' } }))
    )
    return results.filter(Boolean)
  }

  async createPrecio(body: unknown) {
    const d = precioSchema.parse(body)
    return prisma.precioCombustible.create({
      data: { tipo: d.tipo, precio: d.precio, moneda: d.moneda, unidad: d.unidad, fecha: d.fecha, fuente: d.fuente ?? null },
    })
  }

  async removePrecio(id: string) {
    return prisma.precioCombustible.delete({ where: { id } })
  }

  // ── Cálculo Principal ──────────────────────────────────────────────────────
  async calcular(clienteId: string) {
    const [rutas, precioRegular] = await Promise.all([
      prisma.ruta.findMany({
        where: { clienteId, activa: true },
        include: { vehiculo: true },
      }),
      prisma.precioCombustible.findFirst({ where: { tipo: 'Regular' }, orderBy: { fecha: 'desc' } }),
    ])

    const precioPorGalon = precioRegular ? Number(precioRegular.precio) : 294.5

    const detalleRutas = rutas.map(ruta => {
      const kmSemanal = Number(ruta.distanciaKm) * ruta.vecesPorSemana
      const kmMensual = kmSemanal * 4.33
      const millasMes = kmMensual / 1.60934
      const porcentaje = Number(ruta.porcentajePropio) / 100

      let galonesMes = 0
      let costoTotal = 0
      let costoNeto = 0
      let mpgEfectivo: number | null = null

      if (ruta.vehiculo) {
        const mpg = Number(ruta.vehiculo.mpgRealWorld)
        const margen = Number(ruta.vehiculo.margenConsumo) / 100
        mpgEfectivo = +(mpg / (1 + margen)).toFixed(2)
        galonesMes = millasMes / mpgEfectivo
        costoTotal = galonesMes * precioPorGalon
        costoNeto = costoTotal * porcentaje
      }

      return {
        id: ruta.id,
        nombre: ruta.nombre,
        distanciaKm: Number(ruta.distanciaKm),
        vecesPorSemana: ruta.vecesPorSemana,
        porcentajePropio: Number(ruta.porcentajePropio),
        vehiculo: ruta.vehiculo
          ? { id: ruta.vehiculo.id, marca: ruta.vehiculo.marca, modelo: ruta.vehiculo.modelo, ano: ruta.vehiculo.ano, mpgEfectivo }
          : null,
        kmSemanal: +kmSemanal.toFixed(1),
        kmMensual: +kmMensual.toFixed(1),
        galonesMes: +galonesMes.toFixed(2),
        costoTotal: +costoTotal.toFixed(2),
        costoNeto: +costoNeto.toFixed(2),
      }
    })

    const totales = detalleRutas.reduce(
      (acc, r) => ({
        kmSemanal: acc.kmSemanal + r.kmSemanal,
        kmMensual: acc.kmMensual + r.kmMensual,
        galonesMes: acc.galonesMes + r.galonesMes,
        costoTotal: acc.costoTotal + r.costoTotal,
        costoNeto: acc.costoNeto + r.costoNeto,
      }),
      { kmSemanal: 0, kmMensual: 0, galonesMes: 0, costoTotal: 0, costoNeto: 0 }
    )

    return {
      precioCombustible: precioRegular
        ? { id: precioRegular.id, precio: Number(precioRegular.precio), tipo: precioRegular.tipo, fecha: precioRegular.fecha }
        : null,
      rutas: detalleRutas,
      totales: {
        kmSemanal: +totales.kmSemanal.toFixed(1),
        kmMensual: +totales.kmMensual.toFixed(1),
        galonesMes: +totales.galonesMes.toFixed(2),
        costoTotal: +totales.costoTotal.toFixed(2),
        costoNeto: +totales.costoNeto.toFixed(2),
      },
    }
  }
}
