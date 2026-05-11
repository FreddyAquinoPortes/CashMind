import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map: category nombre → correct tabler: icon id
const CAT_ICONS: Record<string, string> = {
  'Vivienda':              'tabler:home',
  'Servicios básicos':     'tabler:bolt',
  'Alimentación':          'tabler:shopping-cart',
  'Transporte':            'tabler:car',
  'Salud':                 'tabler:heart-rate',
  'Deudas':                'tabler:credit-card',
  'Educación':             'tabler:school',
  'Familia':               'tabler:users',
  'Personal':              'tabler:user',
  'Tecnología':            'tabler:device-laptop',
  'Ocio':                  'tabler:device-gamepad',
  'Imprevistos':           'tabler:first-aid-kit',
  'Impuestos/Comisiones':  'tabler:receipt',
  'Ingresos':              'tabler:trending-up',
  'Transferencia':         'tabler:transfer',
}

// Map: subcategoria nombre (exact, case-sensitive) → tabler: icon id
// Matches the names defined in the seed file
const SUB_ICONS: Record<string, string> = {
  // Vivienda
  'Renta/Hipoteca':           'tabler:building',
  'Mantenimiento':            'tabler:tool',
  'Mejoras':                  'tabler:hammer',
  // Servicios básicos
  'Electricidad':             'tabler:bolt',
  'Agua':                     'tabler:droplet',
  'Gas doméstico':            'tabler:flame',
  'Internet':                 'tabler:wifi',
  'Telefonía':                'tabler:device-mobile',
  'Streaming':                'tabler:movie',
  // Alimentación
  'Supermercado':             'tabler:shopping-cart',
  'Comida fuera':             'tabler:tools-kitchen-2',
  'Comida rápida':            'tabler:burger',
  'Bebidas':                  'tabler:glass-full',
  // Transporte
  'Combustible':              'tabler:gas-station',
  'Peaje':                    'tabler:road',
  'Mantenimiento vehículo':   'tabler:car-suv',
  'Uber/Taxi':                'tabler:car',
  'Seguro vehículo':          'tabler:shield',
  // Salud
  'Farmacia':                 'tabler:pill',
  'Consultas':                'tabler:stethoscope',
  'Laboratorio':              'tabler:microscope',
  'Seguro médico':            'tabler:heart',
  // Deudas
  'Tarjeta crédito':          'tabler:credit-card',
  'Préstamo personal':        'tabler:users',
  'Préstamo bancario':        'tabler:bank',
  'Deuda familiar':           'tabler:coin',
  // Educación
  'Matrícula':                'tabler:school',
  'Material':                 'tabler:book',
  'Cursos':                   'tabler:certificate',
  // Familia
  'Apoyo familiar':           'tabler:users',
  'Cumpleaños':               'tabler:cake',
  'Día especial':             'tabler:gift',
  // Personal
  'Higiene':                  'tabler:brush',
  'Ropa':                     'tabler:shirt',
  'Gimnasio':                 'tabler:dumbbell',
  // Tecnología
  'Suscripciones':            'tabler:star',
  'Hardware':                 'tabler:device-desktop',
  'Software':                 'tabler:code',
  // Ocio
  'Entretenimiento':          'tabler:movie',
  'Salidas':                  'tabler:beach',
  'Compras online':           'tabler:shopping-bag',
  // Imprevistos
  'Reserva mensual':          'tabler:piggy-bank',
  'Emergencias':              'tabler:first-aid-kit',
  // Impuestos/Comisiones
  'DGII':                     'tabler:receipt',
  'Cargos bancarios':         'tabler:bank',
  'Comisiones':               'tabler:percent',
  // Ingresos
  'Nómina':                   'tabler:moneybag',
  'Apoyo familiar recibido':  'tabler:users',
  'Trabajos extra':           'tabler:briefcase',
  'Bonos':                    'tabler:trophy',
  'Devoluciones':             'tabler:arrow-down-circle',
  // Transferencia
  'Retiro efectivo':          'tabler:cash',
  'Envío transferencia':      'tabler:transfer',
  'Recibir transferencia':    'tabler:arrow-down-circle',
}

async function main() {
  // Fix category icons (always update, even if already set)
  const cats = await prisma.categoria.findMany({ where: { clienteId: null } })
  let catFixed = 0
  for (const cat of cats) {
    const icon = CAT_ICONS[cat.nombre]
    if (icon) {
      await prisma.categoria.update({ where: { id: cat.id }, data: { icono: icon } })
      console.log(`  cat: "${cat.nombre}" → ${icon}`)
      catFixed++
    } else {
      console.log(`  cat: "${cat.nombre}" — no icon mapping (skipped)`)
    }
  }

  // Fix subcategory icons
  const subs = await prisma.subcategoria.findMany({
    include: { categoria: { select: { clienteId: true } } },
  })
  let subFixed = 0
  for (const sub of subs) {
    if (sub.categoria.clienteId !== null) continue  // skip user-created
    const icon = SUB_ICONS[sub.nombre]
    if (icon) {
      await prisma.subcategoria.update({ where: { id: sub.id }, data: { icono: icon } })
      console.log(`  sub: "${sub.nombre}" → ${icon}`)
      subFixed++
    } else {
      console.log(`  sub: "${sub.nombre}" — no icon mapping`)
    }
  }

  console.log(`\nDone: ${catFixed} categories, ${subFixed} subcategories updated.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
