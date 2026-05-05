export interface Subcategoria {
  id: string
  categoriaId: string
  nombre: string
  color: string | null
  icono: string | null
  peso: number
}

export interface Categoria {
  id: string
  clienteId: string | null
  nombre: string
  color: string | null
  icono: string | null
  esEsencial: boolean
  orden: number
  peso: number
  subcategorias: Subcategoria[]
}

export type TipoTransaccion = 'GASTO' | 'INGRESO' | 'TRANSFERENCIA' | 'PAGO_DEUDA' | 'AJUSTE'
export type EstadoTransaccion = 'PENDIENTE' | 'EJECUTADO' | 'CANCELADO' | 'PROYECTADO' | 'PROGRAMADO'

export interface Transaccion {
  id: string
  clienteId: string
  cuentaId: string | null
  categoriaId: string | null
  subcategoriaId: string | null
  fecha: string
  concepto: string
  monto: number
  tipo: TipoTransaccion
  estado: EstadoTransaccion
  notas: string | null
  categoria?: { id: string; nombre: string; color: string | null; icono: string | null } | null
  subcategoria?: { id: string; nombre: string; color: string | null } | null
  cuentaBancaria?: { id: string; alias: string | null; banco: string } | null
}

export interface CuentaBancaria {
  id: string
  clienteId: string
  banco: string
  alias: string | null
  tipo: string
  saldo: number
  moneda: string
  activa: boolean
}

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}