
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { portalAuthAPI } from '../portalApi'
import toast from 'react-hot-toast'

const STEPS = ['Your Details', 'Verify OTP', 'Set Password']

const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India'        },
  { code: '+1',   flag: '🇺🇸', name: 'USA'          },
  { code: '+44',  flag: '🇬🇧', name: 'UK'           },
  { code: '+61',  flag: '🇦🇺', name: 'Australia'    },
  { code: '+971', flag: '🇦🇪', name: 'UAE'          },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore'    },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia'     },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan'     },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh'   },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka'    },
  { code: '+977', flag: '🇳🇵', name: 'Nepal'        },
]

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [country, setCountry]         = useState(COUNTRIES[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const [phone, setPhone]             = useState('')
  const [fullName, setFullName]       = useState('')
  const [otp, setOtp]                 = useState('')
  const [identifier, setIdentifier]   = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass]       = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!fullName.trim())    { toast.error('Full name is required');         return }
    if (!phone.trim())       { toast.error('Phone number is required');      return }
    if (phone.length !== 10) { toast.error('Enter correct phone number');    return }
    setLoading(true)
    try {
      const fullPhone = country.code + phone.replace(/\D/g, '')
      await portalAuthAPI.register({ full_name: fullName.trim(), phone: fullPhone })
      setIdentifier(fullPhone)
      toast.success('OTP sent to your phone')
      setStep(2)
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Registration failed')
    } finally { setLoading(false) }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp.trim()) { toast.error('Enter OTP'); return }
    setLoading(true)
    try {
      await portalAuthAPI.verifyOtp({ phone: identifier, otp })
      toast.success('OTP verified!')
      setStep(3)
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Invalid OTP')
    } finally { setLoading(false) }
  }

  const handleSetPassword = async (e) => {
    e.preventDefault()
    if (password !== confirmPass) { toast.error('Passwords do not match'); return }
    if (password.length < 8)      { toast.error('Minimum 8 characters');   return }
    setLoading(true)
    try {
      await portalAuthAPI.setPassword({ phone: identifier, otp, password, full_name: fullName })
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Failed to set password')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center items-center p-16"
        style={{ background: '#106f30' }}>
        <img src="/logo_vertical.png" alt="KrishiHrudya" className="h-40 mb-8" />
        <h1 style={{ fontFamily: "'DM Serif Display', serif" }}
          className="text-white text-4xl text-center leading-tight">
          Service Portal
        </h1>
        <p className="text-green-200 text-center mt-4 text-sm max-w-xs">
          Create your account to track and raise service tickets
        </p>
      </div>

      <div className="flex flex-col justify-center px-8 py-12 lg:px-16"
        style={{ background: '#f7ffd6' }}>
        <div className="max-w-md w-full mx-auto">
          <div className="mb-6 lg:hidden flex justify-center">
            <img src="/logo_horizontal.png" alt="KrishiHrudya" className="h-10" />
          </div>

          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step >= i + 1 ? 'text-white' : 'bg-gray-200 text-gray-400'}`}
                  style={step >= i + 1 ? { background: '#106f30' } : {}}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 transition-all ${step > i + 1 ? 'bg-[#106f30]' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
            <span className="ml-2 text-xs text-gray-500">{STEPS[step - 1]}</span>
          </div>

          {step === 1 && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }}
                  className="text-3xl mb-1">Create Account</h1>
                <p className="text-gray-500 text-sm">Enter your details to get started</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Full Name *</label>
                <input placeholder="Your full name" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#106f30] focus:outline-none text-sm bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Phone Number *</label>
                <div className="flex rounded-xl border-2 border-gray-200 focus-within:border-[#106f30] transition-all bg-white overflow-hidden">
                  <div className="relative">
                    <button type="button" onClick={() => setCountryOpen(o => !o)}
                      className="flex items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 border-r border-gray-200 text-sm whitespace-nowrap h-full">
                      <span>{country.flag}</span>
                      <span className="text-gray-600 text-xs">{country.code}</span>
                      <span className="text-gray-400 text-xs">▾</span>
                    </button>
                    {countryOpen && (
                      <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 w-48 max-h-48 overflow-y-auto">
                        {COUNTRIES.map(c => (
                          <button key={c.name} type="button"
                            onClick={() => { setCountry(c); setCountryOpen(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left">
                            <span>{c.flag}</span><span>{c.name}</span>
                            <span className="ml-auto text-gray-400 text-xs">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="tel" placeholder="98765 43210" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-4 py-3 text-sm bg-white focus:outline-none" />
                </div>
                <p className="text-xs font-bold text-gray-900">📞 OTP will be sent to this number via call</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {loading ? 'Sending OTP...' : 'Send OTP →'}
              </button>
              <Link to="/login" className="text-center text-sm font-medium hover:underline"
                style={{ color: '#106f30' }}>
                Already have an account? Sign in
              </Link>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }}
                  className="text-3xl mb-1">Verify OTP</h1>
                <p className="text-gray-500 text-sm">
                  OTP sent to <span className="font-medium text-gray-700">{identifier}</span>
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">OTP Code *</label>
                <input placeholder="" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#106f30] focus:outline-none text-sm bg-white text-center text-xl font-bold tracking-widest" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {loading ? 'Verifying...' : 'Verify OTP →'}
              </button>
              <button type="button" onClick={() => setStep(1)}
                className="text-center text-sm font-medium" style={{ color: '#106f30' }}>
                ← Back
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
              <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }}
                  className="text-3xl mb-1">Set Password</h1>
                <p className="text-gray-500 text-sm">Choose a strong password for your account</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#106f30] focus:outline-none text-sm pr-12 bg-white" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-3.5 text-gray-400 text-sm">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Confirm Password *</label>
                <input type="password" placeholder="Repeat password" value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#106f30] focus:outline-none text-sm bg-white" />
              </div>
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
