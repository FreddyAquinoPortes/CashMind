import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Helpers ────────────────────────────────────────────────────────────────
function parseNum(v: unknown): number {
  return typeof v === 'object' && v !== null && 'toNumber' in (v as object)
    ? (v as { toNumber(): number }).toNumber()
    : Number(v ?? 0)
}

// ── Presupuesto CRUD ───────────────────────────────────────────────────────

export async function listPresupuestos(clienteId: string) {
  const rows = await prisma.presupuesto.findMany({
    where: { clienteId },
    include: {
      lineas: {
        include: { ejecuciones: true },
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: { fechaInicio: 'desc' },
  })
  return rows.map(enrich)
}

export async function getPresupuesto(clienteId: string, id: string) {
  const row = await prisma.presupuesto.findFirstOrThrow({
    where: { id, clienteId },
    include: {
      lineas: {
        include: {
          ejecuciones: true,
        },
        orderBy: { orden: 'asc' },
      },
    },
  })
  return enrich(row)
}

export async function createPresupuesto(clienteId: string, data: {
  nombre: string
  fechaInicio: string
  fechaFin: string
  tipo?: 'NORMAL' | 'ATOMICO'
  notas?: string
  lineas?: LineaInput[]
}) {
  const { lineas, ...rest } = data
  const row = await prisma.presupuesto.create({
    data: {
      clienteId,
      nombre: rest.nombre,
      tipo: rest.tipo ?? 'NORMAL',
      fechaInicio: new Date(rest.fechaInicio),
      fechaFin: new Date(rest.fechaFin),
      notas: rest.notas ?? null,
      estado: 'BORRADOR',
      lineas: lineas ? {
        create: lineas.map((l, i) => ({
          tipo: l.tipo,
          concepto: l.concepto,
          categoriaId: l.categoriaId ?? null,
          subcategoriaId: l.subcategoriaId ?? null,
          montoPlaneado: l.montoPlaneado,
          notas: l.notas ?? null,
          orden: l.orden ?? i,
          incluido: l.incluido ?? true,
          eventoId: l.eventoId ?? null,
          deudaId: l.deudaId ?? null,
          rutaId: l.rutaId ?? null,
        })),
      } : undefined,
    },
    include: { lineas: { include: { ejecuciones: true }, orderBy: { orden: 'asc' } } },
  })
  return enrich(row)
}

export async function updatePresupuesto(clienteId: string, id: string, data: {
  nombre?: string
  fechaInicio?: string
  fechaFin?: string
  notas?: string
  estado?: 'BORRADOR' | 'ACTIVO' | 'CERRADO'
}) {
  const row = await prisma.presupuesto.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.fechaInicio !== undefined && { fechaInicio: new Date(data.fechaInicio) }),
      ...(data.fechaFin !== undefined && { fechaFin: new Date(data.fechaFin) }),
      ...(data.notas !== undefined && { notas: data.notas ?? null }),
      ...(data.estado !== undefined && { estado: data.estado }),
    },
    include: { lineas: { include: { ejecuciones: true }, orderBy: { orden: 'asc' } } },
  })
  return enrich(row)
}

export async function deletePresupuesto(clienteId: string, id: string) {
  await prisma.presupuesto.findFirstOrThrow({ where: { id, clienteId } })
  await prisma.presupuesto.delete({ where: { id } })
}

// ── Líneas CRUD ────────────────────────────────────────────────────────────

interface LineaInput {
  tipo: 'INGRESO' | 'GASTO'
  concepto: string
  categoriaId?: string | null
  subcategoriaId?: string | null
  montoPlaneado: number
  notas?: string | null
  orden?: number
  incluido?: boolean
  eventoId?: string | null
  deudaId?: string | null
  rutaId?: string | null
}

export async function addLinea(clienteId: string, presupuestoId: string, data: LineaInput) {
  await prisma.presupuesto.findFirstOrThrow({ where: { id: presupuestoId, clienteId } })
  const count = await prisma.lineaPresupuesto.count({ where: { presupuestoId } })
  return prisma.lineaPresupuesto.create({
    data: {
      presupuestoId,
      tipo: data.tipo,
      concepto: data.concepto,
      categoriaId: data.categoriaId ?? null,
      subcategoriaId: data.subcategoriaId ?? null,
      montoPlaneado: data.montoPlaneado,
      notas: data.notas ?? null,
      orden: data.orden ?? count,
      incluido: data.incluido ?? true,
      eventoId: data.eventoId ?? null,
      deudaId: data.deudaId ?? null,
      rutaId: data.rutaId ?? null,
    },
    include: { ejecuciones: true },
  })
}

