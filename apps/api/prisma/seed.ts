import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding CashMind...')

  // ---- Categorías globales ----
  const categorias = [
    { nombre: 'Vivienda',            peso: 10, icono: 'tabler:home',            esEsencial: true,  subs: ['Renta/Hipoteca','Mantenimiento','Mejoras'] },
    { nombre: 'Servicios básicos',   peso: 9,  icono: 'tabler:plug',            esEsencial: true,  subs: ['Electricidad','Agua','Gas doméstico','Internet','Telefonía','Streaming'] },
    { nombre: 'Alimentación',        peso: 9,  icono: 'tabler:shopping-cart',   esEsencial: true,  subs: ['Supermercado','Comida fuera','Comida rápida','Bebidas'] },
    { nombre: 'Transporte',          peso: 8,  icono: 'tabler:car',             esEsencial: true,  subs: ['Combustible','Peaje','Mantenimiento vehículo','Uber/Taxi','Seguro vehículo'] },
    { nombre: 'Salud',               peso: 10, icono: 'tabler:stethoscope',     esEsencial: true,  subs: ['Farmacia','Consultas','Laboratorio','Seguro médico'] },
    { nombre: 'Deudas',              peso: 9,  icono: 'tabler:credit-card',     esEsencial: true,  subs: ['Tarjeta crédito','Préstamo personal','Préstamo bancario','Deuda familiar'] },
    { nombre: 'Educación',           peso: 8,  icono: 'tabler:school',          esEsencial: true,  subs: ['Matrícula','Material','Cursos'] },
    { nombre: 'Familia',             peso: 6,  icono: 'tabler:users',           esEsencial: false, subs: ['Apoyo familiar','Cumpleaños','Día especial'] },
    { nombre: 'Personal',            peso: 5,  icono: 'tabler:user-circle',     esEsencial: false, subs: ['Higiene','Ropa','Gimnasio'] },
    { nombre: 'Tecnología',          peso: 4,  icono: 'tabler:device-laptop',   esEsencial: false, subs: ['Suscripciones','Hardware','Software'] },
    { nombre: 'Ocio',                peso: 3,  icono: 'tabler:device-gamepad-2',esEsencial: false, subs: ['Entretenimiento','Salidas','Compras online'] },
    { nombre: 'Imprevistos',         peso: 7,  icono: 'tabler:alert-triangle',  esEsencial: false, subs: ['Reserva mensual','Emergencias'] },
    { nombre: 'Impuestos/Comisiones',peso: 10, icono: 'tabler:receipt-tax',     esEsencial: true,  subs: ['DGII','Cargos bancarios','Comisiones'] },
    { nombre: 'Ingresos',            peso: 10, icono: 'tabler:trending-up',     esEsencial: true,  subs: ['Nómina','Apoyo familiar recibido','Trabajos extra','Bonos','Devoluciones'] },
    { nombre: 'Transferencia',       peso: 5,  icono: 'tabler:arrows-exchange', esEsencial: false, subs: ['Retiro efectivo','Envío transferencia','Recibir transferencia'] },
  ]

  const catMap: Record<string, { id: string; subs: Record<string, string> }> = {}

  for (const cat of categorias) {
    const created = await prisma.categoria.upsert({
      where: { id: `cat_${cat.nombre.toLowerCase().replace(/[^a-z]/g, '_')}` },
      update: { icono: cat.icono },
      create: {
        id: `cat_${cat.nombre.toLowerCase().replace(/[^a-z]/g, '_')}`,
        nombre: cat.nombre,
        peso: cat.peso,
        icono: cat.icono,
        esEsencial: cat.esEsencial,
        orden: categorias.indexOf(cat),
      },
    })
    catMap[cat.nombre] = { id: created.id, subs: {} }
    for (const sub of cat.subs) {
      const subCreated = await prisma.subcategoria.upsert({
        where: { id: `sub_${created.id}_${sub.toLowerCase().replace(/[^a-z]/g, '_')}` },
        update: {},
        create: {
          id: `sub_${created.id}_${sub.toLowerCase().replace(/[^a-z]/g, '_')}`,
          categoriaId: created.id,
          nombre: sub,
          peso: cat.peso,
        },
      })
      if (catMap[cat.nombre]) catMap[cat.nombre]!.subs[sub] = subCreated.id
    }
  }

  console.log(`Created ${categorias.length} categories with subcategories`)

  // ---- Usuario admin / demo ----
  const passwordHash = await bcrypt.hash('CashMind2026!', 12)

  const usuario = await prisma.usuario.upsert({
    where: { email: 'freddy@cashmind.local' },
    update: {},
    create: {
      email: 'freddy@cashmind.local',
      passwordHash,
      nombre: 'Freddy Alejandro Aquino Portes',
      rol: 'ADMIN',
    },
  })

  const cliente = await prisma.cliente.upsert({
    where: { id: 'cliente_freddy' },
    update: {},
    create: {
      id: 'cliente_freddy',
      usuarioId: usuario.id,
      nombre: 'Freddy Alejandro Aquino Portes',
      monedaBase: 'DOP',
      diaCorteCiclo: 21,
    },
  })

  // ---- Cuenta Banreservas ----
  await prisma.cuentaBancaria.upsert({
    where: { id: 'cuenta_banreservas' },
    update: {},
    create: {
      id: 'cuenta_banreservas',
      clienteId: cliente.id,
      banco: 'Banreservas',
      numero: '9603428852',
      alias: 'Banreservas Principal',
      tipo: 'CORRIENTE',
      moneda: 'DOP',
      saldo: 634.61,
    },
  })

  // ---- Tarjeta de crédito ----
  await prisma.tarjetaCredito.upsert({
    where: { id: 'tc_banreservas' },
    update: {},
    create: {
      id: 'tc_banreservas',
      clienteId: cliente.id,
      banco: 'Banreservas',
      alias: 'TC Banreservas',
      ultimosCuatro: '0000',
      limite: 15000,
      saldoActual: 15779.29,
      tasaInteres: 3.5,
      tasaMora: 5.0,
      diaCorte: 11,
      diaPago: 20,
      penalidadSobregiro: 550,
      moneda: 'DOP',
    },
  })

  // ---- Préstamo Banco Unión ----
  const personaBancoUnion = await prisma.persona.upsert({
    where: { id: 'persona_banco_union' },
    update: {},
    create: {
      id: 'persona_banco_union',
      clienteId: cliente.id,
      nombre: 'Banco Unión',
      relacion: 'banco',
    },
  })

  await prisma.deuda.upsert({
    where: { id: 'deuda_banco_union' },
    update: {},
    create: {
      id: 'deuda_banco_union',
      clienteId: cliente.id,
      acreedorTexto: 'Banco Unión',
      personaId: personaBancoUnion.id,
      tipo: 'BANCARIA',
      montoOriginal: 27593.70,
      saldoActual: 27593.70,
      moneda: 'DOP',
      fechaInicio: new Date('2026-01-01'),
      tipoPlazo: 'FIJO',
      numeroCuotas: 10,
      diaCobro: 21,
      notas: 'DOP 3,215 por cuota',
    },
  })

  // ---- Deuda familiar - Lissette ----
  const personaLissette = await prisma.persona.upsert({
    where: { id: 'persona_lissette' },
    update: {},
    create: {
      id: 'persona_lissette',
      clienteId: cliente.id,
      nombre: 'Ana Lissette Portes',
      relacion: 'madre',
    },
  })

  await prisma.deuda.upsert({
    where: { id: 'deuda_lissette' },
    update: {},
    create: {
      id: 'deuda_lissette',
      clienteId: cliente.id,
      personaId: personaLissette.id,
      tipo: 'PERSONAL',
      montoOriginal: 6000,
      saldoActual: 6000,
      moneda: 'DOP',
      fechaInicio: new Date('2026-04-01'),
      tipoPlazo: 'FLEXIBLE',
      notas: 'Compra Bravo pagada por mamá',
    },
  })

  // ---- Vehículo Nissan Note 2016 ----
  const vehiculo = await prisma.vehiculo.upsert({
    where: { id: 'vehiculo_nissan_note' },
    update: {},
    create: {
      id: 'vehiculo_nissan_note',
      clienteId: cliente.id,
      marca: 'Nissan',
      modelo: 'Note',
      ano: 2016,
      mpgRealWorld: 34.3,
      margenConsumo: 15,
      fuenteMpg: 'fuelly.com',
    },
  })

  await prisma.ruta.upsert({
    where: { id: 'ruta_bani_capital' },
    update: {},
    create: {
      id: 'ruta_bani_capital',
      clienteId: cliente.id,
      vehiculoId: vehiculo.id,
      nombre: 'Baní - Capital (ida y vuelta)',
      distanciaKm: 125,
      vecesPorSemana: 4,
      porcentajePropio: 50,
    },
  })

  await prisma.precioCombustible.create({
    data: {
      tipo: 'Regular',
      precio: 294.50,
      moneda: 'DOP',
      unidad: 'galon',
      fecha: new Date('2026-04-21'),
      fuente: 'DGCP',
    },
  })

  // ---- Reglas de categorización ----
  const reglas = [
    { patron: 'UBER RIDES',     catNombre: 'Transporte',           subNombre: 'Uber/Taxi' },
    { patron: 'UBER EATS',      catNombre: 'Alimentación',         subNombre: 'Comida rápida' },
    { patron: 'RD VIAL',        catNombre: 'Transporte',           subNombre: 'Peaje' },
    { patron: 'SHELL',          catNombre: 'Transporte',           subNombre: 'Combustible' },
    { patron: 'TEXACO',         catNombre: 'Transporte',           subNombre: 'Combustible' },
    { patron: 'ECO PETROLEO',   catNombre: 'Transporte',           subNombre: 'Combustible' },
    { patron: 'TOTAL ',         catNombre: 'Transporte',           subNombre: 'Combustible' },
    { patron: 'SIGMA PETROLEUM',catNombre: 'Transporte',           subNombre: 'Combustible' },
    { patron: 'PLAZA LAMA',     catNombre: 'Alimentación',         subNombre: 'Supermercado' },
    { patron: 'BRAVO',          catNombre: 'Alimentación',         subNombre: 'Supermercado' },
    { patron: 'LA SIRENA',      catNombre: 'Alimentación',         subNombre: 'Supermercado' },
    { patron: 'JUMBO',          catNombre: 'Alimentación',         subNombre: 'Supermercado' },
    { patron: 'PRICESMART',     catNombre: 'Alimentación',         subNombre: 'Supermercado' },
    { patron: 'EDEESTE',        catNombre: 'Servicios básicos',    subNombre: 'Electricidad' },
    { patron: 'ALTICE',         catNombre: 'Servicios básicos',    subNombre: 'Internet' },
    { patron: 'CLARO',          catNombre: 'Servicios básicos',    subNombre: 'Telefonía' },
    { patron: 'CAASD',          catNombre: 'Servicios básicos',    subNombre: 'Agua' },
    { patron: 'PROPAGAS',       catNombre: 'Servicios básicos',    subNombre: 'Gas doméstico' },
    { patron: 'CLAUDE.AI',      catNombre: 'Tecnología',           subNombre: 'Suscripciones' },
    { patron: 'GOOGLE',         catNombre: 'Tecnología',           subNombre: 'Suscripciones' },
    { patron: 'FARMACIA',       catNombre: 'Salud',                subNombre: 'Farmacia' },
    { patron: 'FARM CAROL',     catNombre: 'Salud',                subNombre: 'Farmacia' },
    { patron: 'LAB AMADITA',    catNombre: 'Salud',                subNombre: 'Laboratorio' },
    { patron: 'NOM: PAGO NOMINA',catNombre: 'Ingresos',            subNombre: 'Nómina' },
    { patron: 'COBRO IMP DGII', catNombre: 'Impuestos/Comisiones', subNombre: 'DGII' },
    { patron: 'CARGO MENSUAL',  catNombre: 'Impuestos/Comisiones', subNombre: 'Cargos bancarios' },
    { patron: 'PAGO TARJETA',   catNombre: 'Deudas',               subNombre: 'Tarjeta crédito' },
    { patron: 'SMART FIT',      catNombre: 'Personal',             subNombre: 'Gimnasio' },
    { patron: 'PAYPAL',         catNombre: 'Ocio',                 subNombre: 'Compras online' },
    { patron: 'RETIRO ATM',     catNombre: 'Transferencia',        subNombre: 'Retiro efectivo' },
  ]

  for (let i = 0; i < reglas.length; i++) {
    const r = reglas[i]!
    const cat = catMap[r.catNombre]
    if (!cat) continue
    const subId = cat.subs[r.subNombre] ?? Object.values(cat.subs)[0]
    if (!subId) continue
    await prisma.reglaCategorizacion.create({
      data: {
        clienteId: cliente.id,
        patron: r.patron,
        esRegex: false,
        categoriaId: cat.id,
        subcategoriaId: subId,
        prioridad: reglas.length - i,
        activa: true,
      },
    }).catch(() => {})
  }

  // ---- Transacciones de ejemplo ----
  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: 'cuenta_banreservas' } })
  if (cuenta) {
    // Helper to get categoriaId and subcategoriaId from catMap
    const cat = (catNombre: string, subNombre: string) => ({
      categoriaId: catMap[catNombre]!.id,
      subcategoriaId: catMap[catNombre]!.subs[subNombre] ?? Object.values(catMap[catNombre]!.subs)[0]!,
    })

    const transacciones = [
      // Mayo 2026
      { fecha: new Date('2026-05-04'), concepto: 'NOM: PAGO NOMINA EMPRESA XYZ', monto: 45000, tipo: 'INGRESO', ...cat('Ingresos', 'Nómina') },
      { fecha: new Date('2026-05-03'), concepto: 'SUPERMERCADOS BRAVO BANI', monto: 3850, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-05-02'), concepto: 'SHELL GASOLINERA BANI', monto: 2100, tipo: 'GASTO', ...cat('Transporte', 'Combustible') },
      { fecha: new Date('2026-05-01'), concepto: 'UBER RIDES TRIP', monto: 320, tipo: 'GASTO', ...cat('Transporte', 'Uber/Taxi') },
      // Abril 2026
      { fecha: new Date('2026-04-30'), concepto: 'EDEESTE ELECTRICIDAD', monto: 4200, tipo: 'GASTO', ...cat('Servicios básicos', 'Electricidad') },
      { fecha: new Date('2026-04-28'), concepto: 'CLARO TELEFONIA MOVIL', monto: 1200, tipo: 'GASTO', ...cat('Servicios básicos', 'Telefonía') },
      { fecha: new Date('2026-04-25'), concepto: 'NOM: PAGO NOMINA EMPRESA XYZ', monto: 45000, tipo: 'INGRESO', ...cat('Ingresos', 'Nómina') },
      { fecha: new Date('2026-04-22'), concepto: 'SUPERMERCADOS NACIONAL STO DGO', monto: 5600, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-04-20'), concepto: 'FARMACIA CAROL BANI', monto: 980, tipo: 'GASTO', ...cat('Salud', 'Farmacia') },
      { fecha: new Date('2026-04-18'), concepto: 'NETFLIX SUBSCRIPTION', monto: 850, tipo: 'GASTO', ...cat('Tecnología', 'Suscripciones') },
      { fecha: new Date('2026-04-15'), concepto: 'SHELL GASOLINERA CARRETERA', monto: 2300, tipo: 'GASTO', ...cat('Transporte', 'Combustible') },
      { fecha: new Date('2026-04-12'), concepto: 'RESTAURANTE LA RESIDENCE BANI', monto: 1850, tipo: 'GASTO', ...cat('Alimentación', 'Comida fuera') },
      { fecha: new Date('2026-04-10'), concepto: 'SUPERMERCADOS BRAVO BANI', monto: 4200, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-04-08'), concepto: 'PAGO BANCO UNION PRESTAMO', monto: 3215, tipo: 'PAGO_DEUDA', ...cat('Deudas', 'Préstamo bancario') },
      { fecha: new Date('2026-04-05'), concepto: 'UBER RIDES TRIP CAPITAL', monto: 550, tipo: 'GASTO', ...cat('Transporte', 'Uber/Taxi') },
      { fecha: new Date('2026-04-03'), concepto: 'COLMADO EL BUEN GUSTO', monto: 750, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-04-01'), concepto: 'FREELANCE PROYECTO WEB', monto: 15000, tipo: 'INGRESO', ...cat('Ingresos', 'Trabajos extra') },
      // Marzo 2026
      { fecha: new Date('2026-03-31'), concepto: 'EDEESTE ELECTRICIDAD MARZO', monto: 3900, tipo: 'GASTO', ...cat('Servicios básicos', 'Electricidad') },
      { fecha: new Date('2026-03-28'), concepto: 'CLARO INTERNET HOGAR', monto: 1800, tipo: 'GASTO', ...cat('Servicios básicos', 'Internet') },
      { fecha: new Date('2026-03-25'), concepto: 'NOM: PAGO NOMINA EMPRESA XYZ', monto: 45000, tipo: 'INGRESO', ...cat('Ingresos', 'Nómina') },
      { fecha: new Date('2026-03-22'), concepto: 'SUPERMERCADOS BRAVO BANI', monto: 6100, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-03-20'), concepto: 'SHELL GASOLINERA AUTOPISTA', monto: 2500, tipo: 'GASTO', ...cat('Transporte', 'Combustible') },
      { fecha: new Date('2026-03-18'), concepto: 'PAGO BANCO UNION PRESTAMO', monto: 3215, tipo: 'PAGO_DEUDA', ...cat('Deudas', 'Préstamo bancario') },
      { fecha: new Date('2026-03-15'), concepto: 'RESTAURANTE MEDITERRANEO', monto: 2200, tipo: 'GASTO', ...cat('Alimentación', 'Comida fuera') },
      { fecha: new Date('2026-03-12'), concepto: 'FARMACIA CAROL VITAMINAS', monto: 1200, tipo: 'GASTO', ...cat('Salud', 'Farmacia') },
      { fecha: new Date('2026-03-10'), concepto: 'UBER RIDES AEROPUERTO', monto: 890, tipo: 'GASTO', ...cat('Transporte', 'Uber/Taxi') },
      { fecha: new Date('2026-03-08'), concepto: 'SPOTIFY PREMIUM', monto: 450, tipo: 'GASTO', ...cat('Tecnología', 'Suscripciones') },
      { fecha: new Date('2026-03-05'), concepto: 'AMAZON MARKETPLACE COMPRA', monto: 3200, tipo: 'GASTO', ...cat('Ocio', 'Compras online') },
      { fecha: new Date('2026-03-03'), concepto: 'COLMADO BUEN PRECIO', monto: 620, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-03-01'), concepto: 'BONO PRODUCTIVIDAD', monto: 8000, tipo: 'INGRESO', ...cat('Ingresos', 'Bonos') },
      // Febrero 2026
      { fecha: new Date('2026-02-28'), concepto: 'EDEESTE ELECTRICIDAD FEBRERO', monto: 4100, tipo: 'GASTO', ...cat('Servicios básicos', 'Electricidad') },
      { fecha: new Date('2026-02-25'), concepto: 'NOM: PAGO NOMINA EMPRESA XYZ', monto: 45000, tipo: 'INGRESO', ...cat('Ingresos', 'Nómina') },
      { fecha: new Date('2026-02-20'), concepto: 'SUPERMERCADOS NACIONAL', monto: 5300, tipo: 'GASTO', ...cat('Alimentación', 'Supermercado') },
      { fecha: new Date('2026-02-15'), concepto: 'PAGO BANCO UNION PRESTAMO', monto: 3215, tipo: 'PAGO_DEUDA', ...cat('Deudas', 'Préstamo bancario') },
      { fecha: new Date('2026-02-10'), concepto: 'SHELL GASOLINERA BANI', monto: 2200, tipo: 'GASTO', ...cat('Transporte', 'Combustible') },
    ]

    for (const tx of transacciones) {
      await prisma.transaccion.create({
        data: {
          clienteId: cliente.id,
          cuentaId: cuenta.id,
          fecha: tx.fecha,
          concepto: tx.concepto,
          monto: tx.monto,
          tipo: tx.tipo as any,
          estado: 'EJECUTADO',
          frecuencia: 'UNICA',
          categoriaId: tx.categoriaId,
          subcategoriaId: tx.subcategoriaId,
        },
      })
    }

    console.log(`Created ${transacciones.length} transactions`)
  }

  console.log(`Seed complete. User: freddy@cashmind.local / CashMind2026!`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
