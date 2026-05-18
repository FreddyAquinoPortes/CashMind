import { z } from 'zod'
import { prisma } from '../../shared/prisma'


// ── Helpers ────────────────────────────────────────────────────────────────

/** Advance a date by one recurrence step */
function advance(d: Date, tipo: string): Date {
  const nd = new Date(d)
  switch (tipo) {
    case 'DIARIA':   nd.setDate(nd.getDate() + 1);          break
    case 'SEMANAL':  nd.setDate(nd.getDate() + 7);           break
    case 'MENSUAL':  nd.setMonth(nd.getMonth() + 1);         break
    case 'ANUAL':    nd.setFullYear(nd.getFullYear() + 1);   break
  }
  return nd
}

/** Generate every occurrence of a recurring event within [desde, hasta] */
function generateOccurrences(baseDate: Date, tipoRec: string, desde: Date, hasta: Date): Date[] {
  const dates: Date[] = []
  // Fast-forward from baseDate to first occurrence >= desde
  let cur = new Date(baseDate)
  while (cur < desde) cur = advance(cur, tipoRec)
  // Cap iterations to avoid infinite loops (max 5 years daily = ~1825)
  const MAX = 2000
  let i = 0
  while (cur <= hasta && i++ < MAX) {
    dates.push(new Date(cur))
    cur = advance(cur, tipoRec)
  }
  return dates
}

/** ISO week label "2026-W21" for grouping */
function isoWeek(d: Date): string {
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const jan4 = new Date(tmp.getFullYear(), 0, 4)
  const week = 1 + Math.round((tmp.getTime() - jan4.getTime()) / 604800000)
  return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** "YYYY-MM" month label */
function monthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const INGRESO_TYPES = new Set(['NOMINA'])

// ── Schemas ────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  nombre:       z.string().min(1).max(150),
  monto:        z.number().positive(),
  tipo:         z.enum(['GASTO', 'INGRESO']).default('GASTO'),
  moneda:       z.string().default('DOP'),
  periodicidad: z.enum(['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL']).optional().nullable(),
  categoriaId:  z.string().optional().nullable(),
  notas:        z.string().optional().nullable(),
})

// ── Service ────────────────────────────────────────────────────────────────

export class ProyeccionesService {