export async function toggleIncluido(lineaId: string, incluido: boolean) {
  return prisma.lineaPresupuesto.update({
    where: { id: lineaId },
    data: { incluido },
    include: { ejecuciones: true },
  })
}

export async function updateLinea(lineaId: string, data: Partial<LineaInput>) {
  return prisma.lineaPresupuesto.update({
    where: { id: lineaId },
    data: {
      ...(data.tipo !== undefined && { tipo: data.tipo }),
      ...(data.concepto !== undefined && { concepto: data.concepto }),
      ...(data.categoriaId !== undefined && { categoriaId: data.categoriaId ?? null }),
      ...(data.subcategoriaId !== undefined && { subcategoriaId: data.subcategoriaId ?? null }),
      ...(data.montoPlaneado !== undefined && { montoPlaneado: data.montoPlaneado }),
      ...(data.notas !== undefined && { notas: data.notas ?? null }),
      ...(data.orden !== undefined && { orden: data.orden }),
    },
    include: { ejecuciones: true },
  })
}

export async function deleteLinea(lineaId: string) {
  await prisma.lineaPresupuesto.delete({ where: { id: lineaId } })
}

// ── Ejecución ──────────────────────────────────────────────────────────────

export async function ejecutarLinea(clienteId: string, lineaId: string, data: {
  montoEjecutado: number
  fecha?: string
  notas?: string
  crearEvento?: boolean
  cuentaId?: string
}) {
  // Verify ownership through presupuesto
  const linea = await prisma.lineaPresupuesto.findFirstOrThrow({
    where: { id: lineaId },
    include: { presupuesto: true },
  })
  if (linea.presupuesto.clienteId !== clienteId) throw new Error('Acceso denegado')

  const fecha = data.fecha ? new Date(data.fecha) : new Date()

  let eventoId: string | null = null
  let transaccionId: string | null = null

  if (data.crearEvento) {
    // Create a PLANIFICADO evento
    const evento = await prisma.evento.create({
      data: {
        clienteId,
        nombre: linea.concepto,
        tipo: linea.tipo === 'INGRESO' ? 'COBRO_PROGRAMADO' : 'PAGO_PROGRAMADO',
        fecha,
        presupuestoEstimado: data.montoEjecutado,
        estado: 'PLANIFICADO',
        categoriaId: linea.categoriaId ?? undefined,
        subcategoriaId: linea.subcategoriaId ?? undefined,
        notas: data.notas ?? `Generado desde presupuesto: ${linea.presupuesto.nombre}`,
      },
    })
    eventoId = evento.id
  } else {
    // Create a direct EJECUTADO transaction
    const tx = await prisma.transaccion.create({
      data: {
        clienteId,
        concepto: linea.concepto,
        monto: data.montoEjecutado,
        tipo: linea.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO',
        estado: 'EJECUTADO',
        fecha,
        categoriaId: linea.categoriaId ?? undefined,
        subcategoriaId: linea.subcategoriaId ?? undefined,
        cuentaId: data.cuentaId ?? undefined,
        notas: data.notas ?? `Ejecutado desde presupuesto: ${linea.presupuesto.nombre}`,
        frecuencia: 'UNICA',
      },
    })
    transaccionId = tx.id
  }

  const ejecucion = await prisma.ejecucionLinea.create({
    data: {
      lineaId,
      montoEjecutado: data.montoEjecutado,
      fecha,
      notas: data.notas ?? null,
      eventoId,
      transaccionId,
    },
  })

  return ejecucion
}

// ── Auto-sugerencias ───────────────────────────────────────────────────────
// Pulls recurring events, active debts and fuel routes to pre-populate a new budget

