export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

export type Moneda = 'DOP' | 'USD' | 'EUR'
