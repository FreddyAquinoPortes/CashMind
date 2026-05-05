import { prisma } from '../../shared/prisma'
import * as XLSX from 'xlsx'

interface FilaImportacion {
  fecha: string
  concepto: string
  monto: number
  tipo?: string
  cuentaId?: string
  categoriaId?: string
}

type FilaRaw = {
  fecha: string
  concepto: string
  monto: number
  tipo?: string
  cuentaId?: string
  categoriaId?: string
}

export class ImportacionService {
  parseCSV(content: string): FilaImportacion[] {
    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('El archivo CSV está vacío o no tiene encabezados')

    const headers = lines[0]!.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

    const result: FilaImportacion[] = []
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = cols[i] ?? '' })

      const tipoRaw = (row['tipo'] || row['type'] || '').toUpperCase()
      const fila: FilaImportacion = {
        fecha: row['fecha'] || row['date'] || new Date().toISOString(),
        concepto: row['concepto'] || row['descripcion'] || row['description'] || row['detail'] || '',
        monto: Math.abs(parseFloat(row['monto'] || row['amount'] || row['valor'] || '0')),
      }
      if (tipoRaw) fila.tipo = tipoRaw
      if (fila.concepto && fila.monto > 0) result.push(fila)
    }
    return result
  }

  parseExcel(buffer: Buffer): FilaImportacion[] {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]!]!
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    const result: FilaImportacion[] = []
    for (const row of data) {
      const tipoRaw = String(row['tipo'] || row['Tipo'] || row['type'] || '').toUpperCase()
      const fila: FilaImportacion = {
        fecha: String(row['fecha'] || row['Fecha'] || row['date'] || row['Date'] || new Date().toISOString()),
        concepto: String(row['concepto'] || row['Concepto'] || row['descripcion'] || row['Descripcion'] || row['description'] || ''),
        monto: Math.abs(Number(row['monto'] || row['Monto'] || row['amount'] || row['Amount'] || 0)),
      }
      if (tipoRaw) fila.tipo = tipoRaw
      if (fila.concepto && fila.monto > 0) result.push(fila)
    }
    return result
  }

  async aplicarReglas(clienteId: string, filas: FilaImportacion[]): Promise<FilaImportacion[]> {
    const reglas = await prisma.reglaCategorizacion.findMany({
      where: { clienteId, activa: true },
      orderBy: { prioridad: 'desc' },
    })

    return filas.map(fila => {
      for (const regla of reglas) {
        const match = regla.esRegex
          ? new RegExp(regla.patron, 'i').test(fila.concepto)
          : fila.concepto.toLowerCase().includes(regla.patron.toLowerCase())
        if (match) {
          const updated: FilaImportacion = { ...fila }
          if (regla.categoriaId) updated.categoriaId = regla.categoriaId
          return updated
        }
      }
      return fila
    })
  }

  async preview(clienteId: string, filas: FilaImportacion[]) {
    const withRules = await this.aplicarReglas(clienteId, filas)
    const categorias = await prisma.categoria.findMany({
      where: { OR: [{ clienteId: null }, { clienteId }] },
      select: { id: true, nombre: true, color: true },
    })
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: { clienteId },
      select: { id: true, banco: true, alias: true },
    })
    return { filas: withRules, categorias, cuentas, total: withRules.length }
  }

  async confirmar(clienteId: string, filas: FilaImportacion[]) {
    let importadas = 0
    let errores = 0

    for (const fila of filas) {
      try {
        const esIngreso = fila.tipo === 'INGRESO'
        const tx = await prisma.transaccion.create({
          data: {
            clienteId,
            fecha: new Date(fila.fecha),
            concepto: fila.concepto,
            monto: fila.monto,
            tipo: (fila.tipo as any) || 'GASTO',
            estado: 'EJECUTADO',
            cuentaId: fila.cuentaId || null,
            categoriaId: fila.categoriaId || null,
          } as any,
        })
        if (tx.cuentaId) {
          const delta = esIngreso ? fila.monto : -fila.monto
          await prisma.cuentaBancaria.update({
            where: { id: tx.cuentaId },
            data: { saldo: { increment: delta } },
          })
        }
        importadas++
      } catch { errores++ }
    }
    return { importadas, errores }
  }
}