  // ── Resumen: main projection calculation ──────────────────────────────────
  async resumen(clienteId: string, desde: Date, hasta: Date) {
    // 1. Current account balances (bank accounts only)
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: { clienteId, activa: true },
      select: { id: true, alias: true, banco: true, saldo: true, moneda: true },
    })
    const balanceActual = cuentas.reduce((s, c) => s + Number(c.saldo), 0)

    // 2. Fetch todos los eventos (PLANIFICADO/APARTADO) del cliente
    //    Incluye recurrentes (sin filtro de fecha) y los no-recurrentes en el rango
    const rawEventos = await prisma.evento.findMany({
      where: {
        clienteId,
        estado: { in: ['PLANIFICADO', 'APARTADO'] },
        OR: [
          { fecha: { gte: desde, lte: hasta } },
          { recurrente: true },
        ],
      },
      include: {
        categoria:    { select: { id: true, nombre: true, color: true, icono: true } },
        subcategoria: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    })

    // 3. Expand events into occurrences
    const eventoRows: Array<{
      id: string; nombre: string; tipo: string
      presupuesto: number; moneda: string
      recurrente: boolean; tipoRecurrencia: string | null
      categoria: any; subcategoria: any
      fechas: Date[]
      total: number
      esIngreso: boolean
    }> = []

    for (const ev of rawEventos) {
      let fechas: Date[]
      if (ev.recurrente && ev.tipoRecurrencia) {
        fechas = generateOccurrences(ev.fecha, ev.tipoRecurrencia, desde, hasta)
      } else {
        // Non-recurring: include only if its date falls in range
        fechas = ev.fecha >= desde && ev.fecha <= hasta ? [ev.fecha] : []
      }
      if (fechas.length === 0) continue

      const presupuesto = Number(ev.presupuestoEstimado)
      const esIngreso = INGRESO_TYPES.has(ev.tipo)
      eventoRows.push({
        id: ev.id,
        nombre: ev.nombre,
        tipo: ev.tipo,
        presupuesto,
        moneda: ev.moneda,
        recurrente: ev.recurrente,
        tipoRecurrencia: ev.tipoRecurrencia ?? null,
        categoria: (ev as any).categoria ?? null,
        subcategoria: (ev as any).subcategoria ?? null,
        fechas,
        total: presupuesto * fechas.length,
        esIngreso,
      })
    }

    // 4. Custom projection items
    const rawItems = await prisma.proyeccionItem.findMany({ where: { clienteId } })

    const itemRows = rawItems.map(item => {
      const count = item.periodicidad
        ? generateOccurrences(desde, item.periodicidad, desde, hasta).length || 1
        : 1
      return {
        id: item.id,
        nombre: item.nombre,
        monto: Number(item.monto),
        tipo: item.tipo,
        moneda: item.moneda,
        periodicidad: item.periodicidad ?? null,
        categoriaId: item.categoriaId ?? null,
        notas: item.notas ?? null,
        count,
        total: Number(item.monto) * count,
        esIngreso: item.tipo === 'INGRESO',
        createdAt: item.createdAt,
      }
    })

    // 5. Totals
    const totalIngresosEventos = eventoRows.filter(e => e.esIngreso).reduce((s, e) => s + e.total, 0)
    const totalGastosEventos   = eventoRows.filter(e => !e.esIngreso).reduce((s, e) => s + e.total, 0)
    const totalIngresosItems   = itemRows.filter(i => i.esIngreso).reduce((s, i) => s + i.total, 0)
    const totalGastosItems     = itemRows.filter(i => !i.esIngreso).reduce((s, i) => s + i.total, 0)

    const totalIngresos = totalIngresosEventos + totalIngresosItems
    const totalGastos   = totalGastosEventos   + totalGastosItems
    const balanceFinal  = balanceActual + totalIngresos - totalGastos
    const deficit       = balanceFinal < 0

    // 6. Timeline — group by month (or week if range ≤ 60 days)
    const diffDays = Math.ceil((hasta.getTime() - desde.getTime()) / 86400000)
    const useWeeks = diffDays <= 60

    const timelineMap = new Map<string, { ingresos: number; gastos: number }>()

    const addToTimeline = (fecha: Date, monto: number, esIngreso: boolean) => {
      const key = useWeeks ? isoWeek(fecha) : monthLabel(fecha)
      const entry = timelineMap.get(key) ?? { ingresos: 0, gastos: 0 }
      if (esIngreso) entry.ingresos += monto; else entry.gastos += monto
      timelineMap.set(key, entry)
    }

    for (const ev of eventoRows) {
      for (const f of ev.fechas) addToTimeline(f, ev.presupuesto, ev.esIngreso)
    }
    for (const it of itemRows) {
      // Distribute item occurrences across the period
      if (it.periodicidad) {
        const fechas = generateOccurrences(desde, it.periodicidad, desde, hasta)
        for (const f of fechas) addToTimeline(f, it.monto, it.esIngreso)
      } else {
        addToTimeline(desde, it.total, it.esIngreso)
      }
    }

    const timeline = Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => ({
        periodo,
        ingresos: Math.round(v.ingresos * 100) / 100,
        gastos:   Math.round(v.gastos   * 100) / 100,
        balance:  Math.round((v.ingresos - v.gastos) * 100) / 100,
      }))

    // 7. Category breakdown (gastos only)
    const catMap = new Map<string, { nombre: string; color: string | null; icono: string | null; total: number }>()
    for (const ev of eventoRows.filter(e => !e.esIngreso)) {
      const key  = ev.categoria?.id ?? '__sin__'
      const cur  = catMap.get(key) ?? { nombre: ev.categoria?.nombre ?? 'Sin categoría', color: ev.categoria?.color ?? null, icono: ev.categoria?.icono ?? null, total: 0 }
      cur.total += ev.total
      catMap.set(key, cur)
    }
    for (const it of itemRows.filter(i => !i.esIngreso)) {
      const key = it.categoriaId ?? '__sin__'
      const cur = catMap.get(key) ?? { nombre: 'Sin categoría', color: null, icono: null, total: 0 }
      cur.total += it.total
      catMap.set(key, cur)
    }
    const porCategoria = Array.from(catMap.entries())
      .map(([id, v]) => ({ id, ...v, total: Math.round(v.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)

    return {
      periodo:       { desde, hasta, diffDays, useWeeks },
      balanceActual: Math.round(balanceActual * 100) / 100,
      cuentas,
      proyeccion: {
        totalIngresos: Math.round(totalIngresos * 100) / 100,
        totalGastos:   Math.round(totalGastos   * 100) / 100,
        balanceFinal:  Math.round(balanceFinal   * 100) / 100,
        deficit,
        superavit:     deficit ? 0 : Math.round(balanceFinal * 100) / 100,
        deficitMonto:  deficit ? Math.round(Math.abs(balanceFinal) * 100) / 100 : 0,
      },
      eventos:      eventoRows.map(e => ({ ...e, count: e.fechas.length, fechas: e.fechas.map(f => f.toISOString()) })),
      items:        itemRows,
      timeline,
      porCategoria,
    }
  }

  // ── Custom items CRUD ──────────────────────────────────────────────────────
  async listItems(clienteId: string) {
    return prisma.proyeccionItem.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createItem(clienteId: string, body: unknown) {
    const data = itemSchema.parse(body)
    return prisma.proyeccionItem.create({
      data: { clienteId, ...data, monto: data.monto, periodicidad: data.periodicidad ?? null, categoriaId: data.categoriaId ?? null, notas: data.notas ?? null } as any,
    })
  }

  async updateItem(id: string, clienteId: string, body: unknown) {
    await prisma.proyeccionItem.findFirstOrThrow({ where: { id, clienteId } })
    const data = itemSchema.partial().parse(body)
    return prisma.proyeccionItem.update({ where: { id }, data: data as any })
  }

  async deleteItem(id: string, clienteId: string) {
    await prisma.proyeccionItem.findFirstOrThrow({ where: { id, clienteId } })
    return prisma.proyeccionItem.delete({ where: { id } })
  }

  /** Convert a ProyeccionItem into a real Evento */
  async convertirAEvento(id: string, clienteId: string, body: unknown) {
    const item = await prisma.proyeccionItem.findFirstOrThrow({ where: { id, clienteId } })
    const extra = z.object({
      fecha:           z.string(),
      tipoRecurrencia: z.enum(['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL']).optional().nullable(),
      prioridad:       z.number().int().min(1).max(5).default(3),
      categoriaId:     z.string().optional().nullable(),
      subcategoriaId:  z.string().optional().nullable(),
    }).parse(body)

    const recurrente = !!extra.tipoRecurrencia

    const evento = await prisma.evento.create({
      data: {
        clienteId,
        nombre:              item.nombre,
        tipo:                item.tipo === 'INGRESO' ? 'NOMINA' : 'PAGO_PROGRAMADO',
        fecha:               new Date(extra.fecha + 'T00:00:00'),
        recurrente,
        tipoRecurrencia:     extra.tipoRecurrencia ?? null,
        presupuestoEstimado: item.monto,
        moneda:              item.moneda,
        prioridad:           extra.prioridad,
        estado:              'PLANIFICADO',
        categoriaId:         extra.categoriaId ?? item.categoriaId ?? null,
        subcategoriaId:      extra.subcategoriaId ?? null,
        notas:               item.notas ?? null,
      } as any,
    })

    // Remove the custom item since it's now a real event
    await prisma.proyeccionItem.delete({ where: { id } })

    return evento
  }
}
