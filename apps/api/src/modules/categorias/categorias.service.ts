import { prisma } from '../../shared/prisma'

export class CategoriasService {
  // ── Categorias ──────────────────────────────────────────────────────────

  async listar(clienteId: string) {
    return prisma.categoria.findMany({
      where: { OR: [{ clienteId: null }, { clienteId }] },
      include: {
        subcategorias: { orderBy: { nombre: 'asc' } },
      },
      orderBy: { orden: 'asc' },
    })
  }

  async obtener(id: string) {
    const cat = await prisma.categoria.findFirst({
      where: { id },
      include: { subcategorias: { orderBy: { nombre: 'asc' } } },
    })
    if (!cat) throw Object.assign(new Error('Categoría no encontrada'), { status: 404 })
    return cat
  }

  async crear(clienteId: string, data: {
    nombre: string
    color?: string
    icono?: string
    esEsencial?: boolean
    orden?: number
    peso?: number
  }) {
    return prisma.categoria.create({
      data: { ...data, clienteId },
      include: { subcategorias: true },
    })
  }

  async actualizar(id: string, clienteId: string, data: {
    nombre?: string
    color?: string
    icono?: string
    esEsencial?: boolean
    orden?: number
    peso?: number
  }) {
    const cat = await this.obtener(id)
    if (cat.clienteId !== null && cat.clienteId !== clienteId) {
      throw Object.assign(new Error('No autorizado para modificar esta categoría'), { status: 403 })
    }
    return prisma.categoria.update({
      where: { id },
      data,
      include: { subcategorias: true },
    })
  }

  async eliminar(id: string, clienteId: string) {
    const cat = await this.obtener(id)
    if (cat.clienteId === null) {
      throw Object.assign(new Error('No se pueden eliminar categorías del sistema'), { status: 403 })
    }
    if (cat.clienteId !== clienteId) {
      throw Object.assign(new Error('No autorizado'), { status: 403 })
    }
    return prisma.categoria.delete({ where: { id } })
  }

  // ── Subcategorias ────────────────────────────────────────────────────────

  async listarSubcategorias(categoriaId: string) {
    await this.obtener(categoriaId) // validates existence
    return prisma.subcategoria.findMany({
      where: { categoriaId },
      orderBy: { nombre: 'asc' },
    })
  }

  async obtenerSubcategoria(id: string) {
    const sub = await prisma.subcategoria.findFirst({ where: { id } })
    if (!sub) throw Object.assign(new Error('Subcategoría no encontrada'), { status: 404 })
    return sub
  }

  async crearSubcategoria(categoriaId: string, clienteId: string, data: {
    nombre: string
    color?: string
    icono?: string
    peso?: number
  }) {
    const cat = await this.obtener(categoriaId)
    // Allow adding subcategories to global categories (clienteId === null) or own categories
    if (cat.clienteId !== null && cat.clienteId !== clienteId) {
      throw Object.assign(new Error('No autorizado'), { status: 403 })
    }
    return prisma.subcategoria.create({ data: { ...data, categoriaId } })
  }

  async actualizarSubcategoria(id: string, clienteId: string, data: {
    nombre?: string
    color?: string
    icono?: string
    peso?: number
  }) {
    const sub = await this.obtenerSubcategoria(id)
    const cat = await this.obtener(sub.categoriaId)
    if (cat.clienteId !== null && cat.clienteId !== clienteId) {
      throw Object.assign(new Error('No autorizado'), { status: 403 })
    }
    return prisma.subcategoria.update({ where: { id }, data })
  }

  async eliminarSubcategoria(id: string, clienteId: string) {
    const sub = await this.obtenerSubcategoria(id)
    const cat = await this.obtener(sub.categoriaId)
    if (cat.clienteId === null) {
      throw Object.assign(new Error('No se pueden eliminar subcategorías del sistema'), { status: 403 })
    }
    if (cat.clienteId !== clienteId) {
      throw Object.assign(new Error('No autorizado'), { status: 403 })
    }
    return prisma.subcategoria.delete({ where: { id } })
  }
}