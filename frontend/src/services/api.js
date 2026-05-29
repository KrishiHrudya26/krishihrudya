import axios from 'axios'

const isNative = window.location.hostname === 'localhost'

const api = axios.create({
  baseURL: isNative
    ? 'https://krishihrudya.duckdns.org/api'
    : '/api',

  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post('/api/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('access_token', res.data.access_token)
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`
          return api.request(error.config)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
export const authAPI = {
  register:     (data) => api.post('/auth/register', data),
  setPassword:  (data) => api.post('/auth/set-password', data),
  login:          (data) => api.post('/auth/login', data),
  logout:         (data) => api.post('/auth/logout', data),
  refresh:        (data) => api.post('/auth/refresh', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  verifyOtp:      (data) => api.post('/auth/verify-otp', data),
  resetPassword:  (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  me:             ()     => api.get('/auth/me'),
}

export const onboardingAPI = {
  validateCode: (code)   => api.get(`/onboarding/validate-code/${code}`),
  getHierarchy: (custId) => api.get(`/onboarding/hierarchy/${custId}`),
}

export default api