export async function getSugerencias(clienteId: string, fechaInicio: string, fechaFin: string) {
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)

  // 1. Eventos recurrentes que caen en el período
  const eventos = await prisma.evento.findMany({
    where: {
      clienteId,
      recurrente: true,
      estado: { in: ['PLANIFICADO', 'APARTADO'] },
    },
    include: {
      categoria: { select: { id: true, nombre: true, icono: true, color: true } },
      subcategoria: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'asc' },
  })

  // 2. Deudas activas con cuota mensual en el período
  const deudas = await prisma.deuda.findMany({
    where: { clienteId, estado: 'ACTIVA' },
    include: { persona: { select: { nombre: true } } },
  })

  // 3. Rutas de combustible activas
  const rutas = await prisma.ruta.findMany({
    where: { clienteId, activa: true },
    include: {
      vehiculo: {
        include: { rendimientos: { take: 1 } },
      },
    },
  })

  // Latest fuel prices
  const precios = await prisma.precioCombustible.findMany({
    distinct: ['tipo'],
    orderBy: { fecha: 'desc' },
    take: 5,
  })
  const precioMap: Record<string, number> = {}
  precios.forEach(p => { precioMap[p.tipo] = parseNum(p.precio) })

  const sugerencias: Array<{
    tipo: 'INGRESO' | 'GASTO'
    concepto: string
    montoPlaneado: number
    categoriaId?: string | null
    subcategoriaId?: string | null
    eventoId?: string | null
    deudaId?: string | null
    rutaId?: string | null
    origen: string
  }> = []

  // From eventos
  for (const ev of eventos) {
    sugerencias.push({
      tipo: ev.tipo === 'COBRO_PROGRAMADO' ? 'INGRESO' : 'GASTO',
      concepto: ev.nombre,
      montoPlaneado: parseNum(ev.presupuestoEstimado),
      categoriaId: ev.categoriaId,
      subcategoriaId: ev.subcategoriaId,
      eventoId: ev.id,
      origen: 'evento_recurrente',
    })
  }

  // From deudas — calculate monthly payment
  const meses = Math.max(1,
    (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth()) + 1
  )
  for (const deuda of deudas) {
    if (deuda.diaCobro) {
      const cuota = deuda.numeroCuotas
        ? parseNum(deuda.montoOriginal) / deuda.numeroCuotas
        : parseNum(deuda.saldoActual) / meses
      sugerencias.push({
        tipo: 'GASTO',
        concepto: `Cuota ${deuda.acreedorTexto ?? deuda.persona?.nombre ?? 'Deuda'}`,
        montoPlaneado: Math.round(cuota),
        deudaId: deuda.id,
        origen: 'deuda',
      })
    }
  }

  // From rutas (fuel cost estimate per month)
  const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  const semanas = dias / 7

  for (const ruta of rutas) {
    const tipoComb = ruta.tipoCombustible ?? 'Regular'
    const precioPorGalon = precioMap[tipoComb] ?? 294
    const distMensual = parseNum(ruta.distanciaKm) * ruta.vecesPorSemana * semanas * 2
    const distMillas = distMensual * 0.621371

    let mpg = 30 // fallback
    if (ruta.vehiculo?.rendimientos?.length) {
      const rend = ruta.vehiculo.rendimientos.find(r => r.tipoCombustible === tipoComb)
        ?? ruta.vehiculo.rendimientos[0]
      if (rend) mpg = parseNum(rend.rendimiento)
    } else if (ruta.vehiculo) {
      mpg = parseNum(ruta.vehiculo.mpgRealWorld)
    }

    const margen = ruta.vehiculo ? parseNum(ruta.vehiculo.margenConsumo) : 15
    const mpgEfectivo = mpg / (1 + margen / 100)
    const galones = distMillas / mpgEfectivo
    const costoTotal = galones * precioPorGalon
    const costoNeto = costoTotal * (parseNum(ruta.porcentajePropio) / 100)

    sugerencias.push({
      tipo: 'GASTO',
      concepto: `Combustible: ${ruta.nombre}`,
      montoPlaneado: Math.round(costoNeto),
      rutaId: ruta.id,
      origen: 'ruta_combustible',
    })
  }

  return sugerencias
}

// ── Ejecución atómica ──────────────────────────────────────────────────────
// Creates ONE transaction for the sum of all included lines (atomic budgets)

