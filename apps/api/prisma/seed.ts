import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding CashMind...')

  // ---- Categorías globales ----
  const categorias = [
    { nombre: 'Vivienda',           peso: 10, icono: 'home',          esEsencial: true,  subs: ['Renta/Hipoteca','Mantenimiento','Mejoras'] },
    { nombre: 'Servicios básicos',  peso: 9,  icono: 'zap',           esEsencial: true,  subs: ['Electricidad','Agua','Gas doméstico','Internet','Telefonía','Streaming'] },
    { nombre: 'Alimentación',       peso: 9,  icono: 'shopping-cart', esEsencial: true,  subs: ['Supermercado','Comida fuera','Comida rápida','Bebidas'] },
    { nombre: 'Transporte',         peso: 8,  icono: 'car',           esEsencial: true,  subs: ['Combustible','Peaje','Mantenimiento vehículo','Uber/Taxi','Seguro vehículo'] },
    { nombre: 'Salud',              peso: 10, icono: 'heart-pulse',   esEsencial: true,  subs: ['Farmacia','Consultas','Laboratorio','Seguro médico'] },
    { nombre: 'Deudas',             peso: 9,  icono: 'credit-card',   esEsencial: true,  subs: ['Tarjeta crédito','Préstamo personal','Préstamo bancario','Deuda familiar'] },
    { nombre: 'Educación',          peso: 8,  icono: 'book',          esEsencial: true,  subs: ['Matrícula','Material','Cursos'] },
    { nombre: 'Familia',            peso: 6,  icono: 'users',         esEsencial: false, subs: ['Apoyo familiar','Cumpleaños','Día especial'] },
    { nombre: 'Personal',           peso: 5,  icono: 'user',          esEsencial: false, subs: ['Higiene','Ropa','Gimnasio'] },
    { nombre: 'Tecnología',         peso: 4,  icono: 'monitor',       esEsencial: false, subs: ['Suscripciones','Hardware','Software'] },
    { nombre: 'Ocio',               peso: 3,  icono: 'gamepad',       esEsencial: false, subs: ['Entretenimiento','Salidas','Compras online'] },
    { nombre: 'Imprevistos',        peso: 7,  icono: 'alert-triangle',esEsencial: false, subs: ['Reserva mensual','Emergencias'] },
    { nombre: 'Impuestos/Comisiones',peso:10, icono: 'landmark',      esEsencial: true,  subs: ['DGII','Cargos bancarios','Comisiones'] },
    { nombre: 'Ingresos',           peso: 10, icono: 'trending-up',   esEsencial: true,  subs: ['Nómina','Apoyo familiar recibido','Trabajos extra','Bonos','Devoluciones'] },
    { nombre: 'Transferencia',      peso: 5,  icono: 'arrow-right-left',esEsencial:false, subs: ['Retiro efectivo','Envío transferencia','Recibir transferencia'] },
  ]

  const catMap: Record<string, { id: string; subs: Record<string, string> }> = {}

  for (const cat of categorias) {
    const created = await prisma.categoria.upsert({
      where: { id: `cat_${cat.nombre.toLowerCase().replace(/[^a-z]/g, '_')}` },
      update: {},
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

  console.log(`Seed complete. User: freddy@cashmind.local / CashMind2026!`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
