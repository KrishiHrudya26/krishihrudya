import axios from 'axios'

const portalApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

portalApi.interceptors.request.use((config) => {
  const storageType = localStorage.getItem('portal_storage_type')
  const storage     = storageType === 'session' ? sessionStorage : localStorage
  const token       = storage.getItem('portal_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

portalApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const url = error.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/') ||
      url.includes('/portal/login') ||
      url.includes('/portal/register') ||
      url.includes('/portal/verify-otp') ||
      url.includes('/portal/set-password') ||
      url.includes('/portal/forgot-password') ||
      url.includes('/portal/reset-password')

    if (error.response?.status === 401 && !isAuthEndpoint) {
      const storageType = localStorage.getItem('portal_storage_type')
      const storage     = storageType === 'session' ? sessionStorage : localStorage
      const refresh     = storage.getItem('portal_refresh_token')
      if (refresh) {
        try {
          const res = await axios.post('/api/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('portal_access_token', res.data.access_token)
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`
          return portalApi.request(error.config)
        } catch {
          localStorage.removeItem('portal_access_token')
          localStorage.removeItem('portal_refresh_token')
          localStorage.removeItem('portal_user')
          localStorage.removeItem('portal_permissions')
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const portalAuthAPI = {
  login:          (data) => portalApi.post('/portal/login', data),
  register:       (data) => portalApi.post('/portal/register', data),
  verifyOtp:      (data) => portalApi.post('/portal/verify-otp', data),
  setPassword:    (data) => portalApi.post('/portal/set-password', data),
  forgotPassword: (data) => portalApi.post('/portal/forgot-password', data),
  resetPassword:  (data) => portalApi.post('/portal/reset-password', data),
}

export default portalApi
