import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map: category nombre → correct tabler: icon id
const CAT_ICONS: Record<string, string> = {
  'Vivienda':             'tabler:home',
  'Servicios básicos':    'tabler:bolt',
  'Alimentación':         'tabler:shopping-cart',
  'Transporte':           'tabler:car',
  'Salud':                'tabler:heart',
  'Deudas':               'tabler:credit-card',
  'Educación':            'tabler:school',
  'Familia':              'tabler:users',
  'Personal':             'tabler:user',
  'Tecnología':           'tabler:device-laptop',
  'Ocio':                 'tabler:device-gamepad',
  'Imprevistos':          'tabler:first-aid-kit',
  'Impuestos/Comisiones': 'tabler:receipt',
  'Ingresos':             'tabler:trending-up',
  'Transferencia':        'tabler:transfer',
}

// Map: subcategoria nombre → tabler: icon id (key: nombre lowercase)
const SUB_ICONS: Record<string, string> = {
  // Vivienda
  'alquiler / hipoteca':   'tabler:building',
  'alquiler':              'tabler:building',
  'hipoteca':              'tabler:building',
  'mantenimiento del hogar': 'tabler:tool',
  'mantenimiento':         'tabler:tool',
  'electrodomésticos':     'tabler:washing-machine',
  'electrodomesticos':     'tabler:washing-machine',
  'decoración':            'tabler:lamp',
  'decoracion':            'tabler:lamp',
  // Servicios básicos
  'electricidad':          'tabler:bolt',
  'agua':                  'tabler:droplet',
  'internet':              'tabler:wifi',
  'telefonía':             'tabler:device-mobile',
  'telefonia':             'tabler:device-mobile',
  'gas':                   'tabler:flame',
  'seguridad / alarma':    'tabler:shield',
  'seguridad':             'tabler:shield',
  // Alimentación
  'supermercado':          'tabler:shopping-cart',
  'restaurantes':          'tabler:tools-kitchen-2',
  'comida rápida':         'tabler:burger',
  'comida rapida':         'tabler:burger',
  'delivery':              'tabler:bike',
  'colmado':               'tabler:apple',
  'cafetería':             'tabler:coffee',
  'cafeteria':             'tabler:coffee',
  // Transporte
  'gasolina':              'tabler:gas-station',
  'uber / taxi':           'tabler:car',
  'uber':                  'tabler:car',
  'taxi':                  'tabler:car',
  'seguro de vehículo':    'tabler:shield',
  'seguro de vehiculo':    'tabler:shield',
  'mantenimiento de auto': 'tabler:car-suv',
  'estacionamiento':       'tabler:parking',
  'peaje':                 'tabler:road',
  // Salud
  'médico / consulta':     'tabler:stethoscope',
  'medico / consulta':     'tabler:stethoscope',
  'médico':                'tabler:stethoscope',
  'medicamentos':          'tabler:pill',
  'seguro médico':         'tabler:heart',
  'seguro medico':         'tabler:heart',
  'gym / deporte':         'tabler:dumbbell',
  'gym':                   'tabler:dumbbell',
  'dentista':              'tabler:dental',
  // Deudas
  'préstamo bancario':     'tabler:bank',
  'prestamo bancario':     'tabler:bank',
  'préstamo personal':     'tabler:users',
  'prestamo personal':     'tabler:users',
  'tarjeta de crédito':    'tabler:credit-card',
  'tarjeta de credito':    'tabler:credit-card',
  'deuda informal':        'tabler:coin',
  // Educación
  'colegio / universidad': 'tabler:school',
  'colegio':               'tabler:school',
  'cursos':                'tabler:certificate',
  'libros / útiles':       'tabler:book',
  'libros':                'tabler:book',
  // Familia
  'hijos':                 'tabler:baby',
  'mascotas':              'tabler:paw',
  'padres / familiares':   'tabler:old-man',
  'padres':                'tabler:old-man',
  // Personal
  'ropa / calzado':        'tabler:shirt',
  'ropa':                  'tabler:shirt',
  'peluquería / belleza':  'tabler:scissors',
  'peluqueria':            'tabler:scissors',
  'suscripciones':         'tabler:star',
  // Tecnología
  'equipos':               'tabler:device-desktop',
  'software / apps':       'tabler:code',
  'software':              'tabler:code',
  'accesorios tech':       'tabler:device-mobile',
  // Ocio
  'entretenimiento':       'tabler:movie',
  'viajes':                'tabler:plane',
  'deportes':              'tabler:run',
  'restaurante social':    'tabler:tools-kitchen-2',
  // Imprevistos
  'emergencia médica':     'tabler:first-aid-kit',
  'emergencia medica':     'tabler:first-aid-kit',
  'reparación urgente':    'tabler:wrench',
  'reparacion urgente':    'tabler:wrench',
  'multas':                'tabler:receipt',
  // Impuestos
  'dgii / itbis':          'tabler:receipt',
  'dgii':                  'tabler:receipt',
  'comisiones bancarias':  'tabler:bank',
  'otros impuestos':       'tabler:file-text',
  // Ingresos
  'salario / nómina':      'tabler:moneybag',
  'salario':               'tabler:moneybag',
  'nómina':                'tabler:moneybag',
  'nomina':                'tabler:moneybag',
  'freelance':             'tabler:briefcase',
  'inversiones':           'tabler:trending-up',
  'otros ingresos':        'tabler:coins',
  // Transferencia
  'entre cuentas propias': 'tabler:transfer',
  'pago a terceros':       'tabler:users',
  'recepción':             'tabler:arrow-down-circle',
  'recepcion':             'tabler:arrow-down-circle',
}

async function main() {
  // Fix category icons
  const cats = await prisma.categoria.findMany({ where: { clienteId: null } })
  let catFixed = 0
  for (const cat of cats) {
    const icon = CAT_ICONS[cat.nombre]
    if (icon && cat.icono !== icon) {
      await prisma.categoria.update({ where: { id: cat.id }, data: { icono: icon } })
      console.log(`  cat: "${cat.nombre}" → ${icon}`)
      catFixed++
    }
  }

  // Fix subcategory icons
  const subs = await prisma.subcategoria.findMany({
    include: { categoria: { select: { clienteId: true } } },
  })
  let subFixed = 0
  for (const sub of subs) {
    if (sub.categoria.clienteId !== null) continue  // skip custom
    const key = sub.nombre.toLowerCase()
    const icon = SUB_ICONS[key]
    if (icon && sub.icono !== icon) {
      await prisma.subcategoria.update({ where: { id: sub.id }, data: { icono: icon } })
      console.log(`  sub: "${sub.nombre}" → ${icon}`)
      subFixed++
    }
  }

  console.log(`\nDone: ${catFixed} categories, ${subFixed} subcategories updated.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
