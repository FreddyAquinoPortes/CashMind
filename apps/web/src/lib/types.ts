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