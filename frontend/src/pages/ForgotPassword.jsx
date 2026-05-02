
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import BrandPanel from '../components/BrandPanel'
import Input from '../components/Input'
import toast from 'react-hot-toast'

const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India'        },
  { code: '+1',   flag: '🇺🇸', name: 'USA'          },
  { code: '+44',  flag: '🇬🇧', name: 'UK'           },
  { code: '+61',  flag: '🇦🇺', name: 'Australia'    },
  { code: '+971', flag: '🇦🇪', name: 'UAE'          },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore'    },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia'     },
  { code: '+49',  flag: '🇩🇪', name: 'Germany'      },
  { code: '+33',  flag: '🇫🇷', name: 'France'       },
]

export default function ForgotPassword() {
  const navigate = useNavigate()

  const [mode, setMode]               = useState('phone')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [countryCode, setCountryCode] = useState(COUNTRIES[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const [otp, setOtp]                 = useState('')
  const [step, setStep]               = useState(1)
  const [loading, setLoading]         = useState(false)

  const identifier = mode === 'email'
    ? email
    : countryCode.code + phone.replace(/\D/g, '')

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!identifier.trim()) { toast.error('Enter your email or phone'); return }
    setLoading(true)
    try {
      await authAPI.forgotPassword({ identifier })
      toast.success('OTP sent successfully')
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp.trim()) { toast.error('Enter the OTP'); return }
    navigate('/reset-password', { state: { identifier, otp } })
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel subtitle="Reset your account password." />

      <div className="flex flex-col justify-center px-8 py-12 lg:px-16" style={{ background: '#f7ffd6' }}>
        <div className="max-w-md w-full mx-auto">

          <div className="mb-8 lg:hidden">
            <img src="/logo_horizontal.png" alt="KH" className="h-10" />
          </div>

          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-2">
            Forgot Password
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            {step === 1
              ? 'Enter your registered email or phone to receive an OTP'
              : 'Enter the OTP sent to ' + identifier}
          </p>

          {step === 1 && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">

              <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
                {['email', 'phone'].map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={'flex-1 py-2.5 text-sm font-medium transition-all ' +
                      (mode === m ? 'text-white' : 'text-gray-500 hover:bg-gray-50')}
                    style={mode === m ? { background: '#106f30' } : {}}>
                    {m === 'email' ? '📧 Email' : '📱 Phone'}
                  </button>
                ))}
              </div>

              {mode === 'email' && (
                <Input label="Email Address" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              )}

              {mode === 'phone' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Phone Number</label>
                  <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden focus-within:border-[#106f30] transition-all">
                    <div className="relative">
                      <button type="button" onClick={() => setCountryOpen(!countryOpen)}
                        className="flex items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 border-r border-gray-200 text-sm whitespace-nowrap">
                        <span>{countryCode.flag}</span>
                        <span className="text-gray-600">{countryCode.code}</span>
                        <span className="text-gray-400 text-xs">▾</span>
                      </button>
                      {countryOpen && (
                        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 w-52 max-h-52 overflow-y-auto">
                          {COUNTRIES.map(c => (
                            <button key={c.code} type="button"
                              onClick={() => { setCountryCode(c); setCountryOpen(false) }}
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
                      value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-4 py-3 text-sm bg-white focus:outline-none" />
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 mt-2"
                style={{ background: '#106f30' }}>
                {loading ? 'Sending OTP...' : 'Send OTP →'}
              </button>

              <p className="text-center text-xs font-semibold text-gray-700">📞 You will receive OTP through call</p>

              <Link to="/login" className="text-center text-sm font-medium hover:underline"
                style={{ color: '#106f30' }}>
                ← Back to Sign In
              </Link>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                OTP sent to <span className="font-medium">{identifier}</span>
              </div>

              <Input label="Enter OTP" placeholder="6-digit OTP" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                Verify OTP →
              </button>

              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setStep(1)}
                  className="text-sm font-medium hover:underline" style={{ color: '#106f30' }}>
                  ← Change contact
                </button>
                <button type="button" onClick={handleSendOtp} disabled={loading}
                  className="text-sm font-medium hover:underline text-gray-500">
                  Resend OTP
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
