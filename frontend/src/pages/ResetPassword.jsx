import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import BrandPanel from '../components/BrandPanel'
import Input from '../components/Input'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [form, setForm]     = useState({
    identifier:       location.state?.identifier || '',
    otp:              '',
    new_password:     '',
    confirm_password: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return }
    if (form.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authAPI.resetPassword({
        identifier:   form.identifier,
        otp:          form.otp,
        new_password: form.new_password,
      })
      toast.success('Password reset successfully')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel subtitle="Create a new secure password." />
      <div className="flex flex-col justify-center px-8 py-12 lg:px-16" style={{ background: '#f7ffd6' }}>
        <div className="max-w-md w-full mx-auto">
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-2">
            Reset Password
          </h1>
          <p className="text-gray-500 text-sm mb-8">Enter the OTP sent to your email or phone</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email or Phone" placeholder="you@example.com"
              value={form.identifier}
              onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))} />
            <Input label="OTP Code" placeholder="123456" maxLength={6}
              value={form.otp}
              onChange={e => setForm(f => ({ ...f, otp: e.target.value }))} />
            <Input label="New Password" type="password" placeholder="Min 8 characters"
              value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} />
            <Input label="Confirm Password" type="password" placeholder="Repeat password"
              value={form.confirm_password}
              onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))} />
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
              style={{ background: '#106f30' }}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <Link to="/login" className="text-center text-sm font-medium" style={{ color: '#106f30' }}>
              ← Back to Login
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
