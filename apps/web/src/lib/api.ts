import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('cm_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      const refresh = localStorage.getItem('cm_refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh })
          localStorage.setItem('cm_access_token', data.data.accessToken)
          err.config.headers.Authorization = `Bearer ${data.data.accessToken}`
          return api(err.config)
        } catch {
          localStorage.removeItem('cm_access_token')
          localStorage.removeItem('cm_refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)
