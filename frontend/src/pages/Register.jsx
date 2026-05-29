import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, onboardingAPI } from '../services/api'
import BrandPanel from '../components/BrandPanel'
import Input from '../components/Input'
import toast from 'react-hot-toast'

const STEPS = ['Customer ID', 'Your Details', 'Verify OTP', 'Set Password']

const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+1',   flag: '🇺🇸', name: 'USA' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
  { code: '+82',  flag: '🇰🇷', name: 'South Korea' },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+95',  flag: '🇲🇲', name: 'Myanmar' },
  { code: '+66',  flag: '🇹🇭', name: 'Thailand' },
  { code: '+84',  flag: '🇻🇳', name: 'Vietnam' },
  { code: '+62',  flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63',  flag: '🇵🇭', name: 'Philippines' },
  { code: '+64',  flag: '🇳🇿', name: 'New Zealand' },
  { code: '+7',   flag: '🇷🇺', name: 'Russia' },
  { code: '+90',  flag: '🇹🇷', name: 'Turkey' },
  { code: '+20',  flag: '🇪🇬', name: 'Egypt' },
]

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [customerCode, setCustomerCode] = useState('')
  const [customer, setCustomer] = useState(null)
  const [hierarchy, setHierarchy] = useState({ levels: [], nodes: [] })
  const [roles, setRoles] = useState([])

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    role_id: '',
    role_hierarchy_level: null,
    hierarchy_node_id: '',
    verify_via: 'phone',
  })

  const [otp, setOtp] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Get nodes for the selected role's hierarchy level only
  const getFilteredNodes = () => {
    if (!form.role_hierarchy_level) return []
    const level = hierarchy.levels.find(l => l.level_order === form.role_hierarchy_level)
    if (!level) return []
    return hierarchy.nodes.filter(n => n.level_id === level.level_id)
  }

  const getFilteredLevel = () => {
    if (!form.role_hierarchy_level) return null
    return hierarchy.levels.find(l => l.level_order === form.role_hierarchy_level)
  }

  // Step 1 — Validate customer code
  const handleValidateCode = async (e) => {
    e.preventDefault()
    if (!customerCode.trim()) { toast.error('Enter customer code'); return }
    setLoading(true)
    try {
      const res = await onboardingAPI.validateCode(customerCode.trim())
      setCustomer(res.data)

      const hierRes = await onboardingAPI.getHierarchy(res.data.cust_id)
      setHierarchy(hierRes.data)

      const rolesRes = await fetch(`/api/onboarding/roles/${res.data.cust_id}`)
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData)
      }

      toast.success(`Found: ${res.data.cust_name}`)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid customer code')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 — Register and send OTP
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Full name is required'); return }
    if (!phoneNumber.trim()) { toast.error('Phone number is required'); return }
    if (!form.role_id) { toast.error('Please select a role'); return }

    const fullPhone = selectedCountry.code + phoneNumber.replace(/\D/g, '')
    setLoading(true)
    try {
      const res = await authAPI.register({
        customer_code:     customerCode.trim(),
        full_name:         form.full_name.trim(),
        email:             null,
        phone:             fullPhone,
        role_id:           form.role_id,
        hierarchy_node_id: form.hierarchy_node_id || null,
        verify_via:        'phone',
      })

      setIdentifier(fullPhone)
      toast.success('OTP sent to your phone')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Step 3 — Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp.trim()) { toast.error('Enter OTP'); return }
    setLoading(true)
    try {
      await authAPI.verifyOtp({ identifier, otp, purpose: 'registration' })
      toast.success('OTP verified successfully')
      setStep(4)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  // Step 4 — Set password
  const handleSetPassword = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Minimum 8 characters'); return }
    setLoading(true)
    try {
      await authAPI.setPassword({ identifier, otp, password })
      toast.success('Account created! You can now login.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to set password')
    } finally {
      setLoading(false)
    }
  }

  const filteredLevel = getFilteredLevel()
  const filteredNodes = getFilteredNodes()

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel subtitle="Create your KrishiHrudya account." />
      <div className="flex flex-col justify-center px-8 py-12 lg:px-16" style={{ background: '#f7ffd6' }}>
        <div className="max-w-md w-full mx-auto">

          <div className="mb-6 lg:hidden">
            <img src="/logo_horizontal.png" alt="KH" className="h-10" />
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step >= i + 1 ? 'text-white' : 'text-gray-400 bg-gray-200'}`}
                  style={step >= i + 1 ? { background: '#106f30' } : {}}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 ${step > i + 1 ? 'bg-[#106f30]' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
            <span className="ml-2 text-xs text-gray-500">{STEPS[step - 1]}</span>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <form onSubmit={handleValidateCode} className="flex flex-col gap-4">
              <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-1">
                Create Account
              </h1>
              <p className="text-gray-500 text-sm mb-4">Enter your Customer ID provided by KrishiHrudya</p>
              <Input label="Customer ID *" placeholder="e.g. K00I2600001"
                value={customerCode}
                onChange={e => setCustomerCode(e.target.value.toUpperCase())} />
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {loading ? 'Validating...' : 'Validate Code →'}
              </button>
              <Link to="/login" className="text-center text-sm font-medium" style={{ color: '#106f30' }}>
                Already have an account? Sign in
              </Link>
            </form>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-1">
                  Your Details
                </h1>
                <p className="text-sm text-gray-500 mb-2">
                  Registering under <span className="font-medium text-gray-700">{customer?.cust_name}</span>
                </p>
              </div>

              {/* Full Name */}
              <Input label="Full Name *" placeholder="Your full name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />

              {/* Phone with country code */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Phone Number *</label>
                <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden focus-within:border-[#106f30] transition-all">
                  <div className="relative">
                    <button type="button" onClick={() => setCountryOpen(!countryOpen)}
                      className="flex items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 border-r border-gray-200 text-sm whitespace-nowrap">
                      <span>{selectedCountry.flag}</span>
                      <span className="text-gray-600">{selectedCountry.code}</span>
                      <span className="text-gray-400">▾</span>
                    </button>
                    {countryOpen && (
                      <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 w-48">
                        {COUNTRIES.map(c => (
                          <button key={c.code} type="button"
                            onClick={() => { setSelectedCountry(c); setCountryOpen(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                            <span className="ml-auto text-gray-400">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="tel" placeholder="9876543210"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-4 py-3 text-sm bg-white focus:outline-none" />
                </div>
              </div>

              {/* Role selection */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Your Role *</label>
                <select value={form.role_id}
                  onChange={e => {
                    const selectedRole = roles.find(r => r.role_id === e.target.value)
                    setForm(f => ({
                      ...f,
                      role_id: e.target.value,
                      role_hierarchy_level: selectedRole?.hierarchy_level || null,
                      hierarchy_node_id: '',
                    }))
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30] focus:outline-none">
                  <option value="">Select role...</option>
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Hierarchy — only show matching level after role selected */}
              {form.role_id && filteredLevel && filteredNodes.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    {filteredLevel.name} *
                  </label>
                  <select value={form.hierarchy_node_id}
                    onChange={e => setForm(f => ({ ...f, hierarchy_node_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30] focus:outline-none">
                    <option value="">Select {filteredLevel.name}...</option>
                    {filteredNodes.map(n => (
                      <option key={n.node_id} value={n.node_id}>{n.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.role_id && filteredNodes.length === 0 && form.role_hierarchy_level && (
                <p className="text-xs text-gray-400 italic">No department nodes found for this role level.</p>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {loading ? 'Sending OTP...' : 'Send OTP →'}
              </button>

              <p className="text-center text-xs font-semibold text-gray-700">📞 You will receive OTP through call</p>

              <button type="button" onClick={() => setStep(1)}
                className="text-center text-sm font-medium" style={{ color: '#106f30' }}>
                ← Back
              </button>
            </form>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-1">
                Verify OTP
              </h1>
              <p className="text-gray-500 text-sm mb-4">
                Enter the OTP sent to <span className="font-medium text-gray-700">{identifier}</span>
              </p>
              <Input label="OTP Code *" placeholder="123456" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value)} />
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {loading ? 'Verifying...' : 'Verify OTP →'}
              </button>
              <button type="button" onClick={() => setStep(2)}
                className="text-center text-sm font-medium" style={{ color: '#106f30' }}>
                ← Back
              </button>
            </form>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
              <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-1">
                Set Password
              </h1>
              <p className="text-gray-500 text-sm mb-4">Choose a strong password for your account</p>
              <Input label="Password *" type="password" placeholder="Min 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} />
              <Input label="Confirm Password *" type="password" placeholder="Repeat password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {loading ? 'Creating account...' : 'Create Account ✓'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}