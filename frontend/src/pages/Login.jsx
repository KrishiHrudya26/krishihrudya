
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../services/api'
import BrandPanel from '../components/BrandPanel'
import Input from '../components/Input'
import PhoneInput from '../components/PhoneInput'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  const [mode, setMode]             = useState('email')
  const [form, setForm]             = useState({ identifier: '', password: '' })
  const [errors, setErrors]         = useState({})
  const [loading, setLoading]       = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // On mount — load saved credentials if they exist
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kh_remembered')
      if (saved) {
        const { identifier, password, mode: savedMode } = JSON.parse(saved)
        if (identifier && password) {
          setForm({ identifier, password })
          setMode(savedMode || 'email')
          setRememberMe(true)
        }
      }
    } catch {}
  }, [])

  const validate = () => {
    const errs = {}
    if (!form.identifier) errs.identifier = mode === 'email' ? 'Email is required' : 'Phone is required'
    if (!form.password)   errs.password   = 'Password is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await authAPI.login({ identifier: form.identifier, password: form.password })

      // Save or clear remembered credentials
      if (rememberMe) {
        localStorage.setItem('kh_remembered', JSON.stringify({
          identifier: form.identifier,
          password:   form.password,
          mode,
        }))
      } else {
        localStorage.removeItem('kh_remembered')
      }

      login(res.data)
      toast.success(`Welcome back, ${res.data.user.full_name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleModeSwitch = (m) => {
    setMode(m)
    // Only clear identifier when switching modes if not remembered
    const saved = localStorage.getItem('kh_remembered')
    if (!saved) {
      setForm(f => ({ ...f, identifier: '' }))
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel subtitle="Sign in to manage your agricultural IoT devices." />

      <div className="flex flex-col justify-center px-8 py-12 lg:px-16" style={{ background: '#f7ffd6' }}>
        <div className="max-w-md w-full mx-auto">

          <div className="mb-8 lg:hidden">
            <img src="/logo_horizontal.png" alt="Krishi Hrudya" className="h-12" />
          </div>

          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-2">
            Welcome back
          </h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to your KrishiHrudya account</p>

          {/* Email / Phone toggle */}
          <div className="flex gap-2 mb-6 bg-white rounded-xl p-1 border border-gray-200">
            {['email', 'phone'].map(m => (
              <button key={m} type="button"
                onClick={() => handleModeSwitch(m)}
                className={'flex-1 py-2 rounded-lg text-sm font-medium transition-all ' +
                  (mode === m ? 'text-white shadow-sm' : 'text-gray-500')}
                style={mode === m ? { background: '#106f30' } : {}}>
                {m === 'email' ? '✉️  Email' : '📱 Phone'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Identifier input */}
            {mode === 'email'
              ? <Input label="Email Address" type="email" placeholder="you@example.com"
                  value={form.identifier}
                  onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                  error={errors.identifier} />
              : <PhoneInput value={form.identifier}
                  onChange={val => setForm(f => ({ ...f, identifier: val }))}
                  error={errors.identifier} />
            }

            {/* Password with show/hide */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={'w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none pr-12 transition-all ' +
                    (errors.password
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#106f30]')}
                />
                <button type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 text-sm">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setRememberMe(!rememberMe)}>
                <div className={'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ' +
                  (rememberMe ? 'border-transparent' : 'border-gray-300 bg-white')}
                  style={rememberMe ? { background: '#106f30' } : {}}>
                  {rememberMe && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-600">Remember me</span>
              </label>

              <Link to="/forgot-password"
                className="text-sm font-medium hover:underline"
                style={{ color: '#106f30' }}>
                Forgot password?
              </Link>
            </div>

            {/* Sign in */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ background: '#106f30' }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>

            {/* Create account */}
            <p className="text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium hover:underline" style={{ color: '#106f30' }}>
                Create new one
              </Link>
            </p>

          </form>
        </div>
      </div>
    </div>
  )
}
