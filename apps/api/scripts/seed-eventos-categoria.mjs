import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const existing = await prisma.categoria.findFirst({ where: { nombre: 'Eventos', clienteId: null } })
if (existing) {
  console.log('Categoría Eventos ya existe:', existing.id)
} else {
  const cat = await prisma.categoria.create({
    data: {
      nombre: 'Eventos',
      icono: 'tabler:calendar-event',
      color: '#8b5cf6',
      esEsencial: false,
      orden: 99,
      subcategorias: {
        create: [
          { nombre: 'Cumpleaños',    icono: 'tabler:cake',  color: '#ec4899' },
          { nombre: 'Días feriados', icono: 'tabler:beach', color: '#3b82f6' },
        ],
      },
    },
    include: { subcategorias: true },
  })
  console.log('Creada categoría:', cat.nombre, '— subcategorías:', cat.subcategorias.map(s => s.nombre).join(', '))
}

await prisma.$disconnect()
