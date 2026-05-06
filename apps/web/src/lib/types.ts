// ── Categorías ────────────────────────────────────────────────────────────
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

// ── Transacciones ─────────────────────────────────────────────────────────
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

export interface PaginatedResponse<T> {
  total: number
  items: T[]
}

// ── Cuentas ───────────────────────────────────────────────────────────────
export type TipoCuenta = 'CORRIENTE' | 'AHORRO' | 'INVERSION' | 'OTRO'

export interface CuentaBancaria {
  id: string
  clienteId: string
  alias: string | null
  banco: string
  numero: string
  tipo: TipoCuenta
  moneda: string
  saldo: string   // Prisma Decimal → string
  activa: boolean
  createdAt: string
}

// ── Tarjetas ──────────────────────────────────────────────────────────────
export type Franquicia     = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER'
export type TipoTarjeta    = 'CREDITO' | 'DEBITO'
export type CategoriaTarjeta = 'STANDARD' | 'GOLD' | 'PLATINUM' | 'BLACK'

export interface TarjetaCredito {
  id: string
  clienteId: string
  alias: string | null
  banco: string
  ultimosCuatro: string
  franquicia: Franquicia | null
  tipoTarjeta: TipoTarjeta | null
  categoriaTarjeta: CategoriaTarjeta | null
  limite: string
  saldoActual: string
  tasaInteres: string
  diaCorte: number
  diaPago: number
  moneda: string
  activa: boolean
  utilizacion: number   // computed
  disponible: number    // computed
  createdAt: string
}

// ── Personas ──────────────────────────────────────────────────────────────
export type TipoPersona = 'persona' | 'entidad'

export interface Persona {
  id: string
  clienteId: string
  tipo: TipoPersona
  nombre: string
  apellido: string | null
  displayName: string   // computed
  relacion: string | null
  telefono: string | null
  email: string | null
  notas: string | null
  balanceTotal: number  // computed from active debts
}

// ── Deudas ────────────────────────────────────────────────────────────────
export type TipoDeuda   = 'BANCARIA' | 'TARJETA' | 'PERSONAL' | 'COMERCIAL' | 'OTRA'
export type TipoPlazo   = 'FIJO' | 'FLEXIBLE'
export type EstadoDeuda = 'ACTIVA' | 'SALDADA' | 'EN_MORA' | 'RENEGOCIADA' | 'CANCELADA'

export interface Deuda {
  id: string
  clienteId: string
  personaId: string | null
  persona?: { id: string; nombre: string; apellido: string | null; tipo: string } | null
  concepto: string | null
  acreedorTexto: string | null
  tipo: TipoDeuda
  montoOriginal: string
  saldoActual: string
  moneda: string
  fechaInicio: string
  fechaFin: string | null
  tasaInteres: string | null
  tipoPlazo: TipoPlazo
  numeroCuotas: number | null
  diaCobro: number | null
  estado: EstadoDeuda
  notas: string | null
  createdAt: string
}

export interface PagoDeuda {
  id: string
  deudaId: string
  monto: string
  fecha: string
  estado: EstadoTransaccion
  notas: string | null
}

// ── Eventos ────────────────────────────────────────────────────────────────
export type TipoEvento = 'PAGO_PROGRAMADO' | 'NOMINA' | 'CUMPLEANOS' | 'FERIADO' | 'OTRO'
export type EstadoEvento = 'PLANIFICADO' | 'APARTADO' | 'EJECUTADO' | 'CANCELADO'
export type TipoRecurrencia = 'DIARIA' | 'SEMANAL' | 'MENSUAL' | 'ANUAL'

export interface Evento {
  id: string
  clienteId: string
  nombre: string
  tipo: TipoEvento
  fecha: string
  recurrente: boolean
  tipoRecurrencia: TipoRecurrencia | null
  presupuestoEstimado: string
  moneda: string
  rangoMin: string | null
  rangoMax: string | null
  prioridad: number
  estado: EstadoEvento
  personaId: string | null
  persona?: { id: string; nombre: string; apellido: string | null } | null
  notas: string | null
}