export async function ejecutarAtomico(clienteId: string, presupuestoId: string, data: {
  fecha?: string
  cuentaId?: string
  notas?: string
}) {
  const pres = await prisma.presupuesto.findFirstOrThrow({
    where: { id: presupuestoId, clienteId },
    include: { lineas: { where: { incluido: true }, include: { ejecuciones: true } } },
  })

  if (pres.tipo !== 'ATOMICO') throw new Error('Solo presupuestos atómicos pueden ejecutarse en bloque')

  const lineasIncluidas = pres.lineas
  if (lineasIncluidas.length === 0) throw new Error('No hay ítems incluidos para ejecutar')

  const total = lineasIncluidas.reduce((s, l) => s + parseNum(l.montoPlaneado), 0)
  const fecha = data.fecha ? new Date(data.fecha) : new Date()

  // Determine dominant category (most common among included lines)
  const catFreq: Record<string, number> = {}
  for (const l of lineasIncluidas) {
    if (l.categoriaId) catFreq[l.categoriaId] = (catFreq[l.categoriaId] ?? 0) + 1
  }
  const categoriaId = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Determine dominant subcategory
  const subFreq: Record<string, number> = {}
  for (const l of lineasIncluidas) {
    if (l.subcategoriaId) subFreq[l.subcategoriaId] = (subFreq[l.subcategoriaId] ?? 0) + 1
  }
  const subcategoriaId = Object.entries(subFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Create the single transaction
  const tx = await prisma.transaccion.create({
    data: {
      clienteId,
      concepto: data.notas ? `${pres.nombre} — ${data.notas}` : pres.nombre,
      monto: total,
      tipo: 'GASTO',
      estado: 'EJECUTADO',
      fecha,
      categoriaId: categoriaId ?? undefined,
      subcategoriaId: subcategoriaId ?? undefined,
      cuentaId: data.cuentaId ?? undefined,
      notas: `Presupuesto atómico: ${lineasIncluidas.length} ítems ejecutados en bloque`,
      frecuencia: 'UNICA',
    },
  })

  // Create one EjecucionLinea per included line, all linked to the same transaction
  await prisma.ejecucionLinea.createMany({
    data: lineasIncluidas.map(l => ({
      lineaId: l.id,
      montoEjecutado: parseNum(l.montoPlaneado),
      fecha,
      transaccionId: tx.id,
      notas: `Parte de ejecución atómica: ${pres.nombre}`,
    })),
  })

  // Auto-close the budget after atomic execution
  await prisma.presupuesto.update({
    where: { id: presupuestoId },
    data: { estado: 'CERRADO' },
  })

  return { transaccionId: tx.id, total, itemsEjecutados: lineasIncluidas.length }
}

// ── Enrich ─────────────────────────────────────────────────────────────────

type PresupuestoRaw = Awaited<ReturnType<typeof prisma.presupuesto.findFirstOrThrow>>

function enrich(p: PresupuestoRaw & { lineas: Array<{
  id: string
  tipo: string
  concepto: string
  montoPlaneado: { toNumber(): number } | number
  categoriaId: string | null
  subcategoriaId: string | null
  incluido: boolean
  ejecuciones: Array<{ montoEjecutado: { toNumber(): number } | number }>
  [key: string]: unknown
}> }) {
  const lineas = p.lineas.map(l => {
    const planeado = parseNum(l.montoPlaneado)
    const ejecutado = l.ejecuciones.reduce((s, e) => s + parseNum(e.montoEjecutado), 0)
    return { ...l, montoPlaneado: planeado, montoEjecutado: ejecutado, cumplimiento: planeado > 0 ? Math.min(100, (ejecutado / planeado) * 100) : 0 }
  })

  // For atomic budgets, only count included lines in totals
  const isAtomico = (p as { tipo?: string }).tipo === 'ATOMICO'
  const lineasActivas = isAtomico ? lineas.filter(l => l.incluido) : lineas

  const ingresos = lineasActivas.filter(l => l.tipo === 'INGRESO').reduce((s, l) => s + l.montoPlaneado, 0)
  const gastos = lineasActivas.filter(l => l.tipo === 'GASTO').reduce((s, l) => s + l.montoPlaneado, 0)
  const ingresosEjecutados = lineas.filter(l => l.tipo === 'INGRESO').reduce((s, l) => s + l.montoEjecutado, 0)
  const gastosEjecutados = lineas.filter(l => l.tipo === 'GASTO').reduce((s, l) => s + l.montoEjecutado, 0)

  return {
    ...p,
    lineas,
    resumen: {
      ingresos,
      gastos,
      disponible: ingresos - gastos,
      ingresosEjecutados,
      gastosEjecutados,
      cumplimientoGeneral: gastos > 0 ? Math.min(100, (gastosEjecutados / gastos) * 100) : 0,
    },
  }
}
