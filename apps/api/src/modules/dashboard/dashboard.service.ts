import { prisma } from '../../shared/prisma'

export class DashboardService {
  async getKpis(clienteId: string) {
    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
    const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const hace7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [cuentas, txMes, deudas, eventos, tendencia] = await Promise.all([
      prisma.cuentaBancaria.findMany({ where: { clienteId, activa: true }, select: { saldo: true } }),
      prisma.transaccion.findMany({
        where: { clienteId, fecha: { gte: inicioMes, lte: finMes }, estado: 'EJECUTADO' },
        select: { tipo: true, monto: true, categoriaId: true },
      }),
      prisma.deuda.findMany({
        where: { clienteId, estado: 'ACTIVA' },
        select: { saldoActual: true, tipo: true },
      }),
      prisma.evento.findMany({
        where: { clienteId, fecha: { gte: now, lte: hace7 }, estado: { not: 'EJECUTADO' } },
        select: { nombre: true, fecha: true, presupuestoEstimado: true, tipo: true },
        orderBy: { fecha: 'asc' },
      }),
      this._tendencia6Meses(clienteId, now),
    ])

    const balanceTotal = cuentas.reduce((a, c) => a + Number(c.saldo), 0)

    const ingresosMes = txMes
      .filter(t => t.tipo === 'INGRESO')
      .reduce((a, t) => a + Number(t.monto), 0)

    const gastosMes = txMes
      .filter(t => t.tipo === 'GASTO')
      .reduce((a, t) => a + Number(t.monto), 0)

    const totalDeudas = deudas.reduce((a, d) => a + Number(d.saldoActual), 0)

    // Gastos por categoría del mes
    const catMap = new Map<string, number>()
    for (const t of txMes.filter(t => t.tipo === 'GASTO' && t.categoriaId)) {
      catMap.set(t.categoriaId!, (catMap.get(t.categoriaId!) ?? 0) + Number(t.monto))
    }
    const catIds = [...catMap.keys()]
    const cats = catIds.length
      ? await prisma.categoria.findMany({ where: { id: { in: catIds } }, select: { id: true, nombre: true, icono: true } })
      : []
    const gastosPorCategoria = cats.map(c => ({
      categoriaId: c.id,
      nombre: c.nombre,
      icono: c.icono,
      total: catMap.get(c.id) ?? 0,
    })).sort((a, b) => b.total - a.total).slice(0, 8)

    return {
      balanceTotal,
      ingresosMes,
      gastosMes,
      deudasActivas: deudas.length,
      totalDeudas,
      proximosPagos: eventos,
      gastosPorCategoria,
      tendenciaMensual: tendencia,
    }
  }

  private async _tendencia6Meses(clienteId: string, now: Date) {
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const txs = await prisma.transaccion.findMany({
        where: { clienteId, fecha: { gte: inicio, lte: fin }, estado: 'EJECUTADO', tipo: { in: ['INGRESO', 'GASTO'] } },
        select: { tipo: true, monto: true },
      })
      meses.push({
        mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        ingresos: txs.filter(t => t.tipo === 'INGRESO').reduce((a, t) => a + Number(t.monto), 0),
        gastos: txs.filter(t => t.tipo === 'GASTO').reduce((a, t) => a + Number(t.monto), 0),
      })
    }
    return meses
  }
}
