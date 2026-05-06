// ── Bancos dominicanos ────────────────────────────────────────────────────
export const BANCOS_RD = [
  'Banco de Reservas (Banreservas)',
  'Banco Popular Dominicano',
  'BHD León',
  'Scotiabank República Dominicana',
  'Banco Santa Cruz',
  'Asociación Popular de Ahorros y Préstamos',
  'Asociación La Nacional de Ahorros y Préstamos',
  'Asociación Cibao de Ahorros y Préstamos',
  'Banco Unión',
  'Banco Caribe',
  'Banco Promerica',
  'Banco Vimenca',
  'Banco Múltiple BDI',
  'Banco de Ahorro y Crédito ADEMI',
  'Banco Activo Dominicano',
  'Citibank',
  'Efectivo / Billetera',
  'Otro',
] as const

export const TIPOS_CUENTA = [
  { value: 'AHORRO',    label: 'Ahorro' },
  { value: 'CORRIENTE', label: 'Corriente' },
  { value: 'INVERSION', label: 'Inversión' },
  { value: 'OTRO',      label: 'Otro / Billetera digital' },
] as const

export const FRANQUICIAS = [
  { value: 'VISA',       label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'AMEX',       label: 'American Express' },
  { value: 'DISCOVER',   label: 'Discover' },
] as const

export const TIPOS_TARJETA = [
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'DEBITO',  label: 'Débito' },
] as const

export const CATEGORIAS_TARJETA = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'GOLD',     label: 'Gold' },
  { value: 'PLATINUM', label: 'Platinum' },
  { value: 'BLACK',    label: 'Black' },
] as const

export const TIPOS_DEUDA = [
  { value: 'BANCARIA',  label: 'Bancaria' },
  { value: 'TARJETA',   label: 'Tarjeta de crédito' },
  { value: 'PERSONAL',  label: 'Personal' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'OTRA',      label: 'Otra' },
] as const

export const MONEDAS = [
  { value: 'DOP', label: 'DOP — Peso Dominicano' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' },
] as const
